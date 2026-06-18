import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { corsHeaders } from '../_shared/cors.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'

// Edge Function: flujo de revisión de la materia (estilo PR). El profesor envía a
// revisión (borrador→revisada); un revisor aprueba (revisada→aprobada) o pide
// cambios (revisada→borrador). La validación vive en la RPC SECURITY DEFINER
// usuario_puede_transicionar_asignatura; aquí se resuelve el actor por su JWT y
// se aplica con el service role. Se registra la transición en cambios_asignatura.

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

const PayloadSchema = z.object({
  asignaturaId: z.string().uuid('asignaturaId inválido.'),
  nuevoEstado: z.enum(['borrador', 'revisada', 'aprobada']),
  comentario: z.string().trim().max(5000).optional(),
})

async function getCallerId(req: Request, supabase: AdminClient): Promise<string> {
  const token = (req.headers.get('Authorization') ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim()
  if (!token) throw new HttpError(401, 'No autenticado.', 'UNAUTHENTICATED')
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    throw new HttpError(401, 'Sesión inválida.', 'UNAUTHENTICATED')
  }
  return data.user.id
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

    const parsed = PayloadSchema.safeParse(rawBody)
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(' ')
      throw new HttpError(422, message, 'VALIDATION_ERROR')
    }
    const { asignaturaId, nuevoEstado, comentario } = parsed.data

    const supabase = getAdminClient()
    const callerId = await getCallerId(req, supabase)

    const { data: asignatura, error: asigError } = await supabase
      .from('asignaturas')
      .select('id, estado')
      .eq('id', asignaturaId)
      .maybeSingle()
    if (asigError) throw new HttpError(500, asigError.message, 'DB_ERROR')
    if (!asignatura) {
      throw new HttpError(404, 'Asignatura no encontrada.', 'NOT_FOUND')
    }
    if (asignatura.estado === nuevoEstado) {
      throw new HttpError(409, 'La asignatura ya está en ese estado.', 'NO_OP')
    }

    const { data: puede, error: authzError } = await supabase.rpc(
      'usuario_puede_transicionar_asignatura',
      {
        p_usuario_id: callerId,
        p_asignatura_id: asignaturaId,
        p_nuevo_estado: nuevoEstado,
      },
    )
    if (authzError) throw new HttpError(500, authzError.message, 'DB_ERROR')
    if (!puede) {
      throw new HttpError(
        403,
        'No puedes realizar esta transición de la asignatura.',
        'FORBIDDEN',
      )
    }

    // "Pedir cambios" (revisada→borrador) exige un comentario que lo justifique.
    const esPedirCambios =
      nuevoEstado === 'borrador' && asignatura.estado === 'revisada'
    const comentarioLimpio = comentario?.trim() ?? ''
    if (esPedirCambios && comentarioLimpio.length === 0) {
      throw new HttpError(
        422,
        'Agrega un comentario indicando los cambios solicitados.',
        'COMENTARIO_REQUERIDO',
      )
    }

    const { error: updateError } = await supabase
      .from('asignaturas')
      .update({
        estado: nuevoEstado,
        actualizado_por: callerId,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', asignaturaId)
    if (updateError) throw new HttpError(500, updateError.message, 'DB_ERROR')

    // Registra la transición en el historial de la materia (el trigger de
    // auditoría no rastrea cambios de estado).
    await supabase.from('cambios_asignatura').insert({
      asignatura_id: asignaturaId,
      cambiado_por: callerId,
      tipo: 'TRANSICION_ESTADO',
      campo: 'estado',
      valor_anterior: asignatura.estado,
      valor_nuevo: nuevoEstado,
      fuente: 'HUMANO',
    })

    if (comentarioLimpio.length > 0) {
      const { error: comentarioError } = await supabase
        .from('comentarios_asignatura')
        .insert({
          asignatura_id: asignaturaId,
          autor_id: callerId,
          categoria: 'INTERNO',
          cuerpo: comentarioLimpio,
        })
      if (comentarioError) {
        console.error(
          '[subjects_transition_state] comentario insert error:',
          comentarioError.message,
        )
      }
    }

    return sendSuccess({ ok: true })
  } catch (error) {
    if (error instanceof HttpError) {
      console.error(
        `[subjects_transition_state] ${error.status} ${error.code}: ${error.message}`,
      )
      return sendError(error.status, error.message, error.code)
    }
    console.error('[subjects_transition_state] Critical error:', error)
    return sendError(500, 'Error inesperado en el servidor.', 'INTERNAL_SERVER_ERROR')
  }
})
