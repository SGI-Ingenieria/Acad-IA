import '@supabase/functions-js/edge-runtime.d.ts'
import { z } from 'zod'

import { preflightResponse } from '../_shared/cors.ts'
import { readJsonBody, requireMethod } from '../_shared/request.ts'
import {
  getAuthenticatedUserWithClient,
  getServiceRoleClient,
  type ServiceRoleClient,
} from '../_shared/supabase.ts'
import {
  edgeErrorResponse,
  HttpError,
  sendError,
  sendSuccess,
} from '../_shared/utils.ts'
import { joinValidationMessages, validateInput } from '../_shared/validation.ts'
import { normalizeEmail } from '../_shared/value.ts'

type AdminClient = ServiceRoleClient

async function hasAnyRoleAssignments(supabase: AdminClient) {
  const { count, error } = await supabase
    .from('usuarios_roles')
    .select('id', { count: 'exact', head: true })

  if (error) {
    console.error('[usuarios-alta-directa] role assignment count error:', error)
    throw new HttpError(500, error.message, 'DB_ERROR')
  }

  return (count ?? 0) > 0
}

async function getAuthenticatedCallerId(req: Request, supabase: AdminClient) {
  return (await getAuthenticatedUserWithClient(req, supabase))?.id ?? null
}

async function assertCanCreateUsers(req: Request, supabase: AdminClient) {
  const callerId = await getAuthenticatedCallerId(req, supabase)
  if (!callerId) return false

  if (!(await hasAnyRoleAssignments(supabase))) return true

  const { data, error } = await supabase.rpc('usuario_tiene_permiso', {
    p_usuario_id: callerId,
    p_permiso: 'usuarios.gestionar',
  })

  if (error) {
    console.error('[usuarios-alta-directa] permission check error:', error)
    throw new HttpError(500, error.message, 'DB_ERROR')
  }

  if (!data) {
    throw new HttpError(
      403,
      'No tienes permisos para crear usuarios.',
      'FORBIDDEN',
    )
  }

  return true
}

const INTERNAL_EMAIL_DOMAINS = ['lasalle.mx', 'lasallistas.org.mx']

function isInternalEmail(email: string): boolean {
  const domain = normalizeEmail(email).split('@')[1]
  return INTERNAL_EMAIL_DOMAINS.includes(domain)
}

const BaseAltaSchema = z.object({
  nombre_completo: z.string().min(1, 'El nombre completo es requerido.'),
  email: z.string().email('Correo electrónico inválido.'),
  roles: z
    .array(
      z
        .object({
          rol_id: z.string().uuid('Rol inválido.'),
          facultad_id: z
            .string()
            .uuid('Facultad inválida.')
            .nullable()
            .optional(),
          carrera_id: z
            .string()
            .uuid('Carrera inválida.')
            .nullable()
            .optional(),
        })
        .refine((role) => !(role.facultad_id && role.carrera_id), {
          message: 'El alcance debe ser por facultad o por carrera, no ambos.',
        }),
    )
    .max(10, 'No se pueden asignar más de 10 roles a la vez.')
    .optional()
    .default([]),
  // Opcional: solo se exige a llamadas anónimas (registro público). Las llamadas
  // autenticadas (panel de administración) se autorizan por su sesión.
  masterPassword: z.string().optional(),
})

const AltaSchema = z.discriminatedUnion('type', [
  BaseAltaSchema.extend({
    type: z.literal('internal'),
    clave: z
      .string()
      .regex(
        /^(ad|do)\d{6}$/,
        'Formato de clave inválido (ejemplo: ad123456).',
      ),
  }),
  BaseAltaSchema.extend({
    type: z.literal('external'),
    password: z
      .string()
      .min(6, 'La contraseña debe tener al menos 6 caracteres.'),
  }),
])

type AltaInput = z.infer<typeof AltaSchema>

type AltaRolInput = NonNullable<AltaInput['roles']>[number]

function authProviderFor(type: AltaInput['type']) {
  return type === 'internal' ? 'ulsa_ntlm' : 'supabase_password'
}

function randomInternalPassword() {
  return (
    crypto.randomUUID().replaceAll('-', '') +
    crypto.randomUUID().replaceAll('-', '') +
    'Aa1!'
  )
}

function insertConflictMessage(
  type: AltaInput['type'],
  message: string,
  code?: string,
) {
  const lowerMessage = message.toLowerCase()
  if (
    type === 'internal' &&
    (lowerMessage.includes('clave') || code === '23505')
  ) {
    return {
      status: 409,
      message: 'Ya existe una cuenta con esa Clave La Salle.',
      code: 'CLAVE_CONFLICT',
    }
  }

  if (lowerMessage.includes('duplicate') || code === '23505') {
    return {
      status: 409,
      message: 'Ya existe una cuenta con esos datos.',
      code: 'USER_CONFLICT',
    }
  }

  return { status: 500, message, code: 'DB_ERROR' }
}

