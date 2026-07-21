import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from 'jsr:@std/assert@1'

import {
  persistDocumentReferences,
  resolveFrozenDocumentReferences,
} from '../../_shared/documentos-referencias.ts'
import { resolveChatRequest } from '../../create-chat-conversation/lib/retry.ts'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222'
const CONVERSATION_ID = '33333333-3333-4333-8333-333333333333'
const MESSAGE_ID = '44444444-4444-4444-8444-444444444444'
const FILE_ID = '55555555-5555-4555-8555-555555555555'
const VERSION_ID = '66666666-6666-4666-8666-666666666666'
const CHUNK_A = '77777777-7777-4777-8777-777777777777'
const CHUNK_B = '88888888-8888-4888-8888-888888888888'

function awaitableQuery(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'order', 'in']) {
    builder[method] = () => builder
  }
  builder.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return builder
}

function retryClient(
  message: Record<string, unknown> | null,
  sourceTable?: 'plan_mensajes_ia' | 'asignatura_mensajes_ia',
) {
  return {
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () =>
          Promise.resolve({
            data: !sourceTable || table === sourceTable ? message : null,
            error: null,
          }),
      }
      return builder
    },
  } as unknown as Parameters<typeof resolveChatRequest>[0]['supabase']
}

Deno.test(
  'el servidor reemplaza el cuerpo del UI con el snapshot del autor original',
  async () => {
    const resolved = await resolveChatRequest({
      supabase: retryClient({
        id: MESSAGE_ID,
        enviado_por: USER_ID,
        mensaje: 'Analiza la progresión curricular original.',
        campos: ['perfil_egreso', 'objetivo'],
        web_search_enabled: true,
        reasoning_effort: 'high',
        conversacion_plan_id: CONVERSATION_ID,
      }),
      conversationType: 'plan',
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
      body: {
        retryOfMessageId: MESSAGE_ID,
        content: 'Texto adulterado por el cliente',
        campos: ['otro_campo'],
        webSearchEnabled: false,
        reasoningEffort: 'none',
      },
    })

    assertEquals(resolved, {
      content: 'Analiza la progresión curricular original.',
      campos: ['perfil_egreso', 'objetivo'],
      webSearchEnabled: true,
      reasoningEffort: 'high',
      retryOfMessageId: MESSAGE_ID,
    })
  },
)

Deno.test('el servidor exige el autor original para reintentar', async () => {
  const error = await assertRejects(() =>
    resolveChatRequest({
      supabase: retryClient({
        id: MESSAGE_ID,
        enviado_por: OTHER_USER_ID,
        mensaje: 'Solicitud ajena.',
        campos: [],
        web_search_enabled: false,
        reasoning_effort: 'auto',
        conversacion_plan_id: CONVERSATION_ID,
      }),
      conversationType: 'plan',
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
      body: { retryOfMessageId: MESSAGE_ID },
    }),
  )

  assertEquals(
    (error as Error & { code?: string }).code,
    'retry_author_mismatch',
  )
})

Deno.test(
  'el servidor rechaza un mensaje original de otra conversación',
  async () => {
    const error = await assertRejects(() =>
      resolveChatRequest({
        supabase: retryClient({
          id: MESSAGE_ID,
          enviado_por: USER_ID,
          mensaje: 'Solicitud de otra conversación.',
          campos: [],
          web_search_enabled: false,
          reasoning_effort: 'auto',
          conversacion_plan_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        }),
        conversationType: 'plan',
        conversationId: CONVERSATION_ID,
        userId: USER_ID,
        body: { retryOfMessageId: MESSAGE_ID },
      }),
    )

    assertEquals(
      (error as Error & { code?: string }).code,
      'retry_conversation_mismatch',
    )
  },
)

Deno.test('el servidor no acepta un mensaje de otro tipo de chat', async () => {
  const error = await assertRejects(() =>
    resolveChatRequest({
      supabase: retryClient(
        {
          id: MESSAGE_ID,
          enviado_por: USER_ID,
          mensaje: 'Solicitud de asignatura.',
          campos: [],
          web_search_enabled: false,
          reasoning_effort: 'auto',
          conversacion_asignatura_id: CONVERSATION_ID,
        },
        'asignatura_mensajes_ia',
      ),
      conversationType: 'plan',
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
      body: { retryOfMessageId: MESSAGE_ID },
    }),
  )

  assertEquals(
    (error as Error & { code?: string }).code,
    'retry_source_not_found',
  )
})

