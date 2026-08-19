// Renderiza learning_objects como HTML de preview y empaqueta contenidos
// (SCORM 1.2, HTML bundle, PPTX) bajo demanda sin crear filas de exportacion.

import '@supabase/functions-js/edge-runtime.d.ts'
import { z } from 'zod'

import { corsHeaders, preflightResponse } from '../_shared/cors.ts'
import {
  readJsonBody,
  requireJsonContentType,
  requireMethod,
} from '../_shared/request.ts'
import { createAuthenticatedContext } from '../_shared/supabase.ts'
import { edgeErrorResponse, HttpError, sendSuccess } from '../_shared/utils.ts'
import { validateInput } from '../_shared/validation.ts'
import {
  buildHtmlBundle,
  buildPptxPackage,
  buildScormPackage,
} from './packager.ts'
import { BASE_CSS, buildPageHtml, renderObjectBody } from './html-render.ts'
import {
  CACHE_BUCKET,
  type CacheFormat,
  checkCache,
  clientFileName,
  deleteStoragePaths,
  readCachedText,
  uploadArtifact,
} from './cache.ts'

import type { Json } from '../_shared/database.types.ts'
import type {
  BuiltArtifact,
  PackageContext,
  PackageObject,
} from './packager.ts'

type SupabaseUntyped = any

const EXPORT_TYPES = ['html_bundle', 'scorm_1_2', 'pptx_bundle'] as const
type ExportTipo = (typeof EXPORT_TYPES)[number]

const RequestSchema = z
  .object({
    asignaturaId: z.string().uuid('asignaturaId debe ser un UUID'),
    action: z.enum(['preview', 'export']).optional().default('export'),
    objectIds: z
      .array(z.string().uuid('cada objectId debe ser un UUID'))
      .min(1, 'se requiere al menos un contenido')
      .max(100, 'maximo 100 contenidos por peticion'),
    tipo: z.enum(EXPORT_TYPES).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.action === 'export' && !value.tipo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tipo'],
        message: 'tipo es requerido para action export',
      })
    }
    if (value.action === 'preview' && value.tipo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tipo'],
        message: 'tipo no debe enviarse para action preview',
      })
    }
  })

type ExportRequest = z.infer<typeof RequestSchema>

function summarizeObjects(objects: Array<PackageObject>) {
  return objects.map(({ id, tipo, titulo, unidad_id, tema_id }) => ({
    id,
    tipo,
    titulo,
    unidad_id,
    tema_id,
  }))
}

/**
 * Solo requiere poder ver la asignatura; los contenidos generados son
 * descargables directamente sin etapa de revision previa.
 */
async function assertSubjectAccess(
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
}

type NombresContenido = {
  unidades: Map<string, { titulo: string; temas: Map<string, string> }>
}

