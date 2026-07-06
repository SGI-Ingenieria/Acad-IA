import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { corsHeaders } from '../_shared/cors.ts'
import { registrarInteraccionIA } from '../_shared/interacciones-ia.ts'
import { OpenAIService } from '../_shared/openai-service.ts'
import {
  buildReasoningParam,
  buildSafetyIdentifier,
} from '../_shared/openai-response-controls.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'

import type { Json } from '../_shared/database.types.ts'
import type { StructuredResponseOptions } from '../_shared/openai-service.ts'

type LearningObjectTipo =
  | 'apunte'
  | 'quiz'
  | 'actividad'
  | 'ejercicios'
  | 'rubrica'
  | 'outline_presentacion'
  | 'recursos_externos'

type LearningGenerationScope = 'tema' | 'unidad' | 'asignatura'
type ReasoningEffort = 'auto' | 'none' | 'low' | 'medium' | 'high'

type SupabaseUntyped = any
type ResponseInputArray = Extract<
  NonNullable<StructuredResponseOptions['input']>,
  Array<unknown>
>
type ResponseInputItem = ResponseInputArray[number]

type ContenidoTema = {
  id?: string
  nombre: string
  descripcion?: string | null
  horasEstimadas?: number | null
  raw: unknown
  index: number
}

type ContenidoUnidad = {
  id?: string
  unidad: number
  titulo: string
  temas: Array<ContenidoTema>
  raw: unknown
  index: number
}

type TargetContext = {
  scope: LearningGenerationScope
  unidad: ContenidoUnidad | null
  tema: ContenidoTema | null
}

type SourceRef = {
  id: string
  tipo: 'web' | 'archivo' | 'repositorio' | 'bibliografia' | 'modelo'
  titulo: string
  url: string | null
  autor: string | null
  editorial_o_sitio: string | null
  fecha: string | null
  licencia: string | null
  evidencia: string
  confianza: number
}

type GeneratedResource = {
  tipo: LearningObjectTipo
  titulo: string
  descripcion: string
  contenido: Record<string, unknown>
  source_refs: Array<SourceRef>
  score: number
  recomendaciones: Array<string>
}

type GeneratedOutput = {
  resumen_generacion: string
  resources: Array<GeneratedResource>
  quality_score: {
    score_total: number
    rubrica: Record<string, unknown>
    recomendaciones: Array<string>
  }
}

const LearningObjectTipoSchema = z.enum([
  'apunte',
  'quiz',
  'actividad',
  'ejercicios',
  'rubrica',
  'outline_presentacion',
  'recursos_externos',
])

const RequestSchema = z
  .object({
    asignaturaId: z.string().uuid('asignaturaId debe ser un UUID'),
    scope: z.enum(['tema', 'unidad', 'asignatura']).optional().default('tema'),
    unidadId: z.string().min(1).optional(),
    temaId: z.string().min(1).optional(),
    unidadNumero: z.number().int().positive().optional(),
    temaIndex: z.number().int().positive().optional(),
    requestedTypes: z
      .array(LearningObjectTipoSchema)
      .min(1)
      .max(7)
      .optional()
      .default([
        'apunte',
        'quiz',
        'actividad',
        'ejercicios',
        'rubrica',
        'outline_presentacion',
        'recursos_externos',
      ]),
    iaConfig: z
      .object({
        enfoqueAcademico: z.string().optional(),
        instruccionesAdicionalesIA: z.string().optional(),
        archivosReferencia: z.array(z.string().min(1)).optional().default([]),
        repositoriosIds: z.array(z.string().min(1)).optional().default([]),
        webSearchEnabled: z.boolean().optional().default(false),
        webSearchDomains: z.array(z.string().min(1)).optional().default([]),
        reasoningEffort: z
          .enum(['auto', 'none', 'low', 'medium', 'high'])
          .optional()
          .default('auto'),
        model: z.string().min(1).optional(),
      })
      .strict()
      .optional()
      .default({
        archivosReferencia: [],
        repositoriosIds: [],
        webSearchEnabled: false,
        webSearchDomains: [],
        reasoningEffort: 'auto',
      }),
  })
  .strict()

type LearningObjectRequest = z.infer<typeof RequestSchema>

const SourceRefSchema = z
  .object({
    id: z.string().min(1),
    tipo: z.enum(['web', 'archivo', 'repositorio', 'bibliografia', 'modelo']),
    titulo: z.string().min(1),
    url: z.string().nullable(),
    autor: z.string().nullable(),
    editorial_o_sitio: z.string().nullable(),
    fecha: z.string().nullable(),
    licencia: z.string().nullable(),
    evidencia: z.string(),
    confianza: z.number().int().min(0).max(100),
  })
  .strict()

