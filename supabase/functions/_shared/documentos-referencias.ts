import OpenAI from 'npm:openai@6.16.0'

import {
  assertDocumentPermission,
  MAX_FILES_PER_MESSAGE,
  MAX_TOTAL_DIRECT_INPUT,
  requireEnv,
  resolveTenantId,
  serviceClient,
} from './documentos-academicos.ts'
import {
  type OpenAIInputFile,
  storageOpenAIInputFile,
} from './openai-file-input.ts'
import { HttpError } from './utils.ts'

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type DocumentVersion = {
  id: string
  file_id: string
  original_filename: string
  files:
    | {
        display_name: string
        status: string
        current_version_id: string | null
      }
    | Array<{
        display_name: string
        status: string
        current_version_id: string | null
      }>
    | null
  file_blobs:
    | {
        storage_bucket: string
        storage_path: string
        size_bytes: number
        detected_mime: string
      }
    | Array<{
        storage_bucket: string
        storage_path: string
        size_bytes: number
        detected_mime: string
      }>
    | null
}

// `file_versions` y `files` tienen más de una relación en PostgREST. Nombrar
// las FK evita PGRST201 y documenta qué lado de cada relación se necesita.
export const DOCUMENT_REFERENCE_VERSION_SELECT =
  'id, file_id, original_filename, files!file_versions_file_id_fkey(display_name, status, current_version_id), file_blobs!file_versions_blob_id_fkey(storage_bucket, storage_path, size_bytes, detected_mime)'

export type DocumentReferenceResolution = {
  mode: 'none' | 'direct' | 'retrieval'
  inputFiles: Array<OpenAIInputFile>
  context: string
  references: Array<{
    fileId: string
    fileVersionId: string
    chunkIds: Array<string>
    scores: Record<string, number>
  }>
}

export type FrozenDocumentReferenceResolution = DocumentReferenceResolution & {
  query: string
}

export type DocumentReferenceSnapshot =
  DocumentReferenceResolution['references']

type FrozenReferenceRow = {
  id: string
  request_id: string
  file_id: string
  file_version_id: string
  mode: 'direct' | 'retrieval'
  chunk_ids: Array<string>
  retrieval_query: string | null
  retrieval_scores: unknown
}

type FrozenChunk = {
  id: string
  file_version_id: string
  page_start: number | null
  page_end: number | null
  text: string
}

export const FROZEN_DOCUMENT_REFERENCE_SELECT =
  'id, request_id, file_id, file_version_id, mode, chunk_ids, retrieval_query, retrieval_scores'

