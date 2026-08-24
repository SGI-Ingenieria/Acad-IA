import {
  hydrateDirectDocumentReferences,
  hydrateRetrievalDocumentReferences,
  type DocumentReferenceResolution,
} from './documentos-referencias.ts'
import type { OpenAIInputFile } from './openai-file-input.ts'
import type { StructuredResponseOptions } from './openai-service.ts'
import type { ServiceRoleClient } from './supabase.ts'
import { HttpError } from './utils.ts'
import { asRecord, nonEmptyString } from './value.ts'

export { asRecord, nonEmptyString } from './value.ts'

export type GenerationAttemptClient = { rpc: unknown }
export type GenerationRpcResult = { data: unknown; error: unknown }

export type DurableGenerationAttemptCore<State extends string> = {
  raw: Record<string, unknown>
  id: string
  estado: State
  solicitud: StructuredResponseOptions
  modo_referencias: DocumentReferenceResolution['mode']
  consulta_referencias: string
  referencias: DocumentReferenceResolution['references']
  openai_response_id: string | null
  estado_openai: string | null
  iniciado_en: string | null
  token_reclamacion: string | null
  reclamado_por: string | null
  reclamado_hasta: string | null
  intentos: number
  siguiente_intento: string
  fecha_limite: string
}

export function parseDocumentReferences(
  value: unknown,
): DocumentReferenceResolution['references'] | null {
  if (!Array.isArray(value)) return null
  const parsed: DocumentReferenceResolution['references'] = []
  for (const candidate of value) {
    const item = asRecord(candidate)
    const fileId = nonEmptyString(item?.fileId)
    const fileVersionId = nonEmptyString(item?.fileVersionId)
    const chunkIds = item?.chunkIds
    const scores = asRecord(item?.scores)
    if (
      !fileId ||
      !fileVersionId ||
      !Array.isArray(chunkIds) ||
      chunkIds.some((chunkId) => typeof chunkId !== 'string') ||
      !scores ||
      Object.values(scores).some(
        (score) => typeof score !== 'number' || !Number.isFinite(score),
      )
    ) {
      return null
    }
    const resolvedAs = nonEmptyString(item?.resolvedAs)
    parsed.push({
      fileId,
      fileVersionId,
      ...(resolvedAs === 'direct' || resolvedAs === 'retrieval'
        ? { resolvedAs }
        : {}),
      chunkIds: [...chunkIds] as Array<string>,
      scores: scores as Record<string, number>,
    })
  }
  return parsed
}

export function parseDurableGenerationAttemptCore<State extends string>(
  value: unknown,
  allowedStates: ReadonlyArray<State>,
): DurableGenerationAttemptCore<State> | null {
  const raw = asRecord(value)
  const id = nonEmptyString(raw?.id)
  const request = asRecord(raw?.solicitud)
  const references = parseDocumentReferences(raw?.referencias)
  const mode = raw?.modo_referencias
  const state = raw?.estado
  const nextAttempt = nonEmptyString(raw?.siguiente_intento)
  const deadline = nonEmptyString(raw?.fecha_limite)
  if (
    !raw ||
    !id ||
    !request ||
    !references ||
    (mode !== 'none' && mode !== 'direct' && mode !== 'retrieval') ||
    typeof state !== 'string' ||
    !allowedStates.includes(state as State) ||
    typeof raw.consulta_referencias !== 'string' ||
    typeof raw.intentos !== 'number' ||
    !nextAttempt ||
    !deadline
  ) {
    return null
  }

  return {
    raw,
    id,
    estado: state as State,
    solicitud: request as StructuredResponseOptions,
    modo_referencias: mode,
    consulta_referencias: raw.consulta_referencias,
    referencias: references,
    openai_response_id: nonEmptyString(raw.openai_response_id),
    estado_openai: nonEmptyString(raw.estado_openai),
    iniciado_en: nonEmptyString(raw.iniciado_en),
    token_reclamacion: nonEmptyString(raw.token_reclamacion),
    reclamado_por: nonEmptyString(raw.reclamado_por),
    reclamado_hasta: nonEmptyString(raw.reclamado_hasta),
    intentos: raw.intentos,
    siguiente_intento: nextAttempt,
    fecha_limite: deadline,
  }
}

export function durableGenerationAttemptCoreValue<State extends string>(
  core: DurableGenerationAttemptCore<State>,
): Omit<DurableGenerationAttemptCore<State>, 'raw'> {
  const { raw: _raw, ...value } = core
  void _raw
  return value
}

export function callGenerationRpc(
  client: GenerationAttemptClient,
  functionName: string,
  args: Record<string, unknown>,
): PromiseLike<GenerationRpcResult> {
  return (
    client.rpc as (
      name: string,
      values: Record<string, unknown>,
    ) => PromiseLike<GenerationRpcResult>
  )(functionName, args)
}

export function generationRpcFailure(
  code: string,
  message: string,
  details: unknown,
): HttpError {
  return new HttpError(500, message, code, details)
}