const GeneratedResourceSchema = z
  .object({
    tipo: LearningObjectTipoSchema,
    titulo: z.string().min(1),
    descripcion: z.string(),
    contenido: z.record(z.unknown()),
    source_refs: z.array(SourceRefSchema),
    score: z.number().int().min(0).max(100),
    recomendaciones: z.array(z.string()),
  })
  .strict()

const GeneratedOutputSchema = z
  .object({
    resumen_generacion: z.string(),
    resources: z.array(GeneratedResourceSchema).min(1),
    quality_score: z
      .object({
        score_total: z.number().int().min(0).max(100),
        rubrica: z.record(z.unknown()),
        recomendaciones: z.array(z.string()),
      })
      .strict(),
  })
  .strict()

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) {
    throw new HttpError(
      500,
      'Configuracion del servidor incompleta.',
      'MISSING_ENV',
      { missing: [name] },
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
      { contentType, expected: 'application/json' },
    )
  }

  try {
    return await req.json()
  } catch (cause) {
    throw new HttpError(400, 'Body JSON invalido.', 'INVALID_JSON', {
      cause,
    })
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeTema(value: unknown, index: number): ContenidoTema | null {
  if (typeof value === 'string') {
    const nombre = value.trim()
    return nombre ? { nombre, raw: value, index } : null
  }

  const record = asRecord(value)
  if (!record) return null

  const nombre = stringValue(record.nombre)
  if (!nombre) return null

  return {
    id: stringValue(record.id) ?? undefined,
    nombre,
    descripcion: stringValue(record.descripcion),
    horasEstimadas: numberValue(record.horasEstimadas),
    raw: value,
    index,
  }
}

function normalizeContenido(value: unknown): Array<ContenidoUnidad> {
  if (typeof value === 'string') {
    try {
      return normalizeContenido(JSON.parse(value))
    } catch {
      return []
    }
  }

  if (Array.isArray(value)) {
    return value
      .map((unidadValue, index): ContenidoUnidad | null => {
        const record = asRecord(unidadValue)
        if (!record) return null

        const unidad = numberValue(record.unidad) ?? index + 1
        const titulo = stringValue(record.titulo) ?? `Unidad ${unidad}`
        const id = stringValue(record.id)
        const temas = Array.isArray(record.temas)
          ? record.temas
              .map((temaValue, temaIndex) =>
                normalizeTema(temaValue, temaIndex),
              )
              .filter((tema): tema is ContenidoTema => tema !== null)
          : []

        const normalized: ContenidoUnidad = {
          unidad,
          titulo,
          temas,
          raw: unidadValue,
          index,
        }

        if (id) normalized.id = id

        return normalized
      })
      .filter((unidad): unidad is ContenidoUnidad => unidad !== null)
  }

  const record = asRecord(value)
  if (record?.contenido_tematico)
    return normalizeContenido(record.contenido_tematico)
  if (record?.unidades) return normalizeContenido(record.unidades)

  return []
}

function normalizeLookup(value: string): string {
  return value.trim().toLowerCase()
}

function matchesIdentifier(
  value: string | undefined,
  candidates: Array<string | number | null | undefined>,
): boolean {
  const wanted = normalizeLookup(value ?? '')
  if (!wanted) return false

  return candidates.some((candidate) => {
    if (candidate === null || candidate === undefined) return false
    return normalizeLookup(String(candidate)) === wanted
  })
}

function resolveTarget(
  payload: LearningObjectRequest,
  unidades: Array<ContenidoUnidad>,
): TargetContext {
  if (payload.scope === 'asignatura') {
    return { scope: payload.scope, unidad: null, tema: null }
  }

  const unidad = unidades.find((item) => {
    if (payload.unidadNumero && item.unidad === payload.unidadNumero) {
      return true
    }
    return matchesIdentifier(payload.unidadId, [
      item.id,
      item.unidad,
      item.index + 1,
      item.titulo,
      `Unidad ${item.unidad}`,
    ])
  })

  if (!unidad) {
    throw new HttpError(
      404,
      'No se encontro la unidad solicitada en contenido_tematico.',
      'UNIDAD_NOT_FOUND',
      {
        unidadId: payload.unidadId ?? null,
        unidadNumero: payload.unidadNumero ?? null,
      },
    )
  }

  if (payload.scope === 'unidad') {
    return { scope: payload.scope, unidad, tema: null }
  }

  const tema = unidad.temas.find((item) => {
    if (payload.temaIndex && item.index + 1 === payload.temaIndex) return true
    return matchesIdentifier(payload.temaId, [
      item.id,
      item.index + 1,
      item.nombre,
      `Tema ${item.index + 1}`,
    ])
  })

  if (!tema) {
    throw new HttpError(
      404,
      'No se encontro el tema solicitado en contenido_tematico.',
      'TEMA_NOT_FOUND',
      {
        unidadId: payload.unidadId ?? null,
        unidadNumero: payload.unidadNumero ?? null,
        temaId: payload.temaId ?? null,
        temaIndex: payload.temaIndex ?? null,
      },
    )
  }

  return { scope: payload.scope, unidad, tema }
}

function targetIds(target: TargetContext): {
  unidadId: string | null
  temaId: string | null
} {
  const unidadId = target.unidad
    ? (target.unidad.id ?? String(target.unidad.unidad))
    : null
  const temaId = target.tema
    ? (target.tema.id ?? String(target.tema.index + 1))
    : null

  return { unidadId, temaId }
}

function nullableStringSchema() {
  return { anyOf: [{ type: 'string' }, { type: 'null' }] }
}

function nullableObjectSchema(properties: Record<string, unknown>) {
  return {
    anyOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: Object.keys(properties),
        properties,
      },
      { type: 'null' },
    ],
  }
}

