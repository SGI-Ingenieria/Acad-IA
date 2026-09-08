import '@supabase/functions-js/edge-runtime.d.ts'

import { preflightResponse } from '../_shared/cors.ts'
import { assertDocumentPermission } from '../_shared/documentos-academicos.ts'
import {
  azureDocumentLayoutEnabled,
  extractDocumentLayout,
} from '../_shared/azure-document-layout.ts'
import {
  getServiceRoleClient,
  requireAuthenticatedUser,
} from '../_shared/supabase.ts'
import { edgeErrorResponse, HttpError, sendSuccess } from '../_shared/utils.ts'
import { clasificarArchivoAcademico } from '../academic-import-analyze/analysis.ts'

type ContextoPreflight = 'plan' | 'asignatura'

function parseBody(body: unknown): {
  fileId: string
  contexto: ContextoPreflight
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'El cuerpo JSON no es válido.', 'INVALID_JSON')
  }
  const input = body as Record<string, unknown>
  const fileId = typeof input.fileId === 'string' ? input.fileId : ''
  const contexto = input.contexto
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) {
    throw new HttpError(422, 'fileId debe ser un UUID.', 'VALIDATION_ERROR')
  }
  if (contexto !== 'plan' && contexto !== 'asignatura') {
    throw new HttpError(
      422,
      'El contexto documental no es válido.',
      'VALIDATION_ERROR',
    )
  }
  return { fileId, contexto }
}

function invalidResult(input: {
  code: string
  message: string
  role?: string
  confidence?: number
}) {
  return {
    accepted: false,
    code: input.code,
    message: input.message,
    role: input.role ?? 'OTRO',
    confidence: input.confidence ?? 0,
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return preflightResponse()
  try {
    if (request.method !== 'POST') {
      throw new HttpError(405, 'Método no permitido.', 'METHOD_NOT_ALLOWED')
    }
    const user = await requireAuthenticatedUser(request)
    const { fileId, contexto } = parseBody(
      await request.json().catch(() => null),
    )
    const supabase = getServiceRoleClient()
    await assertDocumentPermission({
      supabase,
      userId: user.id,
      fileId,
      permission: 'view',
    })

    if (!azureDocumentLayoutEnabled()) {
      return sendSuccess({
        data: invalidResult({
          code: 'DOCUMENT_VALIDATION_UNAVAILABLE',
          message:
            'No se pudo validar el archivo todavía. Verifica la configuración documental e inténtalo de nuevo.',
        }),
      })
    }

    const { data: file, error } = await supabase
      .from('files')
      .select(
        'display_name, file_versions!files_current_version_fk(original_filename, file_blobs(storage_bucket, storage_path, detected_mime))',
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
    if (!version || !blob) {
      throw new HttpError(
        409,
        'El archivo todavía no tiene contenido disponible para validar.',
        'FILE_VERSION_MISSING',
      )
    }

    const { data, error: downloadError } = await supabase.storage
      .from(blob.storage_bucket)
      .download(blob.storage_path)
    if (downloadError || !data) {
      throw new HttpError(
        502,
        'No se pudo leer el archivo cargado.',
        'DOCUMENT_DOWNLOAD_FAILED',
      )
    }

    let layout
    try {
      layout = await extractDocumentLayout({
        bytes: new Uint8Array(await data.arrayBuffer()),
        mimeType: blob.detected_mime,
        filename: version.original_filename ?? file.display_name,
      })
    } catch (error) {
      const code =
        error instanceof HttpError ? error.code : 'DOCUMENT_UNREADABLE'
      return sendSuccess({
        data: invalidResult({
          code: 'DOCUMENT_UNREADABLE',
          message:
            'El archivo no se pudo leer. Verifica que no esté dañado, protegido o que el escaneo tenga texto visible.',
        }),
        meta: { sourceCode: code },
      })
    }

    const filename = version.original_filename ?? file.display_name
    const classification = clasificarArchivoAcademico({
      nombre: filename,
      mime: blob.detected_mime,
      contenido: layout.content,
    })
    const validRoles =
      contexto === 'asignatura'
        ? new Set(['PROGRAMA'])
        : new Set(['PLAN', 'MAPA', 'PROGRAMA', 'RESOLUCION'])
    if (!validRoles.has(classification.rol)) {
      return sendSuccess({
        data: invalidResult({
          code: 'DOCUMENT_NOT_RELEVANT',
          message:
            contexto === 'asignatura'
              ? 'Este archivo no parece ser un programa de asignatura. Retíralo o verifica que hayas cargado el documento correcto.'
              : 'Este archivo no parece corresponder a un plan, mapa curricular, programa de asignatura o resolución académica.',
          role: classification.rol,
          confidence: classification.confianza,
        }),
      })
    }

    return sendSuccess({
      data: {
        accepted: true,
        code: 'DOCUMENT_ACCEPTED',
        message: 'Archivo académico reconocido.',
        role: classification.rol,
        confidence: classification.confianza,
        pages: layout.pages,
        tables: layout.tables,
      },
    })
  } catch (error) {
    return edgeErrorResponse(
      error,
      'academic-document-preflight',
      'No se pudo validar el archivo.',
    )
  }
})