export async function adoptGenerationAttemptFromWebhook<Envelope>(args: {
  client: GenerationAttemptClient
  rpcName: string
  attemptId: string
  response: { id: string; status?: unknown; created_at?: unknown }
  parseEnvelope: (value: unknown) => Envelope | null
  errorCode: string
  errorMessage: string
}): Promise<Envelope> {
  const { data, error } = await callGenerationRpc(args.client, args.rpcName, {
    p_intento_id: args.attemptId,
    p_openai_response_id: args.response.id,
    p_estado_openai: String(args.response.status ?? 'unknown'),
    p_iniciado_en: openAIResponseStartedAt(args.response),
  })
  const envelope = !error ? args.parseEnvelope(data) : null
  if (!envelope) {
    throw generationRpcFailure(args.errorCode, args.errorMessage, error ?? data)
  }
  return envelope
}

export function serializeGenerationError(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { message: String(error) }
}

export async function claimGenerationAttempts<T>(args: {
  client: GenerationAttemptClient
  rpcName: string
  rpcArgs: Record<string, unknown>
  parse: (value: unknown) => T | null
  errorCode: string
  errorMessage: string
}): Promise<Array<T>> {
  const { data, error } = await callGenerationRpc(
    args.client,
    args.rpcName,
    args.rpcArgs,
  )
  if (error || !Array.isArray(data)) {
    throw generationRpcFailure(args.errorCode, args.errorMessage, error ?? data)
  }
  return data
    .map(args.parse)
    .filter((attempt): attempt is T => attempt !== null)
}

export async function requeueGenerationAttempt(args: {
  client: GenerationAttemptClient
  rpcName: string
  attemptId: string
  claimToken: string | null
  error: unknown
}): Promise<boolean> {
  if (!args.claimToken) return false
  try {
    const { data, error } = await callGenerationRpc(args.client, args.rpcName, {
      p_intento_id: args.attemptId,
      p_token_reclamacion: args.claimToken,
      p_error: serializeGenerationError(args.error),
    })
    return !error && data === true
  } catch {
    return false
  }
}

function userInputIndex(input: unknown): number {
  if (!Array.isArray(input)) return -1
  return input.findIndex((item) => {
    const row = asRecord(item)
    return row?.role === 'user' && typeof row.content === 'string'
  })
}

export async function hydrateGenerationAttemptRequest(args: {
  request: StructuredResponseOptions
  attemptId: string
  referenceMode: DocumentReferenceResolution['mode']
  references: DocumentReferenceResolution['references']
  userId: string
  supabase: ServiceRoleClient
  directInputFiles?: Array<OpenAIInputFile>
  invalidSnapshotMessage: string
  invalidSnapshotCode: string
}): Promise<StructuredResponseOptions> {
  const request = structuredClone(args.request)
  const index = userInputIndex(request.input)
  if (!Array.isArray(request.input) || index < 0) {
    throw new HttpError(
      500,
      args.invalidSnapshotMessage,
      args.invalidSnapshotCode,
    )
  }

  const input = [...request.input]
  const userItem = asRecord(input[index]) ?? {}
  const userText = typeof userItem.content === 'string' ? userItem.content : ''
  let tools = request.tools

  if (args.referenceMode === 'direct') {
    const inputFiles =
      args.directInputFiles ??
      (await hydrateDirectDocumentReferences({
        supabase: args.supabase,
        userId: args.userId,
        references: args.references,
      }))
    input[index] = {
      ...userItem,
      content: [...inputFiles, { type: 'input_text' as const, text: userText }],
    } as (typeof input)[number]
  } else if (
    args.referenceMode === 'retrieval' &&
    args.references.every((reference) => reference.chunkIds.length === 0)
  ) {
    const hydrated = await hydrateRetrievalDocumentReferences({
      supabase: args.supabase,
      userId: args.userId,
      references: args.references,
    })
    input[index] = {
      ...userItem,
      content: [
        ...hydrated.inputFiles,
        { type: 'input_text' as const, text: userText },
      ],
    } as (typeof input)[number]
    const otherTools = (Array.isArray(tools) ? tools : []).filter(
      (tool) => asRecord(tool)?.type !== 'file_search',
    )
    tools = hydrated.vectorStoreId
      ? ([
          ...otherTools,
          {
            type: 'file_search',
            vector_store_ids: [hydrated.vectorStoreId],
          },
        ] as typeof tools)
      : otherTools.length
        ? (otherTools as typeof tools)
        : undefined
  }

  return {
    ...request,
    metadata: {
      ...(request.metadata ?? {}),
      generation_attempt_id: args.attemptId,
    },
    ...(tools !== request.tools ? { tools } : {}),
    input,
  }
}

export function openAIResponseStartedAt(response: {
  created_at?: unknown
}): string {
  return typeof response.created_at === 'number'
    ? new Date(response.created_at * 1000).toISOString()
    : new Date().toISOString()
}