function arrayOfStrings() {
  return { type: 'array', items: { type: 'string' } }
}

function contentItemSourceRefs() {
  return { type: 'array', items: { type: 'string' } }
}

const responseJsonSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['resumen_generacion', 'resources', 'quality_score'],
  properties: {
    resumen_generacion: {
      type: 'string',
      description: 'Resumen breve de lo generado y del uso de fuentes.',
    },
    resources: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'tipo',
          'titulo',
          'descripcion',
          'contenido',
          'source_refs',
          'score',
          'recomendaciones',
        ],
        properties: {
          tipo: {
            type: 'string',
            enum: [
              'apunte',
              'quiz',
              'actividad',
              'ejercicios',
              'rubrica',
              'outline_presentacion',
              'recursos_externos',
            ],
          },
          titulo: { type: 'string' },
          descripcion: { type: 'string' },
          contenido: {
            type: 'object',
            additionalProperties: false,
            required: [
              'apunte',
              'quiz',
              'actividad',
              'ejercicios',
              'rubrica',
              'outline_presentacion',
              'recursos_externos',
            ],
            properties: {
              apunte: nullableObjectSchema({
                objetivo: { type: 'string' },
                introduccion: { type: 'string' },
                secciones: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['titulo', 'desarrollo', 'source_ref_ids'],
                    properties: {
                      titulo: { type: 'string' },
                      desarrollo: { type: 'string' },
                      source_ref_ids: contentItemSourceRefs(),
                    },
                  },
                },
                conceptos_clave: arrayOfStrings(),
                ejemplo_aplicado: { type: 'string' },
                cierre: { type: 'string' },
              }),
              quiz: nullableObjectSchema({
                instrucciones: { type: 'string' },
                preguntas: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: [
                      'pregunta',
                      'opciones',
                      'respuesta_correcta',
                      'retroalimentacion',
                      'source_ref_ids',
                    ],
                    properties: {
                      pregunta: { type: 'string' },
                      opciones: {
                        type: 'array',
                        items: {
                          type: 'object',
                          additionalProperties: false,
                          required: ['id', 'texto'],
                          properties: {
                            id: { type: 'string' },
                            texto: { type: 'string' },
                          },
                        },
                      },
                      respuesta_correcta: { type: 'string' },
                      retroalimentacion: { type: 'string' },
                      source_ref_ids: contentItemSourceRefs(),
                    },
                  },
                },
              }),
              actividad: nullableObjectSchema({
                modalidad: { type: 'string' },
                duracion_minutos: { type: 'integer' },
                instrucciones: { type: 'string' },
                pasos: arrayOfStrings(),
                producto_esperado: { type: 'string' },
                criterios_exito: arrayOfStrings(),
                source_ref_ids: contentItemSourceRefs(),
              }),
              ejercicios: nullableObjectSchema({
                instrucciones: { type: 'string' },
                ejercicios: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: [
                      'enunciado',
                      'dificultad',
                      'pista',
                      'solucion_esperada',
                      'source_ref_ids',
                    ],
                    properties: {
                      enunciado: { type: 'string' },
                      dificultad: {
                        type: 'string',
                        enum: ['basico', 'intermedio', 'avanzado'],
                      },
                      pista: { type: 'string' },
                      solucion_esperada: { type: 'string' },
                      source_ref_ids: contentItemSourceRefs(),
                    },
                  },
                },
              }),
              rubrica: nullableObjectSchema({
                escala: { type: 'string' },
                criterios: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['criterio', 'peso_porcentaje', 'niveles'],
                    properties: {
                      criterio: { type: 'string' },
                      peso_porcentaje: { type: 'integer' },
                      niveles: {
                        type: 'array',
                        items: {
                          type: 'object',
                          additionalProperties: false,
                          required: ['nivel', 'descripcion', 'puntaje'],
                          properties: {
                            nivel: { type: 'string' },
                            descripcion: { type: 'string' },
                            puntaje: { type: 'integer' },
                          },
                        },
                      },
                    },
                  },
                },
              }),
              outline_presentacion: nullableObjectSchema({
                titulo_presentacion: { type: 'string' },
                diapositivas: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: [
                      'numero',
                      'titulo',
                      'puntos',
                      'notas_docente',
                      'source_ref_ids',
                    ],
                    properties: {
                      numero: { type: 'integer' },
                      titulo: { type: 'string' },
                      puntos: arrayOfStrings(),
                      notas_docente: { type: 'string' },
                      source_ref_ids: contentItemSourceRefs(),
                    },
                  },
                },
              }),
              recursos_externos: nullableObjectSchema({
                recursos: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: [
                      'titulo',
                      'tipo_recurso',
                      'url',
                      'descripcion',
                      'licencia',
                      'uso_sugerido',
                      'source_ref_id',
                    ],
                    properties: {
                      titulo: { type: 'string' },
                      tipo_recurso: {
                        type: 'string',
                        enum: [
                          'articulo',
                          'libro',
                          'video',
                          'sitio_web',
                          'dataset',
                          'herramienta',
                          'otro',
                        ],
                      },
                      url: nullableStringSchema(),
                      descripcion: { type: 'string' },
                      licencia: nullableStringSchema(),
                      uso_sugerido: { type: 'string' },
                      source_ref_id: nullableStringSchema(),
                    },
                  },
                },
              }),
            },
          },
          source_refs: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'id',
                'tipo',
                'titulo',
                'url',
                'autor',
                'editorial_o_sitio',
                'fecha',
                'licencia',
                'evidencia',
                'confianza',
              ],
              properties: {
                id: { type: 'string' },
                tipo: {
                  type: 'string',
                  enum: [
                    'web',
                    'archivo',
                    'repositorio',
                    'bibliografia',
                    'modelo',
                  ],
                },
                titulo: { type: 'string' },
                url: nullableStringSchema(),
                autor: nullableStringSchema(),
                editorial_o_sitio: nullableStringSchema(),
                fecha: nullableStringSchema(),
                licencia: nullableStringSchema(),
                evidencia: { type: 'string' },
                confianza: { type: 'integer', minimum: 0, maximum: 100 },
              },
            },
          },
          score: { type: 'integer', minimum: 0, maximum: 100 },
          recomendaciones: arrayOfStrings(),
        },
      },
    },
    quality_score: {
      type: 'object',
      additionalProperties: false,
      required: ['score_total', 'rubrica', 'recomendaciones'],
      properties: {
        score_total: { type: 'integer', minimum: 0, maximum: 100 },
        rubrica: {
          type: 'object',
          additionalProperties: false,
          required: [
            'objetivos_alineados',
            'contenido_completo',
            'evaluacion',
            'actividades',
            'fuentes_confiables',
            'accesibilidad_metadatos',
            'coherencia',
          ],
          properties: {
            objetivos_alineados: { type: 'integer', minimum: 0, maximum: 15 },
            contenido_completo: { type: 'integer', minimum: 0, maximum: 15 },
            evaluacion: { type: 'integer', minimum: 0, maximum: 20 },
            actividades: { type: 'integer', minimum: 0, maximum: 15 },
            fuentes_confiables: { type: 'integer', minimum: 0, maximum: 10 },
            accesibilidad_metadatos: {
              type: 'integer',
              minimum: 0,
              maximum: 10,
            },
            coherencia: { type: 'integer', minimum: 0, maximum: 15 },
          },
        },
        recomendaciones: arrayOfStrings(),
      },
    },
  },
}