function indexarContenido(contenido: unknown): NombresContenido {
  const unidades = new Map<
    string,
    { titulo: string; temas: Map<string, string> }
  >()
  const lista = Array.isArray(contenido) ? contenido : []

  lista.forEach((unidadRaw, unidadIdx) => {
    if (
      !unidadRaw ||
      typeof unidadRaw !== 'object' ||
      Array.isArray(unidadRaw)
    ) {
      return
    }
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
        if (typeof tema.nombre === 'string' && tema.nombre) {
          nombre = tema.nombre
        }
      }
      if (temaId) temas.set(temaId, nombre)
      temas.set(String(temaIdx + 1), nombre)
    })

    const entrada = { titulo, temas }
    if (typeof unidad.id === 'string' && unidad.id) {
      unidades.set(unidad.id, entrada)
    }
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
  asignaturaId: string,
  objectIds: Array<string>,
): Promise<Array<PackageObject>> {
  const { data, error } = await supabaseService
    .from('learning_objects')
    .select(
      'id,unidad_id,tema_id,tipo,titulo,descripcion,contenido_json,source_refs',
    )
    .eq('asignatura_id', asignaturaId)
    .in('id', objectIds)
    .order('creado_en', { ascending: true })

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
  tipo: ExportTipo,
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

async function renderPreviewHtml(
  objetos: Array<PackageObject>,
  ctx: PackageContext,
): Promise<string> {
  const bodies = objetos
    .map((objeto) => renderObjectBody(objeto))
    .join('\n<hr class="separador-preview">\n')

  return buildPageHtml({
    titulo: `${ctx.asignaturaCodigo ?? ctx.asignaturaNombre} — Vista previa`,
    bodyHtml: bodies,
    cssHref: 'shared/styles.css',
  }).replace('</head>', `<style>${BASE_CSS}</style></head>`)
}

async function handlePreview(
  supabaseService: SupabaseUntyped,
  payload: ExportRequest,
  ctx: PackageContext,
): Promise<Response> {
  const objetos = await fetchObjects(
    supabaseService,
    payload.asignaturaId,
    payload.objectIds,
  )

  if (objetos.length === 0) {
    throw new HttpError(
      422,
      'No se encontraron contenidos para previsualizar.',
      'NO_OBJECTS',
      { objectIds: payload.objectIds },
    )
  }

  const cache = await checkCache(
    supabaseService,
    'html_preview',
    payload.asignaturaId,
    payload.objectIds,
  )

  if (cache.hit) {
    const html = await readCachedText(supabaseService, cache.path)
    return sendSuccess({
      ok: true,
      html,
      css: BASE_CSS,
      cached: true,
      objetos: summarizeObjects(objetos),
    })
  }

  const html = await renderPreviewHtml(objetos, ctx)
  const encoder = new TextEncoder()
  await uploadArtifact(supabaseService, cache.path, {
    bytes: encoder.encode(html),
    mime: 'text/html',
    extension: 'html',
    manifest: {},
  })

  return sendSuccess({
    ok: true,
    html,
    css: BASE_CSS,
    cached: false,
    objetos: summarizeObjects(objetos),
  })
}

async function handleExport(
  supabaseService: SupabaseUntyped,
  payload: ExportRequest,
  ctx: PackageContext,
): Promise<Response> {
  const tipo = payload.tipo!
  const objetos = await fetchObjects(
    supabaseService,
    payload.asignaturaId,
    payload.objectIds,
  )

  if (objetos.length === 0) {
    throw new HttpError(
      422,
      'No se encontraron contenidos para exportar.',
      'NO_OBJECTS',
      { objectIds: payload.objectIds },
    )
  }

  const cache = await checkCache(
    supabaseService,
    tipo as CacheFormat,
    payload.asignaturaId,
    payload.objectIds,
  )

  const nombre = clientFileName(tipo as CacheFormat, ctx, objetos)

  let artifactBytes: Uint8Array
  let mime: string

  if (cache.hit) {
    const { data: blob, error: downloadError } = await supabaseService.storage
      .from(CACHE_BUCKET)
      .download(cache.path)

    if (!downloadError && blob) {
      artifactBytes = new Uint8Array(await blob.arrayBuffer())
      mime =
        tipo === 'pptx_bundle'
          ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          : 'application/zip'
    } else {
      // Cache stale or inaccessible — rebuild
      await deleteStoragePaths(supabaseService, [cache.path])
      const artifact = await buildArtifact(tipo, objetos, ctx)
      await uploadArtifact(supabaseService, cache.path, artifact)
      artifactBytes = artifact.bytes
      mime = artifact.mime
    }
  } else {
    const artifact = await buildArtifact(tipo, objetos, ctx)
    await uploadArtifact(supabaseService, cache.path, artifact)
    artifactBytes = artifact.bytes
    mime = artifact.mime
  }

  return new Response(artifactBytes.slice().buffer, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${nombre}"`,
    },
  })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return preflightResponse()
  }

  try {
    requireMethod(req, 'POST', { message: 'Metodo no permitido.' })
    requireJsonContentType(req)
    const { userClient: supabaseAnon, serviceClient: supabaseService } =
      await createAuthenticatedContext(req, {
        missingAuthorizationMessage: 'No autorizado.',
        invalidAuthorizationMessage: 'Token invalido.',
      })

    const rawBody = await readJsonBody(req)
    const parsed = validateInput(RequestSchema, rawBody)
    const payload = parsed.data

    await assertSubjectAccess(supabaseAnon, payload.asignaturaId)

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

    const nombres = indexarContenido(asignatura.contenido_tematico)
    const ctx = buildContext(asignatura as Record<string, unknown>, nombres)

    if (payload.action === 'preview') {
      return await handlePreview(supabaseService, payload, ctx)
    }

    return await handleExport(supabaseService, payload, ctx)
  } catch (error) {
    return edgeErrorResponse(
      error,
      'learning-package-export',
      'Ocurrio un error inesperado en el servidor.',
    )
  }
})
