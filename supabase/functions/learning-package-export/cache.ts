// Cache determinista para previews y exportaciones de learning_objects.
// La clave se calcula a partir de los IDs de los objetos (ordenados), el formato
// y la asignatura, de modo que peticiones idénticas reutilicen el mismo archivo
// en Storage mientras no expire.

import { HttpError } from '../_shared/utils.ts'

import type {
  BuiltArtifact,
  PackageContext,
  PackageObject,
} from './packager.ts'

export const CACHE_VERSION = 'v1'
export const CACHE_BUCKET = 'learning-packages'

/** Tiempo de vida de un artefacto en caché (7 días). */
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Tiempo de vida de artefactos temporales on-demand (1 hora). */
export const ONDEMAND_TTL_MS = 60 * 60 * 1000

export type CacheFormat =
  | 'html_preview'
  | 'html_bundle'
  | 'scorm_1_2'
  | 'pptx_bundle'

function formatExtension(format: CacheFormat): string {
  switch (format) {
    case 'html_preview':
      return 'html'
    case 'html_bundle':
    case 'scorm_1_2':
      return 'zip'
    case 'pptx_bundle':
      return 'pptx'
  }
}

export function cachePath(
  format: CacheFormat,
  asignaturaId: string,
  cacheKey: string,
): string {
  return `cache/${CACHE_VERSION}/${asignaturaId}/${format}/${cacheKey}.${formatExtension(
    format,
  )}`
}

