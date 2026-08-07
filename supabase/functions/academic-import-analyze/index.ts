import '@supabase/functions-js/edge-runtime.d.ts'

import { corsHeaders } from '../_shared/cors.ts'
import {
  documentExtractionModel,
  requireAuthenticatedUser,
  serviceClient,
} from '../_shared/documentos-academicos.ts'
import { resolveDocumentReferences } from '../_shared/documentos-referencias.ts'
import { OpenAIService } from '../_shared/openai-service.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'
import {
  clasificarArchivoAcademico,
  combinarAsignaturas,
  leerMapaCurricularXlsx,
} from './analysis.ts'

import type { StructuredResponseOptions } from '../_shared/openai-service.ts'

type BlobRow = {
  storage_bucket: string
  storage_path: string
  detected_mime: string
}

type VersionRow = {
  id: string
  file_id: string
  original_filename: string
  file_blobs: BlobRow | Array<BlobRow> | null
}

type AttachedRow = {
  id: string
  rol: 'PLAN' | 'MAPA' | 'PROGRAMA' | 'RESOLUCION' | 'OTRO'
  file_version_id: string
  file_versions: VersionRow | Array<VersionRow> | null
}

type ImportRow = {
  id: string
  tenant_id: string
  creado_por: string
  estado: string
  estructura_destino_id: string | null
  importacion_archivos: Array<AttachedRow>
}

const one = <T>(value: T | Array<T> | null): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value

const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'plan',
    'lineas',
    'asignaturas',
    'generacion_normativa',
    'confianza_generacion',
    'evidencia_campos',
    'incidencias',
  ],
  properties: {
    plan: {
      type: 'object',
      additionalProperties: false,
      required: [
        'nombre_display',
        'etiqueta_version',
        'tipo_ciclo',
        'numero_ciclos',
        'semanas_por_ciclo',
        'fecha_inicio_imparticion',
        'datos',
      ],
      properties: {
        nombre_display: { type: 'string' },
        etiqueta_version: { type: 'string' },
        tipo_ciclo: {
          type: 'string',
          enum: ['Semestre', 'Cuatrimestre', 'Trimestre', 'Otro'],
        },
        numero_ciclos: { type: 'integer', minimum: 1 },
        semanas_por_ciclo: { type: ['integer', 'null'], minimum: 1 },
        fecha_inicio_imparticion: { type: ['string', 'null'] },
        datos: {
          type: 'object',
          additionalProperties: false,
          required: [
            'modalidad_educativa',
            'antecedente_academico',
            'area_de_estudio',
            'diseno_curricular',
            'fines_de_aprendizaje_o_formacion',
            'perfil_de_ingreso',
            'perfil_de_egreso',
            'fundamentacion',
          ],
          properties: {
            modalidad_educativa: { type: ['string', 'null'] },
            antecedente_academico: { type: ['string', 'null'] },
            area_de_estudio: { type: ['string', 'null'] },
            diseno_curricular: { type: ['string', 'null'] },
            fines_de_aprendizaje_o_formacion: { type: ['string', 'null'] },
            perfil_de_ingreso: { type: ['string', 'null'] },
            perfil_de_egreso: { type: ['string', 'null'] },
            fundamentacion: { type: ['string', 'null'] },
          },
        },
      },
    },
    lineas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id_externo', 'nombre', 'orden', 'area'],
        properties: {
          id_externo: { type: 'string' },
          nombre: { type: 'string' },
          orden: { type: 'integer' },
          area: { type: ['string', 'null'] },
        },
      },
    },
    asignaturas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id_externo',
          'codigo',
          'nombre',
          'tipo',
          'numero_ciclo',
          'horas_academicas',
          'horas_independientes',
          'linea_id_externo',
          'datos',
          'contenido_tematico',
          'criterios_de_evaluacion',
          'bibliografia',
        ],
        properties: {
          id_externo: { type: 'string' },
          codigo: { type: ['string', 'null'] },
          nombre: { type: 'string' },
          tipo: { type: 'string', enum: ['OBLIGATORIA', 'OPTATIVA'] },
          numero_ciclo: { type: ['integer', 'null'] },
          horas_academicas: { type: ['integer', 'null'] },
          horas_independientes: { type: ['integer', 'null'] },
          linea_id_externo: { type: ['string', 'null'] },
          datos: {
            type: 'object',
            additionalProperties: false,
            required: [
              'descripcion',
              'fines_aprendizaje',
              'actividades_aprendizaje',
              'modalidad_evaluacion',
            ],
            properties: {
              descripcion: { type: ['string', 'null'] },
              fines_aprendizaje: { type: ['string', 'null'] },
              actividades_aprendizaje: { type: ['string', 'null'] },
              modalidad_evaluacion: { type: ['string', 'null'] },
            },
          },
          contenido_tematico: {
            type: 'array',
            items: { type: 'string' },
          },
          criterios_de_evaluacion: {
            type: 'array',
            items: { type: 'string' },
          },
          bibliografia: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'tipo',
                'cita',
                'titulo',
                'autores',
                'editorial',
                'anio',
                'isbn',
                'formato',
              ],
              properties: {
                tipo: { type: 'string', enum: ['BASICA', 'COMPLEMENTARIA'] },
                cita: { type: 'string' },
                titulo: { type: ['string', 'null'] },
                autores: { type: 'array', items: { type: 'string' } },
                editorial: { type: ['string', 'null'] },
                anio: { type: ['integer', 'null'] },
                isbn: { type: ['string', 'null'] },
                formato: { type: ['string', 'null'] },
              },
            },
          },
        },
      },
    },
    generacion_normativa: {
      type: 'string',
      enum: ['ACUERDO_279_2000', 'SEP_DGAIR_VIGENTE', 'NO_DETERMINADA'],
    },
    confianza_generacion: { type: 'number', minimum: 0, maximum: 1 },
    evidencia_campos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['campo', 'fuente', 'extracto', 'confianza'],
        properties: {
          campo: { type: 'string' },
          fuente: { type: 'string' },
          extracto: { type: 'string' },
          confianza: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    incidencias: { type: 'array', items: { type: 'string' } },
  },
} as const