const LegacyAltaSchema = z
  .object({
    nombre_completo: z.string().min(1, 'El nombre completo es requerido.'),
    email: z.string().email('Correo electrónico inválido.'),
    password: z
      .string()
      .min(6, 'La contraseña debe tener al menos 6 caracteres.')
      .optional(),
    clave: z
      .string()
      .regex(/^(ad|do)\d{6}$/, 'Formato de clave inválido (ejemplo: ad123456).')
      .optional(),
    masterPassword: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.clave && !data.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'La contraseña es requerida para usuarios externos.',
      })
    }
  })

function normalizeLegacyInput(rawBody: unknown): unknown {
  if (rawBody && typeof rawBody === 'object' && 'type' in rawBody) {
    return rawBody
  }

  const parsed = LegacyAltaSchema.safeParse(rawBody)
  if (!parsed.success) return rawBody

  return {
    ...parsed.data,
    type: parsed.data.clave ? 'internal' : 'external',
  }
}

async function cleanupCreatedUser(
  supabase: AdminClient,
  userId: string,
  authUserId: string,
) {
  const { error: appUserError } = await supabase
    .from('usuarios_app')
    .delete()
    .eq('id', userId)

  if (appUserError) {
    console.error(
      '[usuarios-alta-directa] cleanup app user failed:',
      appUserError.message,
    )
  }

  const { error: authError } = await supabase.auth.admin.deleteUser(authUserId)
  if (authError) {
    console.error(
      '[usuarios-alta-directa] cleanup auth user failed:',
      authError.message,
    )
  }
}