function buildTools(
  vectorStoreIds: Array<string>,
  webSearchEnabled: boolean,
): StructuredResponseOptions['tools'] {
  const tools: NonNullable<StructuredResponseOptions['tools']> = []

  if (vectorStoreIds.length > 0) {
    tools.push({
      type: 'file_search',
      vector_store_ids: vectorStoreIds,
    })
  }

  if (webSearchEnabled) {
    tools.push({ type: 'web_search' })
  }

  return tools.length > 0 ? tools : undefined
}

function buildUserContent(
  prompt: string,
  openaiFileIds: Array<string>,
): Array<ResponseInputItem> {
  if (!openaiFileIds.length) {
    return [
      {
        role: 'user',
        content: prompt,
      },
    ]
  }

  return [
    {
      role: 'user',
      content: [
        ...openaiFileIds.map((fileId) => ({
          type: 'input_file' as const,
          file_id: fileId,
        })),
        {
          type: 'input_text' as const,
          text: `Usa estos archivos como fuentes de referencia. Citalos en source_refs con tipo "archivo" cuando sustentan contenido.\n\n${prompt}`,
        },
      ],
    },
  ]
}

function safeForPrompt(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeForPrompt)
  const record = asRecord(value)
  if (!record) return value

  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(record)) {
    if (
      [
        'search_vector',
        'asignatura_hash',
        'creado_en',
        'actualizado_en',
        'creado_por',
        'actualizado_por',
      ].includes(key)
    ) {
      continue
    }
    out[key] = safeForPrompt(item)
  }
  return out
}

