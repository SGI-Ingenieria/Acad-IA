export const CHAT_GENERATION_TIMEOUT_MS = 60 * 60 * 1000

type ChatGenerationMessage = {
  estado?: unknown
  openai_response_id?: unknown
  fecha_actualizacion?: unknown
  fecha_creacion?: unknown
  respuesta?: unknown
}

export type ChatAssistantStatus =
  | 'processing'
  | 'completed'
  | 'error'
  | 'cancelled'

function messageTimestamp(message: ChatGenerationMessage) {
  const raw = message.fecha_actualizacion ?? message.fecha_creacion
  if (typeof raw !== 'string') return null

  const timestamp = Date.parse(raw)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function isRawChatMessageProcessing(message: ChatGenerationMessage) {
  return ['PROCESANDO', 'PENDIENTE'].includes(
    String(message.estado ?? '').toUpperCase(),
  )
}

/**
 * Un mensaje que nunca recibió `openai_response_id` no puede consultarse ni
 * cancelarse en OpenAI. Después del límite durable de una hora se considera
 * huérfano para no bloquear el chat indefinidamente si el reconciliador
 * programado no alcanzó a cerrarlo.
 */
export function isStaleUnpublishedChatMessage(
  message: ChatGenerationMessage,
  now = Date.now(),
) {
  if (
    !isRawChatMessageProcessing(message) ||
    typeof message.openai_response_id === 'string'
  ) {
    return false
  }

  const timestamp = messageTimestamp(message)
  return timestamp !== null && now - timestamp >= CHAT_GENERATION_TIMEOUT_MS
}

export function isActiveChatMessageGeneration(
  message: ChatGenerationMessage,
  now = Date.now(),
) {
  return (
    isRawChatMessageProcessing(message) &&
    !isStaleUnpublishedChatMessage(message, now)
  )
}

export function getChatAssistantStatus(
  message: ChatGenerationMessage,
): ChatAssistantStatus {
  const estado = String(message.estado ?? '').toUpperCase()

  if (isStaleUnpublishedChatMessage(message)) return 'error'
  if (estado === 'PROCESANDO' || estado === 'PENDIENTE') return 'processing'
  if (estado === 'ERROR') return 'error'
  if (estado === 'CANCELADO') return 'cancelled'
  if (message.respuesta) return 'completed'
  return 'error'
}

export function getChatAssistantContent(
  message: ChatGenerationMessage,
  status: ChatAssistantStatus,
) {
  if (isStaleUnpublishedChatMessage(message)) {
    return 'La solicitud no llegó a iniciar la generación. Puedes volver a intentarlo.'
  }
  if (status === 'processing') return 'Generando respuesta...'
  if (status === 'cancelled') {
    return String(message.respuesta ?? '') || 'Esta respuesta se ha cancelado.'
  }
  if (status === 'error') {
    return (
      String(message.respuesta ?? '') ||
      'No se pudo generar la respuesta de la IA.'
    )
  }

  return (
    String(message.respuesta ?? '') ||
    'No se pudo procesar la respuesta de la IA.'
  )
}
