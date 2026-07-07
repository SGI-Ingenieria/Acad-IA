// Asset Factory: convierte learning_objects revisados en archivos reales
// (PPTX institucional, paquete SCORM 1.2, bundle HTML), los guarda en el
// bucket privado 'learning-packages' y registra el resultado en
// learning_packages.

import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { corsHeaders } from '../_shared/cors.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'
import {
  buildHtmlBundle,
  buildPptxPackage,
  buildScormPackage,
  slugify,
} from './packager.ts'

import type { Json } from '../_shared/database.types.ts'
import type {
  BuiltArtifact,
  PackageContext,
  PackageObject,
} from './packager.ts'

type SupabaseUntyped = any

const BUCKET = 'learning-packages'

const RequestSchema = z
  .object({
    asignaturaId: z.string().uuid('asignaturaId debe ser un UUID'),
    tipo: z.enum(['pptx_bundle', 'scorm_1_2', 'html_bundle']),
    scope: z.enum(['tema', 'unidad', 'asignatura']).optional().default('tema'),
    unidadId: z.string().min(1).optional(),
    temaId: z.string().min(1).optional(),
    // Por defecto solo objetos revisados/publicados; 'generated' es opcional
    // para previsualizar antes de la revisión humana.
    incluirEstados: z
      .array(z.enum(['generated', 'reviewed', 'published']))
      .min(1)
      .optional()
      .default(['reviewed', 'published']),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.scope !== 'asignatura' && !value.unidadId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['unidadId'],
        message: 'unidadId es requerido para scope unidad/tema',
      })
    }
    if (value.scope === 'tema' && !value.temaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['temaId'],
        message: 'temaId es requerido para scope tema',
      })
    }
  })

type ExportRequest = z.infer<typeof RequestSchema>

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) {
    throw new HttpError(
      500,
      'Configuracion del servidor incompleta.',
      'MISSING_ENV',
      {
        missing: [name],
      },
    )
  }
  return value
}

function formatZodIssues(issues: Array<z.ZodIssue>): string {
  return issues
    .map((issue, i) => {
      const path = issue.path.length ? issue.path.join('.') : '(root)'
      return `${i + 1}. ${path}: ${issue.message}`
    })
    .join('\n')
}

async function readJsonBody(req: Request): Promise<unknown> {
  const contentType = (req.headers.get('content-type') || '').toLowerCase()
  if (!contentType.includes('application/json')) {
    throw new HttpError(
      415,
      'Content-Type no soportado.',
      'UNSUPPORTED_MEDIA_TYPE',
      {
        contentType,
        expected: 'application/json',
      },
    )
  }
  try {
    return await req.json()
  } catch (cause) {
    throw new HttpError(400, 'Body JSON invalido.', 'INVALID_JSON', { cause })
  }
}

/**
 * Exportar requiere poder editar contenido de la asignatura (mismo criterio
 * que las políticas RLS de learning_objects/learning_packages).
 */
async function assertExportAccess(
  supabaseAnon: SupabaseUntyped,
  asignaturaId: string,
) {
  const { data: canAccess, error: accessError } = await supabaseAnon.rpc(
    'authz_can_access_asignatura',
    { p_asignatura_id: asignaturaId },
  )
  if (accessError || canAccess !== true) {
    throw new HttpError(
      403,
      'No tienes acceso a esta asignatura.',
      'FORBIDDEN',
      accessError,
    )
  }

  const { data: canWrite, error: writeError } = await supabaseAnon.rpc(
    'authz_asignatura_content_write_allowed',
    { p_asignatura_id: asignaturaId },
  )
  if (writeError || canWrite !== true) {
    throw new HttpError(
      403,
      'No tienes permiso para exportar recursos de esta asignatura.',
      'FORBIDDEN',
      writeError,
    )
  }
}

type NombresContenido = {
  unidades: Map<string, { titulo: string; temas: Map<string, string> }>
}

