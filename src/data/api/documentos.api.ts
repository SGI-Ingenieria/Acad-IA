import { Upload } from 'tus-js-client'

import { supabaseBrowser, supabasePublicUrl } from '../supabase/client'
import { invokeEdge } from '../supabase/invokeEdge'

import { ApiError } from './_helpers'

export type DocumentoArchivo = {
  id: string
  display_name: string
  description: string | null
  status:
    | 'uploading'
    | 'pending'
    | 'processing'
    | 'ready'
    | 'partial_error'
    | 'failed'
    | 'deleted'
  source?: 'upload' | 'note'
  detected_mime?: string | null
  size_bytes?: number | null
  created_at: string
  updated_at: string
  current_version_id: string | null
  user_state?: {
    last_viewed_at: string | null
    last_used_at: string | null
    pinned_at: string | null
    archived_at: string | null
  } | null
  uploadProgress?: number
  uploadError?: string
  localFile?: File
}

export type DocumentoColeccion = {
  id: string
  name: string
  description: string | null
  kind: 'collection' | 'curriculum_repository'
  status: 'active' | 'archived'
  created_by: string
  created_at: string
  updated_at: string
  canManage: boolean
  fileIds: Array<string>
}

export type OrdenBiblioteca =
  | 'updated_desc'
  | 'created_desc'
  | 'used_desc'
  | 'name_asc'
  | 'name_desc'

export type FiltrosBiblioteca = {
  query?: string
  sort?: OrdenBiblioteca
}

export type BibliotecaReferencias = {
  files: Array<DocumentoArchivo>
  collections: Array<DocumentoColeccion>
}

export type DocumentoReferenciaResuelta = {
  id: string
  name: string
  type: 'file' | 'collection'
  status: string
}

export type ReferenciasDocumentalesResueltas = {
  references: Array<DocumentoReferenciaResuelta>
  unavailableCount: number
}

type SesionCarga = {
  id: string
  temporaryPath: string
  bucket: string
  expiresAt: string
  upload: {
    endpoint?: string
    endpointPath?: string
    metadata: Record<string, string>
  }
}

type EstadoSesion = {
  id: string
  status: string
  fileId: string | null
  errorCode: string | null
}

type EstadoSesionMaterializada = EstadoSesion & { fileId: string }

export type ProgresoCargaDocumento = {
  bytesUploaded: number
  bytesTotal: number
  percentage: number
  bytesPerSecond: number | null
  estimatedSecondsRemaining: number | null
}

export type EtapaCargaDocumento = 'uploading' | 'processing'

export type OpcionesCargaDocumento = {
  onProgress?: (progress: ProgresoCargaDocumento) => void
  onStage?: (stage: EtapaCargaDocumento) => void
  signal?: AbortSignal
}

const TUS_CHUNK_SIZE = 6 * 1024 * 1024
const UPLOAD_RATE_TIME_CONSTANT_SECONDS = 3
export const MAX_DOCUMENT_UPLOAD_BYTES = 20 * 1024 * 1024
const DOCUMENT_UPLOAD_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'pptx',
  'xlsx',
  'txt',
  'md',
  'csv',
  'json',
  'png',
  'jpg',
  'jpeg',
  'webp',
])

export type EstadoEstimacionCarga = {
  bytesUploaded: number
  timestampMs: number
  bytesPerSecond: number | null
}

/**
 * Suaviza la velocidad real con una media móvil exponencial dependiente del
 * tiempo. Así la ETA responde a cambios de red sin saltar con cada evento XHR.
 */
