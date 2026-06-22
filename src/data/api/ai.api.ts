import { supabaseBrowser } from '../supabase/client'
import { invokeEdge } from '../supabase/invokeEdge'

import type { InteraccionIA, UUID } from '../types/domain'

type ReasoningEffort = 'auto' | 'none' | 'low' | 'medium' | 'high'

const EDGE = {
  ai_plan_improve: 'ai_plan_improve',
  ai_plan_chat: 'ai_plan_chat',
  ai_subject_improve: 'ai_subject_improve',
  ai_subject_chat: 'ai_subject_chat',

  library_search: 'library_search',
} as const

export async function ai_plan_improve(payload: {
  planId: UUID
  sectionKey: string // ej: "perfil_de_egreso" o tu key interna
  prompt: string
  context?: Record<string, any>
  fuentes?: {
    archivosIds?: Array<UUID>
    vectorStoresIds?: Array<UUID>
    usarMCP?: boolean
    conversacionId?: string
  }
}): Promise<{ interaccion: InteraccionIA; propuesta: any }> {
  return invokeEdge<{ interaccion: InteraccionIA; propuesta: any }>(
    EDGE.ai_plan_improve,
    payload,
  )
}

export async function ai_plan_chat(payload: {
  planId: UUID
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  fuentes?: {
    archivosIds?: Array<UUID>
    vectorStoresIds?: Array<UUID>
    usarMCP?: boolean
    conversacionId?: string
  }
}): Promise<{ interaccion: InteraccionIA; reply: string; meta?: any }> {
  return invokeEdge<{ interaccion: InteraccionIA; reply: string; meta?: any }>(
    EDGE.ai_plan_chat,
    payload,
  )
}

export async function ai_subject_improve(payload: {
  subjectId: UUID
  sectionKey: string
  prompt: string
  context?: Record<string, any>
  fuentes?: {
    archivosIds?: Array<UUID>
    vectorStoresIds?: Array<UUID>
    usarMCP?: boolean
    conversacionId?: string
  }
}): Promise<{ interaccion: InteraccionIA; propuesta: any }> {
  return invokeEdge<{ interaccion: InteraccionIA; propuesta: any }>(
    EDGE.ai_subject_improve,
    payload,
  )
}

export async function ai_subject_chat(payload: {
  subjectId: UUID
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  fuentes?: {
    archivosIds?: Array<UUID>
    vectorStoresIds?: Array<UUID>
    usarMCP?: boolean
    conversacionId?: string
  }
}): Promise<{ interaccion: InteraccionIA; reply: string; meta?: any }> {
  return invokeEdge<{ interaccion: InteraccionIA; reply: string; meta?: any }>(
    EDGE.ai_subject_chat,
    payload,
  )
}

/** Biblioteca (Edge; adapta a tu API real) */
export type LibraryItem = {
  id: string
  titulo: string
  autor?: string
  isbn?: string
  citaSugerida?: string
  disponibilidad?: string
}

export async function library_search(payload: {
  query: string
  limit?: number
}): Promise<Array<LibraryItem>> {
  return invokeEdge<Array<LibraryItem>>(EDGE.library_search, payload)
}

export async function create_conversation(planId: string) {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase.functions.invoke(
    'create-chat-conversation/plan/conversations',
    {
      method: 'POST',
      body: {
        plan_estudio_id: planId, // O el nombre que confirmamos que funciona
        instanciador: 'alex',
      },
    },
  )

  if (error) throw error
  return data
}

export async function get_chat_history(conversacionId: string) {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase.functions.invoke(
    `create-chat-conversation/conversations/${conversacionId}/messages`,
    { method: 'GET' },
  )
  if (error) throw error
  return data // Retorna Array de mensajes
}

