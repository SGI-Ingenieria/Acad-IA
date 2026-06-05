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

const FRONTEND_URL =
  Deno.env.get('FRONTEND_URL') ?? 'https://acad-ia-.lci.ulsa.mx'

const CreateUsuarioSchema = z.object({
  nombre_completo: z.string().min(1, 'El nombre es requerido.'),
  email: z.string().email('Correo inválido.'),
  externo: z.boolean().default(false),
})

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

    // GET /usuarios — listar
    if (req.method === 'GET' && !id) {
      console.log('[usuarios] Route matched: GET /usuarios')
      const { data, error } = await supabase
        .from('usuarios_app')
        .select(
          'id, nombre_completo, email, externo, creado_en, actualizado_en, dado_de_baja_en',
        )
        .order('creado_en', { ascending: false })

      if (error) {
        console.log('[usuarios] GET /usuarios DB error:', error.message)
        throw new HttpError(500, error.message, 'DB_ERROR')
      }
      return sendSuccess(data)
    }

    // POST /usuarios — crear
    if (req.method === 'POST' && !id) {
      console.log('[usuarios] Route matched: POST /usuarios')
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

      const { nombre_completo, email, externo } = parsed.data

      const redirectTo = FRONTEND_URL
        ? `${FRONTEND_URL}/update-password`
        : undefined

      const { data: authUser, error: authError } =
        await supabase.auth.admin.inviteUserByEmail(email, {
          redirectTo,
          data: { nombre_completo, externo },
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

      const { data: appUser, error: insertError } = await supabase
        .from('usuarios_app')
        .insert({ id: authUser.user.id, nombre_completo, email, externo })
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
      const { data: user, error: userError } = await supabase
        .from('usuarios_app')
        .select('email')
        .eq('id', id)
        .single()

      if (userError || !user) {
        console.log(
          '[usuarios] reenviar-invitacion: user not found',
          userError?.message,
        )
        throw new HttpError(404, 'Usuario no encontrado.', 'NOT_FOUND')
      }

      const redirectTo = FRONTEND_URL
        ? `${FRONTEND_URL}/update-password`
        : undefined

      const { error: resendError } = await supabase.auth.admin.inviteUserByEmail(
        user.email,
        { redirectTo },
      )

      if (resendError) {
        console.log('[usuarios] resend invite error:', resendError.message)
        throw new HttpError(500, resendError.message, 'AUTH_ERROR')
      }

      return sendSuccess({ message: 'Invitación reenviada.' })
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