/**
 * Índice unidad/tema → nombre legible a partir de contenido_tematico. Los ids
 * persistentes existen desde la migración 20260706183000, pero se indexan
 * también número de unidad e índice de tema como claves alternas porque hay
 * learning_objects históricos referenciados así.
 */
function indexarContenido(contenido: unknown): NombresContenido {
  const unidades = new Map<
    string,
    { titulo: string; temas: Map<string, string> }
  >()
  const lista = Array.isArray(contenido) ? contenido : []

  lista.forEach((unidadRaw, unidadIdx) => {
    if (!unidadRaw || typeof unidadRaw !== 'object' || Array.isArray(unidadRaw))
      return
    const unidad = unidadRaw as Record<string, unknown>
    const numero =
      typeof unidad.unidad === 'number' ? unidad.unidad : unidadIdx + 1
    const titulo =
      typeof unidad.titulo === 'string' && unidad.titulo
        ? `Unidad ${numero}: ${unidad.titulo}`
        : `Unidad ${numero}`

    const temas = new Map<string, string>()
    const temasRaw = Array.isArray(unidad.temas) ? unidad.temas : []
    temasRaw.forEach((temaRaw, temaIdx) => {
      let temaId: string | null = null
      let nombre = `Tema ${temaIdx + 1}`
      if (typeof temaRaw === 'string' && temaRaw) {
        nombre = temaRaw
      } else if (
        temaRaw &&
        typeof temaRaw === 'object' &&
        !Array.isArray(temaRaw)
      ) {
        const tema = temaRaw as Record<string, unknown>
        if (typeof tema.id === 'string' && tema.id) temaId = tema.id
        if (typeof tema.nombre === 'string' && tema.nombre) nombre = tema.nombre
      }
      if (temaId) temas.set(temaId, nombre)
      temas.set(String(temaIdx + 1), nombre)
    })

    const entrada = { titulo, temas }
    if (typeof unidad.id === 'string' && unidad.id)
      unidades.set(unidad.id, entrada)
    unidades.set(String(numero), entrada)
  })

  return { unidades }
}

function buildContext(
  asignatura: Record<string, unknown>,
  nombres: NombresContenido,
): PackageContext {
  return {
    asignaturaNombre: String(asignatura.nombre ?? 'Asignatura'),
    asignaturaCodigo:
      typeof asignatura.codigo === 'string' ? asignatura.codigo : null,
    nombreUnidad: (unidadId) =>
      (unidadId && nombres.unidades.get(unidadId)?.titulo) ||
      (unidadId ? `Unidad ${unidadId}` : ''),
    nombreTema: (unidadId, temaId) =>
      (unidadId &&
        temaId &&
        nombres.unidades.get(unidadId)?.temas.get(temaId)) ||
      (temaId ? `Tema ${temaId}` : ''),
  }
}

async function fetchObjects(
  supabaseService: SupabaseUntyped,
  payload: ExportRequest,
): Promise<Array<PackageObject>> {
  let query = supabaseService
    .from('learning_objects')
    .select(
      'id,unidad_id,tema_id,tipo,titulo,descripcion,contenido_json,source_refs,estado',
    )
    .eq('asignatura_id', payload.asignaturaId)
    .in('estado', payload.incluirEstados)
    .order('creado_en', { ascending: true })

  if (payload.scope !== 'asignatura') {
    query = query.eq('unidad_id', payload.unidadId)
  }
  if (payload.scope === 'tema') {
    query = query.eq('tema_id', payload.temaId)
  }
  if (payload.tipo === 'pptx_bundle') {
    query = query.eq('tipo', 'outline_presentacion')
  }

  const { data, error } = await query
  if (error) {
    throw new HttpError(
      500,
      'No se pudieron leer los recursos.',
      'SUPABASE_QUERY_FAILED',
      error,
    )
  }
  return (data ?? []) as Array<PackageObject>
}