Deno.test(
  'el retrieval reusa exactamente chunk_ids, scores y query congelados',
  async () => {
    const references = [
      {
        id: '99999999-9999-4999-8999-999999999999',
        request_id: 'resp_original',
        file_id: FILE_ID,
        file_version_id: VERSION_ID,
        mode: 'retrieval',
        chunk_ids: [CHUNK_B, CHUNK_A],
        retrieval_query: 'consulta vectorial original',
        retrieval_scores: { [CHUNK_A]: 0.41, [CHUNK_B]: 0.73 },
      },
    ]
    const chunks = [
      {
        id: CHUNK_A,
        file_version_id: VERSION_ID,
        page_start: 1,
        page_end: 1,
        text: 'Primer fragmento físico.',
      },
      {
        id: CHUNK_B,
        file_version_id: VERSION_ID,
        page_start: 4,
        page_end: 6,
        text: 'Segundo fragmento físico.',
      },
    ]
    const supabase = {
      rpc: () => Promise.resolve({ data: true, error: null }),
      from: (table: string) =>
        table === 'ai_request_references'
          ? awaitableQuery({ data: references, error: null })
          : awaitableQuery({ data: chunks, error: null }),
    } as unknown as Parameters<
      typeof resolveFrozenDocumentReferences
    >[0]['supabase']

    const resolved = await resolveFrozenDocumentReferences({
      supabase,
      userId: USER_ID,
      conversationType: 'plan',
      conversationId: CONVERSATION_ID,
      messageId: MESSAGE_ID,
    })

    assertEquals(resolved.mode, 'retrieval')
    assertEquals(resolved.query, 'consulta vectorial original')
    assertEquals(resolved.references, [
      {
        fileId: FILE_ID,
        fileVersionId: VERSION_ID,
        chunkIds: [CHUNK_B, CHUNK_A],
        scores: { [CHUNK_A]: 0.41, [CHUNK_B]: 0.73 },
      },
    ])
    assertStringIncludes(resolved.context, 'pp. 4-6')
    assertEquals(
      resolved.context.indexOf('Segundo fragmento físico.') <
        resolved.context.indexOf('Primer fragmento físico.'),
      true,
    )
  },
)

Deno.test(
  'la entrada directa usa el file_version_id congelado aunque ya no sea actual',
  async () => {
    const references = [
      {
        id: '99999999-9999-4999-8999-999999999999',
        request_id: 'resp_original',
        file_id: FILE_ID,
        file_version_id: VERSION_ID,
        mode: 'direct',
        chunk_ids: [],
        retrieval_query: null,
        retrieval_scores: {},
      },
    ]
    const versions = [
      {
        id: VERSION_ID,
        file_id: FILE_ID,
        original_filename: 'version-original.txt',
        files: {
          display_name: 'Plan vigente',
          status: 'ready',
          current_version_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        },
        file_blobs: {
          storage_bucket: 'documentos-academicos',
          storage_path: 'content/version-original',
          size_bytes: 16,
          detected_mime: 'text/plain',
        },
      },
    ]
    const supabase = {
      rpc: () => Promise.resolve({ data: true, error: null }),
      from: (table: string) =>
        table === 'ai_request_references'
          ? awaitableQuery({ data: references, error: null })
          : awaitableQuery({ data: versions, error: null }),
      storage: {
        from: () => ({
          download: () =>
            Promise.resolve({
              data: new Blob(['version original'], { type: 'text/plain' }),
              error: null,
            }),
        }),
      },
    } as unknown as Parameters<
      typeof resolveFrozenDocumentReferences
    >[0]['supabase']

    const resolved = await resolveFrozenDocumentReferences({
      supabase,
      userId: USER_ID,
      conversationType: 'plan',
      conversationId: CONVERSATION_ID,
      messageId: MESSAGE_ID,
    })

    assertEquals(resolved.mode, 'direct')
    assertEquals(resolved.references[0]?.fileVersionId, VERSION_ID)
    const input = resolved.inputFiles[0]
    assertEquals(input?.type, 'input_file')
    if (input?.type !== 'input_file') throw new Error('Se esperaba input_file')
    assertEquals(input.filename, 'version-original.txt')
  },
)

Deno.test('un fallo al persistir referencias se propaga', async () => {
  const supabase = {
    from: () => ({
      upsert: () =>
        Promise.resolve({
          error: { message: 'fallo de escritura simulado' },
        }),
    }),
  } as unknown as Parameters<typeof persistDocumentReferences>[0]['supabase']

  const error = await assertRejects(() =>
    persistDocumentReferences({
      supabase,
      tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      requestId: 'resp_retry',
      conversationType: 'plan',
      conversationId: CONVERSATION_ID,
      messageId: MESSAGE_ID,
      references: [
        {
          fileId: FILE_ID,
          fileVersionId: VERSION_ID,
          chunkIds: [],
          scores: {},
        },
      ],
      mode: 'direct',
      query: 'Solicitud original',
    }),
  )

  assertEquals(
    (error as Error & { code?: string }).code,
    'DOCUMENT_REFERENCE_PERSIST_FAILED',
  )
})

Deno.test(
  'un fallo al asociar referencias a la conversación se propaga',
  async () => {
    const supabase = {
      from: (table: string) => ({
        upsert: () =>
          Promise.resolve({
            error:
              table === 'conversation_files'
                ? { message: 'fallo de asociación simulado' }
                : null,
          }),
      }),
    } as unknown as Parameters<typeof persistDocumentReferences>[0]['supabase']

    const error = await assertRejects(() =>
      persistDocumentReferences({
        supabase,
        tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        requestId: 'resp_retry',
        conversationType: 'plan',
        conversationId: CONVERSATION_ID,
        messageId: MESSAGE_ID,
        references: [
          {
            fileId: FILE_ID,
            fileVersionId: VERSION_ID,
            chunkIds: [],
            scores: {},
          },
        ],
        mode: 'direct',
        query: 'Solicitud original',
        userId: USER_ID,
        attachToConversation: true,
      }),
    )

    assertEquals(
      (error as Error & { code?: string }).code,
      'CONVERSATION_REFERENCE_PERSIST_FAILED',
    )
  },
)
