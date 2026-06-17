import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { corsHeaders } from '../_shared/cors.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SUPABASE_SECRET_KEY')!
const FRONTEND_URL = Deno.env.get('FRONTEND_URL')

const LoginSchema = z.object({
  email: z.string().email('Correo electrónico inválido.'),
  password: z.string().min(1, 'La contraseña es requerida.'),
})

const ResetSchema = z.object({
  email: z.string().email('Correo electrónico inválido.'),
  redirectTo: z.string().url('URL de redirección inválida.').optional(),
})

function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function getAuthClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function getAction(req: Request) {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean)
  return parts[1] ?? ''
}

function getRedirectTo(req: Request, requestedRedirectTo?: string) {
  if (requestedRedirectTo) return requestedRedirectTo
  if (FRONTEND_URL) return `${FRONTEND_URL}/update-password`

  const origin = req.headers.get('origin')
  return origin ? `${origin}/update-password` : undefined
}

async function findAuthUserByEmail(
  supabase: ReturnType<typeof getAdminClient>,
  email: string,
) {
  const perPage = 1000
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    })
    if (error) {
      console.error('[external-auth] listUsers error:', error.message)
      throw new HttpError(
        500,
        'Error al buscar usuario.',
        'SUPABASE_AUTH_ERROR',
      )
    }

    const found = data.users.find(
      (u) => normalizeEmail(u.email ?? '') === email,
    )
    if (found) return found

    if (!data.nextPage || page >= data.lastPage) return null
    page = data.nextPage
  }
}

async function getExternalProfile(
  supabase: ReturnType<typeof getAdminClient>,
  userId: string,
) {
  const { data, error } = await supabase
    .from('usuarios_app')
    .select('id, externo, dado_de_baja_en')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('[external-auth] usuarios_app lookup error:', error.message)
    throw new HttpError(500, 'Error al validar usuario.', 'DB_ERROR')
  }

  return data
}

async function assertExternalActiveUser(
  supabase: ReturnType<typeof getAdminClient>,
  userId: string,
) {
  const profile = await getExternalProfile(supabase, userId)

  if (!profile) {
    throw new HttpError(
      403,
      'La cuenta no está registrada en la aplicación.',
      'APP_USER_NOT_FOUND',
    )
  }

  if (!profile.externo) {
    throw new HttpError(
      403,
      'Esta cuenta usa acceso institucional. Inicia sesión como usuario interno.',
      'NOT_EXTERNAL_USER',
    )
  }

  if (profile.dado_de_baja_en) {
    throw new HttpError(403, 'La cuenta está dada de baja.', 'USER_DISABLED')
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

    const action = getAction(req)
    const admin = getAdminClient()
    const auth = getAuthClient()

    if (action === 'login') {
      const parsed = LoginSchema.safeParse(rawBody)
      if (!parsed.success) {
        const message = parsed.error.issues.map((i) => i.message).join(' ')
        throw new HttpError(422, message, 'VALIDATION_ERROR')
      }

      const email = normalizeEmail(parsed.data.email)
      const { data, error } = await auth.auth.signInWithPassword({
        email,
        password: parsed.data.password,
      })

      if (error || !data.session || !data.user) {
        throw new HttpError(
          401,
          'Correo o contraseña incorrectos.',
          'INVALID_EXTERNAL_CREDENTIALS',
        )
      }

      try {
        await assertExternalActiveUser(admin, data.user.id)
      } catch (error) {
        await auth.auth.signOut()
        throw error
      }

      return sendSuccess({ session: data.session })
    }

    if (action === 'reset-password') {
      const parsed = ResetSchema.safeParse(rawBody)
      if (!parsed.success) {
        const message = parsed.error.issues.map((i) => i.message).join(' ')
        throw new HttpError(422, message, 'VALIDATION_ERROR')
      }

      const email = normalizeEmail(parsed.data.email)
      const authUser = await findAuthUserByEmail(admin, email)
      if (!authUser) {
        return sendSuccess({ sent: true })
      }

      await assertExternalActiveUser(admin, authUser.id)

      const { error } = await auth.auth.resetPasswordForEmail(email, {
        redirectTo: getRedirectTo(req, parsed.data.redirectTo),
      })

      if (error) {
        console.error(
          '[external-auth] resetPasswordForEmail error:',
          error.message,
        )
        throw new HttpError(
          500,
          'No se pudo enviar el correo.',
          'SUPABASE_AUTH_ERROR',
        )
      }

      return sendSuccess({ sent: true })
    }

    throw new HttpError(404, 'Ruta no encontrada.', 'NOT_FOUND')
  } catch (error) {
    if (error instanceof HttpError) {
      console.error(
        `[external-auth] ${error.status} ${error.code}: ${error.message}`,
      )
      return sendError(error.status, error.message, error.code)
    }

    console.error('[external-auth] Critical error:', error)
    return sendError(
      500,
      'Error inesperado en el servidor.',
      'INTERNAL_SERVER_ERROR',
    )
  }
})
