import '@supabase/functions-js/edge-runtime.d.ts'
import OpenAI from 'npm:openai@6.16.0'

import { corsHeaders } from '../_shared/cors.ts'
import {
  DOCUMENTOS_BUCKET,
  canonicalContentPath,
  detectDocument,
  requireEnv,
  serviceClient,
  sha256Hex,
} from '../_shared/documentos-academicos.ts'
import {
  type BlobDocumental,
  ensureSelectionVectorStore,
  syncBlobToOpenAI,
} from '../_shared/documentos-vector-stores.ts'
import { wakeDocumentWorker } from '../_shared/documentos-worker.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void }

type IngestionJob = {
  id: string
  tenant_id: string
  upload_session_id: string | null
  file_version_id: string | null
  job_type: 'hash_file' | 'cleanup' | 'openai_sync' | 'vs_warmup' | 'blob_gc'
  payload: Record<string, unknown> | null
  attempts: number
}

const BLOB_SELECT =
  'id, sha256, size_bytes, detected_mime, storage_bucket, storage_path, openai_file_id'

function workerId() {
  return `edge:${crypto.randomUUID()}`
}

async function matchesSecret(provided: string, expected: string) {
  const encoder = new TextEncoder()
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  const left = new Uint8Array(leftDigest)
  const right = new Uint8Array(rightDigest)
  let difference = 0
  for (let index = 0; index < left.length; index += 1)
    difference |= left[index] ^ right[index]
  return difference === 0
}

async function assertInternal(request: Request) {
  const token = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim()
  if (token === requireEnv('SUPABASE_SERVICE_ROLE_KEY')) return
  const cronSecret = request.headers.get('x-file-jobs-cron-secret') ?? ''
  const configuredSecret = Deno.env.get('FILE_JOBS_CRON_SECRET') ?? ''
  if (
    !cronSecret ||
    !configuredSecret ||
    !(await matchesSecret(cronSecret, configuredSecret))
  ) {
    throw new HttpError(401, 'No autorizado.', 'UNAUTHORIZED')
  }
}

async function finalize(args: {
  supabase: ReturnType<typeof serviceClient>
  job: IngestionJob
  worker: string
  ok: boolean
  error?: Record<string, unknown>
}) {
  const delaySeconds = Math.min(
    300,
    30 * 2 ** Math.max(0, args.job.attempts - 1),
  )
  const { error } = await args.supabase.rpc(
    'finalizar_trabajo_ingesta_documental',
    {
      p_job_id: args.job.id,
      p_worker: args.worker,
      p_ok: args.ok,
      p_error: args.error ?? null,
      p_reintentar_en: args.ok
        ? null
        : new Date(Date.now() + delaySeconds * 1000).toISOString(),
    },
  )
  if (error)
    throw new Error(`No se pudo cerrar el job ${args.job.id}: ${error.message}`)
}