function buildPrompt(args: {
  asignatura: Record<string, unknown>
  target: TargetContext
  requestedTypes: Array<LearningObjectTipo>
  iaConfig: LearningObjectRequest['iaConfig']
}) {
  const { asignatura, target, requestedTypes, iaConfig } = args
  const targetSummary =
    target.scope === 'asignatura'
      ? 'Toda la asignatura'
      : target.scope === 'unidad'
        ? `Unidad ${target.unidad?.unidad}: ${target.unidad?.titulo}`
        : `Unidad ${target.unidad?.unidad}: ${target.unidad?.titulo}\nTema ${
            target.tema?.index != null ? target.tema.index + 1 : ''
          }: ${target.tema?.nombre}`

  const domainText = iaConfig.webSearchDomains.length
    ? `\nDominios preferidos para web_search: ${iaConfig.webSearchDomains.join(', ')}`
    : ''

  return `Genera recursos pedagogicos para Acad-IA.

Objetivo:
- Crear learning objects academicos con fuentes, citas internas y score de calidad.
- Generar exactamente estos tipos: ${requestedTypes.join(', ')}.
- Si el tipo es outline_presentacion, crea SOLO el outline textual/estructurado. No generes PPTX, archivos binarios, ZIP ni SCORM.

Contexto de asignatura:
${JSON.stringify(safeForPrompt(asignatura), null, 2)}

Alcance solicitado:
${targetSummary}

Datos normalizados del alcance:
${JSON.stringify(
  {
    scope: target.scope,
    unidad: target.unidad
      ? {
          id: target.unidad.id ?? null,
          numero: target.unidad.unidad,
          titulo: target.unidad.titulo,
          temas: target.unidad.temas.map((tema) => ({
            id: tema.id ?? null,
            numero: tema.index + 1,
            nombre: tema.nombre,
            descripcion: tema.descripcion ?? null,
            horasEstimadas: tema.horasEstimadas ?? null,
          })),
        }
      : null,
    tema: target.tema
      ? {
          id: target.tema.id ?? null,
          numero: target.tema.index + 1,
          nombre: target.tema.nombre,
          descripcion: target.tema.descripcion ?? null,
          horasEstimadas: target.tema.horasEstimadas ?? null,
        }
      : null,
  },
  null,
  2,
)}

Enfoque academico:
${iaConfig.enfoqueAcademico ?? '(no especificado)'}

Instrucciones adicionales:
${iaConfig.instruccionesAdicionalesIA ?? '(ninguna)'}
${domainText}

Reglas de fuentes y citas:
- Usa archivos adjuntos, repositorios via file_search y web_search cuando esten disponibles.
- Todo dato especifico, definicion especializada, lectura/video/recurso externo o afirmacion no trivial debe quedar respaldado por source_refs.
- No inventes bibliografia, URLs, autores ni licencias. Si una fuente no permite confirmar un dato, usa url/licencia/fecha null y baja confianza.
- Los source_ref_ids dentro del contenido deben corresponder a ids existentes en source_refs del mismo recurso.
- El score mide preparacion pedagogica del recurso antes de que existan alumnos, no aprendizaje del alumno.
- Incluye recomendaciones accionables para mejorar fuentes, cobertura, evaluacion y accesibilidad.

Responde exclusivamente con JSON valido que cumpla el schema.`
}

async function assertSubjectAccess(args: {
  supabaseAnon: SupabaseUntyped
  supabaseService: SupabaseUntyped
  userId: string
  asignaturaId: string
}) {
  const { supabaseAnon, supabaseService, userId, asignaturaId } = args

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

  const { data: canUseIA, error: iaError } = await supabaseService.rpc(
    'usuario_puede_usar_ia_asignatura',
    {
      p_usuario_id: userId,
      p_asignatura_id: asignaturaId,
    },
  )

  if (iaError) {
    throw new HttpError(
      500,
      'No se pudo validar el estado de la asignatura.',
      'AUTHZ_ERROR',
      iaError,
    )
  }

  if (canUseIA !== true) {
    throw new HttpError(
      403,
      'Esta asignatura ya no permite usar IA porque su plan de estudios se encuentra en una etapa de revision o aprobacion.',
      'ASIGNATURA_IA_FROZEN',
    )
  }
}