export async function update_conversation_status(
  conversacionId: string,
  nuevoEstado: 'ARCHIVADA' | 'ACTIVA',
) {
  const supabase = supabaseBrowser()

  const { data, error } = await supabase
    .from('conversaciones_plan') // Asegúrate que el nombre de la tabla sea exacto
    .update({ estado: nuevoEstado })
    .eq('id', conversacionId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Modificamos la función de chat para que use la ruta de mensajes
export async function ai_plan_chat_v2(payload: {
  conversacionId: string
  content: string
  campos?: Array<string>
  archivosReferencia?: Array<string>
  repositoriosIds?: Array<string>
  webSearchEnabled?: boolean
  reasoningEffort?: ReasoningEffort
}): Promise<{ reply: string; meta?: any }> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase.functions.invoke(
    `create-chat-conversation/conversations/plan/${payload.conversacionId}/messages`,
    {
      method: 'POST',
      body: {
        content: payload.content,
        campos: payload.campos || [],
        archivosReferencia: payload.archivosReferencia || [],
        repositoriosIds: payload.repositoriosIds || [],
        webSearchEnabled: payload.webSearchEnabled ?? false,
        reasoningEffort: payload.reasoningEffort ?? 'auto',
      },
    },
  )
  if (error) throw error
  return data
}

export async function getConversationByPlan(planId: string) {
  const supabase = supabaseBrowser()

  const { data, error } = await supabase
    .from('conversaciones_plan')
    .select('*')
    .eq('plan_estudio_id', planId)
    .order('creado_en', { ascending: false })
  if (error) throw error

  return data
}
export async function getMessagesByConversation(conversationId: string) {
  const supabase = supabaseBrowser()

  const { data, error } = await supabase
    .from('plan_mensajes_ia')
    .select('*')
    .eq('conversacion_plan_id', conversationId)
    .order('fecha_creacion', { ascending: true }) // Ascendente para que el chat fluya en orden cronológico

  if (error) {
    console.error('Error al obtener mensajes:', error.message)
    throw error
  }

  return data
}

export async function update_conversation_title(
  conversacionId: string,
  nuevoTitulo: string,
) {
  const supabase = supabaseBrowser()

  const { data, error } = await supabase
    .from('conversaciones_plan')
    .update({ nombre: nuevoTitulo }) // Asegúrate que la columna se llame 'title' o 'nombre'
    .eq('id', conversacionId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function update_recommendation_applied_status(
  mensajeId: string, // Ahora es más eficiente usar el ID del mensaje directamente
  campoAfectado: string,
) {
  const supabase = supabaseBrowser()

  // 1. Obtener la propuesta actual de ese mensaje específico
  const { data: msgData, error: fetchError } = await supabase
    .from('plan_mensajes_ia')
    .select('propuesta')
    .eq('id', mensajeId)
    .single()

  if (fetchError) throw fetchError
  if (!msgData.propuesta)
    throw new Error('No se encontró la propuesta en el mensaje')

  const propuestaActual = msgData.propuesta as any

  // 2. Modificar el array de recommendations dentro de la propuesta
  // Mantenemos el resto de la propuesta (prompt, respuesta, etc.) intacto
  const nuevaPropuesta = {
    ...propuestaActual,
    recommendations: (propuestaActual.recommendations ?? []).map((rec: any) =>
      rec.campo_afectado === campoAfectado ? { ...rec, aplicada: true } : rec,
    ),
  }

  // 3. Actualizar la base de datos con el nuevo objeto JSON
  const { error: updateError } = await supabase
    .from('plan_mensajes_ia')
    .update({ propuesta: nuevaPropuesta })
    .eq('id', mensajeId)

  if (updateError) throw updateError

  return true
}

// --- FUNCIONES DE ASIGNATURA ---

export async function create_subject_conversation(subjectId: string) {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase.functions.invoke(
    'create-chat-conversation/asignatura/conversations', // Ruta corregida
    {
      method: 'POST',
      body: {
        asignatura_id: subjectId,
        instanciador: 'alex',
      },
    },
  )
  if (error) throw error
  return data // Retorna { conversation_asignatura: { id, ... } }
}

export async function ai_subject_chat_v2(payload: {
  conversacionId: string
  content: string
  campos?: Array<string>
  archivosReferencia?: Array<string>
  repositoriosIds?: Array<string>
  webSearchEnabled?: boolean
  reasoningEffort?: ReasoningEffort
}) {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase.functions.invoke(
    `create-chat-conversation/conversations/asignatura/${payload.conversacionId}/messages`, // Ruta corregida
    {
      method: 'POST',
      body: {
        content: payload.content,
        campos: payload.campos || [],
        archivosReferencia: payload.archivosReferencia || [],
        repositoriosIds: payload.repositoriosIds || [],
        webSearchEnabled: payload.webSearchEnabled ?? false,
        reasoningEffort: payload.reasoningEffort ?? 'auto',
      },
    },
  )
  if (error) throw error
  return data
}

export async function getConversationBySubject(subjectId: string) {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('conversaciones_asignatura') // Tabla corregida
    .select('*')
    .eq('asignatura_id', subjectId)
    .order('creado_en', { ascending: false })

  if (error) throw error
  return data
}

export async function getMessagesBySubjectConversation(conversationId: string) {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('asignatura_mensajes_ia' as any)
    .select('*')
    .eq('conversacion_asignatura_id', conversationId)
    .order('fecha_creacion', { ascending: true })

  if (error) throw error
  return data
}

export async function update_subject_recommendation_applied(
  mensajeId: string,
  campoAfectado: string,
) {
  const supabase = supabaseBrowser()

  // 1. Obtener propuesta actual
  const { data: msgData, error: fetchError } = await supabase
    .from('asignatura_mensajes_ia')
    .select('propuesta')
    .eq('id', mensajeId)
    .single()

  if (fetchError) throw fetchError
  const propuestaActual = msgData.propuesta as any

  // 2. Marcar como aplicada
  const nuevaPropuesta = {
    ...propuestaActual,
    recommendations: (propuestaActual.recommendations ?? []).map((rec: any) =>
      rec.campo_afectado === campoAfectado ? { ...rec, aplicada: true } : rec,
    ),
  }

  // 3. Update
  const { error: updateError } = await supabase
    .from('asignatura_mensajes_ia')
    .update({ propuesta: nuevaPropuesta })
    .eq('id', mensajeId)

  if (updateError) throw updateError
  return true
}

export async function update_subject_conversation_status(
  conversacionId: string,
  nuevoEstado: 'ARCHIVADA' | 'ACTIVA',
) {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('conversaciones_asignatura')
    .update({ estado: nuevoEstado })
    .eq('id', conversacionId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function update_subject_conversation_name(
  conversacionId: string,
  nuevoNombre: string,
) {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('conversaciones_asignatura')
    .update({ nombre: nuevoNombre }) // Asumiendo que la columna es 'titulo' según tu código previo, o cambia a 'nombre'
    .eq('id', conversacionId)
    .select()
    .single()

  if (error) throw error
  return data
}
