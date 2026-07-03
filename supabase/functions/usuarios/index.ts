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
    // Cuando es true, ejecuta el "nombramiento": retira al titular previo del
    // mismo rol+alcance y asigna al nuevo de forma atómica (ver RPC).
    reemplazar: z.boolean().optional(),
  })
  .refine((data) => !(data.facultad_id && data.carrera_id), {
    message: 'El alcance debe ser por facultad o por carrera, no ambos.',
  })

// Embed compartido para devolver la asignación con su rol/facultad/carrera.
const ROLE_EMBED_SELECT =
  'id, usuario_id, rol_id, facultad_id, carrera_id, creado_en, asignado_por, roles(id, clave, nombre, descripcion, nivel_jerarquico, alcance_default), facultades(id, nombre, nombre_corto, prefijo), carreras(id, nombre, nombre_corto, facultad_id, nivel)'

const ReasignarSchema = z.object({
  destino_id: z.string().uuid('Usuario destino inválido.'),
})

const ResponsableRolSchema = z.enum([
  'PROFESOR_RESPONSABLE',
  'COAUTOR',
  'REVISOR',
])

const SimulacionRolSchema = z.object({
  rol_id: z.string().uuid('Rol inválido.'),
  facultad_id: z.string().uuid('Facultad inválida.').nullable().optional(),
  carrera_id: z.string().uuid('Carrera inválida.').nullable().optional(),
  plan_estudio_id: z.string().uuid('Plan inválido.').nullable().optional(),
  asignatura_id: z.string().uuid('Asignatura inválida.').nullable().optional(),
  responsable_rol: ResponsableRolSchema.optional(),
})

// SQLSTATE personalizados que emite el RPC reasignar_responsabilidades.
const RPC_ERRCODE_STATUS: Record<string, number> = {
  P0403: 403,
  P0404: 404,
  P0409: 409,
}

// Los embeds de PostgREST pueden venir como objeto (to-one) o como arreglo
// según el cliente; normalizamos al primer elemento.
function firstEmbed<T>(value: unknown): T | null {
  return (
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
  ) as T | null
}

function formatFacultadNombre(
  facultad:
    | { nombre?: string | null; nombre_corto?: string | null; prefijo?: string | null }
    | null
    | undefined,
) {
  if (!facultad) return null
  const nombre = facultad.nombre?.trim() || facultad.nombre_corto?.trim()
  if (!nombre) return null
  const prefijo = facultad.prefijo?.trim()
  return prefijo ? `Facultad ${prefijo} de ${nombre}` : `Facultad de ${nombre}`
}

function formatCarreraNombre(
  carrera:
    | { nombre?: string | null; nombre_corto?: string | null; nivel?: string | null }
    | null
    | undefined,
) {
  if (!carrera) return null
  const nombre = carrera.nombre?.trim() || carrera.nombre_corto?.trim()
  if (!nombre) return null
  const nivel = carrera.nivel?.trim()
  if (!nivel || nivel.toLowerCase() === 'otro') return nombre
  return `${nivel} en ${nombre}`
}

function formatPlanNombre(
  plan:
    | {
        nombre?: string | null
        nombre_propuesto?: string | null
        nombre_display?: string | null
      }
    | null
    | undefined,
) {
  return (
    plan?.nombre_display?.trim() ||
    plan?.nombre_propuesto?.trim() ||
    plan?.nombre?.trim() ||
    null
  )
}

type AdminClient = ReturnType<typeof getAdminClient>

type GestionUsuarioFlags = {
  puede_dar_baja: boolean
  puede_reactivar: boolean
  puede_reenviar_invitacion: boolean
  puede_asignar_roles: boolean
  puede_reasignar: boolean
  puede_gestionar_materias: boolean
}

type CatalogRole = {
  id: string
  clave: string
  alcance_default: 'global' | 'facultad' | 'carrera' | 'asignatura' | 'externo'
}

type CatalogFacultad = {
  id: string
}

type CatalogCarrera = {
  id: string
  facultad_id: string
  nivel: string | null
}

const EMPTY_GESTION_USUARIO: GestionUsuarioFlags = {
  puede_dar_baja: false,
  puede_reactivar: false,
  puede_reenviar_invitacion: false,
  puede_asignar_roles: false,
  puede_reasignar: false,
  puede_gestionar_materias: false,
}

function isNivelPosgrado(nivel: string | null | undefined) {
  const normalized = (nivel ?? '')
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
  return (
    normalized === 'maestria' ||
    normalized === 'doctorado' ||
    normalized === 'especialidad'
  )
}

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

async function callerHasPermission(
  supabase: AdminClient,
  callerId: string,
  permiso: string,
) {
  if (!(await hasAnyRoleAssignments(supabase))) return true

  const { data, error } = await supabase.rpc('usuario_tiene_permiso', {
    p_usuario_id: callerId,
    p_permiso: permiso,
  })

  if (error) {
    console.log('[usuarios] permission lookup error:', error.message)
    throw new HttpError(500, error.message, 'DB_ERROR')
  }

  return !!data
}