async function fetchSubjectContext(
  supabaseService: SupabaseUntyped,
  asignaturaId: string,
) {
  const { data, error } = await supabaseService
    .from('asignaturas')
    .select(
      `
      id,plan_estudio_id,estructura_id,codigo,nombre,tipo,creditos,numero_ciclo,
      datos,contenido_tematico,horas_academicas,horas_independientes,
      criterios_de_evaluacion,prerrequisito_asignatura_id,
      planes_estudio(
        id,nombre,tipo_ciclo,numero_ciclos,datos,
        carreras(id,nombre,nombre_corto,nivel,facultades(id,nombre,nombre_corto))
      ),
      bibliografia_asignatura(id,tipo,cita,titulo,autores,editorial,anio,isbn,formato)
    `,
    )
    .eq('id', asignaturaId)
    .maybeSingle()

  if (error) {
    throw new HttpError(
      500,
      'No se pudo obtener la asignatura.',
      'SUPABASE_QUERY_FAILED',
      error,
    )
  }

  if (!data) {
    throw new HttpError(404, 'Asignatura no encontrada.', 'NOT_FOUND', {
      asignaturaId,
    })
  }

  return data as Record<string, unknown>
}

function applyTargetFilters(
  query: SupabaseUntyped,
  ids: { unidadId: string | null; temaId: string | null },
) {
  let scoped = query

  scoped =
    ids.unidadId === null
      ? scoped.is('unidad_id', null)
      : scoped.eq('unidad_id', ids.unidadId)

  scoped =
    ids.temaId === null
      ? scoped.is('tema_id', null)
      : scoped.eq('tema_id', ids.temaId)

  return scoped
}

async function resolveTypesToGenerate(args: {
  supabaseService: SupabaseUntyped
  asignaturaId: string
  target: TargetContext
  requestedTypes: Array<LearningObjectTipo>
}) {
  const ids = targetIds(args.target)
  const query = args.supabaseService
    .from('learning_objects')
    .select('id,tipo,estado')
    .eq('asignatura_id', args.asignaturaId)
    .in('tipo', args.requestedTypes)

  const { data, error } = await applyTargetFilters(query, ids)

  if (error) {
    throw new HttpError(
      500,
      'No se pudieron revisar los recursos existentes.',
      'SUPABASE_QUERY_FAILED',
      error,
    )
  }

  const existingFinalTypes = new Set<LearningObjectTipo>(
    (data ?? [])
      .filter((row: Record<string, unknown>) => row.estado !== 'draft')
      .map((row: Record<string, unknown>) => row.tipo as LearningObjectTipo),
  )

  return args.requestedTypes.filter((type) => !existingFinalTypes.has(type))
}