async function assignAltaRoles(
  supabase: AdminClient,
  actorId: string,
  usuarioId: string,
  roles: Array<AltaRolInput>,
) {
  const bootstrapMode = !(await hasAnyRoleAssignments(supabase))

  for (const role of roles) {
    const facultadId = role.facultad_id ?? null
    const carreraId = role.carrera_id ?? null
    const { data: catalogRole, error: roleError } = await supabase
      .from('roles')
      .select('id, alcance_default')
      .eq('id', role.rol_id)
      .single()

    if (roleError || !catalogRole) {
      throw new HttpError(422, 'Rol no encontrado.', 'ROLE_NOT_FOUND')
    }

    if (
      (catalogRole.alcance_default === 'facultad' && !facultadId) ||
      (catalogRole.alcance_default === 'carrera' && !carreraId) ||
      (catalogRole.alcance_default === 'global' && (facultadId || carreraId))
    ) {
      throw new HttpError(
        422,
        'El alcance no corresponde al rol seleccionado.',
        'ROLE_SCOPE_INVALID',
      )
    }

    if (!bootstrapMode) {
      const { data: canManage, error: permissionError } = await supabase.rpc(
        'usuario_puede_gestionar_rol',
        {
          p_actor: actorId,
          p_rol: role.rol_id,
          p_facultad: facultadId,
          p_carrera: carreraId,
        },
      )

      if (permissionError) {
        throw new HttpError(500, permissionError.message, 'DB_ERROR')
      }
      if (!canManage) {
        throw new HttpError(
          403,
          'No tienes permisos para gestionar uno de los roles seleccionados.',
          'FORBIDDEN',
        )
      }
    }

    const scopeColumn = facultadId
      ? 'facultad_id'
      : carreraId
        ? 'carrera_id'
        : null
    const scopeValue = facultadId ?? carreraId
    if (scopeColumn && scopeValue) {
      const { data: holder, error: holderError } = await supabase
        .from('usuarios_roles')
        .select('usuario_id')
        .eq('rol_id', role.rol_id)
        .eq(scopeColumn, scopeValue)
        .maybeSingle()

      if (holderError) {
        throw new HttpError(500, holderError.message, 'DB_ERROR')
      }
      if (holder) {
        throw new HttpError(
          409,
          'Ya existe un titular para este rol y alcance. Retira o reemplaza al titular actual antes de crear el usuario.',
          'ROLE_SINGLETON_CONFLICT',
        )
      }
    }

    const { error: insertError } = await supabase
      .from('usuarios_roles')
      .insert({
        usuario_id: usuarioId,
        rol_id: role.rol_id,
        facultad_id: facultadId,
        carrera_id: carreraId,
        asignado_por: actorId,
      })

    if (insertError) {
      const isConflict = insertError.code === '23505'
      throw new HttpError(
        isConflict ? 409 : 500,
        isConflict
          ? 'El usuario ya tiene ese rol con ese alcance.'
          : insertError.message,
        isConflict ? 'ROLE_ASSIGNMENT_CONFLICT' : 'DB_ERROR',
      )
    }
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return preflightResponse()
  }

  try {
    requireMethod(req, 'POST')
    const rawBody = await readJsonBody(req)

    const parsed = validateInput(AltaSchema, normalizeLegacyInput(rawBody), {
      message: joinValidationMessages,
    })

    const { nombre_completo, masterPassword, type, roles = [] } = parsed.data
    const email = normalizeEmail(parsed.data.email)
    const clave = type === 'internal' ? parsed.data.clave.toLowerCase() : null
    const password =
      type === 'external' ? parsed.data.password : randomInternalPassword()

    if (type === 'internal' && !isInternalEmail(email)) {
      throw new HttpError(
        422,
        'Los usuarios internos deben usar un correo @lasalle.mx o @lasallistas.org.mx.',
        'INVALID_INTERNAL_EMAIL_DOMAIN',
      )
    }

    const supabase = getServiceRoleClient()

    // Las llamadas autenticadas (panel de administración en /usuarios) se
    // autorizan por permisos; las anónimas (registro público en /registro)
    // deben enviar la contraseña maestra.
    const isAuthenticatedCaller = await assertCanCreateUsers(req, supabase)

    if (roles.length > 0 && !isAuthenticatedCaller) {
      throw new HttpError(
        403,
        'Solo el panel de administración puede asignar roles al crear usuarios.',
        'FORBIDDEN',
      )
    }

    if (!isAuthenticatedCaller) {
      const masterPasswordEnv = Deno.env.get('USER_CREATION_MASTER_PASSWORD')
      if (!masterPasswordEnv) {
        console.error(
          '[usuarios-alta-directa] USER_CREATION_MASTER_PASSWORD no configurada',
        )
        return sendError(
          500,
          'El registro de cuentas no está disponible en este momento. Contacta al administrador.',
          'MASTER_PASSWORD_NOT_CONFIGURED',
        )
      }
      if (!masterPassword || masterPassword !== masterPasswordEnv) {
        throw new HttpError(403, 'Contraseña maestra incorrecta.', 'FORBIDDEN')
      }
    }

    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: {
          user_type: type,
          auth_provider: authProviderFor(type),
        },
      })

    if (authError) {
      console.error('[usuarios-alta-directa] createUser error:', {
        message: authError.message,
        code: authError.code,
        status: authError.status,
        name: authError.name,
      })
      const isConflict =
        authError.message.toLowerCase().includes('already') ||
        authError.message.toLowerCase().includes('duplicate') ||
        authError.code === 'email_exists'
      throw new HttpError(
        isConflict ? 409 : 500,
        isConflict
          ? 'Ya existe una cuenta con ese correo electrónico.'
          : authError.message,
        isConflict ? 'EMAIL_CONFLICT' : 'AUTH_ERROR',
      )
    }

    // Auditoría: las altas autenticadas conservan al creador aunque la cuenta
    // todavía no tenga roles, para que pueda terminar la gestión.
    const invitadoPor = isAuthenticatedCaller
      ? await getAuthenticatedCallerId(req, supabase)
      : null

    const { data: appUser, error: insertError } = await supabase
      .from('usuarios_app')
      .insert({
        id: authUser.user.id,
        nombre_completo,
        clave,
        invitado_por: invitadoPor,
      })
      .select()
      .single()

    if (insertError) {
      console.error(
        '[usuarios-alta-directa] DB insert failed, deleting auth user:',
        insertError.message,
      )
      await supabase.auth.admin.deleteUser(authUser.user.id)
      const conflict = insertConflictMessage(
        type,
        insertError.message,
        insertError.code,
      )
      throw new HttpError(conflict.status, conflict.message, conflict.code)
    }

    try {
      if (roles.length > 0) {
        const callerId = await getAuthenticatedCallerId(req, supabase)
        if (!callerId) {
          throw new HttpError(403, 'Sesión no válida.', 'FORBIDDEN')
        }
        await assignAltaRoles(supabase, callerId, appUser.id, roles)
      }
    } catch (error) {
      await cleanupCreatedUser(supabase, appUser.id, authUser.user.id)
      throw error
    }

    return sendSuccess(
      {
        id: appUser.id,
        nombre_completo: appUser.nombre_completo,
      },
      201,
    )
  } catch (error) {
    return edgeErrorResponse(
      error,
      'usuarios-alta-directa',
      'Error inesperado en el servidor.',
    )
  }
})