export function estimarProgresoCarga(
  previous: EstadoEstimacionCarga,
  bytesUploaded: number,
  bytesTotal: number,
  timestampMs: number,
): { state: EstadoEstimacionCarga; progress: ProgresoCargaDocumento } {
  const uploaded = Math.max(0, Math.min(bytesUploaded, bytesTotal))
  const elapsedSeconds = Math.max(
    0,
    (timestampMs - previous.timestampMs) / 1_000,
  )
  const deltaBytes = Math.max(0, uploaded - previous.bytesUploaded)
  let bytesPerSecond = previous.bytesPerSecond

  if (elapsedSeconds > 0 && deltaBytes > 0) {
    const instantaneousRate = deltaBytes / elapsedSeconds
    const alpha =
      1 - Math.exp(-elapsedSeconds / UPLOAD_RATE_TIME_CONSTANT_SECONDS)
    bytesPerSecond = bytesPerSecond
      ? bytesPerSecond + alpha * (instantaneousRate - bytesPerSecond)
      : instantaneousRate
  }

  const remainingBytes = Math.max(0, bytesTotal - uploaded)
  const estimatedSecondsRemaining =
    remainingBytes === 0
      ? 0
      : bytesPerSecond && bytesPerSecond > 0
        ? Math.ceil(remainingBytes / bytesPerSecond)
        : null
  const progress: ProgresoCargaDocumento = {
    bytesUploaded: uploaded,
    bytesTotal,
    percentage: bytesTotal > 0 ? Math.round((uploaded / bytesTotal) * 100) : 0,
    bytesPerSecond,
    estimatedSecondsRemaining,
  }

  return {
    state: { bytesUploaded: uploaded, timestampMs, bytesPerSecond },
    progress,
  }
}

export function validarDocumentoAntesDeSubir(file: File) {
  const extension = file.name.split('.').pop()?.toLocaleLowerCase('es-MX') ?? ''
  if (!DOCUMENT_UPLOAD_EXTENSIONS.has(extension)) {
    throw new ApiError(
      'El formato del archivo no está permitido.',
      'FILE_TYPE_REJECTED',
    )
  }
  if (file.size < 1 || file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    throw new ApiError(
      'El archivo debe pesar como máximo 20 MiB.',
      'FILE_SIZE_REJECTED',
    )
  }
}

function uploadPollingDelay(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(
        new ApiError('La carga del documento fue cancelada.', 'UPLOAD_ABORTED'),
      )
      return
    }

    const timeout = setTimeout(done, milliseconds)
    signal?.addEventListener('abort', aborted, { once: true })

    function done() {
      signal?.removeEventListener('abort', aborted)
      resolve()
    }

    function aborted() {
      clearTimeout(timeout)
      reject(
        new ApiError('La carga del documento fue cancelada.', 'UPLOAD_ABORTED'),
      )
    }
  })
}

export async function esperarMaterializacionCarga(args: {
  read: () => Promise<EstadoSesion>
  signal?: AbortSignal
  wait?: (milliseconds: number) => Promise<void>
}): Promise<EstadoSesionMaterializada> {
  let delay = 750

  for (;;) {
    if (args.signal?.aborted) {
      throw new ApiError(
        'La carga del documento fue cancelada.',
        'UPLOAD_ABORTED',
      )
    }

    const current = await args.read()
    if (current.fileId) {
      return { ...current, fileId: current.fileId }
    }
    if (['failed', 'expired'].includes(current.status)) {
      throw new ApiError(
        'No se pudo procesar el documento cargado.',
        current.errorCode ?? undefined,
      )
    }
    if (current.status === 'ready') {
      throw new ApiError(
        'La carga terminó sin asociar el documento resultante.',
        'UPLOAD_RESULT_MISSING',
      )
    }

    await (args.wait
      ? args.wait(delay)
      : uploadPollingDelay(delay, args.signal))
    delay = Math.min(5_000, Math.round(delay * 1.5))
  }
}

export function construirEndpointTus(publicUrl: string): string {
  const url = new URL(publicUrl)
  const hostedProject = url.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i)

  // Supabase recomienda el hostname directo para evitar el proxy general en
  // cargas grandes. Localhost y dominios personalizados conservan su origen.
  if (url.protocol === 'https:' && hostedProject) {
    url.hostname = `${hostedProject[1]}.storage.supabase.co`
  }
  url.pathname = '/storage/v1/upload/resumable'
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

export function documentos_tus_endpoint(): string {
  return construirEndpointTus(supabasePublicUrl())
}

