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

type AdminClient = ReturnType<typeof getAdminClient>

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
  const token = (req.headers.get('Authorization') ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim()
  if (!token) return null

  const { data: caller } = await supabase.auth.getUser(token)
  return caller.user?.id ?? null
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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isInternalEmail(email: string): boolean {
  const domain = normalizeEmail(email).split('@')[1]
  return INTERNAL_EMAIL_DOMAINS.includes(domain)
}

const BaseAltaSchema = z.object({
  nombre_completo: z.string().min(1, 'El nombre completo es requerido.'),
  email: z.string().email('Correo electrónico inválido.'),
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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return sendError(405, 'Método no permitido.', 'METHOD_NOT_ALLOWED')
  }

  try {
    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      throw new HttpError(400, 'Body JSON inválido.', 'INVALID_JSON')
    }

    const parsed = AltaSchema.safeParse(normalizeLegacyInput(rawBody))
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(' ')
      throw new HttpError(422, message, 'VALIDATION_ERROR')
    }

    const { nombre_completo, masterPassword, type } = parsed.data
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

    const supabase = getAdminClient()

    // Las llamadas autenticadas (panel de administración en /usuarios) se
    // autorizan por permisos; las anónimas (registro público en /registro)
    // deben enviar la contraseña maestra.
    const isAuthenticatedCaller = await assertCanCreateUsers(req, supabase)

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

    return sendSuccess(
      {
        id: appUser.id,
        nombre_completo: appUser.nombre_completo,
      },
      201,
    )
  } catch (error) {
    if (error instanceof HttpError) {
      console.error(
        `[usuarios-alta-directa] ${error.status} ${error.code}: ${error.message}`,
      )
      return sendError(error.status, error.message, error.code)
    }
    console.error('[usuarios-alta-directa] Critical error:', error)
    return sendError(
      500,
      'Error inesperado en el servidor.',
      'INTERNAL_SERVER_ERROR',
    )
  }
})
