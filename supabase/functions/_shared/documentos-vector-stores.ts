// Cascada de vector stores de OpenAI. Storage es la única fuente de verdad;
// todo lo que vive en OpenAI (Files y vector stores) es caché reconstruible.
// Ningún nivel de esta cascada puede volverse visible ni bloqueante para el
// usuario: cada fallo degrada al siguiente nivel y, en el peor caso, el
// documento se inyecta directo al contexto del modelo.
import OpenAI from 'npm:openai@6.16.0'

import { serviceClient, sha256Hex } from './documentos-academicos.ts'

// Selecciones que caben en el contexto se inyectan directo: más rápido, más
// barato y con mejores respuestas que un índice para documentos cortos.
export const UMBRAL_TOKENS_INYECCION_DIRECTA = 24_000
const REINTENTOS_SYNC = 2
const BACKOFF_BASE_MS = 500

export type BlobDocumental = {
  id: string
  sha256: string
  size_bytes: number
  detected_mime: string
  storage_bucket: string
  storage_path: string
  openai_file_id: string | null
}

export function estimarTokens(sizeBytes: number): number {
  return Math.ceil(sizeBytes / 4)
}

export async function hashSeleccion(sha256s: Array<string>): Promise<string> {
  const canonical = [...new Set(sha256s)].sort().join('\n')
  return await sha256Hex(new TextEncoder().encode(canonical).buffer)
}

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Sube el contenido de un blob desde Storage a OpenAI Files (purpose
 * `assistants`, el requerido por vector stores) y persiste el id en el blob
 * para que todos los usuarios que compartan ese contenido lo reutilicen.
 */
export async function syncBlobToOpenAI(args: {
  supabase: ReturnType<typeof serviceClient>
  openai: OpenAI
  blob: BlobDocumental
  filename?: string
}): Promise<string> {
  const { data: contenido, error } = await args.supabase.storage
    .from(args.blob.storage_bucket)
    .download(args.blob.storage_path)
  if (error || !contenido) {
    throw new Error(
      `STORAGE_BLOB_MISSING:${args.blob.id}:${error?.message ?? 'sin contenido'}`,
    )
  }
  const filename = args.filename ?? `${args.blob.sha256}.bin`
  const file = new File([await contenido.arrayBuffer()], filename, {
    type: args.blob.detected_mime,
  })
  const created = await args.openai.files.create({
    file,
    purpose: 'assistants',
  })
  await args.supabase
    .from('file_blobs')
    .update({
      openai_file_id: created.id,
      openai_synced_at: new Date().toISOString(),
      openai_sync_error: null,
    })
    .eq('id', args.blob.id)
  return created.id
}

async function syncBlobConReintentos(args: {
  supabase: ReturnType<typeof serviceClient>
  openai: OpenAI
  blob: BlobDocumental
  filename?: string
}): Promise<string | null> {
  for (let intento = 0; intento <= REINTENTOS_SYNC; intento += 1) {
    try {
      return await syncBlobToOpenAI(args)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // Storage caído es el único fallo real: no tiene sentido reintentar
      // contra OpenAI si no podemos leer el contenido.
      if (message.startsWith('STORAGE_BLOB_MISSING:')) throw error
      if (intento === REINTENTOS_SYNC) {
        await args.supabase
          .from('file_blobs')
          .update({ openai_sync_error: message.slice(0, 500) })
          .eq('id', args.blob.id)
        return null
      }
      await esperar(BACKOFF_BASE_MS * 2 ** intento + Math.random() * 250)
    }
  }
  return null
}

type CacheSeleccion = {
  id: string
  openai_vector_store_id: string | null
  estado: 'creando' | 'listo' | 'expirado' | 'fallido'
}

async function actualizarCache(
  supabase: ReturnType<typeof serviceClient>,
  id: string,
  values: Record<string, unknown>,
) {
  await supabase.from('vector_store_selecciones').update(values).eq('id', id)
}

export type SelectionVectorStoreResult = {
  vectorStoreId: string | null
  /** Blobs que no pudieron indexarse y deben degradar a inyección directa. */
  blobsDegradados: Set<string>
}

/**
 * Materializa (o reutiliza) el vector store de una selección de blobs.
 *
 * Nivel 1: hit en caché con el índice vivo en OpenAI.
 * Nivel 2: crear el vector store adjuntando los Files ya sincronizados.
 * Nivel 3: sincronizar a OpenAI Files los blobs a los que les falte el File.
 * Nivel 4: lo que siga fallando se reporta como degradado (inyección directa).
 */