function one<T>(value: T | Array<T> | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export function documentFileIds(
  values: Array<string> | undefined,
): Array<string> {
  return Array.from(new Set((values ?? []).filter((value) => UUID.test(value))))
}

export async function resolveDocumentReferences(args: {
  supabase: ReturnType<typeof serviceClient>
  userId: string
  fileIds: Array<string>
  collectionIds?: Array<string>
  query: string
  conversationId?: string | null
}): Promise<DocumentReferenceResolution> {
  const collectionIds = documentFileIds(args.collectionIds)
  const { data: collectionFiles, error: collectionError } = collectionIds.length
    ? await args.supabase
        .from('collection_files')
        .select('file_id')
        .in('collection_id', collectionIds)
    : { data: [], error: null }
  if (collectionError) {
    throw new HttpError(
      500,
      'No se pudo resolver la colección documental.',
      'DOCUMENT_COLLECTION_READ_FAILED',
    )
  }
  const fileIds = documentFileIds([
    ...args.fileIds,
    ...(collectionFiles ?? []).map((item) => item.file_id),
  ])
  if (!fileIds.length) {
    return { mode: 'none', inputFiles: [], context: '', references: [] }
  }
  if (fileIds.length > MAX_FILES_PER_MESSAGE) {
    throw new HttpError(
      422,
      `Puedes adjuntar como máximo ${MAX_FILES_PER_MESSAGE} documentos.`,
      'TOO_MANY_DOCUMENTS',
    )
  }
  await Promise.all(
    fileIds.map((fileId) =>
      assertDocumentPermission({
        supabase: args.supabase,
        userId: args.userId,
        fileId,
        permission: 'use',
      }),
    ),
  )
  const { data: versions, error } = await args.supabase
    .from('file_versions')
    .select(DOCUMENT_REFERENCE_VERSION_SELECT)
    .in('file_id', fileIds)
  if (error) {
    throw new HttpError(
      500,
      'No se pudieron resolver los documentos de referencia.',
      'DOCUMENT_REFERENCE_READ_FAILED',
      error,
    )
  }
  const current = (versions ?? [])
    .map((value) => value as unknown as DocumentVersion)
    .filter((version) => one(version.files)?.current_version_id === version.id)
  const unresolvedFileIds = fileIds.filter(
    (fileId) =>
      !current.some(
        (version) => version.file_id === fileId && one(version.file_blobs),
      ),
  )
  if (unresolvedFileIds.length) {
    throw new HttpError(
      409,
      'Uno o más documentos todavía se están preparando. Reintenta en unos instantes.',
      'DOCUMENT_STILL_PROCESSING',
      { fileIds: unresolvedFileIds },
    )
  }
  const totalBytes = current.reduce(
    (total, version) =>
      total + Number(one(version.file_blobs)?.size_bytes ?? 0),
    0,
  )
  if (
    current.length === fileIds.length &&
    totalBytes <= MAX_TOTAL_DIRECT_INPUT
  ) {
    const inputFiles = await Promise.all(
      current.map(async (version) => {
        const blob = one(version.file_blobs)
        if (!blob) {
          throw new HttpError(
            500,
            'El documento no tiene contenido físico.',
            'DOCUMENT_BLOB_MISSING',
          )
        }
        return await storageOpenAIInputFile({
          supabase: args.supabase,
          bucket: blob.storage_bucket,
          path: blob.storage_path,
          filename: version.original_filename,
          mimeType: blob.detected_mime,
          expectedSize: Number(blob.size_bytes),
        })
      }),
    )
    return {
      mode: 'direct',
      inputFiles,
      context: '',
      references: current.map((version) => ({
        fileId: version.file_id,
        fileVersionId: version.id,
        chunkIds: [],
        scores: {},
      })),
    }
  }

  const notIndexed = current
    .filter((version) => one(version.files)?.status !== 'ready')
    .map((version) => version.file_id)
  if (notIndexed.length) {
    throw new HttpError(
      409,
      'Los documentos todavía se están indexando. Reintenta en unos instantes.',
      'DOCUMENT_STILL_PROCESSING',
      { fileIds: notIndexed },
    )
  }

  const tenantId = await resolveTenantId(args.supabase, args.userId)
  const client = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })
  const embedding = await client.embeddings.create({
    model: Deno.env.get('DOCUMENT_EMBEDDING_MODEL') ?? 'text-embedding-3-small',
    input: args.query.slice(0, 8_000),
    dimensions: 1536,
  })
  const vector = `[${embedding.data[0]?.embedding.join(',') ?? ''}]`
  const { data: chunks, error: searchError } = await args.supabase.rpc(
    'search_authorized_chunks',
    {
      p_user_id: args.userId,
      p_tenant_id: tenantId,
      p_collection_ids: collectionIds,
      p_file_ids: fileIds,
      p_conversation_id: args.conversationId ?? null,
      p_query_text: args.query.slice(0, 8_000),
      p_query_embedding: vector,
      p_limit: 12,
    },
  )
  if (searchError) {
    throw new HttpError(
      500,
      'No se pudo buscar en los documentos autorizados.',
      'DOCUMENT_RETRIEVAL_FAILED',
    )
  }
  const byVersion = new Map<
    string,
    { fileId: string; chunkIds: Array<string>; scores: Record<string, number> }
  >()
  const typedChunks = (chunks ?? []) as Array<{
    chunk_id: string
    file_id: string
    file_version_id: string
    page_start: number | null
    page_end: number | null
    chunk_text: string
    rrf_score: number
  }>
  if (!typedChunks.length) {
    throw new HttpError(
      409,
      'Los documentos todavía no tienen contenido indexado disponible. Reintenta en unos instantes.',
      'DOCUMENT_STILL_PROCESSING',
      { fileIds },
    )
  }
  const excerpts = typedChunks.map((chunk) => {
    const existing = byVersion.get(chunk.file_version_id) ?? {
      fileId: chunk.file_id,
      chunkIds: [],
      scores: {},
    }
    existing.chunkIds.push(chunk.chunk_id)
    existing.scores[chunk.chunk_id] = Number(chunk.rrf_score)
    byVersion.set(chunk.file_version_id, existing)
    const pages = chunk.page_start
      ? `, pp. ${chunk.page_start}${
          chunk.page_end && chunk.page_end !== chunk.page_start
            ? `-${chunk.page_end}`
            : ''
        }`
      : ''
    return `[Fuente ${chunk.file_id}${pages}]\n${chunk.chunk_text}`
  })
  return {
    mode: 'retrieval',
    inputFiles: [],
    context: excerpts.length
      ? `Fuentes recuperadas autorizadas:\n\n${excerpts.join('\n\n')}`
      : 'No se encontraron fragmentos indexados todavía.',
    references: Array.from(byVersion, ([fileVersionId, value]) => ({
      fileVersionId,
      ...value,
    })),
  }
}