async function processHash(
  job: IngestionJob,
  supabase: ReturnType<typeof serviceClient>,
) {
  if (!job.upload_session_id)
    throw new HttpError(422, 'El job de hash no tiene sesión.', 'JOB_INVALID')
  const { data: session, error: sessionError } = await supabase
    .from('upload_sessions')
    .select(
      'id, tenant_id, user_id, temporary_path, original_filename, declared_size, client_sha256, status',
    )
    .eq('id', job.upload_session_id)
    .maybeSingle()
  if (sessionError || !session)
    throw new HttpError(
      404,
      'No se encontró la sesión de carga.',
      'UPLOAD_SESSION_NOT_FOUND',
    )
  const { data: blob, error: downloadError } = await supabase.storage
    .from(DOCUMENTOS_BUCKET)
    .download(session.temporary_path)
  if (downloadError || !blob)
    throw new HttpError(
      404,
      'No se encontró el archivo temporal.',
      'UPLOAD_OBJECT_MISSING',
    )
  if (blob.size !== Number(session.declared_size)) {
    await supabase
      .from('upload_sessions')
      .update({ status: 'failed', error_code: 'UPLOAD_SIZE_MISMATCH' })
      .eq('id', session.id)
    throw new HttpError(
      422,
      'El tamaño descargado no coincide con la sesión.',
      'UPLOAD_SIZE_MISMATCH',
    )
  }

  const bytes = await blob.arrayBuffer()
  const detected = detectDocument(
    new Uint8Array(bytes.slice(0, 32)),
    session.original_filename,
  )
  const hash = await sha256Hex(bytes)
  const finalPath = canonicalContentPath(session.tenant_id, hash)
  const { data: existingBlob } = await supabase
    .from('file_blobs')
    .select('id')
    .eq('tenant_id', session.tenant_id)
    .eq('sha256', hash)
    .eq('size_bytes', blob.size)
    .is('deleted_at', null)
    .maybeSingle()

  if (!existingBlob) {
    const { error: moveError } = await supabase.storage
      .from(DOCUMENTOS_BUCKET)
      .move(session.temporary_path, finalPath)
    if (moveError) {
      const { error: finalObjectError } = await supabase.storage
        .from(DOCUMENTOS_BUCKET)
        .download(finalPath)
      if (finalObjectError)
        throw new HttpError(
          502,
          'No se pudo mover el contenido al almacén inmutable.',
          'STORAGE_MOVE_FAILED',
        )
    }
  } else {
    const { error: removeError } = await supabase.storage
      .from(DOCUMENTOS_BUCKET)
      .remove([session.temporary_path])
    if (removeError)
      console.warn(
        'No se pudo eliminar el temporal deduplicado:',
        removeError.message,
      )
  }

  const { data: materialized, error: materializeError } = await supabase.rpc(
    'materializar_sesion_carga_documento',
    {
      p_session_id: session.id,
      p_sha256: hash,
      p_size_bytes: blob.size,
      p_detected_mime: detected.mimeType,
      p_storage_path: finalPath,
    },
  )
  if (materializeError || !materialized) {
    throw new HttpError(
      500,
      'No se pudo materializar la versión documental.',
      'FILE_MATERIALIZE_FAILED',
    )
  }
  if (session.client_sha256 && session.client_sha256 !== hash) {
    await supabase.from('file_events').insert({
      tenant_id: session.tenant_id,
      file_id: Array.isArray(materialized)
        ? materialized[0]?.file_id
        : materialized.file_id,
      actor_user_id: session.user_id,
      event_type: 'upload.client_hash_mismatch',
      entity_type: 'upload_session',
      entity_id: session.id,
      metadata: {
        client_sha256: session.client_sha256,
        authoritative_sha256: hash,
      },
    })
  }
}

// Sincroniza (caché) el contenido de un blob hacia OpenAI Files. Nunca es
// bloqueante: si falla, la cascada de generación lo reintenta just-in-time.
async function processOpenAISync(
  job: IngestionJob,
  supabase: ReturnType<typeof serviceClient>,
) {
  const blobId = String(job.payload?.blob_id ?? '')
  if (!blobId)
    throw new HttpError(422, 'El job de sync no tiene blob.', 'JOB_INVALID')
  const { data: blob, error } = await supabase
    .from('file_blobs')
    .select(BLOB_SELECT)
    .eq('id', blobId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error)
    throw new HttpError(500, 'No se pudo leer el blob.', 'BLOB_READ_FAILED')
  // Blob ya recolectado o ya sincronizado: el trabajo terminó.
  if (!blob || blob.openai_file_id) return
  const openai = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })
  await syncBlobToOpenAI({
    supabase,
    openai,
    blob: blob as BlobDocumental,
  })
}

// Pre-calentamiento: materializa el vector store de una selección antes de
// que el usuario confirme la generación.
async function processVectorStoreWarmup(
  job: IngestionJob,
  supabase: ReturnType<typeof serviceClient>,
) {
  const seleccionHash = String(job.payload?.seleccion_sha256 ?? '')
  if (!seleccionHash)
    throw new HttpError(
      422,
      'El job de warm-up no tiene selección.',
      'JOB_INVALID',
    )
  const { data: seleccion, error } = await supabase
    .from('vector_store_selecciones')
    .select('id, estado, blob_ids')
    .eq('tenant_id', job.tenant_id)
    .eq('seleccion_sha256', seleccionHash)
    .maybeSingle()
  if (error)
    throw new HttpError(
      500,
      'No se pudo leer la selección.',
      'SELECTION_READ_FAILED',
    )
  if (!seleccion || seleccion.estado === 'listo') return

  const { data: blobs, error: blobsError } = await supabase
    .from('file_blobs')
    .select(BLOB_SELECT)
    .in('id', (seleccion.blob_ids ?? []) as Array<string>)
    .is('deleted_at', null)
  if (blobsError)
    throw new HttpError(
      500,
      'No se pudieron leer los blobs.',
      'BLOB_READ_FAILED',
    )
  if (!blobs?.length) {
    await supabase
      .from('vector_store_selecciones')
      .update({ estado: 'fallido', error: 'sin blobs vivos' })
      .eq('id', seleccion.id)
    return
  }
  const openai = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })
  const resultado = await ensureSelectionVectorStore({
    supabase,
    openai,
    tenantId: job.tenant_id,
    blobs: blobs as Array<BlobDocumental>,
  })
  // El warm-up es mejor esfuerzo: si no hubo vector store, la generación
  // degradará a inyección directa sin que el usuario lo perciba.
  if (!resultado.vectorStoreId) {
    console.warn(
      `Warm-up sin índice para selección ${seleccionHash}; degradará a inyección directa.`,
    )
  }
}

