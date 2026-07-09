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
import type {
  StructuredResponseOptions,
  StructuredResponseResult,
} from '../_shared/openai-service.ts'

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

const FINALIZE_LOCK_MS = Math.max(
  10_000,
  Number(Deno.env.get('LEARNING_OBJECT_FINALIZE_LOCK_MS') ?? '45000') || 45_000,
)
const ACTIVE_JOB_TIMEOUT_MS = Math.max(
  60_000,
  Number(Deno.env.get('LEARNING_OBJECT_ACTIVE_TIMEOUT_MS') ?? '360000') ||
    360_000,
)
const LEARNING_OBJECT_MAX_OUTPUT_TOKENS = Math.max(
  12_000,
  positiveIntegerEnv('LEARNING_OBJECT_MAX_OUTPUT_TOKENS', 25_000),
)
const LEARNING_OBJECT_QUICK_MAX_OUTPUT_TOKENS = Math.max(
  8_000,
  positiveIntegerEnv('LEARNING_OBJECT_QUICK_MAX_OUTPUT_TOKENS', 16_000),
)
const OPENAI_ACTIVE_STATUSES = new Set(['queued', 'in_progress'])
const OPENAI_CREATE_RETRY_DELAYS_MS = [0, 1_500, 4_000]

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

const StatusRequestSchema = z
  .object({
    jobId: z.string().uuid('jobId debe ser un UUID'),
  })
  .strict()

type LearningObjectStatusRequest = z.infer<typeof StatusRequestSchema>

const FinalizeRequestSchema = z
  .object({
    jobId: z.string().uuid('jobId debe ser un UUID'),
    responseId: z.string().min(1).optional(),
  })
  .strict()

type LearningObjectFinalizeRequest = z.infer<typeof FinalizeRequestSchema>

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

const ORTHOGRAPHY_NORMALIZATION_PATTERNS: Array<{
  pattern: RegExp
  expected: string
}> = [
  { pattern: /\bacademic[ao]s?\b/i, expected: 'académico/académica' },
  { pattern: /\bpedagogic[ao]s?\b/i, expected: 'pedagógico/pedagógica' },
  { pattern: /\bevaluacion\b/i, expected: 'evaluación' },
  { pattern: /\binformacion\b/i, expected: 'información' },
  { pattern: /\bdefinicion\b/i, expected: 'definición' },
  { pattern: /\bfuncion\b/i, expected: 'función' },
  { pattern: /\blimite(?:s)?\b/i, expected: 'límite' },
  { pattern: /\bcalculo\b/i, expected: 'cálculo' },
  { pattern: /\bsolucion\b/i, expected: 'solución' },
  { pattern: /\bintroduccion\b/i, expected: 'introducción' },
  { pattern: /\bcomprension\b/i, expected: 'comprensión' },
  { pattern: /\bpractica(?:s)?\b/i, expected: 'práctica' },
  { pattern: /\bdiagnostico(?:s)?\b/i, expected: 'diagnóstico' },
  { pattern: /\brubrica(?:s)?\b/i, expected: 'rúbrica' },
  { pattern: /\bespanol\b/i, expected: 'español' },
]

function collectStrings(
  value: unknown,
  out: Array<string> = [],
): Array<string> {
  if (typeof value === 'string') {
    out.push(value)
    return out
  }

  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out)
    return out
  }

  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) collectStrings(nested, out)
  }

  return out
}

function assertGeneratedOrthography(output: GeneratedOutput) {
  const strings = [
    output.resumen_generacion,
    ...output.resources.flatMap((resource) =>
      collectStrings({
        titulo: resource.titulo,
        descripcion: resource.descripcion,
        contenido: resource.contenido,
        recomendaciones: resource.recomendaciones,
      }),
    ),
  ]

  for (const text of strings) {
    if (
      /[�]|Ã.|Â.|&(?:aacute|eacute|iacute|oacute|uacute|ntilde);/i.test(text)
    ) {
      throw new HttpError(
        502,
        'La IA devolvió texto con codificación dañada. Vuelve a generar el contenido.',
        'AI_OUTPUT_ORTHOGRAPHY_FAILED',
        { sample: text.slice(0, 180) },
      )
    }

    for (const { pattern, expected } of ORTHOGRAPHY_NORMALIZATION_PATTERNS) {
      const match = text.match(pattern)
      if (!match) continue
      throw new HttpError(
        502,
        `La IA devolvió texto con acentos omitidos: "${match[0]}"; se esperaba ${expected}. Vuelve a generar el contenido.`,
        'AI_OUTPUT_ORTHOGRAPHY_FAILED',
        { sample: text.slice(0, 180), match: match[0], expected },
      )
    }
  }
}