export function resolverUrlFirmadaDocumento(
  signedUrl: string,
  publicUrl = supabasePublicUrl(),
): string {
  const parsed = new URL(signedUrl, `${publicUrl.replace(/\/+$/, '')}/`)
  if (!parsed.pathname.startsWith('/storage/v1/object/')) {
    throw new Error('Ruta de Storage inesperada')
  }
  return new URL(
    `${parsed.pathname}${parsed.search}`,
    `${publicUrl.replace(/\/+$/, '')}/`,
  ).toString()
}

function inferMimeType(file: File) {
  if (file.type) return file.type
  const extension = file.name.split('.').pop()?.toLowerCase()
  return (
    (
      {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        txt: 'text/plain',
        md: 'text/markdown',
        csv: 'text/csv',
        json: 'application/json',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
      } as Record<string, string>
    )[extension ?? ''] ?? 'application/octet-stream'
  )
}

async function sessionToken() {
  const { data } = await supabaseBrowser().auth.getSession()
  const token = data.session?.access_token
  if (!token)
    throw new ApiError('Debes iniciar sesión para subir un documento.')
  return token
}

async function uploadTus(
  file: File,
  session: SesionCarga,
  options: OpcionesCargaDocumento = {},
) {
  const token = await sessionToken()
  const now = () =>
    typeof performance === 'undefined' ? Date.now() : performance.now()
  let rateState: EstadoEstimacionCarga = {
    bytesUploaded: 0,
    timestampMs: now(),
    bytesPerSecond: null,
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false
    const upload = new Upload(file, {
      // Nunca se usa el SUPABASE_URL interno devuelto por una Edge Function.
      // El navegador conoce la URL pública correcta tanto local como alojada.
      endpoint: documentos_tus_endpoint(),
      headers: { Authorization: `Bearer ${token}` },
      metadata: session.upload.metadata,
      chunkSize: TUS_CHUNK_SIZE,
      retryDelays: [0, 3_000, 5_000, 10_000, 20_000],
      uploadDataDuringCreation: true,
      // Cada intento obtiene una sesión y ruta temporal nuevas en files-api.
      // Persistir la URL TUS por huella del archivo reanudaría otra sesión.
      // Los retryDelays conservan la reanudación dentro del intento activo.
      storeFingerprintForResuming: false,
      onProgress: (bytesUploaded, bytesTotal) => {
        const measured = estimarProgresoCarga(
          rateState,
          bytesUploaded,
          bytesTotal,
          now(),
        )
        rateState = measured.state
        options.onProgress?.(measured.progress)
      },
      onError: (error) => {
        if (settled) return
        settled = true
        options.signal?.removeEventListener('abort', abort)
        reject(
          new ApiError(
            'La carga del documento se interrumpió. Puedes reintentarla.',
            'TUS_UPLOAD_FAILED',
            error,
          ),
        )
      },
      onSuccess: () => {
        if (settled) return
        settled = true
        options.signal?.removeEventListener('abort', abort)
        resolve()
      },
    })

    const abort = () => {
      if (settled) return
      settled = true
      const rejectAborted = () =>
        reject(
          new ApiError(
            'La carga del documento fue cancelada.',
            'UPLOAD_ABORTED',
          ),
        )
      void upload.abort(true).then(rejectAborted, rejectAborted)
    }
    if (options.signal?.aborted) return abort()
    options.signal?.addEventListener('abort', abort, { once: true })
    upload.start()
  })
}

export async function documentos_listar(): Promise<Array<DocumentoArchivo>> {
  const response = await invokeEdge<{ data: Array<DocumentoArchivo> }>(
    'files-api/files',
    undefined,
    { method: 'GET' },
  )
  return response.data
}

