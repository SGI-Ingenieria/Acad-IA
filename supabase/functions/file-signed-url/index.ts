import '@supabase/functions-js/edge-runtime.d.ts'

import { corsHeaders } from '../_shared/cors.ts'
import {
  assertDocumentPermission,
  requireAuthenticatedUser,
  serviceClient,
} from '../_shared/documentos-academicos.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'
import { clientSignedUrl } from '../learning-package-export/cache.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  try {
    if (request.method !== 'POST') {
      throw new HttpError(405, 'Método no permitido.', 'METHOD_NOT_ALLOWED')
    }
    const user = await requireAuthenticatedUser(request)
    const body = await request.json().catch(() => null)
    const fileId =
      body && typeof body === 'object'
        ? (body as Record<string, unknown>).fileId
        : null
    const download =
      body && typeof body === 'object'
        ? (body as Record<string, unknown>).download === true
        : false
    if (typeof fileId !== 'string' || !/^[0-9a-f-]{36}$/i.test(fileId)) {
      throw new HttpError(422, 'fileId debe ser un UUID.', 'VALIDATION_ERROR')
    }
    const supabase = serviceClient()
    await assertDocumentPermission({
      supabase,
      userId: user.id,
      fileId,
      permission: 'view',
    })
    const { data: file, error } = await supabase
      .from('files')
      .select(
        'display_name, file_versions!files_current_version_fk(file_blobs(storage_bucket, storage_path))',
      )
      .eq('id', fileId)
      .single()
    if (error || !file) {
      throw new HttpError(404, 'No se encontró el archivo.', 'FILE_NOT_FOUND')
    }
    const version = Array.isArray(file.file_versions)
      ? file.file_versions[0]
      : file.file_versions
    const blob =
      version &&
      (Array.isArray(version.file_blobs)
        ? version.file_blobs[0]
        : version.file_blobs)
    if (!blob) {
      throw new HttpError(
        409,
        'El archivo no tiene una versión disponible.',
        'FILE_VERSION_MISSING',
      )
    }
    const { data: signed, error: signedError } = await supabase.storage
      .from(blob.storage_bucket)
      .createSignedUrl(blob.storage_path, 300, {
        download: download ? file.display_name : false,
      })
    if (signedError || !signed?.signedUrl) {
      throw new HttpError(
        500,
        'No se pudo firmar el archivo.',
        'SIGNED_URL_FAILED',
      )
    }
    const publicSignedUrl = clientSignedUrl(signed.signedUrl, request.url)
    const parsedSignedUrl = new URL(publicSignedUrl)
    // El navegador ya conoce su origen público de Supabase. Entregar la ruta
    // firmada evita filtrar nombres internos de Docker cuando el runtime local
    // no recibe SUPABASE_PUBLIC_URL.
    const signedPath = `${parsedSignedUrl.pathname}${parsedSignedUrl.search}`
    return sendSuccess({
      data: { fileId, url: signedPath, expiresIn: 300 },
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return sendError(error.status, error.message, error.code)
    }
    console.error('file-signed-url failed', error)
    return sendError(
      500,
      'No se pudo preparar la descarga.',
      'INTERNAL_SERVER_ERROR',
    )
  }
})
