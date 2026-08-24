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
  type BlobDocumental,
  ensureSelectionVectorStore,
  estimarTokens,
  UMBRAL_TOKENS_INYECCION_DIRECTA,
} from './documentos-vector-stores.ts'
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
  file_blobs: BlobRow | Array<BlobRow> | null
}

type BlobRow = {
  id: string
  sha256: string
  storage_bucket: string
  storage_path: string
  size_bytes: number
  detected_mime: string
  openai_file_id: string | null
}

// `file_versions` y `files` tienen más de una relación en PostgREST. Nombrar
// las FK evita PGRST201 y documenta qué lado de cada relación se necesita.
export const DOCUMENT_REFERENCE_VERSION_SELECT =
  'id, file_id, original_filename, files!file_versions_file_id_fkey(display_name, status, current_version_id), file_blobs!file_versions_blob_id_fkey(id, sha256, storage_bucket, storage_path, size_bytes, detected_mime, openai_file_id)'

export type DocumentReferenceResolution = {
  mode: 'none' | 'direct' | 'retrieval'
  inputFiles: Array<OpenAIInputFile>
  /** Vector store de OpenAI para la tool `file_search`; null en modo directo. */
  vectorStoreId: string | null
  context: string
  references: Array<{
    fileId: string
    fileVersionId: string
    /** Cómo llegó realmente el documento al modelo. */
    resolvedAs?: 'direct' | 'retrieval'
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

type ResolvedVersion = {
  version: DocumentVersion
  blob: BlobRow
}

async function directInputFile(
  supabase: ReturnType<typeof serviceClient>,
  resolved: ResolvedVersion,
): Promise<OpenAIInputFile> {
  return await storageOpenAIInputFile({
    supabase,
    bucket: resolved.blob.storage_bucket,
    path: resolved.blob.storage_path,
    filename: resolved.version.original_filename,
    mimeType: resolved.blob.detected_mime,
    expectedSize: Number(resolved.blob.size_bytes),
  })
}

/**
 * Resuelve la selección de referencias para una generación de IA.
 *
 * Las imágenes van siempre directo al modelo como visión. Los documentos
 * cortos se inyectan directo al contexto. El resto pasa por la cascada de
 * vector stores de OpenAI, y cualquier documento que la cascada no pueda
 * indexar degrada en silencio a inyección directa: la generación siempre
 * procede con lo que se pudo preparar.
 */
export async function resolveDocumentReferences(args: {
  supabase: ReturnType<typeof serviceClient>
  userId: string
  fileIds: Array<string>
  collectionIds?: Array<string>
  query: string
  conversationId?: string | null
  /** Fuerza inyección directa (p. ej. clonación, que necesita el texto íntegro). */
  forceDirect?: boolean
  maxFiles?: number
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
    return {
      mode: 'none',
      inputFiles: [],
      vectorStoreId: null,
      context: '',
      references: [],
    }
  }
  const maxFiles = args.maxFiles ?? MAX_FILES_PER_MESSAGE
  if (fileIds.length > maxFiles) {
    throw new HttpError(
      422,
      `Puedes adjuntar como máximo ${maxFiles} documentos.`,
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
  const current: Array<ResolvedVersion> = (versions ?? [])
    .map((value) => value as unknown as DocumentVersion)
    .filter((version) => one(version.files)?.current_version_id === version.id)
    .flatMap((version) => {
      const blob = one(version.file_blobs)
      return blob ? [{ version, blob }] : []
    })
  const unresolvedFileIds = fileIds.filter(
    (fileId) => !current.some((item) => item.version.file_id === fileId),
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
    (total, item) => total + Number(item.blob.size_bytes),
    0,
  )
  if (totalBytes > MAX_TOTAL_DIRECT_INPUT && args.forceDirect) {
    throw new HttpError(
      422,
      'Los documentos seleccionados exceden el tamaño admitido para esta operación.',
      'DOCUMENT_TOO_LARGE',
    )
  }

  // El uso en una generación alimenta "Recientes".
  await args.supabase
    .from('files')
    .update({ last_used_at: new Date().toISOString() })
    .in('id', fileIds)

  return await materializeSelection({
    supabase: args.supabase,
    userId: args.userId,
    items: current,
    forceDirect: args.forceDirect ?? false,
  })
}

/**
 * Materializa una selección ya autorizada: decide inyección directa versus
 * cascada de vector stores y degrada en silencio lo que no pueda indexarse.
 */
async function materializeSelection(args: {
  supabase: ReturnType<typeof serviceClient>
  userId: string
  items: Array<ResolvedVersion>
  forceDirect: boolean
}): Promise<DocumentReferenceResolution> {
  const imagenes = args.items.filter((item) =>
    item.blob.detected_mime.startsWith('image/'),
  )
  const documentos = args.items.filter(
    (item) => !item.blob.detected_mime.startsWith('image/'),
  )
  const tokensEstimados = documentos.reduce(
    (total, item) => total + estimarTokens(Number(item.blob.size_bytes)),
    0,
  )

  const referenceFor = (
    item: ResolvedVersion,
    resolvedAs: 'direct' | 'retrieval',
  ) => ({
    fileId: item.version.file_id,
    fileVersionId: item.version.id,
    resolvedAs,
    chunkIds: [] as Array<string>,
    scores: {} as Record<string, number>,
  })

  // Selección chica (o forzada): todo directo, sin vector store.
  if (args.forceDirect || tokensEstimados <= UMBRAL_TOKENS_INYECCION_DIRECTA) {
    const inputFiles = await Promise.all(
      args.items.map((item) => directInputFile(args.supabase, item)),
    )
    return {
      mode: 'direct',
      inputFiles,
      vectorStoreId: null,
      context: '',
      references: args.items.map((item) => referenceFor(item, 'direct')),
    }
  }

  // Selección grande: cascada de vector stores. Las imágenes nunca entran al
  // índice; van directo como visión.
  const tenantId = await resolveTenantId(args.supabase, args.userId)
  const openai = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })
  const { vectorStoreId, blobsDegradados } = await ensureSelectionVectorStore({
    supabase: args.supabase,
    openai,
    tenantId,
    blobs: documentos.map((item) => item.blob as BlobDocumental),
    filenames: new Map(
      documentos.map((item) => [item.blob.id, item.version.original_filename]),
    ),
  })

  const directos = [
    ...imagenes,
    ...documentos.filter(
      (item) => !vectorStoreId || blobsDegradados.has(item.blob.id),
    ),
  ]
  const indexados = vectorStoreId
    ? documentos.filter((item) => !blobsDegradados.has(item.blob.id))
    : []
  const inputFiles = await Promise.all(
    directos.map((item) => directInputFile(args.supabase, item)),
  )

  if (!indexados.length) {
    // La cascada agotó todos sus niveles: todo degradó a inyección directa.
    return {
      mode: 'direct',
      inputFiles,
      vectorStoreId: null,
      context: '',
      references: args.items.map((item) => referenceFor(item, 'direct')),
    }
  }

  return {
    mode: 'retrieval',
    inputFiles,
    vectorStoreId,
    context: '',
    references: [
      ...indexados.map((item) => referenceFor(item, 'retrieval')),
      ...directos.map((item) => referenceFor(item, 'direct')),
    ],
  }
}

/**
 * Rehidrata un snapshot en modo retrieval: vuelve a correr la cascada sobre
 * las versiones inmutables congeladas para obtener un vector store vigente
 * (el original pudo expirar entre el intento y el reintento).
 */
export async function hydrateRetrievalDocumentReferences(args: {
  supabase: ReturnType<typeof serviceClient>
  userId: string
  references: DocumentReferenceSnapshot
}): Promise<{
  inputFiles: Array<OpenAIInputFile>
  vectorStoreId: string | null
}> {
  const items = await loadFrozenVersions({
    supabase: args.supabase,
    userId: args.userId,
    references: args.references,
  })
  const resolution = await materializeSelection({
    supabase: args.supabase,
    userId: args.userId,
    items,
    forceDirect: false,
  })
  return {
    inputFiles: resolution.inputFiles,
    vectorStoreId: resolution.vectorStoreId,
  }
}

async function loadFrozenVersions(args: {
  supabase: ReturnType<typeof serviceClient>
  userId: string
  references: DocumentReferenceSnapshot
}): Promise<Array<ResolvedVersion>> {
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
  return args.references.map((reference) => {
    const version = versionsById.get(reference.fileVersionId)
    const blob = version ? one(version.file_blobs) : null
    if (!version || version.file_id !== reference.fileId || !blob) {
      throw frozenReferenceError(
        'Una versión documental congelada ya no está disponible.',
        'FROZEN_REFERENCE_MISSING',
        { fileVersionId: reference.fileVersionId },
      )
    }
    return { version, blob }
  })
}

/**
 * Combina las tools de la generación: búsqueda web opcional y `file_search`
 * cuando la selección se materializó como vector store.
 */
export function buildReferenceTools(args: {
  webSearchEnabled?: boolean
  vectorStoreId?: string | null
}):
  | Array<
      | { type: 'web_search' }
      | { type: 'file_search'; vector_store_ids: Array<string> }
    >
  | undefined {
  const tools: Array<
    | { type: 'web_search' }
    | { type: 'file_search'; vector_store_ids: Array<string> }
  > = []
  if (args.webSearchEnabled) tools.push({ type: 'web_search' })
  if (args.vectorStoreId) {
    tools.push({ type: 'file_search', vector_store_ids: [args.vectorStoreId] })
  }
  return tools.length ? tools : undefined
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
      vectorStoreId: null,
      context: '',
      references: [],
      query: '',
    }
  }

  const requestIds = new Set(rows.map((row) => row.request_id))
  if (requestIds.size !== 1) {
    throw frozenReferenceError(
      'El snapshot documental del mensaje original es inconsistente.',
      'FROZEN_REFERENCE_INVALID',
    )
  }

  // Un snapshot de la cascada puede mezclar filas direct (imágenes o
  // degradados) con filas retrieval; el modo global es retrieval.
  const mode = rows.some((row) => row.mode === 'retrieval')
    ? 'retrieval'
    : rows[0]?.mode
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
      vectorStoreId: null,
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

  const query =
    rows.find((row) => typeof row.retrieval_query === 'string')
      ?.retrieval_query ?? ''

  const chunkIds = references.flatMap((reference) => reference.chunkIds)
  if (!chunkIds.length) {
    // Snapshot de la cascada (sin fragmentos propios): se rehidrata volviendo
    // a materializar las versiones congeladas contra OpenAI.
    const hydrated = await hydrateRetrievalDocumentReferences({
      supabase: args.supabase,
      userId: args.userId,
      references,
    })
    return {
      mode,
      inputFiles: hydrated.inputFiles,
      vectorStoreId: hydrated.vectorStoreId,
      context: '',
      references,
      query,
    }
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
    vectorStoreId: null,
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
  const rows = args.references.map((reference) => {
    // En la cascada cada archivo registra cómo llegó realmente al modelo
    // (retrieval vía vector store o inyección directa por imagen/degradación).
    const rowMode = reference.resolvedAs ?? args.mode
    return {
      tenant_id: args.tenantId,
      request_id: args.requestId,
      conversation_type: args.conversationType,
      conversation_id: args.conversationId,
      message_type: args.conversationType,
      message_id: args.messageId ?? null,
      file_id: reference.fileId,
      file_version_id: reference.fileVersionId,
      mode: rowMode,
      chunk_ids: reference.chunkIds,
      retrieval_query: rowMode === 'retrieval' ? args.query : null,
      retrieval_scores: reference.scores,
    }
  })
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
