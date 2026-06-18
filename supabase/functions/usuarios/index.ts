import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { corsHeaders } from '../_shared/cors.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SUPABASE_SECRET_KEY')!

function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const FRONTEND_URL =
  Deno.env.get('FRONTEND_URL') ?? 'https://acad-ia-.lci.ulsa.mx'

const CreateUsuarioSchema = z.object({
  nombre_completo: z.string().min(1, 'El nombre es requerido.'),
  email: z.string().email('Correo inválido.'),
})

const AssignRoleSchema = z
  .object({
    rol_id: z.string().uuid('Rol inválido.'),
    facultad_id: z.string().uuid('Facultad inválida.').nullable().optional(),
    carrera_id: z.string().uuid('Carrera inválida.').nullable().optional(),
  })
  .refine((data) => !(data.facultad_id && data.carrera_id), {
    message: 'El alcance debe ser por facultad o por carrera, no ambos.',
  })

const ReasignarSchema = z.object({
  destino_id: z.string().uuid('Usuario destino inválido.'),
})

// SQLSTATE personalizados que emite el RPC reasignar_responsabilidades.
const RPC_ERRCODE_STATUS: Record<string, number> = {
  P0403: 403,
  P0404: 404,
  P0409: 409,
}

type AdminClient = ReturnType<typeof getAdminClient>

function getBearerToken(req: Request) {
  return (req.headers.get('Authorization') ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim()
}

async function getCallerId(req: Request, supabase: AdminClient) {
  const token = getBearerToken(req)
  if (!token) {
    throw new HttpError(401, 'Sesión requerida.', 'UNAUTHENTICATED')
  }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    throw new HttpError(401, 'Sesión inválida.', 'UNAUTHENTICATED')
  }

  return data.user.id
}

async function hasAnyRoleAssignments(supabase: AdminClient) {
  const { count, error } = await supabase
    .from('usuarios_roles')
    .select('id', { count: 'exact', head: true })

  if (error) {
    console.log('[usuarios] role assignment count error:', error.message)
    throw new HttpError(500, error.message, 'DB_ERROR')
  }

  return (count ?? 0) > 0
}

async function requirePermission(
  req: Request,
  supabase: AdminClient,
  permiso: string,
) {
  const callerId = await getCallerId(req, supabase)

  // Bootstrap: permite crear la primera asignación/administración inicial.
  if (!(await hasAnyRoleAssignments(supabase))) return callerId

  const { data, error } = await supabase.rpc('usuario_tiene_permiso', {
    p_usuario_id: callerId,
    p_permiso: permiso,
  })

  if (error) {
    console.log('[usuarios] permission check error:', error.message)
    throw new HttpError(500, error.message, 'DB_ERROR')
  }

  if (!data) {
    throw new HttpError(
      403,
      'No tienes permisos para realizar esta acción.',
      'FORBIDDEN',
    )
  }

  return callerId
}