async function buildArtifact(
  tipo: ExportRequest['tipo'],
  objetos: Array<PackageObject>,
  ctx: PackageContext,
): Promise<BuiltArtifact> {
  switch (tipo) {
    case 'scorm_1_2':
      return buildScormPackage(objetos, ctx)
    case 'html_bundle':
      return buildHtmlBundle(objetos, ctx)
    case 'pptx_bundle':
      return await buildPptxPackage(objetos, ctx)
  }
}

function emptyObjectsMessage(payload: ExportRequest): string {
  const qualifier = payload.incluirEstados.includes('generated')
    ? 'disponibles'
    : 'revisados'

  return payload.tipo === 'pptx_bundle'
    ? `No hay outlines de presentación ${qualifier} en el alcance solicitado.`
    : `No hay recursos ${qualifier} en el alcance solicitado.`
}

function archivoNombre(
  tipo: ExportRequest['tipo'],
  ctx: PackageContext,
  payload: ExportRequest,
  extension: string,
): string {
  const prefijo =
    tipo === 'scorm_1_2'
      ? 'scorm'
      : tipo === 'html_bundle'
        ? 'html'
        : 'presentacion'
  const partes = [
    prefijo,
    slugify(ctx.asignaturaCodigo ?? ctx.asignaturaNombre, 'asignatura'),
    payload.scope !== 'asignatura'
      ? `u-${slugify(payload.unidadId ?? '', 'u')}`
      : null,
    payload.scope === 'tema' ? `t-${slugify(payload.temaId ?? '', 't')}` : null,
  ].filter(Boolean)
  return `${partes.join('-')}.${extension}`
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  let packageId: string | null = null
  let supabaseServiceForError: SupabaseUntyped | null = null

  try {
    if (req.method !== 'POST') {
      throw new HttpError(405, 'Metodo no permitido.', 'METHOD_NOT_ALLOWED')
    }

    const authHeader =
      req.headers.get('Authorization') ?? req.headers.get('authorization')
    if (!authHeader) {
      throw new HttpError(401, 'No autorizado.', 'UNAUTHORIZED', {
        reason: 'missing_authorization_header',
      })
    }

    const rawBody = await readJsonBody(req)
    const parsed = RequestSchema.safeParse(rawBody)
    if (!parsed.success) {
      throw new HttpError(
        422,
        formatZodIssues(parsed.error.issues),
        'VALIDATION_ERROR',
        parsed.error,
      )
    }
    const payload = parsed.data

    const SUPABASE_URL = requireEnv('SUPABASE_URL')
    const SUPABASE_ANON_KEY = requireEnv('SUPABASE_ANON_KEY')
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const supabaseService = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    )
    supabaseServiceForError = supabaseService

    const { data: userData, error: userError } =
      await supabaseAnon.auth.getUser()
    if (userError || !userData?.user) {
      throw new HttpError(401, 'Token invalido.', 'UNAUTHORIZED', {
        reason: userError?.message ?? 'invalid_token',
      })
    }
    const user = userData.user

    await assertExportAccess(supabaseAnon, payload.asignaturaId)

    const { data: asignatura, error: asignaturaError } = await supabaseService
      .from('asignaturas')
      .select('id,codigo,nombre,contenido_tematico')
      .eq('id', payload.asignaturaId)
      .maybeSingle()

    if (asignaturaError) {
      throw new HttpError(
        500,
        'No se pudo obtener la asignatura.',
        'SUPABASE_QUERY_FAILED',
        asignaturaError,
      )
    }
    if (!asignatura) {
      throw new HttpError(404, 'Asignatura no encontrada.', 'NOT_FOUND', {
        asignaturaId: payload.asignaturaId,
      })
    }

    const objetos = await fetchObjects(supabaseService, payload)
    if (!objetos.length) {
      throw new HttpError(
        422,
        emptyObjectsMessage(payload),
        'NO_REVIEWED_OBJECTS',
        { scope: payload.scope, incluirEstados: payload.incluirEstados },
      )
    }

    const nombres = indexarContenido(asignatura.contenido_tematico)
    const ctx = buildContext(asignatura as Record<string, unknown>, nombres)

    const { data: packageRow, error: insertError } = await supabaseService
      .from('learning_packages')
      .insert({
        asignatura_id: payload.asignaturaId,
        unidad_id: payload.scope !== 'asignatura' ? payload.unidadId : null,
        tema_id: payload.scope === 'tema' ? payload.temaId : null,
        scope: payload.scope,
        tipo: payload.tipo,
        estado: 'generating',
        creado_por: user.id,
      })
      .select('*')
      .single()

    if (insertError || !packageRow) {
      throw new HttpError(
        500,
        'No se pudo registrar el paquete.',
        'SUPABASE_INSERT_FAILED',
        insertError,
      )
    }
    packageId = String(packageRow.id)

    const artifact = await buildArtifact(payload.tipo, objetos, ctx)
    const nombre = archivoNombre(payload.tipo, ctx, payload, artifact.extension)
    const zipPath = `asignaturas/${payload.asignaturaId}/${packageId}/${nombre}`
    const uploadBuffer = new ArrayBuffer(artifact.bytes.byteLength)
    new Uint8Array(uploadBuffer).set(artifact.bytes)

    const { error: uploadError } = await supabaseService.storage
      .from(BUCKET)
      .upload(zipPath, new Blob([uploadBuffer], { type: artifact.mime }), {
        contentType: artifact.mime,
        upsert: true,
      })

    if (uploadError) {
      throw new HttpError(
        500,
        'No se pudo guardar el paquete en Storage.',
        'STORAGE_UPLOAD_FAILED',
        uploadError,
      )
    }

    const manifest = {
      ...artifact.manifest,
      scope: payload.scope,
      unidad_id: payload.scope !== 'asignatura' ? payload.unidadId : null,
      tema_id: payload.scope === 'tema' ? payload.temaId : null,
      incluir_estados: payload.incluirEstados,
    }

    const { data: readyRow, error: updateError } = await supabaseService
      .from('learning_packages')
      .update({
        estado: 'ready',
        zip_path: zipPath,
        archivo_nombre: nombre,
        archivo_mime: artifact.mime,
        archivo_size: artifact.bytes.byteLength,
        manifest_json: manifest as Json,
        completado_en: new Date().toISOString(),
      })
      .eq('id', packageId)
      .select('*')
      .single()

    if (updateError || !readyRow) {
      throw new HttpError(
        500,
        'No se pudo actualizar el paquete.',
        'SUPABASE_UPDATE_FAILED',
        updateError,
      )
    }

    // El PPTX generado también queda referenciado en el propio outline.
    if (payload.tipo === 'pptx_bundle') {
      const { error: pathError } = await supabaseService
        .from('learning_objects')
        .update({ archivo_path: zipPath, actualizado_por: user.id })
        .in(
          'id',
          objetos.map((objeto) => objeto.id),
        )
      if (pathError) {
        console.warn(
          '[learning-package-export] archivo_path update failed',
          pathError,
        )
      }
    }

    return sendSuccess({ ok: true, package: readyRow })
  } catch (error) {
    if (packageId && supabaseServiceForError) {
      await supabaseServiceForError
        .from('learning_packages')
        .update({
          estado: 'failed',
          error: error instanceof Error ? error.message : String(error),
          completado_en: new Date().toISOString(),
        })
        .eq('id', packageId)
    }

    if (error instanceof HttpError) {
      console.error('[learning-package-export] handled error', {
        code: error.code,
        message: error.message,
        details: error.internalDetails ?? null,
      })
      return sendError(error.status, error.message, error.code)
    }

    console.error('[learning-package-export] unexpected error', error)
    return sendError(
      500,
      'Ocurrio un error inesperado en el servidor.',
      'INTERNAL_SERVER_ERROR',
    )
  }
})
