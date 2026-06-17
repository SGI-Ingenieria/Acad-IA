import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import httpntlm from 'npm:httpntlm'

import { corsHeaders } from '../_shared/cors.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SUPABASE_SECRET_KEY')!
const INTERNAL_AUTH_SECRET = Deno.env.get('INTERNAL_AUTH_SECRET')
const INTERNAL_AUTH_PEPPER = Deno.env.get('INTERNAL_AUTH_PEPPER')
const SGU_NTLM_URL = Deno.env.get('SGU_NTLM_URL') ?? 'https://sgu.ulsa.edu.mx/'

type NtlmValidationResult = 'valid' | 'invalid'

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

function validateNtlm(
  url: string,
  username: string,
  password: string,
): Promise<NtlmValidationResult> {
  return new Promise((resolve, reject) => {
    httpntlm.get(
      { url, username, password, domain: '', workstation: '' },
      (err: Error | null, res: { statusCode: number; body: string }) => {
        if (err) return reject(err)

        const statusCode = res.statusCode
        if (statusCode >= 400 && statusCode < 500) return resolve('invalid')
        if (statusCode >= 500 || statusCode < 200) {
          return reject(new Error(`SGU responded with status ${statusCode}`))
        }

        resolve('valid')
      },
    )
  })
}

async function deriveInternalPassword(
  clave: string,
  userId: string,
  secret: string,
  pepper: string,
): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(`${pepper}|${clave}|${userId}`),
  )
  return (
    btoa(String.fromCharCode(...new Uint8Array(sig))).substring(0, 32) + 'Aa1!'
  )
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return sendError(405, 'Método no permitido.', 'METHOD_NOT_ALLOWED')
  }

  if (!INTERNAL_AUTH_SECRET || !INTERNAL_AUTH_PEPPER) {
    console.error(
      '[internal-auth-login] INTERNAL_AUTH_SECRET o INTERNAL_AUTH_PEPPER no configurados',
    )
    return sendError(
      500,
      'Autenticación interna no configurada.',
      'INTERNAL_SERVER_ERROR',
    )
  }

  try {
    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      throw new HttpError(400, 'Body JSON inválido.', 'INVALID_JSON')
    }

    const body = rawBody as Record<string, unknown>
    const rawClave = body.clave
    const password = body.password

    // Validate clave format
    const clave = String(rawClave ?? '')
      .toLowerCase()
      .trim()
    if (!clave || !/^(ad|do)\d{6}$/.test(clave)) {
      throw new HttpError(
        400,
        'Formato de clave inválido. Debe ser ad o do seguido de 6 dígitos.',
        'INVALID_CLAVE_FORMAT',
      )
    }

    // Validate password
    if (!password || typeof password !== 'string' || !password.trim()) {
      throw new HttpError(
        400,
        'La contraseña es requerida.',
        'MISSING_PASSWORD',
      )
    }

    // NTLM validation against SGU — institutional password used here and nowhere else
    let ntlmResult: NtlmValidationResult
    try {
      ntlmResult = await validateNtlm(SGU_NTLM_URL, clave, password)
    } catch (ntlmErr) {
      console.error('[internal-auth-login] NTLM error:', ntlmErr)
      throw new HttpError(
        503,
        'El servidor institucional no está disponible. Intenta más tarde.',
        'NTLM_SERVICE_UNAVAILABLE',
      )
    }

    if (ntlmResult === 'invalid') {
      throw new HttpError(
        401,
        'Credenciales institucionales inválidas.',
        'INVALID_INTERNAL_CREDENTIALS',
      )
    }

    const supabase = getAdminClient()
    const { data: usuario, error: lookupError } = await supabase
      .from('usuarios_app')
      .select('id, dado_de_baja_en')
      .eq('clave', clave)
      .maybeSingle()

    if (lookupError) {
      console.error(
        '[internal-auth-login] DB lookup error:',
        lookupError.message,
      )
      throw new HttpError(500, 'Error al buscar usuario.', 'DB_ERROR')
    }

    if (!usuario || usuario.dado_de_baja_en) {
      throw new HttpError(
        404,
        'No existe una cuenta vinculada a esta clave ULSA.',
        'INTERNAL_USER_NOT_FOUND',
      )
    }

    const { data: authUserData, error: authUserError } =
      await supabase.auth.admin.getUserById(usuario.id)

    if (authUserError) {
      console.error(
        '[internal-auth-login] getUserById error:',
        authUserError.message,
      )
      throw new HttpError(
        500,
        'Error al buscar credenciales.',
        'SUPABASE_AUTH_ERROR',
      )
    }

    const email = authUserData.user?.email
    if (!email) {
      throw new HttpError(
        422,
        'La cuenta interna no tiene correo electrónico vinculado.',
        'INTERNAL_USER_WITHOUT_EMAIL',
      )
    }

    const derivedPassword = await deriveInternalPassword(
      clave,
      usuario.id,
      INTERNAL_AUTH_SECRET,
      INTERNAL_AUTH_PEPPER,
    )

    const authClient = getAuthClient()
    let { data: sessionData, error: sessionError } =
      await authClient.auth.signInWithPassword({
        email,
        password: derivedPassword,
      })

    if (sessionError || !sessionData.session) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        usuario.id,
        {
          password: derivedPassword,
          app_metadata: {
            ...(authUserData.user.app_metadata ?? {}),
            user_type: 'internal',
            auth_provider: 'ulsa_ntlm',
          },
        },
      )

      if (updateError) {
        console.error(
          '[internal-auth-login] updateUserById error:',
          updateError.message,
        )
        throw new HttpError(
          500,
          'Error al actualizar credenciales.',
          'SUPABASE_AUTH_ERROR',
        )
      }

      const retry = await authClient.auth.signInWithPassword({
        email,
        password: derivedPassword,
      })
      sessionData = retry.data
      sessionError = retry.error
    }

    if (sessionError || !sessionData?.session) {
      console.error(
        '[internal-auth-login] signInWithPassword error:',
        sessionError?.message,
      )
      throw new HttpError(500, 'Error al crear sesión.', 'SUPABASE_AUTH_ERROR')
    }

    return sendSuccess({ session: sessionData.session })
  } catch (error) {
    if (error instanceof HttpError) {
      console.error(
        `[internal-auth-login] ${error.status} ${error.code}: ${error.message}`,
      )
      return sendError(error.status, error.message, error.code)
    }
    console.error('[internal-auth-login] Critical error:', error)
    return sendError(
      500,
      'Error inesperado en el servidor.',
      'INTERNAL_SERVER_ERROR',
    )
  }
})