function frozenReferenceError(
  message: string,
  code: string,
  details?: unknown,
) {
  return new HttpError(500, message, code, details)
}

function frozenScores(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const entries = Object.entries(value)
  if (
    entries.some(
      ([chunkId, score]) =>
        !UUID.test(chunkId) ||
        typeof score !== 'number' ||
        !Number.isFinite(score),
    )
  ) {
    return null
  }

  return Object.fromEntries(entries) as Record<string, number>
}

/**
 * Reconstruye archivos directos desde versiones inmutables, sin volver a
 * resolver la versión "actual" del documento. Se usa tanto en reintentos como
 * en la recuperación durable de una llamada remota interrumpida.
 */
export async function hydrateDirectDocumentReferences(args: {
  supabase: ReturnType<typeof serviceClient>
  userId: string
  references: DocumentReferenceSnapshot
}): Promise<Array<OpenAIInputFile>> {
  if (
    args.references.some(
      (reference) =>
        !UUID.test(reference.fileId) ||
        !UUID.test(reference.fileVersionId) ||
        reference.chunkIds.length > 0,
    )
  ) {
    throw frozenReferenceError(
      'El snapshot de archivos directos no es válido.',
      'FROZEN_REFERENCE_INVALID',
    )
  }

  await Promise.all(
    args.references.map((reference) =>
      assertDocumentPermission({
        supabase: args.supabase,
        userId: args.userId,
        fileId: reference.fileId,
        permission: 'use',
      }),
    ),
  )

  const { data: versions, error } = await args.supabase
    .from('file_versions')
    .select(DOCUMENT_REFERENCE_VERSION_SELECT)
    .in(
      'id',
      args.references.map((reference) => reference.fileVersionId),
    )

  if (error) {
    throw frozenReferenceError(
      'No se pudieron recuperar las versiones documentales congeladas.',
      'FROZEN_REFERENCE_READ_FAILED',
      error,
    )
  }

  const versionsById = new Map(
    ((versions ?? []) as unknown as Array<DocumentVersion>).map((version) => [
      version.id,
      version,
    ]),
  )

  return await Promise.all(
    args.references.map(async (reference) => {
      const version = versionsById.get(reference.fileVersionId)
      const blob = version ? one(version.file_blobs) : null
      if (!version || version.file_id !== reference.fileId || !blob) {
        throw frozenReferenceError(
          'Una versión documental congelada ya no está disponible.',
          'FROZEN_REFERENCE_MISSING',
          { fileVersionId: reference.fileVersionId },
        )
      }

      return await storageOpenAIInputFile({
        supabase: args.supabase,
        bucket: blob.storage_bucket,
        path: blob.storage_path,
        filename: version.original_filename,
        mimeType: blob.detected_mime,
        expectedSize: Number(blob.size_bytes),
      })
    }),
  )
}