export async function documentos_biblioteca(
  filters: FiltrosBiblioteca = {},
): Promise<BibliotecaReferencias> {
  const files = new Map<string, DocumentoArchivo>()
  const collections = new Map<string, DocumentoColeccion>()
  const limit = 200
  let offset = 0

  for (;;) {
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    })
    if (filters.query?.trim()) query.set('query', filters.query.trim())
    if (filters.sort) query.set('sort', filters.sort)
    const response = await invokeEdge<{
      data: BibliotecaReferencias
      pagination?: { nextOffset: number | null }
    }>(`files-api/library?${query.toString()}`, undefined, { method: 'GET' })

    for (const file of response.data.files) files.set(file.id, file)
    for (const collection of response.data.collections) {
      const previous = collections.get(collection.id)
      collections.set(collection.id, {
        ...collection,
        fileIds: Array.from(
          new Set([...(previous?.fileIds ?? []), ...collection.fileIds]),
        ),
      })
    }

    const nextOffset = response.pagination?.nextOffset
    if (
      nextOffset === null ||
      nextOffset === undefined ||
      nextOffset <= offset
    ) {
      break
    }
    offset = nextOffset
  }

  return {
    files: Array.from(files.values()),
    collections: Array.from(collections.values()),
  }
}

export async function documentos_resolver_referencias(input: {
  fileIds: Array<string>
  collectionIds: Array<string>
}): Promise<ReferenciasDocumentalesResueltas> {
  const response = await invokeEdge<{
    data: ReferenciasDocumentalesResueltas
  }>('files-api/references/resolve', input, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  return response.data
}

export async function documentos_crear_coleccion(input: {
  name: string
  description?: string
  kind?: DocumentoColeccion['kind']
}): Promise<DocumentoColeccion> {
  const response = await invokeEdge<{ data: DocumentoColeccion }>(
    'files-api/collections',
    input,
    { method: 'POST', headers: { 'Content-Type': 'application/json' } },
  )
  return response.data
}

export async function documentos_actualizar_coleccion(input: {
  id: string
  name?: string
  description?: string | null
}): Promise<DocumentoColeccion> {
  const { id, ...body } = input
  const response = await invokeEdge<{ data: DocumentoColeccion }>(
    `files-api/collections/${id}`,
    body,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' } },
  )
  return response.data
}

export async function documentos_archivar_coleccion(id: string) {
  return await invokeEdge<{ data: { id: string; archived: boolean } }>(
    `files-api/collections/${id}`,
    undefined,
    { method: 'DELETE' },
  )
}

export async function documentos_agregar_a_coleccion(input: {
  collectionId: string
  fileId: string
}) {
  return await invokeEdge(
    `files-api/collections/${input.collectionId}/files/${input.fileId}`,
    undefined,
    { method: 'POST' },
  )
}

export async function documentos_quitar_de_coleccion(input: {
  collectionId: string
  fileId: string
}) {
  return await invokeEdge(
    `files-api/collections/${input.collectionId}/files/${input.fileId}`,
    undefined,
    { method: 'DELETE' },
  )
}

export type TipoConversacionDocumental = 'plan' | 'asignatura'

export type DocumentoReferenciaConversacion = {
  fileId: string
  addedAt: string
  active: boolean
  used: boolean
  firstUsedAt: string | null
  canRemove: boolean
}

export async function documentos_archivos_conversacion(input: {
  conversationType: TipoConversacionDocumental
  conversationId: string
}) {
  const response = await invokeEdge<{
    data: {
      references?: Array<DocumentoReferenciaConversacion>
      fileIds?: Array<string>
    }
  }>(
    `files-api/conversations/${input.conversationType}/${input.conversationId}/files`,
    undefined,
    { method: 'GET' },
  )
  if (response.data.references) return response.data.references
  return (response.data.fileIds ?? []).map((fileId) => ({
    fileId,
    addedAt: new Date(0).toISOString(),
    active: true,
    used: false,
    firstUsedAt: null,
    canRemove: true,
  }))
}

export async function documentos_adjuntar_a_conversacion(input: {
  conversationType: TipoConversacionDocumental
  conversationId: string
  fileId: string
}) {
  return await invokeEdge(
    `files-api/conversations/${input.conversationType}/${input.conversationId}/files/${input.fileId}`,
    undefined,
    { method: 'POST' },
  )
}

export async function documentos_quitar_de_conversacion(input: {
  conversationType: TipoConversacionDocumental
  conversationId: string
  fileId: string
}) {
  return await invokeEdge(
    `files-api/conversations/${input.conversationType}/${input.conversationId}/files/${input.fileId}`,
    undefined,
    { method: 'DELETE' },
  )
}

export async function documentos_subir(
  file: File,
  options: OpcionesCargaDocumento & { source?: 'upload' | 'note' } = {},
): Promise<{ sessionId: string; fileId: string; status: string }> {
  validarDocumentoAntesDeSubir(file)
  options.onStage?.('uploading')
  const created = await invokeEdge<{ data: SesionCarga }>(
    'files-api/upload-sessions',
    {
      filename: file.name,
      size: file.size,
      mimeType: inferMimeType(file),
      ...(options.source ? { source: options.source } : {}),
    },
    { method: 'POST', headers: { 'Content-Type': 'application/json' } },
  )
  await uploadTus(file, created.data, options)
  options.onStage?.('processing')
  await invokeEdge(
    'file-upload-complete',
    { sessionId: created.data.id },
    { method: 'POST', headers: { 'Content-Type': 'application/json' } },
  )
  const completed = await esperarMaterializacionCarga({
    signal: options.signal,
    read: async () => {
      const result = await invokeEdge<{ data: EstadoSesion }>(
        `files-api/upload-sessions/${created.data.id}`,
        undefined,
        { method: 'GET' },
      )
      return result.data
    },
  })
  return {
    sessionId: created.data.id,
    fileId: completed.fileId,
    status: completed.status,
  }
}

/**
 * Crea una nota de texto como archivo Markdown por el mismo pipeline de
 * subida que cualquier documento. Para el sistema una nota es un archivo más.
 */
export async function documentos_crear_nota(
  input: { titulo: string; contenido: string },
  options: OpcionesCargaDocumento = {},
): Promise<{ sessionId: string; fileId: string; status: string }> {
  const titulo = input.titulo.trim() || 'Nota'
  const nombre = `${titulo.replace(/[\\/:*?"<>|]/g, ' ').trim()}.md`
  const file = new File([input.contenido], nombre, { type: 'text/markdown' })
  return await documentos_subir(file, { ...options, source: 'note' })
}

export async function documentos_renombrar(input: {
  fileId: string
  displayName: string
}) {
  return await invokeEdge<{ data: { id: string; displayName: string } }>(
    `files-api/files/${input.fileId}`,
    { displayName: input.displayName },
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' } },
  )
}

/**
 * Pre-calentamiento de la selección de referencias. Fire-and-forget: el
 * resultado nunca se muestra al usuario; sólo acelera la generación posterior.
 */
export async function documentos_warmup_seleccion(input: {
  fileIds: Array<string>
  collectionIds: Array<string>
}) {
  return await invokeEdge<{ data: { ok: boolean } }>(
    'files-api/warmup',
    input,
    { method: 'POST', headers: { 'Content-Type': 'application/json' } },
  )
}

export async function documentos_eliminar(fileId: string) {
  return await invokeEdge<{ data: { id: string; deleted: boolean } }>(
    `files-api/files/${fileId}`,
    undefined,
    { method: 'DELETE' },
  )
}

export async function documentos_url_firmada(fileId: string, download = false) {
  const response = await invokeEdge<{
    data: { signedUrl?: string; url?: string }
  }>(
    'file-signed-url',
    { fileId, download },
    { method: 'POST', headers: { 'Content-Type': 'application/json' } },
  )
  const url = response.data.signedUrl ?? response.data.url
  if (!url)
    throw new ApiError('No se recibió una URL válida para el documento.')
  try {
    return resolverUrlFirmadaDocumento(url)
  } catch (error) {
    throw new ApiError(
      'No se recibió una URL válida para el documento.',
      'INVALID_SIGNED_DOCUMENT_URL',
      error,
    )
  }
}