async function jsonBody(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'El cuerpo JSON no es válido.', 'INVALID_JSON')
  }
  const importacionId = String(
    (body as Record<string, unknown>).importacionId ?? '',
  )
  if (!/^[0-9a-f-]{36}$/i.test(importacionId)) {
    throw new HttpError(422, 'La importación no es válida.', 'VALIDATION_ERROR')
  }
  return { importacionId }
}

async function importDetail(
  supabase: ReturnType<typeof serviceClient>,
  importacionId: string,
) {
  const { data, error } = await supabase
    .from('importaciones_academicas')
    .select(
      `
      *,
      importacion_archivos(
        *,
        file_versions!importacion_archivos_file_version_id_fkey(
          id,file_id,original_filename,
          files!file_versions_file_id_fkey(id,display_name,status),
          file_blobs!file_versions_blob_id_fkey(storage_bucket,storage_path,detected_mime)
        )
      )
      `,
    )
    .eq('id', importacionId)
    .single()
  if (error || !data) {
    throw new HttpError(
      404,
      'No se encontró la importación.',
      'IMPORT_NOT_FOUND',
    )
  }
  return data
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  let importacionId: string | null = null
  try {
    if (request.method !== 'POST') {
      throw new HttpError(405, 'Método no permitido.', 'METHOD_NOT_ALLOWED')
    }
    const user = await requireAuthenticatedUser(request)
    importacionId = (await jsonBody(request)).importacionId
    const supabase = serviceClient()
    const importacion = (await importDetail(
      supabase,
      importacionId,
    )) as unknown as ImportRow
    if (importacion.creado_por !== user.id) {
      throw new HttpError(
        403,
        'La importación no está disponible.',
        'FORBIDDEN',
      )
    }
    if (!['CARGANDO', 'FALLIDA', 'REVISION'].includes(importacion.estado)) {
      throw new HttpError(
        409,
        'La importación ya está en proceso.',
        'IMPORT_BUSY',
      )
    }
    if (!importacion.importacion_archivos.length) {
      throw new HttpError(
        422,
        'Añade al menos un archivo.',
        'IMPORT_FILES_REQUIRED',
      )
    }
    await supabase
      .from('importaciones_academicas')
      .update({ estado: 'ANALIZANDO', error_codigo: null, error_mensaje: null })
      .eq('id', importacion.id)

    const mapSubjects: Array<Record<string, unknown>> = []
    const mapEvidence: Array<Record<string, unknown>> = []
    const issues: Array<Record<string, unknown>> = []
    const documentFileIds: Array<string> = []

    for (const attached of importacion.importacion_archivos) {
      const version = one(attached.file_versions)
      const blob = version ? one(version.file_blobs) : null
      if (!version || !blob) {
        issues.push({ codigo: 'ARCHIVO_NO_DISPONIBLE', archivo: attached.id })
        continue
      }
      const classification = clasificarArchivoAcademico({
        nombre: version.original_filename,
        mime: blob.detected_mime,
      })
      await supabase
        .from('importacion_archivos')
        .update({
          rol_detectado: classification.rol,
          confianza: classification.confianza,
          evidencia: { huellas: classification.evidencia },
        })
        .eq('id', attached.id)

      if (attached.rol === 'MAPA') {
        const { data, error } = await supabase.storage
          .from(blob.storage_bucket)
          .download(blob.storage_path)
        if (error || !data) {
          issues.push({ codigo: 'MAPA_NO_DISPONIBLE', archivo: attached.id })
          continue
        }
        const parsed = await leerMapaCurricularXlsx(
          new Uint8Array(await data.arrayBuffer()),
        )
        mapSubjects.push(...parsed.asignaturas)
        mapEvidence.push({
          archivo: version.original_filename,
          hojas: parsed.hojas,
        })
        issues.push(...parsed.incidencias)
      } else if (attached.rol !== 'OTRO') {
        documentFileIds.push(version.file_id)
      }
    }

    let extracted: Record<string, unknown> = {
      plan: {
        nombre_display: 'Plan importado',
        etiqueta_version: '',
        tipo_ciclo: 'Semestre',
        numero_ciclos: 1,
        semanas_por_ciclo: null,
        fecha_inicio_imparticion: null,
        datos: {},
      },
      lineas: [],
      asignaturas: [],
      generacion_normativa: 'NO_DETERMINADA',
      confianza_generacion: 0,
      evidencia_campos: [],
      incidencias: [],
    }
    if (documentFileIds.length) {
      const references = await resolveDocumentReferences({
        supabase,
        userId: user.id,
        fileIds: documentFileIds,
        query: 'Extraer expediente curricular SEP con evidencia por campo.',
        forceDirect: true,
      })
      const openai = OpenAIService.fromEnv()
      if (!(openai instanceof OpenAIService)) {
        throw new HttpError(
          500,
          'Configuración de análisis incompleta.',
          'OPENAI_MISCONFIGURED',
        )
      }
      const requestOptions: StructuredResponseOptions = {
        model: documentExtractionModel(
          Deno.env.get('DOCUMENT_EXTRACTION_MODEL'),
        ),
        background: false,
        input: [
          {
            role: 'system',
            content:
              'Extrae un expediente curricular SEP de forma literal y verificable. No inventes campos ausentes. Distingue plan, líneas curriculares y programas de asignatura. Los créditos nunca se extraen: se calculan desde horas. Devuelve evidencia breve y confianza por campo. Clasifica como Acuerdo 279/2000 sólo con evidencia textual; en otro caso usa SEP/DGAIR vigente o no determinada.',
          },
          {
            role: 'user',
            content: [
              ...references.inputFiles,
              {
                type: 'input_text',
                text: 'Normaliza el expediente conservando la redacción académica original.',
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'expediente_curricular_sep',
            schema: EXTRACTION_SCHEMA as unknown as Record<string, unknown>,
            strict: true,
          },
        },
      }
      const result =
        await openai.createStructuredResponse<Record<string, unknown>>(
          requestOptions,
        )
      if (!result.ok) {
        throw new HttpError(
          502,
          'No se pudo analizar el expediente.',
          'OPENAI_REQUEST_FAILED',
        )
      }
      if (!result.output) {
        throw new HttpError(
          502,
          'El análisis no devolvió un expediente estructurado.',
          'OPENAI_EMPTY_OUTPUT',
        )
      }
      extracted = result.output
    }

    const generation = String(
      extracted.generacion_normativa ?? 'NO_DETERMINADA',
    )
    const generationConfidence = Number(extracted.confianza_generacion ?? 0)
    const { data: structures } = await supabase
      .from('estructuras_plan')
      .select('id,etiqueta_version,estado_publicacion')
      .eq('tipo', 'CURRICULAR')
    const detectedStructure =
      generationConfidence >= 0.7
        ? structures?.find((structure) =>
            generation === 'ACUERDO_279_2000'
              ? /279\/2000/i.test(structure.etiqueta_version ?? '')
              : structure.estado_publicacion === 'PUBLICADA',
          )
        : null
    const targetStructure =
      importacion.estructura_destino_id ??
      structures?.find(
        (structure) => structure.estado_publicacion === 'PUBLICADA',
      )?.id ??
      null
    if (!detectedStructure) {
      issues.push({ codigo: 'ESTRUCTURA_POR_CONFIRMAR' })
    }

    const result = {
      plan: extracted.plan,
      lineas: extracted.lineas,
      asignaturas: combinarAsignaturas(
        mapSubjects,
        Array.isArray(extracted.asignaturas)
          ? (extracted.asignaturas as Array<Record<string, unknown>>)
          : [],
      ),
      redisenio: {
        etiqueta_version: '',
        fecha_inicio_imparticion: null,
      },
    }
    const extractedIssues = Array.isArray(extracted.incidencias)
      ? extracted.incidencias.map((detalle) => ({
          codigo: 'REVISION_DOCUMENTAL',
          detalle,
        }))
      : []
    const { error: updateError } = await supabase
      .from('importaciones_academicas')
      .update({
        estado: 'REVISION',
        estructura_detectada_id: detectedStructure?.id ?? null,
        estructura_destino_id: targetStructure,
        confianza_estructura: generationConfidence,
        resultado_normalizado: result,
        incidencias: [...issues, ...extractedIssues],
        evidencia: {
          campos: extracted.evidencia_campos,
          mapas: mapEvidence,
          generacion_normativa: generation,
        },
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', importacion.id)
    if (updateError) {
      throw new HttpError(
        500,
        'No se pudo guardar la revisión.',
        'IMPORT_UPDATE_FAILED',
      )
    }
    return sendSuccess({ data: await importDetail(supabase, importacion.id) })
  } catch (error) {
    if (importacionId) {
      await serviceClient()
        .from('importaciones_academicas')
        .update({
          estado: 'FALLIDA',
          error_codigo:
            error instanceof HttpError ? error.code : 'ANALYSIS_FAILED',
          error_mensaje: error instanceof Error ? error.message : String(error),
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', importacionId)
    }
    if (error instanceof HttpError)
      return sendError(error.status, error.message, error.code)
    console.error('academic-import-analyze failed', error)
    return sendError(
      500,
      'No se pudo analizar el expediente.',
      'INTERNAL_SERVER_ERROR',
    )
  }
})