async function canManageUser(
  supabase: AdminClient,
  actorId: string,
  usuarioId: string,
  bootstrapMode = false,
) {
  if (bootstrapMode) return true

  const { data, error } = await supabase.rpc(
    'usuario_puede_gestionar_usuario',
    {
      p_actor: actorId,
      p_usuario: usuarioId,
    },
  )

  if (error) {
    console.log('[usuarios] user management check error:', error.message)
    throw new HttpError(500, error.message, 'DB_ERROR')
  }

  return !!data
}

async function canManageRole(
  supabase: AdminClient,
  actorId: string,
  rolId: string,
  facultadId: string | null = null,
  carreraId: string | null = null,
  bootstrapMode = false,
) {
  if (bootstrapMode) return true

  const { data, error } = await supabase.rpc('usuario_puede_gestionar_rol', {
    p_actor: actorId,
    p_rol: rolId,
    p_facultad: facultadId,
    p_carrera: carreraId,
  })

  if (error) {
    console.log('[usuarios] role management check error:', error.message)
    throw new HttpError(500, error.message, 'DB_ERROR')
  }

  return !!data
}

async function assertCanManageUser(
  supabase: AdminClient,
  actorId: string,
  usuarioId: string,
) {
  const bootstrapMode = !(await hasAnyRoleAssignments(supabase))
  if (await canManageUser(supabase, actorId, usuarioId, bootstrapMode)) return

  throw new HttpError(
    403,
    'No tienes permisos para gestionar a este usuario.',
    'FORBIDDEN',
  )
}

async function assertCanManageRole(
  supabase: AdminClient,
  actorId: string,
  rolId: string,
  facultadId: string | null = null,
  carreraId: string | null = null,
) {
  const bootstrapMode = !(await hasAnyRoleAssignments(supabase))
  if (
    await canManageRole(
      supabase,
      actorId,
      rolId,
      facultadId,
      carreraId,
      bootstrapMode,
    )
  ) {
    return
  }

  throw new HttpError(
    403,
    'No tienes permisos para gestionar ese rol en ese alcance.',
    'FORBIDDEN',
  )
}

async function buildCatalogGestion(
  supabase: AdminClient,
  actorId: string,
  roles: Array<CatalogRole>,
  facultades: Array<CatalogFacultad>,
  carreras: Array<CatalogCarrera>,
) {
  const bootstrapMode = !(await hasAnyRoleAssignments(supabase))
  const rolesAsignables = new Set<string>()
  const facultadesGestionables = new Set<string>()
  const carrerasGestionables = new Set<string>()

  for (const rol of roles) {
    if (rol.alcance_default === 'global') {
      if (await canManageRole(supabase, actorId, rol.id, null, null, bootstrapMode)) {
        rolesAsignables.add(rol.id)
      }
      continue
    }

    if (rol.alcance_default === 'facultad') {
      for (const facultad of facultades) {
        if (
          await canManageRole(
            supabase,
            actorId,
            rol.id,
            facultad.id,
            null,
            bootstrapMode,
          )
        ) {
          rolesAsignables.add(rol.id)
          facultadesGestionables.add(facultad.id)
        }
      }
      continue
    }

    if (rol.alcance_default === 'carrera') {
      for (const carrera of carreras) {
        if (
          await canManageRole(
            supabase,
            actorId,
            rol.id,
            null,
            carrera.id,
            bootstrapMode,
          )
        ) {
          rolesAsignables.add(rol.id)
          carrerasGestionables.add(carrera.id)
          facultadesGestionables.add(carrera.facultad_id)
        }
      }
    }
  }

  const { data: actorRoles, error } = await supabase
    .from('usuarios_roles')
    .select(
      'facultad_id, carrera_id, roles(id, clave, alcance_default)',
    )
    .eq('usuario_id', actorId)

  if (error) {
    console.log('[usuarios] actor roles lookup error:', error.message)
    throw new HttpError(500, error.message, 'DB_ERROR')
  }

  const facultadesPropias = new Set<string>()
  const carrerasPropias = new Set<string>()
  const jefePosgradoFacultades = new Set<string>()

  for (const row of actorRoles ?? []) {
    const rol = firstEmbed<{
      clave: string | null
      alcance_default: string | null
    }>(row.roles)
    const facultadId = (row.facultad_id as string | null) ?? null
    const carreraId = (row.carrera_id as string | null) ?? null

    if (facultadId) facultadesPropias.add(facultadId)
    if (carreraId) carrerasPropias.add(carreraId)
    if (rol?.clave === 'JEFE_POSGRADO' && facultadId) {
      jefePosgradoFacultades.add(facultadId)
    }
  }

  const carrerasPosgradoGestionables = carreras
    .filter(
      (carrera) =>
        isNivelPosgrado(carrera.nivel) &&
        (facultadesGestionables.has(carrera.facultad_id) ||
          carrerasGestionables.has(carrera.id) ||
          jefePosgradoFacultades.has(carrera.facultad_id)),
    )
    .map((carrera) => carrera.id)

  return {
    roles_asignables: Array.from(rolesAsignables),
    facultades_gestionables: Array.from(facultadesGestionables),
    carreras_gestionables: Array.from(carrerasGestionables),
    carreras_posgrado_gestionables: carrerasPosgradoGestionables,
    facultades_propias: Array.from(facultadesPropias),
    carreras_propias: Array.from(carrerasPropias),
    puede_crear_usuarios: await callerHasPermission(
      supabase,
      actorId,
      'usuarios.gestionar',
    ),
    puede_gestionar_roles: rolesAsignables.size > 0,
  }
}

