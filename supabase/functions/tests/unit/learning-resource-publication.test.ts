import { assertEquals, assertRejects } from 'jsr:@std/assert@1'

import {
  LearningResourcePublicationError,
  publishLearningResourceGenerationAtomically,
  shouldMarkLearningResourceJobFailed,
} from '../../learning-object-generate/publication.ts'

const BASE_ARGS = {
  generationJobId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  responseId: 'resp_learning_publication',
  localState: 'running' as const,
  openAIStatus: 'in_progress',
  startedAt: '2026-07-21T19:50:00.000Z',
  metadata: { source: 'unit-test' },
  referenceMode: 'none' as const,
  referenceQuery: 'Genera un apunte verificable.',
  references: [],
}

const PUBLISHED = {
  resolution: 'published',
  localJob: {
    id: BASE_ARGS.generationJobId,
    openai_response_id: BASE_ARGS.responseId,
  },
  globalJob: {
    id: '33333333-3333-4333-8333-333333333333',
    entidad_id: BASE_ARGS.generationJobId,
    openai_response_id: BASE_ARGS.responseId,
  },
}

Deno.test(
  'publica job, trabajo y referencias mediante una sola RPC',
  async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = []
    let cancellations = 0
    const result = await publishLearningResourceGenerationAtomically({
      ...BASE_ARGS,
      supabase: {
        rpc: (name, args) => {
          calls.push({ name, args })
          return Promise.resolve({ data: PUBLISHED, error: null })
        },
      },
      cancelRemoteResponse: () => {
        cancellations += 1
        return Promise.resolve(null)
      },
    })

    assertEquals(result.resolution, 'published')
    assertEquals(
      calls.map((call) => call.name),
      ['publicar_generacion_recursos_ia'],
    )
    assertEquals(calls[0]?.args.p_referencias, [])
    assertEquals(cancellations, 0)
  },
)

Deno.test('confirma un commit cuyo resultado HTTP se perdió', async () => {
  const calls: Array<string> = []
  const result = await publishLearningResourceGenerationAtomically({
    ...BASE_ARGS,
    supabase: {
      rpc: (name) => {
        calls.push(name)
        if (name === 'publicar_generacion_recursos_ia') {
          return Promise.reject(new TypeError('Failed to fetch'))
        }
        return Promise.resolve({ data: PUBLISHED, error: null })
      },
    },
    cancelRemoteResponse: () => Promise.resolve(null),
  })

  assertEquals(result.resolution, 'published')
  assertEquals(calls, [
    'publicar_generacion_recursos_ia',
    'consultar_publicacion_generacion_recursos_ia',
  ])
})

Deno.test(
  'reintenta idempotentemente cuando la primera publicación es incierta',
  async () => {
    let publicationCalls = 0
    const calls: Array<string> = []
    const result = await publishLearningResourceGenerationAtomically({
      ...BASE_ARGS,
      supabase: {
        rpc: (name) => {
          calls.push(name)
          if (name === 'consultar_publicacion_generacion_recursos_ia') {
            return Promise.resolve({
              data: { resolution: 'missing' },
              error: null,
            })
          }
          publicationCalls += 1
          return publicationCalls === 1
            ? Promise.reject(new TypeError('network reset'))
            : Promise.resolve({ data: PUBLISHED, error: null })
        },
      },
      cancelRemoteResponse: () => Promise.resolve(null),
    })

    assertEquals(result.resolution, 'published')
    assertEquals(calls, [
      'publicar_generacion_recursos_ia',
      'consultar_publicacion_generacion_recursos_ia',
      'publicar_generacion_recursos_ia',
    ])
  },
)

Deno.test(
  'un rechazo determinista cancela best-effort y permite fallar el job local',
  async () => {
    const cancellations: Array<string> = []
    const error = await assertRejects(
      () =>
        publishLearningResourceGenerationAtomically({
          ...BASE_ARGS,
          supabase: {
            rpc: (name) =>
              name === 'publicar_generacion_recursos_ia'
                ? Promise.resolve({
                    data: null,
                    error: { code: '23503', message: 'referencia inválida' },
                  })
                : Promise.resolve({
                    data: { resolution: 'missing' },
                    error: null,
                  }),
          },
          cancelRemoteResponse: (responseId) => {
            cancellations.push(responseId)
            return Promise.resolve(null)
          },
        }),
      LearningResourcePublicationError,
    )

    assertEquals(error.code, 'LEARNING_PUBLICATION_FAILED')
    assertEquals(shouldMarkLearningResourceJobFailed(error), true)
    assertEquals(cancellations, [BASE_ARGS.responseId])
  },
)

Deno.test(
  'sólo cancela la respuesta perdedora cuando Postgres demuestra otro ganador',
  async () => {
    const cancellations: Array<string> = []
    const error = await assertRejects(
      () =>
        publishLearningResourceGenerationAtomically({
          ...BASE_ARGS,
          supabase: {
            rpc: (name) =>
              name === 'publicar_generacion_recursos_ia'
                ? Promise.resolve({
                    data: null,
                    error: { code: '55000', message: 'respuesta vigente' },
                  })
                : Promise.resolve({
                    data: {
                      resolution: 'claimed_elsewhere',
                      winnerResponseId: 'resp_winner',
                    },
                    error: null,
                  }),
          },
          cancelRemoteResponse: (responseId) => {
            cancellations.push(responseId)
            return Promise.resolve(null)
          },
        }),
      LearningResourcePublicationError,
    )

    assertEquals(error.code, 'LEARNING_PUBLICATION_CONFLICT')
    assertEquals(shouldMarkLearningResourceJobFailed(error), false)
    assertEquals(cancellations, [BASE_ARGS.responseId])
  },
)

Deno.test(
  'un transporte ambiguo no cancela ni marca fallido el job',
  async () => {
    let cancellations = 0
    const error = await assertRejects(
      () =>
        publishLearningResourceGenerationAtomically({
          ...BASE_ARGS,
          supabase: {
            rpc: (name) =>
              name === 'publicar_generacion_recursos_ia'
                ? Promise.reject(new TypeError('connection closed'))
                : Promise.resolve({
                    data: { resolution: 'missing' },
                    error: null,
                  }),
          },
          cancelRemoteResponse: () => {
            cancellations += 1
            return Promise.resolve(null)
          },
        }),
      LearningResourcePublicationError,
    )

    assertEquals(error.code, 'LEARNING_PUBLICATION_UNCONFIRMED')
    assertEquals(error.ambiguous, true)
    assertEquals(shouldMarkLearningResourceJobFailed(error), false)
    assertEquals(cancellations, 0)
  },
)