async function assertExternalActiveUser(supabase: AdminClient, id: string) {
  const { data, error } = await supabase
    .from('usuarios_app')
    .select('clave, externo, dado_de_baja_en')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.log('[usuarios] external profile lookup error:', error.message)
    throw new HttpError(500, error.message, 'DB_ERROR')
  }

  if (!data) {
    throw new HttpError(404, 'Usuario no encontrado.', 'NOT_FOUND')
  }

  if (!data.externo || data.clave) {
    throw new HttpError(
      403,
      'Las cuentas internas usan acceso institucional.',
      'NOT_EXTERNAL_USER',
    )
  }

  if (data.dado_de_baja_en) {
    throw new HttpError(403, 'La cuenta está dada de baja.', 'USER_DISABLED')
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  console.log('[usuarios] Incoming request:', req.method, req.url)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const parts = url.pathname.split('/').filter(Boolean)
    // parts[0] = 'usuarios', parts[1] = id?, parts[2] = action?
    const id = parts[1]
    const action = parts[2]

    const supabase = getAdminClient()
    console.log('[usuarios] Initialized admin client')

    // GET /usuarios/catalogos — roles y alcances disponibles
    if (req.method === 'GET' && id === 'catalogos') {
      console.log('[usuarios] Route matched: GET /usuarios/catalogos')
      await requirePermission(req, supabase, 'usuarios.ver')

      const [rolesRes, permisosRes, facultadesRes, carrerasRes] =
        await Promise.all([
          supabase
            .from('roles')
            .select(
              'id, clave, nombre, descripcion, nivel_jerarquico, alcance_default',
            )
            .order('nivel_jerarquico', { ascending: true }),
          supabase
            .from('permisos')
            .select('id, clave, nombre, descripcion, grupo, orden')
            .order('grupo', { ascending: true })
            .order('orden', { ascending: true }),
          supabase
            .from('facultades')
            .select('id, nombre, nombre_corto, prefijo, color, icono, activa')
            .eq('activa', true)
            .order('nombre', { ascending: true }),
          supabase
            .from('carreras')
            .select('id, facultad_id, nombre, nombre_corto, nivel, activa')
            .eq('activa', true)
            .order('nombre', { ascending: true }),
        ])

      for (const result of [
        rolesRes,
        permisosRes,
        facultadesRes,
        carrerasRes,
      ]) {
        if (result.error) {
          console.log('[usuarios] catalog lookup error:', result.error.message)
          throw new HttpError(500, result.error.message, 'DB_ERROR')
        }
      }

      return sendSuccess({
        roles: rolesRes.data ?? [],
        permisos: permisosRes.data ?? [],
        facultades: facultadesRes.data ?? [],
        carreras: carrerasRes.data ?? [],
      })
    }

    // GET /usuarios — listar
    if (req.method === 'GET' && !id) {
      console.log('[usuarios] Route matched: GET /usuarios')
      await requirePermission(req, supabase, 'usuarios.ver')

      const [
        { data: appData, error },
        { data: authData },
        { data: rolesData, error: rolesError },
      ] = await Promise.all([
        supabase
          .from('usuarios_app')
          .select(
            'id, nombre_completo, clave, externo, creado_en, actualizado_en, dado_de_baja_en',
          )
          .order('creado_en', { ascending: false }),
        supabase.auth.admin.listUsers({ perPage: 1000 }),
        supabase
          .from('usuarios_roles')
          .select(
            'id, usuario_id, rol_id, facultad_id, carrera_id, creado_en, asignado_por, roles(id, clave, nombre, descripcion, nivel_jerarquico, alcance_default), facultades(id, nombre, nombre_corto, prefijo), carreras(id, nombre, nombre_corto, facultad_id, nivel)',
          )
          .order('creado_en', { ascending: false }),
      ])

      if (error) {
        console.log('[usuarios] GET /usuarios DB error:', error.message)
        throw new HttpError(500, error.message, 'DB_ERROR')
      }
      if (rolesError) {
        console.log('[usuarios] GET /usuarios roles error:', rolesError.message)
        throw new HttpError(500, rolesError.message, 'DB_ERROR')
      }

      const confirmedIds = new Set(
        (authData?.users ?? [])
          .filter((u) => u.email_confirmed_at)
          .map((u) => u.id),
      )

      const emailByUserId = new Map(
        (authData?.users ?? []).map((u) => [u.id, u.email ?? null]),
      )

      const rolesByUserId = new Map<string, Array<unknown>>()
      for (const row of rolesData ?? []) {
        const userId = row.usuario_id as string
        const current = rolesByUserId.get(userId) ?? []
        current.push(row)
        rolesByUserId.set(userId, current)
      }

      return sendSuccess(
        (appData ?? []).map((u) => ({
          ...u,
          email: emailByUserId.get(u.id) ?? null,
          email_confirmed: confirmedIds.has(u.id),
          roles: rolesByUserId.get(u.id) ?? [],
        })),
      )
    }

    // GET /usuarios/:id/relaciones — planes (tareas de revisión) y materias
    // (responsabilidades de asignatura) en las que participa el usuario.
    if (req.method === 'GET' && id && action === 'relaciones') {
      console.log('[usuarios] Route matched: GET /usuarios/:id/relaciones', id)
      await requirePermission(req, supabase, 'usuarios.ver')

      const [planesRes, materiasRes, invitadosRes] = await Promise.all([
        supabase
          .from('tareas_revision')
          .select(
            'id, plan_estudio_id, estatus, fecha_limite, creado_en, planes_estudio(id, nombre, carreras(id, nombre, nombre_corto))',
          )
          .eq('asignado_a', id)
          .order('creado_en', { ascending: false }),
        supabase
          .from('responsables_asignatura')
          .select(
            'id, rol, creado_en, asignaturas(id, nombre, plan_estudio_id, planes_estudio(id, nombre))',
          )
          .eq('usuario_id', id)
          .order('creado_en', { ascending: false }),
        supabase
          .from('usuarios_app')
          .select('id, nombre_completo, dado_de_baja_en, creado_en')
          .eq('invitado_por', id)
          .order('creado_en', { ascending: false }),
      ])

      if (planesRes.error) {
        console.log(
          '[usuarios] relaciones planes error:',
          planesRes.error.message,
        )
        throw new HttpError(500, planesRes.error.message, 'DB_ERROR')
      }
      if (materiasRes.error) {
        console.log(
          '[usuarios] relaciones materias error:',
          materiasRes.error.message,
        )
        throw new HttpError(500, materiasRes.error.message, 'DB_ERROR')
      }
      if (invitadosRes.error) {
        console.log(
          '[usuarios] relaciones invitados error:',
          invitadosRes.error.message,
        )
        throw new HttpError(500, invitadosRes.error.message, 'DB_ERROR')
      }

      const planes = (planesRes.data ?? []).map((row) => {
        const plan =
          (
            row.planes_estudio as unknown as Array<{
              nombre: string | null
              carreras:
                | {
                    nombre: string | null
                    nombre_corto: string | null
                  }[]
                | null
            }>
          )[0] ?? null
        return {
          tarea_id: row.id,
          plan_estudio_id: row.plan_estudio_id,
          plan_nombre: plan?.nombre ?? null,
          carrera_nombre:
            plan?.carreras?.[0]?.nombre_corto ??
            plan?.carreras?.[0]?.nombre ??
            null,
          estatus: row.estatus,
          fecha_limite: row.fecha_limite,
          creado_en: row.creado_en,
        }
      })

      const materias = (materiasRes.data ?? []).map((row) => {
        const asignatura =
          (
            row.asignaturas as unknown as Array<{
              id: string
              nombre: string | null
              plan_estudio_id: string | null
              planes_estudio: { nombre: string | null } | null
            }>
          )[0] ?? null
        return {
          responsable_id: row.id,
          asignatura_id: asignatura?.id ?? null,
          asignatura_nombre: asignatura?.nombre ?? null,
          plan_estudio_id: asignatura?.plan_estudio_id ?? null,
          plan_nombre: asignatura?.planes_estudio?.nombre ?? null,
          rol: row.rol,
          creado_en: row.creado_en,
        }
      })

      const invitados = (invitadosRes.data ?? []).map((row) => ({
        id: row.id,
        nombre_completo: row.nombre_completo,
        dado_de_baja_en: row.dado_de_baja_en,
        creado_en: row.creado_en,
      }))

      return sendSuccess({ planes, materias, invitados })
    }

    // POST /usuarios/:id/reasignar — mueve roles+tareas del origen (:id) al
    // destino, da de baja al origen y registra histórico.
    if (req.method === 'POST' && id && action === 'reasignar') {
      console.log('[usuarios] Route matched: POST /usuarios/:id/reasignar', id)
      const callerId = await requirePermission(
        req,
        supabase,
        'usuarios.roles.gestionar',
      )

      let rawBody: unknown
      try {
        rawBody = await req.json()
      } catch {
        throw new HttpError(400, 'Body JSON inválido.', 'INVALID_JSON')
      }

      const parsed = ReasignarSchema.safeParse(rawBody)
      if (!parsed.success) {
        const message = parsed.error.issues.map((i) => i.message).join(' ')
        throw new HttpError(422, message, 'VALIDATION_ERROR')
      }

      const { data, error } = await supabase.rpc(
        'reasignar_responsabilidades',
        { p_origen: id, p_destino: parsed.data.destino_id, p_actor: callerId },
      )

      if (error) {
        console.log('[usuarios] reasignar error:', error.code, error.message)
        const status = RPC_ERRCODE_STATUS[error.code ?? ''] ?? 500
        throw new HttpError(
          status,
          error.message,
          status === 403 ? 'FORBIDDEN' : 'REASSIGN_ERROR',
        )
      }

      // Bloquear el acceso del origen (queda dado de baja), igual que dar-de-baja.
      const { error: banError } = await supabase.auth.admin.updateUserById(id, {
        ban_duration: '876600h',
      })
      if (banError) {
        console.log('[usuarios] reasignar ban error:', banError.message)
        throw new HttpError(500, banError.message, 'AUTH_ERROR')
      }

      return sendSuccess(data)
    }

    // POST /usuarios — crear
    if (req.method === 'POST' && !id) {
      console.log('[usuarios] Route matched: POST /usuarios')
      const callerId = await requirePermission(
        req,
        supabase,
        'usuarios.gestionar',
      )

      let rawBody: unknown
      try {
        rawBody = await req.json()
      } catch {
        throw new HttpError(400, 'Body JSON inválido.', 'INVALID_JSON')
      }

      const parsed = CreateUsuarioSchema.safeParse(rawBody)
      if (!parsed.success) {
        console.log('[usuarios] POST /usuarios validation failed')
        const message = parsed.error.issues.map((i) => i.message).join(' ')
        throw new HttpError(422, message, 'VALIDATION_ERROR')
      }

      const { nombre_completo, email } = parsed.data

      const redirectTo = FRONTEND_URL
        ? `${FRONTEND_URL}/update-password`
        : undefined

      const { data: authUser, error: authError } =
        await supabase.auth.admin.inviteUserByEmail(email, {
          redirectTo,
          data: { nombre_completo },
        })

      if (authError) {
        console.log(
          '[usuarios] inviteUserByEmail error:',
          authError.message,
          authError.code,
          authError.cause,
        )
        const isConflict = authError.message.toLowerCase().includes('already')
        throw new HttpError(
          isConflict ? 409 : 500,
          isConflict
            ? 'Ya existe un usuario con ese correo.'
            : authError.message,
          isConflict ? 'EMAIL_CONFLICT' : 'AUTH_ERROR',
        )
      }

      const { error: metadataError } = await supabase.auth.admin.updateUserById(
        authUser.user.id,
        {
          app_metadata: {
            ...(authUser.user.app_metadata ?? {}),
            user_type: 'external',
            auth_provider: 'supabase_password',
          },
        },
      )

      if (metadataError) {
        console.log(
          '[usuarios] app_metadata update error:',
          metadataError.message,
        )
        await supabase.auth.admin.deleteUser(authUser.user.id)
        throw new HttpError(500, metadataError.message, 'AUTH_ERROR')
      }

      const { data: appUser, error: insertError } = await supabase
        .from('usuarios_app')
        .insert({
          id: authUser.user.id,
          nombre_completo,
          invitado_por: callerId,
        })
        .select()
        .single()

      if (insertError) {
        console.log(
          '[usuarios] DB insert error, deleting auth user',
          insertError.message,
        )
        await supabase.auth.admin.deleteUser(authUser.user.id)
        throw new HttpError(500, insertError.message, 'DB_ERROR')
      }

      return sendSuccess(appUser, 201)
    }

    // PATCH /usuarios/:id/dar-de-baja
    if (req.method === 'PATCH' && id && action === 'dar-de-baja') {
      console.log(
        '[usuarios] Route matched: PATCH /usuarios/:id/dar-de-baja',
        id,
      )
      await requirePermission(req, supabase, 'usuarios.gestionar')

      const { data, error } = await supabase
        .from('usuarios_app')
        .update({ dado_de_baja_en: new Date().toISOString() })
        .eq('id', id)
        .is('dado_de_baja_en', null)
        .select()
        .single()

      if (error?.code === 'PGRST116' || !data) {
        console.log('[usuarios] dar-de-baja: not found or already disabled')
        throw new HttpError(
          404,
          'Usuario no encontrado o ya dado de baja.',
          'NOT_FOUND',
        )
      }
      if (error) throw new HttpError(500, error.message, 'DB_ERROR')

      const { error: banError } = await supabase.auth.admin.updateUserById(id, {
        ban_duration: '876600h',
      })
      if (banError) {
        console.log('[usuarios] ban user error:', banError.message)
        throw new HttpError(500, banError.message, 'AUTH_ERROR')
      }

      return sendSuccess(data)
    }

    // PATCH /usuarios/:id/reactivar
    if (req.method === 'PATCH' && id && action === 'reactivar') {
      console.log('[usuarios] Route matched: PATCH /usuarios/:id/reactivar', id)
      await requirePermission(req, supabase, 'usuarios.gestionar')

      const { data, error } = await supabase
        .from('usuarios_app')
        .update({ dado_de_baja_en: null })
        .eq('id', id)
        .not('dado_de_baja_en', 'is', null)
        .select()
        .single()

      if (error?.code === 'PGRST116' || !data) {
        console.log('[usuarios] reactivar: not found or already active')
        throw new HttpError(
          404,
          'Usuario no encontrado o ya activo.',
          'NOT_FOUND',
        )
      }
      if (error) throw new HttpError(500, error.message, 'DB_ERROR')

      const { error: unbanError } = await supabase.auth.admin.updateUserById(
        id,
        { ban_duration: 'none' },
      )
      if (unbanError) {
        console.log('[usuarios] unban user error:', unbanError.message)
        throw new HttpError(500, unbanError.message, 'AUTH_ERROR')
      }

      return sendSuccess(data)
    }

    // POST /usuarios/:id/reenviar-invitacion
    if (req.method === 'POST' && id && action === 'reenviar-invitacion') {
      console.log(
        '[usuarios] Route matched: POST /usuarios/:id/reenviar-invitacion',
        id,
      )
      const redirectTo = FRONTEND_URL
        ? `${FRONTEND_URL}/update-password`
        : undefined

      await requirePermission(req, supabase, 'usuarios.gestionar')
      await assertExternalActiveUser(supabase, id)

      // email lives in auth.users now, not usuarios_app
      const { data: authUser } = await supabase.auth.admin.getUserById(id)

      if (!authUser?.user) {
        throw new HttpError(404, 'Usuario no encontrado.', 'NOT_FOUND')
      }

      const userEmail = authUser.user.email
      if (!userEmail) {
        throw new HttpError(
          422,
          'El usuario no tiene correo electrónico.',
          'NO_EMAIL',
        )
      }

      const isConfirmed = !!authUser.user.email_confirmed_at

      if (isConfirmed) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          userEmail,
          { redirectTo },
        )
        if (resetError) {
          console.log('[usuarios] reset password error:', resetError.message)
          throw new HttpError(500, resetError.message, 'AUTH_ERROR')
        }
        return sendSuccess({ message: 'Correo de restablecimiento enviado.' })
      }

      const { error: resendError } =
        await supabase.auth.admin.inviteUserByEmail(userEmail, { redirectTo })

      if (resendError) {
        console.log('[usuarios] resend invite error:', resendError.message)
        throw new HttpError(500, resendError.message, 'AUTH_ERROR')
      }

      return sendSuccess({ message: 'Invitación reenviada.' })
    }

    // POST /usuarios/:id/roles — asignar rol
    if (req.method === 'POST' && id && action === 'roles') {
      console.log('[usuarios] Route matched: POST /usuarios/:id/roles', id)
      const callerId = await requirePermission(
        req,
        supabase,
        'usuarios.roles.gestionar',
      )

      let rawBody: unknown
      try {
        rawBody = await req.json()
      } catch {
        throw new HttpError(400, 'Body JSON inválido.', 'INVALID_JSON')
      }

      const parsed = AssignRoleSchema.safeParse(rawBody)
      if (!parsed.success) {
        const message = parsed.error.issues.map((i) => i.message).join(' ')
        throw new HttpError(422, message, 'VALIDATION_ERROR')
      }

      const { rol_id, facultad_id = null, carrera_id = null } = parsed.data
      const { data, error } = await supabase
        .from('usuarios_roles')
        .insert({
          usuario_id: id,
          rol_id,
          facultad_id,
          carrera_id,
          asignado_por: callerId,
        })
        .select(
          'id, usuario_id, rol_id, facultad_id, carrera_id, creado_en, asignado_por, roles(id, clave, nombre, descripcion, nivel_jerarquico, alcance_default), facultades(id, nombre, nombre_corto, prefijo), carreras(id, nombre, nombre_corto, facultad_id, nivel)',
        )
        .single()

      if (error) {
        const isConflict = error.code === '23505'
        throw new HttpError(
          isConflict ? 409 : 500,
          isConflict
            ? 'El usuario ya tiene ese rol con ese alcance.'
            : error.message,
          isConflict ? 'ROLE_ASSIGNMENT_CONFLICT' : 'DB_ERROR',
        )
      }

      return sendSuccess(data, 201)
    }

    // DELETE /usuarios/:id/roles/:asignacionId — retirar rol
    if (req.method === 'DELETE' && id && action === 'roles' && parts[3]) {
      const asignacionId = parts[3]
      console.log(
        '[usuarios] Route matched: DELETE /usuarios/:id/roles/:asignacionId',
        id,
        asignacionId,
      )
      await requirePermission(req, supabase, 'usuarios.roles.gestionar')

      const { data, error } = await supabase
        .from('usuarios_roles')
        .delete()
        .eq('id', asignacionId)
        .eq('usuario_id', id)
        .select('id')
        .maybeSingle()

      if (error) throw new HttpError(500, error.message, 'DB_ERROR')
      if (!data) {
        throw new HttpError(
          404,
          'Asignación de rol no encontrada.',
          'NOT_FOUND',
        )
      }

      return sendSuccess({ id: asignacionId })
    }

    throw new HttpError(404, 'Ruta no encontrada.', 'NOT_FOUND')
  } catch (error) {
    if (error instanceof HttpError) {
      console.error(
        `[usuarios] ${error.status} ${error.code}: ${error.message}`,
      )
      return sendError(error.status, error.message, error.code)
    }
    console.error('[usuarios] Critical error:', error)
    return sendError(
      500,
      'Error inesperado en el servidor.',
      'INTERNAL_SERVER_ERROR',
    )
  }
})