async function requireRealAdmin(req: Request, supabase: AdminClient) {
  const callerId = await getCallerId(req, supabase)

  const { data: profile, error: profileError } = await supabase
    .from('usuarios_app')
    .select('dado_de_baja_en')
    .eq('id', callerId)
    .maybeSingle()

  if (profileError) {
    console.log('[usuarios] real admin profile error:', profileError.message)
    throw new HttpError(500, profileError.message, 'DB_ERROR')
  }

  if (!profile || profile.dado_de_baja_en) {
    throw new HttpError(403, 'La cuenta no está activa.', 'FORBIDDEN')
  }

  const { data, error } = await supabase
    .from('usuarios_roles')
    .select('id, roles!inner(clave)')
    .eq('usuario_id', callerId)
    .eq('roles.clave', 'ADMIN')
    .limit(1)

  if (error) {
    console.log('[usuarios] real admin role error:', error.message)
    throw new HttpError(500, error.message, 'DB_ERROR')
  }

  if (!data || data.length === 0) {
    throw new HttpError(
      403,
      'Solo un administrador puede usar la simulación de roles.',
      'FORBIDDEN',
    )
  }

  return callerId
}

async function getAuthAppMetadata(supabase: AdminClient, userId: string) {
  const { data, error } = await supabase.auth.admin.getUserById(userId)

  if (error || !data.user) {
    console.log('[usuarios] auth user lookup error:', error?.message)
    throw new HttpError(
      error?.status ?? 500,
      error?.message ?? 'Usuario auth no encontrado.',
      'AUTH_ERROR',
    )
  }

  return data.user.app_metadata ?? {}
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

    // Endpoints de simulación de rol. Se autorizan contra el ADMIN real en BD,
    // no contra los claims actuales, para poder cambiar/desactivar aun cuando
    // el token ya está simulando un rol sin permisos administrativos.
    if (id === 'simulacion') {
      const callerId = await requireRealAdmin(req, supabase)

      if (req.method === 'GET' && action === 'asignaturas') {
        console.log(
          '[usuarios] Route matched: GET /usuarios/simulacion/asignaturas',
        )
        const q = (url.searchParams.get('q') ?? '').trim()
        const limit = Math.max(
          1,
          Math.min(Number(url.searchParams.get('limit') ?? 20) || 20, 50),
        )

        let query = supabase
          .from('asignaturas')
          .select(
            'id, nombre, codigo, plan_estudio_id, planes_estudio(id, nombre, nombre_propuesto, nombre_display, carrera_id, carreras(id, nombre, nombre_corto, nivel, facultad_id, facultades(id, nombre, nombre_corto, prefijo)))',
          )
          .order('nombre', { ascending: true })
          .limit(limit)

        if (q) {
          query = query.ilike('nombre', `%${q.replace(/[%_]/g, '')}%`)
        }

        const { data, error } = await query

        if (error) {
          console.log('[usuarios] simulation subjects error:', error.message)
          throw new HttpError(500, error.message, 'DB_ERROR')
        }

        return sendSuccess(
          (data ?? []).map((row) => {
            const plan = firstEmbed<{
              id: string
              nombre: string | null
              nombre_propuesto: string | null
              nombre_display: string | null
              carrera_id: string | null
              carreras: unknown
            }>(row.planes_estudio)
            const carrera = firstEmbed<{
              id: string
              nombre: string | null
              nombre_corto: string | null
              nivel: string | null
              facultad_id: string | null
              facultades: unknown
            }>(plan?.carreras)
            const facultad = firstEmbed<{
              id: string
              nombre: string | null
              nombre_corto: string | null
              prefijo: string | null
            }>(carrera?.facultades)

            return {
              id: row.id,
              nombre: row.nombre,
              codigo: row.codigo,
              plan_estudio_id: plan?.id ?? row.plan_estudio_id ?? null,
              plan_nombre: formatPlanNombre(plan),
              carrera_id: carrera?.id ?? plan?.carrera_id ?? null,
              carrera_nombre: formatCarreraNombre(carrera),
              facultad_id: facultad?.id ?? carrera?.facultad_id ?? null,
              facultad_nombre: formatFacultadNombre(facultad),
            }
          }),
        )
      }

      if (req.method === 'DELETE' && !action) {
        console.log('[usuarios] Route matched: DELETE /usuarios/simulacion')
        const currentMetadata = await getAuthAppMetadata(supabase, callerId)

        const { error } = await supabase.auth.admin.updateUserById(callerId, {
          app_metadata: {
            ...currentMetadata,
            authz_simulacion: {
              activa: false,
              desactivada_en: new Date().toISOString(),
            },
          },
        })

        if (error) {
          console.log('[usuarios] simulation disable error:', error.message)
          throw new HttpError(500, error.message, 'AUTH_ERROR')
        }

        return sendSuccess({ activa: false })
      }

      if (req.method === 'POST' && !action) {
        console.log('[usuarios] Route matched: POST /usuarios/simulacion')

        let rawBody: unknown
        try {
          rawBody = await req.json()
        } catch {
          throw new HttpError(400, 'Body JSON inválido.', 'INVALID_JSON')
        }

        const parsed = SimulacionRolSchema.safeParse(rawBody)
        if (!parsed.success) {
          const message = parsed.error.issues.map((i) => i.message).join(' ')
          throw new HttpError(422, message, 'VALIDATION_ERROR')
        }

        const { data: rol, error: roleError } = await supabase
          .from('roles')
          .select('id, clave, nombre, alcance_default')
          .eq('id', parsed.data.rol_id)
          .single()

        if (roleError || !rol) {
          console.log('[usuarios] simulation role error:', roleError?.message)
          throw new HttpError(404, 'Rol no encontrado.', 'NOT_FOUND')
        }

        if (rol.clave === 'ADMIN') {
          throw new HttpError(
            422,
            'Para volver a administrador, desactiva la simulación.',
            'VALIDATION_ERROR',
          )
        }

        let facultadId = parsed.data.facultad_id ?? null
        let carreraId = parsed.data.carrera_id ?? null
        let planId = parsed.data.plan_estudio_id ?? null
        const asignaturaId = parsed.data.asignatura_id ?? null

        let facultadNombre: string | null = null
        let carreraNombre: string | null = null
        let planNombre: string | null = null
        let asignaturaNombre: string | null = null

        if (asignaturaId) {
          const { data: asignatura, error: asignaturaError } = await supabase
            .from('asignaturas')
            .select(
              'id, nombre, plan_estudio_id, planes_estudio(id, nombre, nombre_propuesto, nombre_display, carrera_id, carreras(id, nombre, nombre_corto, nivel, facultad_id, facultades(id, nombre, nombre_corto, prefijo)))',
            )
            .eq('id', asignaturaId)
            .single()

          if (asignaturaError || !asignatura) {
            console.log(
              '[usuarios] simulation subject error:',
              asignaturaError?.message,
            )
            throw new HttpError(404, 'Asignatura no encontrada.', 'NOT_FOUND')
          }

          const plan = firstEmbed<{
            id: string
            nombre: string | null
            nombre_propuesto: string | null
            nombre_display: string | null
            carrera_id: string | null
            carreras: unknown
          }>(asignatura.planes_estudio)
          const carrera = firstEmbed<{
            id: string
            nombre: string | null
            nombre_corto: string | null
            nivel: string | null
            facultad_id: string | null
            facultades: unknown
          }>(plan?.carreras)
          const facultad = firstEmbed<{
            id: string
            nombre: string | null
            nombre_corto: string | null
            prefijo: string | null
          }>(carrera?.facultades)

          asignaturaNombre = asignatura.nombre ?? null
          planId = plan?.id ?? asignatura.plan_estudio_id ?? planId
          planNombre = formatPlanNombre(plan)
          carreraId = carrera?.id ?? plan?.carrera_id ?? carreraId
          carreraNombre = formatCarreraNombre(carrera)
          facultadId = facultad?.id ?? carrera?.facultad_id ?? facultadId
          facultadNombre = formatFacultadNombre(facultad)
        }

        if (planId && (!carreraId || !facultadId || !planNombre)) {
          const { data: plan, error: planError } = await supabase
            .from('planes_estudio')
            .select(
              'id, nombre, nombre_propuesto, nombre_display, carrera_id, carreras(id, nombre, nombre_corto, nivel, facultad_id, facultades(id, nombre, nombre_corto, prefijo))',
            )
            .eq('id', planId)
            .single()

          if (planError || !plan) {
            console.log('[usuarios] simulation plan error:', planError?.message)
            throw new HttpError(404, 'Plan no encontrado.', 'NOT_FOUND')
          }

          const carrera = firstEmbed<{
            id: string
            nombre: string | null
            nombre_corto: string | null
            nivel: string | null
            facultad_id: string | null
            facultades: unknown
          }>(plan.carreras)
          const facultad = firstEmbed<{
            id: string
            nombre: string | null
            nombre_corto: string | null
            prefijo: string | null
          }>(carrera?.facultades)

          planNombre = formatPlanNombre(plan) ?? planNombre
          carreraId = carrera?.id ?? plan.carrera_id ?? carreraId
          carreraNombre = formatCarreraNombre(carrera) ?? carreraNombre
          facultadId = facultad?.id ?? carrera?.facultad_id ?? facultadId
          facultadNombre = formatFacultadNombre(facultad) ?? facultadNombre
        }

        if (carreraId && (!facultadId || !carreraNombre)) {
          const { data: carrera, error: carreraError } = await supabase
            .from('carreras')
            .select('id, nombre, nombre_corto, nivel, facultad_id, facultades(id, nombre, nombre_corto, prefijo)')
            .eq('id', carreraId)
            .single()

          if (carreraError || !carrera) {
            console.log(
              '[usuarios] simulation carrera error:',
              carreraError?.message,
            )
            throw new HttpError(404, 'Carrera no encontrada.', 'NOT_FOUND')
          }

          const facultad = firstEmbed<{
            id: string
            nombre: string | null
            nombre_corto: string | null
            prefijo: string | null
          }>(carrera.facultades)

          carreraNombre = formatCarreraNombre(carrera) ?? carreraNombre
          facultadId = facultad?.id ?? carrera.facultad_id ?? facultadId
          facultadNombre = formatFacultadNombre(facultad) ?? facultadNombre
        }

        if (facultadId && !facultadNombre) {
          const { data: facultad, error: facultadError } = await supabase
            .from('facultades')
            .select('id, nombre, nombre_corto, prefijo')
            .eq('id', facultadId)
            .single()

          if (facultadError || !facultad) {
            console.log(
              '[usuarios] simulation facultad error:',
              facultadError?.message,
            )
            throw new HttpError(404, 'Facultad no encontrada.', 'NOT_FOUND')
          }

          facultadNombre = formatFacultadNombre(facultad)
        }

        if (rol.alcance_default === 'facultad' && !facultadId) {
          throw new HttpError(
            422,
            'Selecciona una facultad para ese rol.',
            'VALIDATION_ERROR',
          )
        }

        if (rol.alcance_default === 'carrera' && !carreraId) {
          throw new HttpError(
            422,
            'Selecciona una carrera para ese rol.',
            'VALIDATION_ERROR',
          )
        }

        if (rol.alcance_default === 'asignatura' && !asignaturaId) {
          throw new HttpError(
            422,
            'Selecciona una asignatura para ese rol.',
            'VALIDATION_ERROR',
          )
        }

        if (rol.alcance_default === 'externo' && !planId) {
          throw new HttpError(
            422,
            'Selecciona una asignatura o plan para ese rol.',
            'VALIDATION_ERROR',
          )
        }

        const simulacion = {
          activa: true,
          rol_id: rol.id,
          rol_clave: rol.clave,
          rol_nombre: rol.nombre,
          alcance_default: rol.alcance_default,
          facultad_id: facultadId,
          facultad_nombre: facultadNombre,
          carrera_id: carreraId,
          carrera_nombre: carreraNombre,
          plan_estudio_id: planId,
          plan_nombre: planNombre,
          asignatura_id: asignaturaId,
          asignatura_nombre: asignaturaNombre,
          responsable_rol:
            rol.clave === 'PROFESOR'
              ? (parsed.data.responsable_rol ?? 'PROFESOR_RESPONSABLE')
              : undefined,
          activada_en: new Date().toISOString(),
        }

        const currentMetadata = await getAuthAppMetadata(supabase, callerId)
        const { error: updateError } =
          await supabase.auth.admin.updateUserById(callerId, {
            app_metadata: {
              ...currentMetadata,
              authz_simulacion: simulacion,
            },
          })

        if (updateError) {
          console.log('[usuarios] simulation enable error:', updateError.message)
          throw new HttpError(500, updateError.message, 'AUTH_ERROR')
        }

        return sendSuccess(simulacion)
      }

      throw new HttpError(404, 'Ruta no encontrada.', 'NOT_FOUND')
    }

    // GET /usuarios/catalogos — roles y alcances disponibles
    if (req.method === 'GET' && id === 'catalogos') {
      console.log('[usuarios] Route matched: GET /usuarios/catalogos')
      const callerId = await requirePermission(req, supabase, 'usuarios.ver')

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

      const roles = (rolesRes.data ?? []) as Array<CatalogRole>
      const facultades = (facultadesRes.data ?? []) as Array<CatalogFacultad>
      const carreras = (carrerasRes.data ?? []) as Array<CatalogCarrera>

      return sendSuccess({
        roles,
        permisos: permisosRes.data ?? [],
        facultades,
        carreras,
        gestion: await buildCatalogGestion(
          supabase,
          callerId,
          roles,
          facultades,
          carreras,
        ),
      })
    }

    // GET /usuarios — listar
    if (req.method === 'GET' && !id) {
      console.log('[usuarios] Route matched: GET /usuarios')
      const callerId = await requirePermission(req, supabase, 'usuarios.ver')

      const [
        { data: appData, error },
        { data: authData },
        { data: rolesData, error: rolesError },
        { data: materiasData, error: materiasError },
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
        supabase
          .from('responsables_asignatura')
          .select(
            'id, usuario_id, rol, asignaturas(id, nombre, planes_estudio(id, carrera_id, carreras(id, nombre, nombre_corto, facultad_id)))',
          ),
      ])

      if (error) {
        console.log('[usuarios] GET /usuarios DB error:', error.message)
        throw new HttpError(500, error.message, 'DB_ERROR')
      }
      if (rolesError) {
        console.log('[usuarios] GET /usuarios roles error:', rolesError.message)
        throw new HttpError(500, rolesError.message, 'DB_ERROR')
      }
      if (materiasError) {
        console.log(
          '[usuarios] GET /usuarios materias error:',
          materiasError.message,
        )
        throw new HttpError(500, materiasError.message, 'DB_ERROR')
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

      const materiasByUserId = new Map<string, Array<unknown>>()
      for (const row of materiasData ?? []) {
        const userId = row.usuario_id as string
        const asignatura = firstEmbed<{
          id: string
          nombre: string | null
          planes_estudio: unknown
        }>(row.asignaturas)
        const plan = firstEmbed<{
          id: string
          carrera_id: string | null
          carreras: unknown
        }>(asignatura?.planes_estudio)
        const carrera = firstEmbed<{
          id: string
          nombre: string | null
          nombre_corto: string | null
          facultad_id: string | null
        }>(plan?.carreras)
        const current = materiasByUserId.get(userId) ?? []
        current.push({
          responsable_id: row.id,
          rol: row.rol,
          asignatura_id: asignatura?.id ?? null,
          asignatura_nombre: asignatura?.nombre ?? null,
          plan_estudio_id: plan?.id ?? null,
          carrera_id: carrera?.id ?? plan?.carrera_id ?? null,
          carrera_nombre: carrera?.nombre_corto ?? carrera?.nombre ?? null,
          facultad_id: carrera?.facultad_id ?? null,
        })
        materiasByUserId.set(userId, current)
      }

      const canAssignAnyRole = await callerHasPermission(
        supabase,
        callerId,
        'usuarios.roles.gestionar',
      )
      const canManageMaterias = await callerHasPermission(
        supabase,
        callerId,
        'asignaturas.responsables.gestionar',
      )
      const bootstrapMode = !(await hasAnyRoleAssignments(supabase))
      const gestionByUserId = new Map<string, GestionUsuarioFlags>()
      await Promise.all(
        (appData ?? []).map(async (u) => {
          const manageable = await canManageUser(
            supabase,
            callerId,
            u.id,
            bootstrapMode,
          )
          const isDisabled = !!u.dado_de_baja_en
          const flags = manageable
            ? {
                puede_dar_baja: !isDisabled,
                puede_reactivar: isDisabled,
                puede_reenviar_invitacion: !isDisabled && !!u.externo,
                puede_asignar_roles: !isDisabled && canAssignAnyRole,
                puede_reasignar: !isDisabled,
                puede_gestionar_materias: !isDisabled && canManageMaterias,
              }
            : EMPTY_GESTION_USUARIO
          gestionByUserId.set(u.id, flags)
        }),
      )

      return sendSuccess(
        (appData ?? []).map((u) => ({
          ...u,
          email: emailByUserId.get(u.id) ?? null,
          email_confirmed: confirmedIds.has(u.id),
          roles: rolesByUserId.get(u.id) ?? [],
          materias: materiasByUserId.get(u.id) ?? [],
          gestion: gestionByUserId.get(u.id) ?? EMPTY_GESTION_USUARIO,
        })),
      )
    }

    // GET /usuarios/:id/relaciones — planes (tareas de revisión) y materias
    // (responsabilidades de asignatura) en las que participa el usuario.
    if (req.method === 'GET' && id && action === 'relaciones') {
      console.log('[usuarios] Route matched: GET /usuarios/:id/relaciones', id)
      await requirePermission(req, supabase, 'usuarios.ver')

      const [
        tareasRes,
        materiasRes,
        invitadosRes,
        jefeRolesRes,
        jefePosgradoRolesRes,
      ] =
        await Promise.all([
          supabase
            .from('tareas_revision')
            .select(
              'id, plan_estudio_id, estatus, estado_id, fecha_limite, creado_en, planes_estudio(id, nombre, nombre_propuesto, nombre_display, estado_actual_id, carreras(id, nombre, nombre_corto))',
            )
            .eq('asignado_a', id)
            .order('creado_en', { ascending: false }),
          supabase
            .from('responsables_asignatura')
            .select(
              'id, rol, creado_en, asignaturas(id, nombre, plan_estudio_id, planes_estudio(id, nombre, nombre_propuesto, nombre_display))',
            )
            .eq('usuario_id', id)
            .order('creado_en', { ascending: false }),
          supabase
            .from('usuarios_app')
            .select('id, nombre_completo, dado_de_baja_en, creado_en')
            .eq('invitado_por', id)
            .order('creado_en', { ascending: false }),
          supabase
            .from('usuarios_roles')
            .select('carrera_id, roles!inner(clave)')
            .eq('usuario_id', id)
            .eq('roles.clave', 'JEFE_CARRERA'),
          supabase
            .from('usuarios_roles')
            .select('facultad_id, roles!inner(clave)')
            .eq('usuario_id', id)
            .eq('roles.clave', 'JEFE_POSGRADO'),
        ])

      for (const res of [
        tareasRes,
        materiasRes,
        invitadosRes,
        jefeRolesRes,
        jefePosgradoRolesRes,
      ]) {
        if (res.error) {
          console.log('[usuarios] relaciones error:', res.error.message)
          throw new HttpError(500, res.error.message, 'DB_ERROR')
        }
      }

      type PlanItem = {
        plan_estudio_id: string
        plan_nombre: string | null
        carrera_nombre: string | null
        origen: 'dueño' | 'revision'
        estatus: string | null
        tarea_id: string | null
        fecha_limite: string | null
        creado_en: string | null
      }
      type OwnedPlanRow = {
        id: string
        nombre?: string | null
        nombre_propuesto?: string | null
        nombre_display?: string | null
        carreras: unknown
        estados_plan: unknown
      }
      const planesMap = new Map<string, PlanItem>()

      const addOwnedPlans = (rows: Array<OwnedPlanRow>) => {
        for (const row of rows) {
          const carrera = firstEmbed<{
            nombre: string | null
            nombre_corto: string | null
          }>(row.carreras)
          const estado = firstEmbed<{
            clave: string | null
            etiqueta: string | null
          }>(row.estados_plan)
          planesMap.set(row.id as string, {
            plan_estudio_id: row.id as string,
            plan_nombre: formatPlanNombre(row),
            carrera_nombre: carrera?.nombre_corto ?? carrera?.nombre ?? null,
            origen: 'dueño',
            estatus: estado?.etiqueta ?? estado?.clave ?? null,
            tarea_id: null,
            fecha_limite: null,
            creado_en: null,
          })
        }
      }

      // Jefatura = dueña: carrera exacta, y Posgrado para todos los posgrados
      // de su facultad.
      const jefeCarreras = (jefeRolesRes.data ?? [])
        .map((r) => r.carrera_id as string | null)
        .filter((c): c is string => !!c)
      const jefePosgradoFacultades = (jefePosgradoRolesRes.data ?? [])
        .map((r) => r.facultad_id as string | null)
        .filter((f): f is string => !!f)

      if (jefeCarreras.length > 0) {
        const { data: ownedData, error: ownedError } = await supabase
          .from('planes_estudio')
          .select(
            'id, nombre, nombre_propuesto, nombre_display, carreras(id, nombre, nombre_corto), estados_plan(clave, etiqueta)',
          )
          .in('carrera_id', jefeCarreras)
          .eq('activo', true)
        if (ownedError) {
          throw new HttpError(500, ownedError.message, 'DB_ERROR')
        }
        addOwnedPlans((ownedData ?? []) as Array<OwnedPlanRow>)
      }

      if (jefePosgradoFacultades.length > 0) {
        const { data: ownedPosgradoData, error: ownedPosgradoError } =
          await supabase
            .from('planes_estudio')
            .select(
              'id, nombre, nombre_propuesto, nombre_display, carreras!inner(id, nombre, nombre_corto, nivel, facultad_id), estados_plan(clave, etiqueta)',
            )
            .in('carreras.facultad_id', jefePosgradoFacultades)
            .in('carreras.nivel', ['Maestría', 'Doctorado', 'Especialidad'])
            .eq('activo', true)
        if (ownedPosgradoError) {
          throw new HttpError(500, ownedPosgradoError.message, 'DB_ERROR')
        }
        addOwnedPlans(
          (ownedPosgradoData ?? []) as Array<OwnedPlanRow>,
        )
      }

      // Otros roles: participan solo cuando el plan está en SU estado actual de
      // revisión (la tarea coincide con planes_estudio.estado_actual_id).
      for (const row of tareasRes.data ?? []) {
        const plan = firstEmbed<{
          id: string
          nombre: string | null
          nombre_propuesto: string | null
          nombre_display: string | null
          estado_actual_id: string | null
          carreras: unknown
        }>(row.planes_estudio)
        if (!plan) continue
        if (row.estado_id !== plan.estado_actual_id) continue
        if (planesMap.has(plan.id)) continue // el dueño tiene precedencia
        const carrera = firstEmbed<{
          nombre: string | null
          nombre_corto: string | null
        }>(plan.carreras)
        planesMap.set(plan.id, {
          plan_estudio_id: plan.id,
          plan_nombre: formatPlanNombre(plan),
          carrera_nombre: carrera?.nombre_corto ?? carrera?.nombre ?? null,
          origen: 'revision',
          estatus: (row.estatus as string | null) ?? null,
          tarea_id: row.id as string,
          fecha_limite: (row.fecha_limite as string | null) ?? null,
          creado_en: (row.creado_en as string | null) ?? null,
        })
      }

      const planes = Array.from(planesMap.values())

      const materias = (materiasRes.data ?? []).map((row) => {
        const asignatura = firstEmbed<{
          id: string
          nombre: string | null
          plan_estudio_id: string | null
          planes_estudio: {
            nombre: string | null
            nombre_propuesto: string | null
            nombre_display: string | null
          } | null
        }>(row.asignaturas)
        return {
          responsable_id: row.id,
          asignatura_id: asignatura?.id ?? null,
          asignatura_nombre: asignatura?.nombre ?? null,
          plan_estudio_id: asignatura?.plan_estudio_id ?? null,
          plan_nombre: formatPlanNombre(asignatura?.planes_estudio),
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
        'usuarios.gestionar',
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

      await assertCanManageUser(supabase, callerId, id)

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
      const callerId = await requirePermission(
        req,
        supabase,
        'usuarios.gestionar',
      )
      await assertCanManageUser(supabase, callerId, id)

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
      const callerId = await requirePermission(
        req,
        supabase,
        'usuarios.gestionar',
      )
      await assertCanManageUser(supabase, callerId, id)

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

      const callerId = await requirePermission(
        req,
        supabase,
        'usuarios.gestionar',
      )
      await assertCanManageUser(supabase, callerId, id)
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

      const {
        rol_id,
        facultad_id = null,
        carrera_id = null,
        reemplazar = false,
      } = parsed.data

      await assertCanManageUser(supabase, callerId, id)
      await assertCanManageRole(
        supabase,
        callerId,
        rol_id,
        facultad_id,
        carrera_id,
      )

      // Nombramiento: swap atómico (retira titular previo + asigna nuevo).
      if (reemplazar) {
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          'nombrar_responsable',
          {
            p_usuario: id,
            p_rol: rol_id,
            p_facultad: facultad_id,
            p_carrera: carrera_id,
            p_actor: callerId,
          },
        )

        if (rpcError) {
          console.log(
            '[usuarios] nombrar error:',
            rpcError.code,
            rpcError.message,
          )
          const status = RPC_ERRCODE_STATUS[rpcError.code ?? ''] ?? 500
          throw new HttpError(
            status,
            rpcError.message,
            status === 403 ? 'FORBIDDEN' : 'APPOINTMENT_ERROR',
          )
        }

        const asignacionId = (rpcData as { asignacion_id?: string } | null)
          ?.asignacion_id
        const { data, error } = await supabase
          .from('usuarios_roles')
          .select(ROLE_EMBED_SELECT)
          .eq('id', asignacionId ?? '')
          .single()

        if (error) throw new HttpError(500, error.message, 'DB_ERROR')
        return sendSuccess(data, 201)
      }

      // Roles singleton (alcance facultad/carrera): si ya hay otro titular para
      // ese alcance, exigir confirmación de nombramiento (reemplazar).
      if (facultad_id || carrera_id) {
        const scopeColumn = facultad_id ? 'facultad_id' : 'carrera_id'
        const scopeValue = (facultad_id ?? carrera_id) as string
        const { data: holder } = await supabase
          .from('usuarios_roles')
          .select('usuario_id')
          .eq('rol_id', rol_id)
          .eq(scopeColumn, scopeValue)
          .neq('usuario_id', id)
          .maybeSingle()
        if (holder) {
          throw new HttpError(
            409,
            'Ya existe un titular para este rol y alcance.',
            'ROLE_SINGLETON_CONFLICT',
          )
        }
      }

      const { data, error } = await supabase
        .from('usuarios_roles')
        .insert({
          usuario_id: id,
          rol_id,
          facultad_id,
          carrera_id,
          asignado_por: callerId,
        })
        .select(ROLE_EMBED_SELECT)
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
      const callerId = await requirePermission(
        req,
        supabase,
        'usuarios.roles.gestionar',
      )

      const { data: asignacion, error: lookupError } = await supabase
        .from('usuarios_roles')
        .select('id, rol_id, facultad_id, carrera_id')
        .eq('id', asignacionId)
        .eq('usuario_id', id)
        .maybeSingle()

      if (lookupError) throw new HttpError(500, lookupError.message, 'DB_ERROR')
      if (!asignacion) {
        throw new HttpError(
          404,
          'Asignación de rol no encontrada.',
          'NOT_FOUND',
        )
      }

      await assertCanManageUser(supabase, callerId, id)
      await assertCanManageRole(
        supabase,
        callerId,
        asignacion.rol_id as string,
        (asignacion.facultad_id as string | null) ?? null,
        (asignacion.carrera_id as string | null) ?? null,
      )

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