/**
 * Reconstruye únicamente el snapshot documental que quedó ligado al mensaje
 * original. Nunca vuelve a resolver versiones actuales, colecciones ni una
 * búsqueda vectorial nueva.
 */
export async function resolveFrozenDocumentReferences(args: {
  supabase: ReturnType<typeof serviceClient>
  userId: string
  conversationType: 'plan' | 'asignatura'
  conversationId: string
  messageId: string
}): Promise<FrozenDocumentReferenceResolution> {
  const { data, error } = await args.supabase
    .from('ai_request_references')
    .select(FROZEN_DOCUMENT_REFERENCE_SELECT)
    .eq('conversation_type', args.conversationType)
    .eq('conversation_id', args.conversationId)
    .eq('message_type', args.conversationType)
    .eq('message_id', args.messageId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (error) {
    throw frozenReferenceError(
      'No se pudo recuperar el snapshot documental del mensaje original.',
      'FROZEN_REFERENCE_READ_FAILED',
      error,
    )
  }

  const rows = (data ?? []) as unknown as Array<FrozenReferenceRow>
  if (!rows.length) {
    return {
      mode: 'none',
      inputFiles: [],
      context: '',
      references: [],
      query: '',
    }
  }

  const requestIds = new Set(rows.map((row) => row.request_id))
  const modes = new Set(rows.map((row) => row.mode))
  if (requestIds.size !== 1 || modes.size !== 1) {
    throw frozenReferenceError(
      'El snapshot documental del mensaje original es inconsistente.',
      'FROZEN_REFERENCE_INVALID',
    )
  }

  const mode = rows[0]?.mode
  if (mode !== 'direct' && mode !== 'retrieval') {
    throw frozenReferenceError(
      'El modo del snapshot documental no es válido.',
      'FROZEN_REFERENCE_INVALID',
    )
  }

  const references = rows.map((row) => {
    const chunkIds = Array.isArray(row.chunk_ids) ? row.chunk_ids : []
    const scores = frozenScores(row.retrieval_scores)
    if (
      !UUID.test(row.file_id) ||
      !UUID.test(row.file_version_id) ||
      chunkIds.some((chunkId) => !UUID.test(chunkId)) ||
      !scores
    ) {
      throw frozenReferenceError(
        'El snapshot documental contiene identificadores o puntajes inválidos.',
        'FROZEN_REFERENCE_INVALID',
      )
    }

    return {
      fileId: row.file_id,
      fileVersionId: row.file_version_id,
      chunkIds: [...chunkIds],
      scores,
    }
  })

  if (mode === 'direct') {
    const inputFiles = await hydrateDirectDocumentReferences({
      supabase: args.supabase,
      userId: args.userId,
      references,
    })

    return {
      mode,
      inputFiles,
      context: '',
      references,
      query: '',
    }
  }

  await Promise.all(
    references.map((reference) =>
      assertDocumentPermission({
        supabase: args.supabase,
        userId: args.userId,
        fileId: reference.fileId,
        permission: 'use',
      }),
    ),
  )

  const queries = new Set(rows.map((row) => row.retrieval_query))
  const query = rows[0]?.retrieval_query
  if (queries.size !== 1 || typeof query !== 'string') {
    throw frozenReferenceError(
      'La consulta del snapshot documental es inconsistente.',
      'FROZEN_REFERENCE_INVALID',
    )
  }

  const chunkIds = references.flatMap((reference) => reference.chunkIds)
  if (!chunkIds.length) {
    throw frozenReferenceError(
      'El snapshot documental no contiene fragmentos recuperados.',
      'FROZEN_REFERENCE_INVALID',
    )
  }

  const { data: chunks, error: chunkError } = await args.supabase
    .from('document_chunks')
    .select('id, file_version_id, page_start, page_end, text')
    .in('id', chunkIds)

  if (chunkError) {
    throw frozenReferenceError(
      'No se pudieron recuperar los fragmentos documentales congelados.',
      'FROZEN_REFERENCE_READ_FAILED',
      chunkError,
    )
  }

  const chunksById = new Map(
    ((chunks ?? []) as unknown as Array<FrozenChunk>).map((chunk) => [
      chunk.id,
      chunk,
    ]),
  )
  const excerpts = references.flatMap((reference) =>
    reference.chunkIds.map((chunkId) => {
      const chunk = chunksById.get(chunkId)
      if (!chunk || chunk.file_version_id !== reference.fileVersionId) {
        throw frozenReferenceError(
          'Un fragmento documental congelado ya no está disponible.',
          'FROZEN_REFERENCE_MISSING',
          { chunkId },
        )
      }
      const pages = chunk.page_start
        ? `, pp. ${chunk.page_start}${
            chunk.page_end && chunk.page_end !== chunk.page_start
              ? `-${chunk.page_end}`
              : ''
          }`
        : ''
      return `[Fuente ${reference.fileId}${pages}]\n${chunk.text}`
    }),
  )

  return {
    mode,
    inputFiles: [],
    context: `Fuentes recuperadas autorizadas:\n\n${excerpts.join('\n\n')}`,
    references,
    query,
  }
}

export async function persistDocumentReferences(args: {
  supabase: ReturnType<typeof serviceClient>
  tenantId: string
  requestId: string
  conversationType: 'plan' | 'asignatura'
  conversationId: string
  messageId?: string | null
  references: DocumentReferenceResolution['references']
  mode: DocumentReferenceResolution['mode']
  query: string
  userId?: string
  attachToConversation?: boolean
}) {
  if (args.mode === 'none' || !args.references.length) return
  const rows = args.references.map((reference) => ({
    tenant_id: args.tenantId,
    request_id: args.requestId,
    conversation_type: args.conversationType,
    conversation_id: args.conversationId,
    message_type: args.conversationType,
    message_id: args.messageId ?? null,
    file_id: reference.fileId,
    file_version_id: reference.fileVersionId,
    mode: args.mode,
    chunk_ids: reference.chunkIds,
    retrieval_query: args.mode === 'retrieval' ? args.query : null,
    retrieval_scores: reference.scores,
  }))
  const { error } = await args.supabase
    .from('ai_request_references')
    .upsert(rows, { onConflict: 'request_id,file_version_id,mode' })
  if (error) {
    throw new HttpError(
      500,
      'No se pudieron registrar las referencias documentales.',
      'DOCUMENT_REFERENCE_PERSIST_FAILED',
      error,
    )
  }
  if (args.attachToConversation && args.userId) {
    const { error: conversationError } = await args.supabase
      .from('conversation_files')
      .upsert(
        args.references.map((reference) => ({
          tenant_id: args.tenantId,
          conversation_type: args.conversationType,
          conversation_id: args.conversationId,
          file_id: reference.fileId,
          added_by: args.userId,
          removed_at: null,
        })),
        { onConflict: 'conversation_type,conversation_id,file_id' },
      )
    if (conversationError) {
      throw new HttpError(
        500,
        'No se pudieron asociar las referencias documentales al chat.',
        'CONVERSATION_REFERENCE_PERSIST_FAILED',
        conversationError,
      )
    }
  }
}