function normalizeGeneratedOutputForRequest(
  output: GeneratedOutput,
  requestedTypes: Array<LearningObjectTipo>,
): GeneratedOutput {
  const requested = new Set(requestedTypes)
  const selectedResources: Array<GeneratedResource> = []
  const duplicateTypes: Array<LearningObjectTipo> = []
  const unexpectedTypes = output.resources
    .filter((resource) => !requested.has(resource.tipo))
    .map((resource) => resource.tipo)

  for (const type of requestedTypes) {
    const matches = output.resources.filter(
      (resource) => resource.tipo === type,
    )
    if (matches.length > 0) {
      selectedResources.push(matches[0])
    }
    if (matches.length > 1) {
      duplicateTypes.push(type)
    }
  }

  const missingTypes = requestedTypes.filter(
    (type) => !selectedResources.some((resource) => resource.tipo === type),
  )

  if (missingTypes.length > 0) {
    throw new HttpError(
      502,
      'La IA no devolvió todos los tipos de contenido solicitados. Vuelve a intentarlo.',
      'AI_OUTPUT_TYPE_MISMATCH',
      {
        requestedTypes,
        outputTypes: output.resources.map((resource) => resource.tipo),
        missingTypes,
        duplicateTypes,
        unexpectedTypes,
      },
    )
  }

  if (duplicateTypes.length > 0 || unexpectedTypes.length > 0) {
    console.warn(
      '[learning-object-generate] ignoring extra generated resources',
      {
        requestedTypes,
        outputTypes: output.resources.map((resource) => resource.tipo),
        duplicateTypes,
        unexpectedTypes,
      },
    )
  }

  return {
    ...output,
    resources: selectedResources,
  }
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) {
    throw new HttpError(
      500,
      'Configuración del servidor incompleta.',
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
    throw new HttpError(400, 'Body JSON inválido.', 'INVALID_JSON', {
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

function positiveIntegerEnv(name: string, fallback: number): number {
  const parsed = Number(Deno.env.get(name))
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.trunc(parsed)
}

function dateMs(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
}

function isNeedsReviewFresh(job: Record<string, unknown>): boolean {
  if (job.estado !== 'needs_review') return false
  const updatedAt = dateMs(job.actualizado_en) ?? dateMs(job.creado_en)
  if (updatedAt === null) return false
  return Date.now() - updatedAt < FINALIZE_LOCK_MS
}

function isActiveJobTimedOut(job: Record<string, unknown>): boolean {
  if (job.estado !== 'queued' && job.estado !== 'running') return false
  const createdAt = dateMs(job.creado_en)
  if (createdAt === null) return false
  return Date.now() - createdAt > ACTIVE_JOB_TIMEOUT_MS
}

function activeJobTimeoutMessage(): string {
  const minutes = Math.max(1, Math.round(ACTIVE_JOB_TIMEOUT_MS / 60_000))
  return `OpenAI no completó la generación después de ${minutes} minuto${minutes === 1 ? '' : 's'}. Puedes volver a intentarlo con una solicitud más breve.`
}

function staleNeedsReviewCutoffIso(): string {
  return new Date(Date.now() - FINALIZE_LOCK_MS).toISOString()
}

function getOpenAIFailureStatus(error: unknown): number | null {
  const record = asRecord(error)
  const directStatus = numberValue(record?.status)
  if (directStatus !== null) return directStatus

  const responseStatus = numberValue(asRecord(record?.response)?.status)
  if (responseStatus !== null) return responseStatus

  return null
}

function isRetryableOpenAIFailure(result: { code: string; cause?: unknown }) {
  if (result.code === 'MissingEnv') return false
  const status = getOpenAIFailureStatus(result.cause)
  return (
    status === null ||
    status === 408 ||
    status === 409 ||
    status === 429 ||
    status >= 500
  )
}

function terminalOpenAIStatusMessage(
  status: string,
  response?: unknown,
): string {
  if (status === 'cancelled' || status === 'canceled') {
    return 'OpenAI canceló la generación.'
  }
  if (status === 'failed') return 'OpenAI marcó la generación como fallida.'
  if (status === 'incomplete') {
    const details = asRecord(asRecord(response)?.incomplete_details)
    const reason = stringValue(details?.reason)

    if (reason === 'max_output_tokens') {
      return 'OpenAI alcanzó el límite de tokens de salida antes de terminar la generación. Puedes volver a intentarlo con una solicitud más breve.'
    }

    return 'OpenAI devolvió la generación como incompleta.'
  }
  return 'La generación no pudo completarse.'
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

const GENERATED_TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/&aacute;/gi, 'á'],
  [/&eacute;/gi, 'é'],
  [/&iacute;/gi, 'í'],
  [/&oacute;/gi, 'ó'],
  [/&uacute;/gi, 'ú'],
  [/&ntilde;/gi, 'ñ'],
  [/Ã¡/g, 'á'],
  [/Ã©/g, 'é'],
  [/Ã­/g, 'í'],
  [/Ã³/g, 'ó'],
  [/Ãº/g, 'ú'],
  [/Ã±/g, 'ñ'],
  [/ÃÁ/g, 'Á'],
  [/Ã‰/g, 'É'],
  [/ÃÍ/g, 'Í'],
  [/Ã“/g, 'Ó'],
  [/Ãš/g, 'Ú'],
  [/Ã‘/g, 'Ñ'],
  [/Â¿/g, '¿'],
  [/Â¡/g, '¡'],
  [/Â°/g, '°'],
  [/â/g, 'á'],
  [/ê/g, 'é'],
  [/î/g, 'í'],
  [/ô/g, 'ó'],
  [/û/g, 'ú'],
  [/Â/g, ''],
]

function sanitizeGeneratedText(value: unknown): unknown {
  if (typeof value === 'string') {
    return GENERATED_TEXT_REPLACEMENTS.reduce(
      (text, [pattern, replacement]) => text.replace(pattern, replacement),
      value.replace(/\u0000/g, ''),
    )
  }

  if (Array.isArray(value)) return value.map(sanitizeGeneratedText)

  const record = asRecord(value)
  if (!record) return value

  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(record)) {
    out[key] = sanitizeGeneratedText(item)
  }
  return out
}

function isQuickGenerationRequest(
  iaConfig: LearningObjectRequest['iaConfig'],
): boolean {
  const text = [iaConfig.enfoqueAcademico, iaConfig.instruccionesAdicionalesIA]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return /\b(prueba|breve|rapida|rápida|compacta|compacto|concisa|conciso)\b/.test(
    text,
  )
}

function buildLengthGuidance(
  requestedTypes: Array<LearningObjectTipo>,
  quickMode: boolean,
): string {
  const max = quickMode
    ? {
        apunte: '2 secciones, máximo 70 palabras por sección',
        quiz: '2 preguntas, 3 opciones por pregunta',
        actividad: '4 pasos',
        ejercicios: '2 ejercicios',
        rubrica: '3 criterios',
        outline_presentacion: '3 diapositivas, 3 puntos por diapositiva',
        recursos_externos: '3 recursos',
      }
    : {
        apunte: '3 secciones, máximo 120 palabras por sección',
        quiz: '4 preguntas, 4 opciones por pregunta',
        actividad: '6 pasos',
        ejercicios: '3 ejercicios',
        rubrica: '4 criterios',
        outline_presentacion: '5 diapositivas, 3 puntos por diapositiva',
        recursos_externos: '4 recursos',
      }

  return requestedTypes.map((type) => `- ${type}: ${max[type]}.`).join('\n')
}

function buildMaxOutputTokens(
  requestedTypes: Array<LearningObjectTipo>,
  quickMode: boolean,
): number {
  const byType = quickMode
    ? {
        apunte: 5_500,
        quiz: 5_500,
        actividad: 4_000,
        ejercicios: 6_000,
        rubrica: 4_000,
        outline_presentacion: 5_000,
        recursos_externos: 3_500,
      }
    : {
        apunte: 8_000,
        quiz: 8_000,
        actividad: 6_000,
        ejercicios: 9_000,
        rubrica: 6_500,
        outline_presentacion: 6_500,
        recursos_externos: 5_000,
      }
  const base = quickMode ? 4_000 : 7_000
  const fallback = quickMode ? 4_000 : 6_000
  const limit = quickMode
    ? LEARNING_OBJECT_QUICK_MAX_OUTPUT_TOKENS
    : LEARNING_OBJECT_MAX_OUTPUT_TOKENS

  const total = requestedTypes.reduce(
    (sum, type) => sum + (byType[type] ?? fallback),
    base,
  )

  return Math.min(total, limit)
}

function buildPrompt(args: {
  asignatura: Record<string, unknown>
  target: TargetContext
  requestedTypes: Array<LearningObjectTipo>
  iaConfig: LearningObjectRequest['iaConfig']
}) {
  const { asignatura, target, requestedTypes, iaConfig } = args
  const quickMode = isQuickGenerationRequest(iaConfig)
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

  return `Genera contenidos pedagógicos para Acad-IA.

Objetivo:
- Crear contenidos académicos con fuentes, citas internas y metadata técnica de calidad.
- Generar exactamente estos tipos: ${requestedTypes.join(', ')}.
- Devuelve exactamente un objeto en "resources" por cada tipo solicitado. Si se solicita "ejercicios", crea un solo recurso de tipo "ejercicios" cuyo contenido_json.ejercicios contenga varios ejercicios internos; no crees varios recursos de tipo "ejercicios".
- Si se solicita "quiz", crea un solo recurso de tipo "quiz" cuyo contenido_json.quiz.preguntas contenga todas las preguntas internas; no crees un recurso por pregunta.
- Si el tipo es outline_presentacion, crea SOLO el outline textual/estructurado. No generes PPTX, archivos binarios, ZIP ni SCORM.

Límites de extensión:
${quickMode ? '- Modo breve activado por la solicitud. Prioriza una respuesta compacta para validación rápida.' : '- Mantén el contenido completo pero acotado para que pueda revisarse y editarse con rapidez.'}
${buildLengthGuidance(requestedTypes, quickMode)}
- Solo excedas estos límites si las instrucciones adicionales piden explícitamente una extensión mayor.

Reglas de idioma, ortografía y fórmulas:
- Escribe en español académico con ortografía impecable.
- Conserva tildes, diéresis, signos de apertura (¿, ¡) y la letra Ñ/ñ. No sustituyas Ñ por N ni elimines acentos por compatibilidad técnica.
- Si incluyes una fórmula, expresión matemática, fracción, serie, integral, límite o variable con notación formal, escríbela en LaTeX entre \\( y \\).
- No escribas fracciones matemáticas como texto plano cuando deban verse como fórmula. Ejemplo correcto: \\(\\frac{1}{2} + \\frac{1}{4} + \\frac{1}{8} + \\frac{1}{16} + \\ldots\\).
- Aplica LaTeX en preguntas, opciones y retroalimentación de quizzes; también en enunciados, pistas y soluciones de ejercicios.
- Los quizzes deben estar diseñados para un solo envío local. No incluyas instrucciones de reintentos ni frases como "puedes intentar de nuevo"; los intentos posteriores los gestionará el LMS cuando se exporte.

Contexto de asignatura:
${JSON.stringify(safeForPrompt(asignatura), null, 2)}

Alcance solicitado:
${targetSummary}

Regla de foco del alcance:
- El contenido generado debe concentrarse únicamente en el alcance solicitado.
- Si el alcance es tema, todos los títulos, preguntas, ejercicios, actividades y ejemplos deben tratar exclusivamente el tema indicado arriba.
- Los demás temas de la unidad/asignatura pueden usarse solo para entender contexto, prerrequisitos y evitar duplicidad; no generes piezas, secciones principales ni ejercicios para temas hermanos.
- No repartas un tipo solicitado en subtemas que pertenezcan a otros temas del programa.

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
- Usa archivos adjuntos, repositorios vía file_search y web_search cuando estén disponibles.
- Todo dato específico, definición especializada, lectura/video/recurso externo o afirmación no trivial debe quedar respaldado por source_refs.
- No inventes bibliografía, URLs, autores ni licencias. Si una fuente no permite confirmar un dato, usa url/licencia/fecha null y baja confianza.
- Los source_ref_ids dentro del contenido deben corresponder a ids existentes en source_refs del mismo recurso.
- La metadata de calidad mide preparación pedagógica del recurso antes de que existan alumnos, no aprendizaje del alumno.
- Incluye recomendaciones accionables para mejorar fuentes, cobertura, evaluación y accesibilidad.

Responde exclusivamente con JSON válido que cumpla el schema.`
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
      'Esta asignatura ya no permite usar IA porque su plan de estudios se encuentra en una etapa de revisión o aprobación.',
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
      'No se pudo crear el job de generación.',
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

async function fetchGenerationJob(
  supabaseService: SupabaseUntyped,
  jobId: string,
) {
  const { data, error } = await supabaseService
    .from('learning_generation_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle()

  if (error) {
    throw new HttpError(
      500,
      'No se pudo consultar el job de generación.',
      'SUPABASE_QUERY_FAILED',
      error,
    )
  }

  if (!data) {
    throw new HttpError(404, 'Job de generación no encontrado.', 'NOT_FOUND', {
      jobId,
    })
  }

  return data as Record<string, unknown>
}

async function fetchActiveGenerationJobForTarget(args: {
  supabaseService: SupabaseUntyped
  asignaturaId: string
  target: TargetContext
}) {
  const ids = targetIds(args.target)
  let query = args.supabaseService
    .from('learning_generation_jobs')
    .select('*')
    .eq('asignatura_id', args.asignaturaId)
    .eq('scope', args.target.scope)
    .in('estado', ['queued', 'running', 'needs_review'])
    .order('creado_en', { ascending: false })
    .limit(1)

  query = applyTargetFilters(query, ids)

  const { data, error } = await query.maybeSingle()
  if (error) {
    throw new HttpError(
      500,
      'No se pudo consultar si ya existe una generación activa.',
      'SUPABASE_QUERY_FAILED',
      error,
    )
  }

  const activeJob = data ? (data as Record<string, unknown>) : null
  if (!activeJob) return null

  if (isActiveJobTimedOut(activeJob)) {
    await updateGenerationJob(args.supabaseService, String(activeJob.id), {
      estado: 'failed',
      error: activeJobTimeoutMessage(),
      completado_en: new Date().toISOString(),
    })
    return null
  }

  return activeJob
}

async function assertGenerationJobAccess(args: {
  supabaseAnon: SupabaseUntyped
  job: Record<string, unknown>
}) {
  const asignaturaId = stringValue(args.job.asignatura_id)
  if (!asignaturaId) {
    throw new HttpError(
      500,
      'El job no tiene asignatura asociada.',
      'JOB_SCOPE_INVALID',
      args.job,
    )
  }

  const { data: canAccess, error: accessError } = await args.supabaseAnon.rpc(
    'authz_can_access_asignatura',
    {
      p_asignatura_id: asignaturaId,
    },
  )

  if (accessError || canAccess !== true) {
    throw new HttpError(
      403,
      'No tienes acceso a esta generación.',
      'FORBIDDEN',
      accessError,
    )
  }
}

function targetFromJob(job: Record<string, unknown>): TargetContext {
  const scope =
    job.scope === 'asignatura' || job.scope === 'unidad' || job.scope === 'tema'
      ? (job.scope as LearningGenerationScope)
      : 'tema'

  if (scope === 'asignatura') {
    return { scope, unidad: null, tema: null }
  }

  const unidadId = stringValue(job.unidad_id) ?? ''
  const unidad: ContenidoUnidad = {
    id: unidadId || undefined,
    unidad: Number.parseInt(unidadId, 10) || 0,
    titulo: '',
    temas: [],
    raw: null,
    index: 0,
  }

  if (scope === 'unidad') {
    return { scope, unidad, tema: null }
  }

  const temaId = stringValue(job.tema_id) ?? ''
  const tema: ContenidoTema = {
    id: temaId || undefined,
    nombre: '',
    raw: null,
    index: Number.parseInt(temaId, 10) ? Number.parseInt(temaId, 10) - 1 : 0,
  }

  return { scope, unidad, tema }
}

function requestedTypesFromJob(
  job: Record<string, unknown>,
): Array<LearningObjectTipo> {
  if (!Array.isArray(job.requested_types)) return []
  return job.requested_types.filter(
    (tipo): tipo is LearningObjectTipo =>
      LearningObjectTipoSchema.safeParse(tipo).success,
  )
}

function assertOpenAIResponseMatchesJob(
  response: { id?: unknown; metadata?: unknown },
  jobId: string,
) {
  const metadata = asRecord(response.metadata)
  if (metadata?.tabla === 'learning_objects' && metadata?.id === jobId) return

  throw new HttpError(
    409,
    'La respuesta de OpenAI no corresponde a este job.',
    'RESPONSE_JOB_MISMATCH',
    {
      responseId: response.id,
      jobId,
      metadata,
    },
  )
}

async function fetchGenerationArtifacts(args: {
  supabaseService: SupabaseUntyped
  job: Record<string, unknown>
  responseStatus?: string | null
  openai?: { responseId: string; model: string; usage?: unknown } | null
}) {
  const jobId = String(args.job.id)
  const { data: objects, error: objectsError } = await args.supabaseService
    .from('learning_objects')
    .select('*')
    .eq('generation_job_id', jobId)
    .order('creado_en', { ascending: true })

  if (objectsError) {
    throw new HttpError(
      500,
      'No se pudieron consultar los contenidos generados.',
      'SUPABASE_QUERY_FAILED',
      objectsError,
    )
  }

  const { data: qualityScore, error: scoreError } = await args.supabaseService
    .from('learning_quality_scores')
    .select('*')
    .eq('generation_job_id', jobId)
    .order('calculado_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (scoreError) {
    throw new HttpError(
      500,
      'No se pudo consultar el score de calidad.',
      'SUPABASE_QUERY_FAILED',
      scoreError,
    )
  }

  const resultado = asRecord(args.job.resultado_json)
  const resumen =
    typeof resultado?.resumen_generacion === 'string'
      ? resultado.resumen_generacion
      : null

  return {
    ok: true,
    job: {
      id: jobId,
      estado: args.job.estado,
      openai_response_id: stringValue(args.job.openai_response_id),
      error: stringValue(args.job.error),
    },
    responseStatus: args.responseStatus ?? null,
    learning_objects: objects ?? [],
    quality_score: qualityScore ?? null,
    resumen_generacion: resumen,
    ...(args.openai ? { openai: args.openai } : {}),
  }
}

async function claimGenerationJobCompletion(
  supabaseService: SupabaseUntyped,
  jobId: string,
  options: { staleNeedsReviewBefore?: string | null } = {},
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseService
    .from('learning_generation_jobs')
    .update({ estado: 'needs_review' })
    .eq('id', jobId)
    .in('estado', ['queued', 'running'])
    .select('*')
    .maybeSingle()

  if (error) {
    throw new HttpError(
      500,
      'No se pudo preparar el cierre de la generación.',
      'SUPABASE_UPDATE_FAILED',
      error,
    )
  }

  if (data) return data as Record<string, unknown>

  if (!options.staleNeedsReviewBefore) return null

  const { data: staleData, error: staleError } = await supabaseService
    .from('learning_generation_jobs')
    .update({ estado: 'needs_review' })
    .eq('id', jobId)
    .eq('estado', 'needs_review')
    .lt('actualizado_en', options.staleNeedsReviewBefore)
    .select('*')
    .maybeSingle()

  if (staleError) {
    throw new HttpError(
      500,
      'No se pudo retomar el cierre pendiente de la generación.',
      'SUPABASE_UPDATE_FAILED',
      staleError,
    )
  }

  return staleData ? (staleData as Record<string, unknown>) : null
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

  const { data: persistedObjects, error: insertObjectsError } =
    await args.supabaseService.from('learning_objects').insert(rows).select('*')

  if (insertObjectsError || !persistedObjects) {
    throw new HttpError(
      500,
      'No se pudieron guardar los recursos generados.',
      'SUPABASE_INSERT_FAILED',
      insertObjectsError,
    )
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

async function buildRequestRuntime(req: Request): Promise<{
  supabaseAnon: SupabaseUntyped
  supabaseService: SupabaseUntyped
  userId: string
}> {
  const authHeader =
    req.headers.get('Authorization') ?? req.headers.get('authorization')
  if (!authHeader) {
    throw new HttpError(401, 'No autorizado.', 'UNAUTHORIZED', {
      reason: 'missing_authorization_header',
    })
  }

  const SUPABASE_URL = requireEnv('SUPABASE_URL')
  const SUPABASE_ANON_KEY = requireEnv('SUPABASE_ANON_KEY')
  const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: userData, error: userError } = await supabaseAnon.auth.getUser()
  if (userError || !userData?.user) {
    throw new HttpError(401, 'Token inválido.', 'UNAUTHORIZED', {
      reason: userError?.message ?? 'invalid_token',
    })
  }

  return {
    supabaseAnon,
    supabaseService,
    userId: userData.user.id,
  }
}

async function createStructuredResponseWithRetry<TOutput = unknown>(
  svc: OpenAIService,
  options: StructuredResponseOptions,
): Promise<StructuredResponseResult<TOutput>> {
  let lastResult: StructuredResponseResult<TOutput> | null = null

  for (const [attempt, waitMs] of OPENAI_CREATE_RETRY_DELAYS_MS.entries()) {
    if (waitMs > 0) await delay(waitMs)

    const result = await svc.createStructuredResponse<TOutput>(options)
    if (result.ok) return result

    lastResult = result
    if (
      attempt === OPENAI_CREATE_RETRY_DELAYS_MS.length - 1 ||
      !isRetryableOpenAIFailure(result)
    ) {
      return result
    }

    console.warn('[learning-object-generate] retrying OpenAI create', {
      attempt: attempt + 1,
      code: result.code,
      message: result.message,
    })
  }

  return (
    lastResult ?? {
      ok: false,
      code: 'OpenAIRequestFailed',
      message: 'No se pudo iniciar la generación con OpenAI.',
    }
  )
}

async function synchronizeGenerationJob(args: {
  supabaseService: SupabaseUntyped
  userId: string
  job: Record<string, unknown>
  jobId: string
  responseId?: string | null
}) {
  let job = args.job
  const estado = String(job.estado ?? '')

  if (estado === 'completed' || estado === 'failed') {
    return await fetchGenerationArtifacts({
      supabaseService: args.supabaseService,
      job,
      responseStatus: null,
    })
  }

  if (isNeedsReviewFresh(job)) {
    return await fetchGenerationArtifacts({
      supabaseService: args.supabaseService,
      job,
      responseStatus: null,
    })
  }

  const responseId = args.responseId ?? stringValue(job.openai_response_id)
  if (!responseId) {
    if (isActiveJobTimedOut(job) || estado === 'needs_review') {
      const message =
        estado === 'needs_review'
          ? 'La generación quedó en revisión sin response ID de OpenAI. Puedes volver a intentarlo.'
          : activeJobTimeoutMessage()

      await updateGenerationJob(args.supabaseService, args.jobId, {
        estado: 'failed',
        error: message,
        completado_en: new Date().toISOString(),
      })
      job = { ...job, estado: 'failed', error: message }

      return await fetchGenerationArtifacts({
        supabaseService: args.supabaseService,
        job,
        responseStatus: 'missing_response_id',
      })
    }

    return await fetchGenerationArtifacts({
      supabaseService: args.supabaseService,
      job,
      responseStatus: null,
    })
  }

  const svc = OpenAIService.fromEnv()
  if (!(svc instanceof OpenAIService)) {
    throw new HttpError(
      500,
      'Configuración de OpenAI incompleta.',
      'OPENAI_MISCONFIGURED',
      svc,
    )
  }

  const aiResult =
    await svc.retrieveStructuredResponse<GeneratedOutput>(responseId)
  if (!aiResult.ok) {
    const status = getOpenAIFailureStatus(aiResult.cause)
    if (status === 404) {
      const message = 'No se encontró el response ID guardado en OpenAI.'
      await updateGenerationJob(args.supabaseService, args.jobId, {
        estado: 'failed',
        error: message,
        completado_en: new Date().toISOString(),
      })
      job = { ...job, estado: 'failed', error: message }

      return await fetchGenerationArtifacts({
        supabaseService: args.supabaseService,
        job,
        responseStatus: 'not_found',
      })
    }

    throw new HttpError(
      aiResult.code === 'MissingEnv' ? 500 : 502,
      'No se pudo consultar el estado de la generación.',
      'OPENAI_REQUEST_FAILED',
      aiResult,
    )
  }

  assertOpenAIResponseMatchesJob(aiResult.openaiRaw, args.jobId)

  const responseStatus = String(aiResult.openaiRaw.status ?? '')
  if (OPENAI_ACTIVE_STATUSES.has(responseStatus)) {
    if (isActiveJobTimedOut(job)) {
      const message = activeJobTimeoutMessage()
      await updateGenerationJob(args.supabaseService, args.jobId, {
        estado: 'failed',
        error: message,
        openai_response_id: aiResult.responseId,
        completado_en: new Date().toISOString(),
      })
      job = {
        ...job,
        estado: 'failed',
        error: message,
        openai_response_id: aiResult.responseId,
      }

      return await fetchGenerationArtifacts({
        supabaseService: args.supabaseService,
        job,
        responseStatus,
        openai: {
          responseId: aiResult.responseId,
          model: aiResult.model,
          usage: aiResult.usage ?? null,
        },
      })
    }

    const nextEstado = responseStatus === 'queued' ? 'queued' : 'running'
    await updateGenerationJob(args.supabaseService, args.jobId, {
      estado: nextEstado,
      openai_response_id: aiResult.responseId,
    })
    job = {
      ...job,
      estado: nextEstado,
      openai_response_id: aiResult.responseId,
    }

    return await fetchGenerationArtifacts({
      supabaseService: args.supabaseService,
      job,
      responseStatus,
      openai: {
        responseId: aiResult.responseId,
        model: aiResult.model,
        usage: aiResult.usage ?? null,
      },
    })
  }

  if (responseStatus !== 'completed') {
    const message = terminalOpenAIStatusMessage(
      responseStatus,
      aiResult.openaiRaw,
    )
    await updateGenerationJob(args.supabaseService, args.jobId, {
      estado: 'failed',
      error: message,
      openai_response_id: aiResult.responseId,
      completado_en: new Date().toISOString(),
    })
    job = {
      ...job,
      estado: 'failed',
      error: message,
      openai_response_id: aiResult.responseId,
    }

    return await fetchGenerationArtifacts({
      supabaseService: args.supabaseService,
      job,
      responseStatus,
      openai: {
        responseId: aiResult.responseId,
        model: aiResult.model,
        usage: aiResult.usage ?? null,
      },
    })
  }

  const claimedJob = await claimGenerationJobCompletion(
    args.supabaseService,
    args.jobId,
    { staleNeedsReviewBefore: staleNeedsReviewCutoffIso() },
  )
  if (!claimedJob) {
    const latestJob = await fetchGenerationJob(args.supabaseService, args.jobId)
    return await fetchGenerationArtifacts({
      supabaseService: args.supabaseService,
      job: latestJob,
      responseStatus,
      openai: {
        responseId: aiResult.responseId,
        model: aiResult.model,
        usage: aiResult.usage ?? null,
      },
    })
  }
  job = claimedJob

  if (!aiResult.output) {
    await updateGenerationJob(args.supabaseService, args.jobId, {
      estado: 'failed',
      error: 'La IA terminó sin devolver contenidos válidos.',
      completado_en: new Date().toISOString(),
    })
    throw new HttpError(
      502,
      'La IA terminó sin devolver contenidos válidos.',
      'AI_OUTPUT_EMPTY',
      aiResult.openaiRaw,
    )
  }

  const sanitizedOutput = sanitizeGeneratedText(aiResult.output)
  const outputParse = GeneratedOutputSchema.safeParse(sanitizedOutput)
  if (!outputParse.success) {
    await updateGenerationJob(args.supabaseService, args.jobId, {
      estado: 'failed',
      error: 'La IA devolvio un JSON fuera del contrato esperado.',
      completado_en: new Date().toISOString(),
    })
    throw new HttpError(
      502,
      'La IA devolvio un JSON fuera del contrato esperado.',
      'AI_OUTPUT_VALIDATION_FAILED',
      outputParse.error,
    )
  }

  try {
    const requestedTypes = requestedTypesFromJob(job)
    const normalizedOutput = normalizeGeneratedOutputForRequest(
      outputParse.data,
      requestedTypes,
    )
    assertGeneratedOrthography(normalizedOutput)

    await persistGeneratedOutput({
      supabaseService: args.supabaseService,
      asignaturaId: String(job.asignatura_id),
      userId: stringValue(job.creado_por) ?? args.userId,
      jobId: args.jobId,
      target: targetFromJob(job),
      output: normalizedOutput,
      aiResult: {
        responseId: aiResult.responseId,
        model: aiResult.model,
        usage: aiResult.usage,
      },
    })

    const completedAt = new Date().toISOString()
    await updateGenerationJob(args.supabaseService, args.jobId, {
      estado: 'completed',
      openai_response_id: aiResult.responseId,
      resultado_json: normalizedOutput as unknown as Json,
      completado_en: completedAt,
    })

    job = {
      ...job,
      estado: 'completed',
      openai_response_id: aiResult.responseId,
      resultado_json: normalizedOutput,
      completado_en: completedAt,
    }
  } catch (error) {
    await updateGenerationJob(args.supabaseService, args.jobId, {
      estado: 'failed',
      error: error instanceof Error ? error.message : String(error),
      completado_en: new Date().toISOString(),
    })
    throw error
  }

  return await fetchGenerationArtifacts({
    supabaseService: args.supabaseService,
    job,
    responseStatus,
    openai: {
      responseId: aiResult.responseId,
      model: aiResult.model,
      usage: aiResult.usage ?? null,
    },
  })
}

async function handleFinalize(req: Request): Promise<Response> {
  const SUPABASE_URL = requireEnv('SUPABASE_URL')
  const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const authHeader =
    req.headers.get('Authorization') ?? req.headers.get('authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

  if (token !== SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(401, 'No autorizado.', 'UNAUTHORIZED', {
      reason: 'invalid_internal_token',
    })
  }

  const rawBody = await readJsonBody(req)
  const parsed = FinalizeRequestSchema.safeParse(rawBody)
  if (!parsed.success) {
    throw new HttpError(
      422,
      formatZodIssues(parsed.error.issues),
      'VALIDATION_ERROR',
      parsed.error,
    )
  }

  const payload: LearningObjectFinalizeRequest = parsed.data
  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const job = await fetchGenerationJob(supabaseService, payload.jobId)
  const storedResponseId = stringValue(job.openai_response_id)
  const responseId = payload.responseId ?? storedResponseId

  if (!responseId) {
    throw new HttpError(
      409,
      'El job no tiene response ID de OpenAI para finalizar.',
      'OPENAI_RESPONSE_ID_MISSING',
      { jobId: payload.jobId },
    )
  }

  if (storedResponseId && responseId !== storedResponseId) {
    throw new HttpError(
      409,
      'El response ID recibido no coincide con el job guardado.',
      'RESPONSE_JOB_MISMATCH',
      { jobId: payload.jobId, storedResponseId, responseId },
    )
  }

  return sendSuccess(
    await synchronizeGenerationJob({
      supabaseService,
      userId: stringValue(job.creado_por) ?? 'system',
      job,
      jobId: payload.jobId,
      responseId,
    }),
  )
}

async function handleStatus(req: Request): Promise<Response> {
  const rawBody = await readJsonBody(req)
  const parsed = StatusRequestSchema.safeParse(rawBody)
  if (!parsed.success) {
    throw new HttpError(
      422,
      formatZodIssues(parsed.error.issues),
      'VALIDATION_ERROR',
      parsed.error,
    )
  }

  const payload: LearningObjectStatusRequest = parsed.data
  const runtime = await buildRequestRuntime(req)
  let job = await fetchGenerationJob(runtime.supabaseService, payload.jobId)

  await assertGenerationJobAccess({
    supabaseAnon: runtime.supabaseAnon,
    job,
  })

  return sendSuccess(
    await synchronizeGenerationJob({
      supabaseService: runtime.supabaseService,
      userId: runtime.userId,
      job,
      jobId: payload.jobId,
    }),
  )
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

    const action = new URL(req.url).pathname.split('/').filter(Boolean).pop()
    if (action === 'finalize') return await handleFinalize(req)
    if (action === 'status') return await handleStatus(req)

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
      throw new HttpError(401, 'Token inválido.', 'UNAUTHORIZED', {
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
    const requestedTypes = payload.requestedTypes

    const activeJob = await fetchActiveGenerationJobForTarget({
      supabaseService,
      asignaturaId: payload.asignaturaId,
      target,
    })
    if (activeJob) {
      const activeJobResponseId = stringValue(activeJob.openai_response_id)
      const shouldSynchronizeActiveJob =
        !isNeedsReviewFresh(activeJob) &&
        (Boolean(activeJobResponseId) || activeJob.estado === 'needs_review')

      return sendSuccess(
        shouldSynchronizeActiveJob
          ? await synchronizeGenerationJob({
              supabaseService,
              userId: user.id,
              job: activeJob,
              jobId: String(activeJob.id),
              responseId: activeJobResponseId,
            })
          : await fetchGenerationArtifacts({
              supabaseService,
              job: activeJob,
              responseStatus: null,
            }),
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
        'Configuración de OpenAI incompleta.',
        'OPENAI_MISCONFIGURED',
        svc,
      )
    }

    const model =
      payload.iaConfig.model ??
      Deno.env.get('LEARNING_OBJECT_GENERATE_MODELO') ??
      'gpt-5-nano'
    const openaiFileIds = payload.iaConfig.archivosReferencia.filter(Boolean)
    const vectorStoreIds = payload.iaConfig.repositoriosIds.filter(Boolean)
    const quickMode = isQuickGenerationRequest(payload.iaConfig)
    const useBackground = !quickMode
    const effectiveReasoningEffort =
      !payload.iaConfig.reasoningEffort ||
      payload.iaConfig.reasoningEffort === 'auto'
        ? 'low'
        : payload.iaConfig.reasoningEffort
    const reasoning = buildReasoningParam(
      model,
      effectiveReasoningEffort as ReasoningEffort,
    )
    const maxOutputTokens = buildMaxOutputTokens(requestedTypes, quickMode)
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
          'Eres un diseñador instruccional universitario experto. Generas contenidos pedagógicos rigurosos, citables y revisables para Acad-IA. Escribes en español con acentos, eñes y ortografía impecable. No generas archivos binarios, PPTX ni paquetes SCORM.',
      },
      ...buildUserContent(prompt, openaiFileIds),
    ]

    const aiResult = await createStructuredResponseWithRetry<GeneratedOutput>(
      svc,
      {
        model,
        ...(useBackground ? { background: true } : {}),
        store: true,
        metadata: {
          tabla: 'learning_objects',
          accion: 'generar',
          id: jobId,
          asignatura_id: payload.asignaturaId,
          scope: target.scope,
          webSearchEnabled: String(payload.iaConfig.webSearchEnabled),
          reasoningEffort: effectiveReasoningEffort ?? 'auto',
          quickMode: String(quickMode),
        },
        safety_identifier: await buildSafetyIdentifier(user.id),
        ...(reasoning ? { reasoning } : {}),
        max_output_tokens: maxOutputTokens,
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
      },
    )

    if (!aiResult.ok) {
      throw new HttpError(
        aiResult.code === 'MissingEnv' ? 500 : 502,
        'No se pudo iniciar la generación de contenidos con IA.',
        'OPENAI_REQUEST_FAILED',
        aiResult,
      )
    }

    const responseStatus = String(aiResult.openaiRaw.status ?? '')
    const nextEstado = responseStatus === 'queued' ? 'queued' : 'running'

    await updateGenerationJob(supabaseService, jobId, {
      estado: nextEstado,
      openai_response_id: aiResult.responseId,
    })

    await registrarInteraccionIA(supabaseService, {
      usuarioId: user.id,
      asignaturaId: payload.asignaturaId,
      tipo: 'GENERAR',
      modelo: aiResult.model,
      openaiFileIds,
      vectorStoreIds,
    })

    if (!useBackground) {
      const foregroundJob = await fetchGenerationJob(supabaseService, jobId)
      return sendSuccess(
        await synchronizeGenerationJob({
          supabaseService,
          userId: user.id,
          job: foregroundJob,
          jobId,
        }),
      )
    }

    return sendSuccess({
      ok: true,
      job: {
        id: jobId,
        estado: nextEstado,
        openai_response_id: aiResult.responseId,
      },
      responseStatus,
      learning_objects: [],
      quality_score: null,
      resumen_generacion: null,
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
      'Ocurrió un error inesperado en el servidor.',
      'INTERNAL_SERVER_ERROR',
    )
  }
})
