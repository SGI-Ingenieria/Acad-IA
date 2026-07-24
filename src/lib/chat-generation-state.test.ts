import { describe, expect, test } from 'bun:test'

import {
  CHAT_GENERATION_TIMEOUT_MS,
  getChatAssistantContent,
  getChatAssistantStatus,
  isActiveChatMessageGeneration,
  isStaleUnpublishedChatMessage,
} from './chat-generation-state'

const NOW = Date.parse('2026-07-23T18:00:00.000Z')

describe('estado de generaciones de chat', () => {
  test('mantiene activa una solicitud publicada aunque sea antigua', () => {
    const message = {
      estado: 'PROCESANDO',
      openai_response_id: 'resp_123',
      fecha_actualizacion: new Date(
        NOW - CHAT_GENERATION_TIMEOUT_MS * 2,
      ).toISOString(),
    }

    expect(isStaleUnpublishedChatMessage(message, NOW)).toBe(false)
    expect(isActiveChatMessageGeneration(message, NOW)).toBe(true)
  })

  test('expira una solicitud que nunca se publicó después de una hora', () => {
    const message = {
      estado: 'PROCESANDO',
      openai_response_id: null,
      fecha_actualizacion: new Date(
        NOW - CHAT_GENERATION_TIMEOUT_MS,
      ).toISOString(),
    }

    expect(isStaleUnpublishedChatMessage(message, NOW)).toBe(true)
    expect(isActiveChatMessageGeneration(message, NOW)).toBe(false)
  })

  test('presenta el mensaje huérfano como error reintentable', () => {
    const message = {
      estado: 'PROCESANDO',
      openai_response_id: null,
      fecha_actualizacion: '2026-07-20T18:00:00.000Z',
    }

    const status = getChatAssistantStatus(message)

    expect(status).toBe('error')
    expect(getChatAssistantContent(message, status)).toContain(
      'no llegó a iniciar',
    )
  })
})