export async function ensureSelectionVectorStore(args: {
  supabase: ReturnType<typeof serviceClient>
  openai: OpenAI
  tenantId: string
  blobs: Array<BlobDocumental>
  filenames?: Map<string, string>
}): Promise<SelectionVectorStoreResult> {
  const degradados = new Set<string>()
  if (!args.blobs.length)
    return { vectorStoreId: null, blobsDegradados: degradados }

  const seleccionHash = await hashSeleccion(args.blobs.map((b) => b.sha256))

  // Nivel 1: caché de selección.
  const { data: cacheRow } = await args.supabase
    .from('vector_store_selecciones')
    .select('id, openai_vector_store_id, estado')
    .eq('tenant_id', args.tenantId)
    .eq('seleccion_sha256', seleccionHash)
    .maybeSingle()
  const cache = (cacheRow ?? null) as CacheSeleccion | null

  if (cache?.estado === 'listo' && cache.openai_vector_store_id) {
    try {
      const vivo = await args.openai.vectorStores.retrieve(
        cache.openai_vector_store_id,
      )
      if (vivo.status !== 'expired') {
        // Renovar la ventana de expiración anclada a la última actividad.
        const renovado = await args.openai.vectorStores
          .update(cache.openai_vector_store_id, {
            expires_after: { anchor: 'last_active_at', days: 1 },
          })
          .catch(() => vivo)
        await actualizarCache(args.supabase, cache.id, {
          last_active_at: new Date().toISOString(),
          expires_at: renovado.expires_at
            ? new Date(renovado.expires_at * 1000).toISOString()
            : new Date(Date.now() + 86_400_000).toISOString(),
        })
        return {
          vectorStoreId: cache.openai_vector_store_id,
          blobsDegradados: degradados,
        }
      }
    } catch {
      // El índice murió en OpenAI: se refleja y se reconstruye.
    }
    await actualizarCache(args.supabase, cache.id, { estado: 'expirado' })
  }

  // Nivel 3: garantizar que cada blob tenga su File en OpenAI.
  const fileIdPorBlob = new Map<string, string>()
  for (const blob of args.blobs) {
    if (blob.openai_file_id) {
      fileIdPorBlob.set(blob.id, blob.openai_file_id)
      continue
    }
    const fileId = await syncBlobConReintentos({
      supabase: args.supabase,
      openai: args.openai,
      blob,
      filename: args.filenames?.get(blob.id),
    })
    if (fileId) fileIdPorBlob.set(blob.id, fileId)
    else degradados.add(blob.id)
  }
  if (!fileIdPorBlob.size) {
    return { vectorStoreId: null, blobsDegradados: degradados }
  }

  // Nivel 2: crear el índice y adjuntar cada File. Las selecciones son chicas
  // (máximo un puñado de documentos), por lo que el adjunte individual con
  // poll da un manejo de errores por archivo mucho más simple que el batch.
  let vectorStoreId: string
  try {
    const creado = await args.openai.vectorStores.create({
      name: `seleccion-${seleccionHash.slice(0, 12)}`,
      expires_after: { anchor: 'last_active_at', days: 1 },
    })
    vectorStoreId = creado.id
  } catch {
    for (const blob of args.blobs) degradados.add(blob.id)
    if (cache) {
      await actualizarCache(args.supabase, cache.id, { estado: 'fallido' })
    }
    return { vectorStoreId: null, blobsDegradados: degradados }
  }

  let adjuntos = 0
  for (const blob of args.blobs) {
    const fileId = fileIdPorBlob.get(blob.id)
    if (!fileId) continue
    let attached = false
    for (let intento = 0; intento <= 1 && !attached; intento += 1) {
      try {
        const resultado = await args.openai.vectorStores.files.createAndPoll(
          vectorStoreId,
          { file_id: fileIdPorBlob.get(blob.id)! },
        )
        if (resultado.status === 'completed') {
          attached = true
          adjuntos += 1
          break
        }
        throw new Error(`indexado ${resultado.status}`)
      } catch (error) {
        // Un File cacheado pudo haber muerto en OpenAI: se limpia y se
        // vuelve a subir desde Storage una única vez.
        if (intento === 0) {
          await args.supabase
            .from('file_blobs')
            .update({ openai_file_id: null, openai_synced_at: null })
            .eq('id', blob.id)
          const nuevoId = await syncBlobConReintentos({
            supabase: args.supabase,
            openai: args.openai,
            blob: { ...blob, openai_file_id: null },
            filename: args.filenames?.get(blob.id),
          })
          if (nuevoId) {
            fileIdPorBlob.set(blob.id, nuevoId)
            continue
          }
        }
        console.warn(
          `Documento degradado a inyección directa (blob ${blob.id}):`,
          error instanceof Error ? error.message : error,
        )
        degradados.add(blob.id)
        break
      }
    }
  }

  if (!adjuntos) {
    await args.openai.vectorStores.delete(vectorStoreId).catch(() => {})
    if (cache) {
      await actualizarCache(args.supabase, cache.id, { estado: 'fallido' })
    }
    return { vectorStoreId: null, blobsDegradados: degradados }
  }

  const expiraEn = new Date(Date.now() + 86_400_000).toISOString()
  if (cache) {
    await actualizarCache(args.supabase, cache.id, {
      openai_vector_store_id: vectorStoreId,
      estado: 'listo',
      last_active_at: new Date().toISOString(),
      expires_at: expiraEn,
      error: null,
      blob_ids: args.blobs.map((b) => b.id),
    })
  } else {
    await args.supabase.from('vector_store_selecciones').upsert(
      {
        tenant_id: args.tenantId,
        seleccion_sha256: seleccionHash,
        openai_vector_store_id: vectorStoreId,
        estado: 'listo',
        last_active_at: new Date().toISOString(),
        expires_at: expiraEn,
        blob_ids: args.blobs.map((b) => b.id),
      },
      { onConflict: 'tenant_id,seleccion_sha256' },
    )
  }
  return { vectorStoreId, blobsDegradados: degradados }
}
