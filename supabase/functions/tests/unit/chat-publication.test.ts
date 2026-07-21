import { assertEquals, assertRejects } from 'jsr:@std/assert@1'

import {
  prepareChatGenerationAttempt,
  publishDurableChatResponse,
} from '../../create-chat-conversation/lib/publication.ts'

import type { ChatGenerationAttempt } from '../../create-chat-conversation/lib/publication.ts'

const ATTEMPT: ChatGenerationAttempt = {
  id: '11111111-1111-4111-8111-111111111111',
  tipo_conversacion: 'plan',
  conversacion_id: '22222222-2222-4222-8222-222222222222',
  mensaje_id: '33333333-3333-4333-8333-333333333333',
  usuario_id: '44444444-4444-4444-8444-444444444444',
  estado: 'reclamado',
  solicitud: {
    model: 'gpt-5.6-luna',
    background: true,
    metadata: {
      tabla: 'plan_mensajes_ia',
      mensaje_id: '33333333-3333-4333-8333-333333333333',
    },
    input: [
      { role: 'system', content: 'Sistema' },
      { role: 'user', content: 'Solicitud durable' },
    ],
  },
  modo_referencias: 'none',
  consulta_referencias: 'Solicitud durable',
  referencias: [],
  openai_response_id: null,
  estado_openai: null,
  iniciado_en: null,
  token_reclamacion: '55555555-5555-4555-8555-555555555555',
  reclamado_por: 'unit-test',
  reclamado_hasta: '2026-07-21T20:02:00.000Z',
  intentos: 1,
  siguiente_intento: '2026-07-21T20:00:00.000Z',
  fecha_limite: '2026-07-21T21:00:00.000Z',
}

const LINKED_ATTEMPT: ChatGenerationAttempt = {
  ...ATTEMPT,
  estado: 'respuesta_vinculada',
  openai_response_id: 'resp_chat_durable',
  estado_openai: 'queued',
  iniciado_en: '2026-07-21T20:00:00.000Z',
}

const PUBLISHED_ATTEMPT: ChatGenerationAttempt = {
  ...LINKED_ATTEMPT,
  estado: 'publicado',
  token_reclamacion: null,
  reclamado_por: null,
  reclamado_hasta: null,
}

const RESPONSE = {
  responseId: 'resp_chat_durable',
  openaiRaw: {
    id: 'resp_chat_durable',
    status: 'queued',
    created_at: 1_774_123_200,
  },
} as Parameters<typeof publishDurableChatResponse>[0]['response']

Deno.test(
  'prepara el outbox antes del efecto remoto y no persiste binarios directos',
  async () => {
    let rpcArgs: Record<string, unknown> = {}
    const prepared = await prepareChatGenerationAttempt({
      supabase: {
        rpc: (_name: string, args: Record<string, unknown>) => {
          rpcArgs = args
          return Promise.resolve({ data: ATTEMPT, error: null })
        },
      },
      attemptId: ATTEMPT.id,
      conversationType: ATTEMPT.tipo_conversacion,
      conversationId: ATTEMPT.conversacion_id,
      messageId: ATTEMPT.mensaje_id,
      userId: ATTEMPT.usuario_id,
      request: ATTEMPT.solicitud,
      referenceMode: 'none',
      referenceQuery: ATTEMPT.consulta_referencias,
      references: [],
    })

    assertEquals(prepared.id, ATTEMPT.id)
    assertEquals(rpcArgs.p_solicitud, ATTEMPT.solicitud)
    assertEquals(JSON.stringify(rpcArgs).includes('file_data'), false)
  },
)

Deno.test(
  'una preparación con commit incierto se confirma por el identificador estable',
  async () => {
    const calls: Array<string> = []
    const prepared = await prepareChatGenerationAttempt({
      supabase: {
        rpc: (name: string) => {
          calls.push(name)
          if (name === 'preparar_intento_chat_ia') {
            return Promise.reject(new TypeError('Failed to fetch'))
          }
          return Promise.resolve({ data: ATTEMPT, error: null })
        },
      },
      attemptId: ATTEMPT.id,
      conversationType: ATTEMPT.tipo_conversacion,
      conversationId: ATTEMPT.conversacion_id,
      messageId: ATTEMPT.mensaje_id,
      userId: ATTEMPT.usuario_id,
      request: ATTEMPT.solicitud,
      referenceMode: 'none',
      referenceQuery: ATTEMPT.consulta_referencias,
      references: [],
    })

    assertEquals(prepared.id, ATTEMPT.id)
    assertEquals(calls, [
      'preparar_intento_chat_ia',
      'consultar_intento_chat_ia',
    ])
  },
)

Deno.test('vincula y publica el happy path sin cancelar', async () => {
  const calls: Array<string> = []
  let cancellationCalls = 0
  const result = await publishDurableChatResponse({
    supabase: {
      rpc: (name: string) => {
        calls.push(name)
        if (name === 'vincular_respuesta_intento_chat_ia') {
          return Promise.resolve({
            data: { resolution: 'linked', attempt: LINKED_ATTEMPT },
            error: null,
          })
        }
        return Promise.resolve({
          data: { resolution: 'applied', attempt: PUBLISHED_ATTEMPT },
          error: null,
        })
      },
    },
    attempt: ATTEMPT,
    response: RESPONSE,
    cancelDuplicateResponse: () => {
      cancellationCalls += 1
      return Promise.resolve(null)
    },
  })

  assertEquals(result.resolution, 'applied')
  assertEquals(calls, [
    'vincular_respuesta_intento_chat_ia',
    'publicar_intento_chat_ia',
  ])
  assertEquals(cancellationCalls, 0)
})