export async function computeCacheKey(
  asignaturaId: string,
  format: CacheFormat,
  objectIds: Array<string>,
): Promise<string> {
  const sorted = [...objectIds].sort()
  const payload = `${CACHE_VERSION}:${asignaturaId}:${format}:${sorted.join(
    ',',
  )}`
  const encoded = new TextEncoder().encode(payload)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  const bytes = new Uint8Array(digest)
  // base64url sin padding
  const base64 = btoa(String.fromCharCode(...bytes))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function isExpired(createdAtIso: string | undefined, ttlMs: number): boolean {
  if (!createdAtIso) return true
  const createdAt = new Date(createdAtIso).getTime()
  return Number.isNaN(createdAt) || Date.now() - createdAt > ttlMs
}

type StorageObjectMeta = {
  name: string
  created_at?: string
}

function splitStoragePath(path: string): {
  directory: string
  fileName: string
} {
  const separatorIndex = path.lastIndexOf('/')
  if (separatorIndex < 0) {
    return { directory: '', fileName: path }
  }

  return {
    directory: path.slice(0, separatorIndex),
    fileName: path.slice(separatorIndex + 1),
  }
}

export async function findStorageObject(
  supabaseService: any,
  path: string,
): Promise<StorageObjectMeta | null> {
  const { directory, fileName } = splitStoragePath(path)
  const { data, error } = await supabaseService.storage
    .from(CACHE_BUCKET)
    .list(directory, {
      limit: 100,
      offset: 0,
      search: fileName,
      sortBy: { column: 'name', order: 'asc' },
    })

  if (error) {
    throw new HttpError(
      500,
      'No se pudo consultar el cache de Storage.',
      'CACHE_LOOKUP_FAILED',
      error,
    )
  }

  const exact = ((data ?? []) as Array<StorageObjectMeta>).find(
    (item) => item.name === fileName,
  )
  if (!exact) return null

  return {
    ...exact,
    name: directory ? `${directory}/${exact.name}` : exact.name,
  }
}

export async function readCachedText(
  supabaseService: any,
  path: string,
): Promise<string> {
  const { data, error } = await supabaseService.storage
    .from(CACHE_BUCKET)
    .download(path)

  if (error) {
    throw new HttpError(
      500,
      'No se pudo leer el cache de Storage.',
      'CACHE_READ_FAILED',
      error,
    )
  }

  const blob = data as Blob
  return await blob.text()
}

export async function deleteStoragePaths(
  supabaseService: any,
  paths: Array<string>,
): Promise<void> {
  if (paths.length === 0) return
  const { error } = await supabaseService.storage
    .from(CACHE_BUCKET)
    .remove(paths)
  if (error) {
    console.error('[learning-package-export] failed to remove storage paths', {
      paths,
      error,
    })
  }
}

export async function uploadArtifact(
  supabaseService: any,
  path: string,
  artifact: BuiltArtifact,
): Promise<void> {
  const uploadBuffer = new ArrayBuffer(artifact.bytes.byteLength)
  new Uint8Array(uploadBuffer).set(artifact.bytes)

  const { error } = await supabaseService.storage
    .from(CACHE_BUCKET)
    .upload(path, new Blob([uploadBuffer], { type: artifact.mime }), {
      contentType: artifact.mime,
      upsert: true,
    })

  if (error) {
    throw new HttpError(
      500,
      'No se pudo guardar el paquete en Storage.',
      'STORAGE_UPLOAD_FAILED',
      error,
    )
  }
}

export function rewriteStorageUrlOrigin(
  signedUrl: string,
  internalBaseUrl: string | undefined,
  publicBaseUrl: string | undefined,
): string {
  if (!internalBaseUrl || !publicBaseUrl) return signedUrl

  try {
    const url = new URL(signedUrl)
    const internalBase = new URL(internalBaseUrl)
    if (url.origin !== internalBase.origin) return signedUrl

    const publicBase = new URL(publicBaseUrl)
    url.protocol = publicBase.protocol
    url.host = publicBase.host
    return url.toString()
  } catch {
    return signedUrl
  }
}

function localSupabasePublicUrl(): string | undefined {
  const internalBaseUrl = Deno.env.get('SUPABASE_URL')
  if (!internalBaseUrl) return undefined

  try {
    const internalBase = new URL(internalBaseUrl)
    const configuredPort = Deno.env.get('LOCAL_SUPABASE_PORT')

    // Supabase CLI expone este puerto al host y lo inyecta en el runtime. No
    // asumimos localhost para un despliegue remoto que sólo se llame `kong`.
    if (internalBase.hostname === 'kong') {
      return configuredPort
        ? `${internalBase.protocol}//127.0.0.1:${configuredPort}`
        : undefined
    }

    if (!['localhost', '127.0.0.1'].includes(internalBase.hostname)) {
      return undefined
    }

    const port = configuredPort ?? internalBase.port ?? '54321'
    return `${internalBase.protocol}//127.0.0.1:${port}`
  } catch {
    return undefined
  }
}

export function clientSignedUrl(
  signedUrl: string,
  requestUrl?: string,
): string {
  return rewriteStorageUrlOrigin(
    signedUrl,
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_PUBLIC_URL') ??
      Deno.env.get('API_EXTERNAL_URL') ??
      requestUrl ??
      localSupabasePublicUrl(),
  )
}

export type CacheCheckResult =
  | { hit: true; path: string; createdAt?: string }
  | { hit: false; path: string }

export async function checkCache(
  supabaseService: any,
  format: CacheFormat,
  asignaturaId: string,
  objectIds: Array<string>,
): Promise<CacheCheckResult> {
  const key = await computeCacheKey(asignaturaId, format, objectIds)
  const path = cachePath(format, asignaturaId, key)
  const existing = await findStorageObject(supabaseService, path)

  if (existing && !isExpired(existing.created_at, CACHE_TTL_MS)) {
    return { hit: true, path, createdAt: existing.created_at }
  }

  if (existing) {
    await deleteStoragePaths(supabaseService, [path])
  }

  return { hit: false, path }
}

export function clientFileName(
  format: CacheFormat,
  ctx: PackageContext,
  objetos: Array<PackageObject>,
): string {
  const prefijo =
    format === 'scorm_1_2'
      ? 'scorm'
      : format === 'html_bundle'
        ? 'html'
        : format === 'pptx_bundle'
          ? 'presentacion'
          : 'vista-previa'
  const slugAsignatura = slugify(
    ctx.asignaturaCodigo ?? ctx.asignaturaNombre,
    'asignatura',
  )
  const slugContenido =
    objetos.length === 1
      ? slugify(objetos[0].titulo, objetos[0].tipo)
      : 'coleccion'
  const ext = format === 'html_preview' ? 'html' : formatExtension(format)
  return `${prefijo}-${slugAsignatura}-${slugContenido}.${ext}`
}

function slugify(value: string, fallback = 'paquete'): string {
  const slug = value
    .normalize('NFD')
    .replace(/[^\x20-\x7e]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || fallback
}