async function createGenerationJob(args: {
  supabaseService: SupabaseUntyped
  asignaturaId: string
  userId: string
  payload: LearningObjectRequest
  requestedTypes: Array<LearningObjectTipo>
  target: TargetContext
}) {
  const ids = targetIds(args.target)

  const { data, error } = await args.supabaseService
    .from('learning_generation_jobs')
    .insert({
      asignatura_id: args.asignaturaId,
      unidad_id: ids.unidadId,
      tema_id: ids.temaId,
      scope: args.target.scope,
      estado: 'running',
      requested_types: args.requestedTypes,
      config_json: {
        iaConfig: args.payload.iaConfig,
        target: {
          scope: args.target.scope,
          unidad: args.target.unidad
            ? {
                id: args.target.unidad.id ?? null,
                unidad: args.target.unidad.unidad,
                titulo: args.target.unidad.titulo,
              }
            : null,
          tema: args.target.tema
            ? {
                id: args.target.tema.id ?? null,
                index: args.target.tema.index,
                nombre: args.target.tema.nombre,
              }
            : null,
        },
      } satisfies Json,
      creado_por: args.userId,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new HttpError(
      500,
      'No se pudo crear el job de generacion.',
      'SUPABASE_INSERT_FAILED',
      error,
    )
  }

  return data as Record<string, unknown>
}

async function updateGenerationJob(
  supabaseService: SupabaseUntyped,
  jobId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await supabaseService
    .from('learning_generation_jobs')
    .update(patch)
    .eq('id', jobId)

  if (error) {
    console.warn('[learning-object-generate] job update failed', error)
  }
}

async function persistGeneratedOutput(args: {
  supabaseService: SupabaseUntyped
  asignaturaId: string
  userId: string
  jobId: string
  target: TargetContext
  output: GeneratedOutput
  aiResult: { responseId: string; model: string; usage?: unknown }
}) {
  const ids = targetIds(args.target)

  const rows = args.output.resources.map((resource) => ({
    asignatura_id: args.asignaturaId,
    unidad_id: ids.unidadId,
    tema_id: ids.temaId,
    tipo: resource.tipo,
    titulo: resource.titulo,
    descripcion: resource.descripcion,
    contenido_json: resource.contenido as Json,
    estado: 'generated',
    score: resource.score,
    source_refs: resource.source_refs as unknown as Json,
    metadata: {
      recomendaciones: resource.recomendaciones,
      generatedBy: 'learning-object-generate',
      openai: {
        responseId: args.aiResult.responseId,
        model: args.aiResult.model,
      },
    } satisfies Json,
    creado_por: args.userId,
    actualizado_por: args.userId,
    generation_job_id: args.jobId,
  }))

  const outputTypes = args.output.resources.map((resource) => resource.tipo)
  const draftsQuery = args.supabaseService
    .from('learning_objects')
    .select('id,tipo,creado_en')
    .eq('asignatura_id', args.asignaturaId)
    .eq('estado', 'draft')
    .in('tipo', outputTypes)

  const { data: drafts, error: draftsError } = await applyTargetFilters(
    draftsQuery,
    ids,
  ).order('creado_en', { ascending: true })

  if (draftsError) {
    throw new HttpError(
      500,
      'No se pudieron revisar los borradores existentes.',
      'SUPABASE_QUERY_FAILED',
      draftsError,
    )
  }

  const draftsByType = new Map<
    LearningObjectTipo,
    Array<Record<string, unknown>>
  >()
  for (const draft of drafts ?? []) {
    const tipo = draft.tipo as LearningObjectTipo
    const list = draftsByType.get(tipo) ?? []
    list.push(draft)
    draftsByType.set(tipo, list)
  }

  const persistedObjects: Array<Record<string, unknown>> = []

  for (const row of rows) {
    const draft = draftsByType.get(row.tipo)?.shift()

    if (draft?.id) {
      const {
        asignatura_id: _asignaturaId,
        unidad_id: _unidadId,
        tema_id: _temaId,
        tipo: _tipo,
        creado_por: _creadoPor,
        ...patch
      } = row

      const { data: object, error: objectError } = await args.supabaseService
        .from('learning_objects')
        .update(patch)
        .eq('id', draft.id)
        .select('*')
        .single()

      if (objectError || !object) {
        throw new HttpError(
          500,
          'No se pudo actualizar un borrador generado.',
          'SUPABASE_UPDATE_FAILED',
          objectError,
        )
      }

      persistedObjects.push(object)
      continue
    }

    const { data: object, error: objectError } = await args.supabaseService
      .from('learning_objects')
      .insert(row)
      .select('*')
      .single()

    if (objectError || !object) {
      throw new HttpError(
        500,
        'No se pudieron guardar los recursos generados.',
        'SUPABASE_INSERT_FAILED',
        objectError,
      )
    }

    persistedObjects.push(object)
  }

  let deleteScore = args.supabaseService
    .from('learning_quality_scores')
    .delete()
    .eq('asignatura_id', args.asignaturaId)

  deleteScore =
    ids.unidadId === null
      ? deleteScore.is('unidad_id', null)
      : deleteScore.eq('unidad_id', ids.unidadId)

  deleteScore =
    ids.temaId === null
      ? deleteScore.is('tema_id', null)
      : deleteScore.eq('tema_id', ids.temaId)

  const { error: deleteScoreError } = await deleteScore
  if (deleteScoreError) {
    throw new HttpError(
      500,
      'No se pudo reemplazar el score de calidad anterior.',
      'SUPABASE_DELETE_FAILED',
      deleteScoreError,
    )
  }

  const { data: qualityScore, error: scoreError } = await args.supabaseService
    .from('learning_quality_scores')
    .insert({
      asignatura_id: args.asignaturaId,
      unidad_id: ids.unidadId,
      tema_id: ids.temaId,
      score_total: args.output.quality_score.score_total,
      rubrica_json: args.output.quality_score.rubrica as Json,
      recomendaciones_json: args.output.quality_score
        .recomendaciones as unknown as Json,
      generation_job_id: args.jobId,
      generado_por: args.userId,
    })
    .select('*')
    .single()

  if (scoreError) {
    throw new HttpError(
      500,
      'No se pudo guardar el score de calidad.',
      'SUPABASE_INSERT_FAILED',
      scoreError,
    )
  }

  return { objects: persistedObjects, qualityScore }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  let jobId: string | null = null
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

    await assertSubjectAccess({
      supabaseAnon,
      supabaseService,
      userId: user.id,
      asignaturaId: payload.asignaturaId,
    })

    const asignatura = await fetchSubjectContext(
      supabaseService,
      payload.asignaturaId,
    )
    const unidades = normalizeContenido(asignatura.contenido_tematico)
    const target = resolveTarget(payload, unidades)
    const requestedTypes = await resolveTypesToGenerate({
      supabaseService,
      asignaturaId: payload.asignaturaId,
      target,
      requestedTypes: payload.requestedTypes,
    })

    if (requestedTypes.length === 0) {
      throw new HttpError(
        409,
        'Los recursos seleccionados ya existen para este alcance.',
        'LEARNING_OBJECTS_ALREADY_EXIST',
      )
    }

    const job = await createGenerationJob({
      supabaseService,
      asignaturaId: payload.asignaturaId,
      userId: user.id,
      payload,
      requestedTypes,
      target,
    })
    jobId = String(job.id)

    const svc = OpenAIService.fromEnv()
    if (!(svc instanceof OpenAIService)) {
      throw new HttpError(
        500,
        'Configuracion de OpenAI incompleta.',
        'OPENAI_MISCONFIGURED',
        svc,
      )
    }

    const model =
      payload.iaConfig.model ??
      Deno.env.get('LEARNING_OBJECT_GENERATE_MODELO') ??
      'gpt-5-nano'
    const reasoning = buildReasoningParam(
      model,
      payload.iaConfig.reasoningEffort as ReasoningEffort,
    )
    const openaiFileIds = payload.iaConfig.archivosReferencia.filter(Boolean)
    const vectorStoreIds = payload.iaConfig.repositoriosIds.filter(Boolean)
    const prompt = buildPrompt({
      asignatura,
      target,
      requestedTypes,
      iaConfig: payload.iaConfig,
    })

    const input: StructuredResponseOptions['input'] = [
      {
        role: 'system',
        content:
          'Eres un disenador instruccional universitario experto. Generas recursos pedagogicos rigurosos, citables y revisables para Acad-IA. No generas archivos binarios, PPTX ni paquetes SCORM.',
      },
      ...buildUserContent(prompt, openaiFileIds),
    ]

    const aiResult = await svc.createStructuredResponse<GeneratedOutput>({
      model,
      background: false,
      metadata: {
        tabla: 'learning_objects',
        accion: 'generar',
        id: jobId,
        asignatura_id: payload.asignaturaId,
        scope: target.scope,
        webSearchEnabled: String(payload.iaConfig.webSearchEnabled),
        reasoningEffort: payload.iaConfig.reasoningEffort ?? 'auto',
      },
      safety_identifier: await buildSafetyIdentifier(user.id),
      ...(reasoning ? { reasoning } : {}),
      tools: buildTools(vectorStoreIds, payload.iaConfig.webSearchEnabled),
      input,
      text: {
        format: {
          type: 'json_schema',
          name: 'learning_object_generation',
          schema: responseJsonSchema,
          strict: true,
        },
      },
    })

    if (!aiResult.ok || !aiResult.output) {
      throw new HttpError(
        aiResult.ok ? 502 : aiResult.code === 'MissingEnv' ? 500 : 502,
        'No se pudo generar el recurso pedagogico con IA.',
        'OPENAI_REQUEST_FAILED',
        aiResult,
      )
    }

    const outputParse = GeneratedOutputSchema.safeParse(aiResult.output)
    if (!outputParse.success) {
      throw new HttpError(
        502,
        'La IA devolvio un JSON fuera del contrato esperado.',
        'AI_OUTPUT_VALIDATION_FAILED',
        outputParse.error,
      )
    }

    const missingTypes = requestedTypes.filter(
      (type) =>
        !outputParse.data.resources.some((resource) => resource.tipo === type),
    )
    if (missingTypes.length > 0) {
      throw new HttpError(
        502,
        'La IA no genero todos los tipos solicitados.',
        'AI_OUTPUT_INCOMPLETE',
        { missingTypes },
      )
    }

    const persisted = await persistGeneratedOutput({
      supabaseService,
      asignaturaId: payload.asignaturaId,
      userId: user.id,
      jobId,
      target,
      output: outputParse.data,
      aiResult: {
        responseId: aiResult.responseId,
        model: aiResult.model,
        usage: aiResult.usage,
      },
    })

    await updateGenerationJob(supabaseService, jobId, {
      estado: 'completed',
      openai_response_id: aiResult.responseId,
      resultado_json: outputParse.data as unknown as Json,
      completado_en: new Date().toISOString(),
    })

    await registrarInteraccionIA(supabaseService, {
      usuarioId: user.id,
      asignaturaId: payload.asignaturaId,
      tipo: 'GENERAR',
      modelo: aiResult.model,
      openaiFileIds,
      vectorStoreIds,
    })

    return sendSuccess({
      ok: true,
      job: {
        id: jobId,
        estado: 'completed',
        openai_response_id: aiResult.responseId,
      },
      learning_objects: persisted.objects,
      quality_score: persisted.qualityScore,
      resumen_generacion: outputParse.data.resumen_generacion,
      openai: {
        responseId: aiResult.responseId,
        model: aiResult.model,
        usage: aiResult.usage ?? null,
      },
    })
  } catch (error) {
    if (jobId && supabaseServiceForError) {
      await updateGenerationJob(supabaseServiceForError, jobId, {
        estado: 'failed',
        error: error instanceof Error ? error.message : String(error),
        completado_en: new Date().toISOString(),
      })
    }

    if (error instanceof HttpError) {
      console.error('[learning-object-generate] handled error', {
        code: error.code,
        message: error.message,
        details: error.internalDetails ?? null,
      })
      return sendError(error.status, error.message, error.code)
    }

    console.error('[learning-object-generate] unexpected error', error)
    return sendError(
      500,
      'Ocurrio un error inesperado en el servidor.',
      'INTERNAL_SERVER_ERROR',
    )
  }
})