Deno.test(
  'si publicar rechaza después de commit, inspecciona y no cancela la respuesta vigente',
  async () => {
    let cancellationCalls = 0
    const result = await publishDurableChatResponse({
      supabase: {
        rpc: (name: string) => {
          if (name === 'vincular_respuesta_intento_chat_ia') {
            return Promise.resolve({
              data: { resolution: 'linked', attempt: LINKED_ATTEMPT },
              error: null,
            })
          }
          if (name === 'publicar_intento_chat_ia') {
            return Promise.reject(new TypeError('Failed to fetch'))
          }
          return Promise.resolve({ data: PUBLISHED_ATTEMPT, error: null })
        },
      },
      attempt: ATTEMPT,
      response: RESPONSE,
      cancelDuplicateResponse: () => {
        cancellationCalls += 1
        return Promise.resolve(null)
      },
    })

    assertEquals(result.resolution, 'already_applied')
    assertEquals(result.attempt?.estado, 'publicado')
    assertEquals(cancellationCalls, 0)
  },
)

Deno.test(
  'si vincular rechaza después de commit, confirma el response_id y continúa',
  async () => {
    let linkCalls = 0
    const result = await publishDurableChatResponse({
      supabase: {
        rpc: (name: string) => {
          if (name === 'vincular_respuesta_intento_chat_ia') {
            linkCalls += 1
            return Promise.reject(new TypeError('connection reset'))
          }
          if (name === 'consultar_intento_chat_ia') {
            return Promise.resolve({ data: LINKED_ATTEMPT, error: null })
          }
          return Promise.resolve({
            data: { resolution: 'applied', attempt: PUBLISHED_ATTEMPT },
            error: null,
          })
        },
      },
      attempt: ATTEMPT,
      response: RESPONSE,
    })

    assertEquals(linkCalls, 1)
    assertEquals(result.resolution, 'applied')
  },
)

Deno.test(
  'un estado indeterminado nunca autoriza cancelar la respuesta remota',
  async () => {
    let cancellationCalls = 0
    const result = await publishDurableChatResponse({
      supabase: {
        rpc: (name: string) => {
          if (name === 'vincular_respuesta_intento_chat_ia') {
            return Promise.resolve({
              data: { resolution: 'claimed_elsewhere', attempt: null },
              error: null,
            })
          }
          return Promise.resolve({
            data: { resolution: 'claimed_elsewhere', attempt: null },
            error: null,
          })
        },
      },
      attempt: ATTEMPT,
      response: RESPONSE,
      cancelDuplicateResponse: () => {
        cancellationCalls += 1
        return Promise.resolve(null)
      },
    })

    assertEquals(result.resolution, 'claimed_elsewhere')
    assertEquals(cancellationCalls, 0)
  },
)

Deno.test(
  'sólo cancela cuando Postgres demuestra que otro response_id ganó',
  async () => {
    const winner = {
      ...PUBLISHED_ATTEMPT,
      openai_response_id: 'resp_winner',
    }
    const cancelled: Array<string> = []
    const result = await publishDurableChatResponse({
      supabase: {
        rpc: () =>
          Promise.resolve({
            data: { resolution: 'claimed_elsewhere', attempt: winner },
            error: null,
          }),
      },
      attempt: ATTEMPT,
      response: RESPONSE,
      cancelDuplicateResponse: (responseId) => {
        cancelled.push(responseId)
        return Promise.resolve(null)
      },
    })

    assertEquals(result.resolution, 'claimed_elsewhere')
    assertEquals(cancelled, [RESPONSE.responseId])
  },
)

Deno.test(
  'un fallo confirmado de publicación queda para recovery y no dispara cancelación ciega',
  async () => {
    let cancellationCalls = 0
    const error = await assertRejects(
      () =>
        publishDurableChatResponse({
          supabase: {
            rpc: (name: string) => {
              if (name === 'vincular_respuesta_intento_chat_ia') {
                return Promise.resolve({
                  data: { resolution: 'linked', attempt: LINKED_ATTEMPT },
                  error: null,
                })
              }
              if (name === 'consultar_intento_chat_ia') {
                return Promise.resolve({ data: LINKED_ATTEMPT, error: null })
              }
              return Promise.resolve({
                data: null,
                error: { code: '23503', message: 'referencia inválida' },
              })
            },
          },
          attempt: ATTEMPT,
          response: RESPONSE,
          cancelDuplicateResponse: () => {
            cancellationCalls += 1
            return Promise.resolve(null)
          },
        }),
      Error,
      'La respuesta quedó resguardada',
    )

    assertEquals(
      (error as { code?: unknown }).code,
      'CHAT_ATTEMPT_PUBLICATION_FAILED',
    )
    assertEquals(cancellationCalls, 0)
  },
)