// Borrado físico de un blob sin referencias: Storage + File de OpenAI + fila.
async function processBlobGC(
  job: IngestionJob,
  supabase: ReturnType<typeof serviceClient>,
) {
  const blobId = String(job.payload?.blob_id ?? '')
  if (!blobId)
    throw new HttpError(422, 'El job de GC no tiene blob.', 'JOB_INVALID')
  const { data: preparado, error } = await supabase.rpc('preparar_blob_gc', {
    p_blob_id: blobId,
  })
  if (error)
    throw new HttpError(500, 'No se pudo preparar el GC.', 'BLOB_GC_FAILED')
  const target = Array.isArray(preparado) ? preparado[0] : preparado
  // Sin fila: el blob recuperó referencias o ya no existe. Trabajo terminado.
  if (!target) return

  const { error: removeError } = await supabase.storage
    .from(String(target.storage_bucket))
    .remove([String(target.storage_path)])
  if (removeError && !/not.?found/i.test(removeError.message)) {
    throw new HttpError(
      502,
      'No se pudo eliminar el contenido físico.',
      'STORAGE_REMOVE_FAILED',
    )
  }
  if (target.openai_file_id) {
    const openai = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })
    await openai.files.delete(String(target.openai_file_id)).catch(() => {
      // El File pudo haber expirado en OpenAI; es caché, no fuente de verdad.
    })
  }
  const { error: finalizeError } = await supabase.rpc('finalizar_blob_gc', {
    p_blob_id: blobId,
  })
  if (finalizeError)
    throw new HttpError(500, 'No se pudo cerrar el GC.', 'BLOB_GC_FAILED')
}

async function processJob(
  job: IngestionJob,
  supabase: ReturnType<typeof serviceClient>,
) {
  if (job.job_type === 'hash_file') return await processHash(job, supabase)
  if (job.job_type === 'openai_sync')
    return await processOpenAISync(job, supabase)
  if (job.job_type === 'vs_warmup')
    return await processVectorStoreWarmup(job, supabase)
  if (job.job_type === 'blob_gc') return await processBlobGC(job, supabase)
  throw new HttpError(
    501,
    'La etapa aún no está disponible.',
    'JOB_TYPE_NOT_IMPLEMENTED',
  )
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders })
  try {
    if (request.method !== 'POST')
      throw new HttpError(405, 'Método no permitido.', 'METHOD_NOT_ALLOWED')
    await assertInternal(request)
    const supabase = serviceClient()
    const worker = workerId()
    const { data, error } = await supabase.rpc(
      'reclamar_trabajos_ingesta_documental',
      {
        p_worker: worker,
        p_limite: 3,
        p_arrendamiento: '2 minutes',
      },
    )
    if (error)
      throw new HttpError(
        500,
        'No se pudieron reclamar trabajos.',
        'INGESTION_CLAIM_FAILED',
      )
    const jobs = (data ?? []) as Array<IngestionJob>
    const results = []
    for (const job of jobs) {
      try {
        await processJob(job, supabase)
        await finalize({ supabase, job, worker, ok: true })
        results.push({ id: job.id, status: 'completed' })
      } catch (error) {
        const details = {
          code: error instanceof HttpError ? error.code : 'PROCESSING_ERROR',
          message: error instanceof Error ? error.message : String(error),
        }
        await finalize({ supabase, job, worker, ok: false, error: details })
        results.push({ id: job.id, status: 'retry', error: details.code })
      }
    }
    if (jobs.length > 0) {
      EdgeRuntime.waitUntil(
        wakeDocumentWorker('self-drain').catch((error) =>
          console.warn('No se pudo continuar drenando la cola:', error),
        ),
      )
    }
    return sendSuccess({ data: results })
  } catch (error) {
    if (error instanceof HttpError)
      return sendError(error.status, error.message, error.code)
    console.error('process-file-jobs failed', error)
    return sendError(
      500,
      'No se pudieron procesar los documentos.',
      'INTERNAL_SERVER_ERROR',
    )
  }
})
