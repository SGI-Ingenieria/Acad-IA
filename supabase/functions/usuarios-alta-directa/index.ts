import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { corsHeaders } from '../_shared/cors.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const AltaSchema = z.object({
  nombre_completo: z.string().min(1, 'El nombre completo es requerido.'),
  email: z.string().email('Correo electrónico inválido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
  externo: z.boolean().default(true),
  masterPassword: z.string().min(1, 'La contraseña maestra es requerida.'),
})

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return sendError(405, 'Método no permitido.', 'METHOD_NOT_ALLOWED')
  }

  try {
    const masterPasswordEnv = Deno.env.get('USER_CREATION_MASTER_PASSWORD')
    if (!masterPasswordEnv) {
      console.error('[usuarios-alta-directa] USER_CREATION_MASTER_PASSWORD no configurada')
      return sendError(
        500,
        'El registro de cuentas no está disponible en este momento. Contacta al administrador.',
        'MASTER_PASSWORD_NOT_CONFIGURED',
      )
    }

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      throw new HttpError(400, 'Body JSON inválido.', 'INVALID_JSON')
    }

    const parsed = AltaSchema.safeParse(rawBody)
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(' ')
      throw new HttpError(422, message, 'VALIDATION_ERROR')
    }

    const { nombre_completo, email, password, externo, masterPassword } = parsed.data

    if (masterPassword !== masterPasswordEnv) {
      throw new HttpError(403, 'Contraseña maestra incorrecta.', 'FORBIDDEN')
    }

    const supabase = getAdminClient()

    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nombre_completo, externo },
      })

    if (authError) {
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

    const { data: appUser, error: insertError } = await supabase
      .from('usuarios_app')
      .insert({ id: authUser.user.id, nombre_completo, email, externo })
      .select()
      .single()

    if (insertError) {
      console.error(
        '[usuarios-alta-directa] DB insert failed, deleting auth user:',
        insertError.message,
      )
      await supabase.auth.admin.deleteUser(authUser.user.id)
      const isConflict =
        insertError.message.toLowerCase().includes('duplicate') ||
        insertError.code === '23505'
      throw new HttpError(
        isConflict ? 409 : 500,
        isConflict
          ? 'Ya existe una cuenta con ese correo electrónico.'
          : insertError.message,
        isConflict ? 'EMAIL_CONFLICT' : 'DB_ERROR',
      )
    }

    return sendSuccess(
      {
        id: appUser.id,
        nombre_completo: appUser.nombre_completo,
        email: appUser.email,
        externo: appUser.externo,
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
    return sendError(500, 'Error inesperado en el servidor.', 'INTERNAL_SERVER_ERROR')
  }
})
