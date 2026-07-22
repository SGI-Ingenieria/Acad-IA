import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'

import { corsHeaders } from '../_shared/cors.ts'
import {
  MAX_GENERATION_REFERENCE_IDS,
  normalizeGenerationReferences,
} from '../_shared/ai-generation-references.ts'
import { resolveTenantId } from '../_shared/documentos-academicos.ts'
import {
  buildReferenceTools,
  persistDocumentReferences,
  resolveDocumentReferences,
} from '../_shared/documentos-referencias.ts'
import { buildReasoningParam } from '../_shared/openai-response-controls.ts'
import { OpenAIService } from '../_shared/openai-service.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'

import type { Database, Tables } from '../_shared/database.types.ts'
import type { StructuredResponseOptions } from '../_shared/openai-service.ts'

addEventListener('beforeunload', (ev: any) => {
  console.error('ALERTA: La función se va a apagar. Razón:', ev?.detail?.reason)
})

export type DataAsignaturaSugerida = {
  nombre: Tables<'asignaturas'>['nombre']
  codigo?: Tables<'asignaturas'>['codigo']
  tipo: Tables<'asignaturas'>['tipo'] | null
  creditos: Tables<'asignaturas'>['creditos'] | null
  horasAcademicas?: number | null
  horasIndependientes?: number | null
  descripcion: string
}

const GenerationReferencesSchema = z
  .object({
    fileIds: z.array(z.uuid()).max(MAX_GENERATION_REFERENCE_IDS).default([]),
    collectionIds: z
      .array(z.uuid())
      .max(MAX_GENERATION_REFERENCE_IDS)
      .default([]),
  })
  .strict()
  .default({ fileIds: [], collectionIds: [] })

const AsignaturaSugeridaItemSchema: z.ZodType<DataAsignaturaSugerida> =
  z.object({
    nombre: z.string().describe('Nombre de la asignatura a crear'),
    codigo: z
      .string()
      .optional()
      .nullable()
      .describe(
        "Código o clave de la asignatura. Un string único que la identifique, como 'MAT101' o 'FIS202'. Opcional, pero recomendado para evitar confusiones.",
      ),
    tipo: z.enum(['TRONCAL', 'OBLIGATORIA', 'OPTATIVA', 'OTRA']).nullable(),
    creditos: z.number().nullable(),
    horasAcademicas: z.number().optional().nullable(),
    horasIndependientes: z.number().optional().nullable(),
    descripcion: z.string().max(200),
  })

const RequestSchema = z
  .object({
    plan_estudio_id: z.string().uuid(),
    // numero_de_ciclo: z.number().int().positive(), // ya no se usa
    enfoque: z.string().trim().min(1).optional(),
    cantidad_de_sugerencias: z.number().int().positive().max(15),
    sugerencias_conservadas: z
      .array(
        z.object({
          nombre: z.string().trim().min(1),
          descripcion: z.string().trim().min(1),
        }),
      )
      .default([]),
    references: GenerationReferencesSchema,
    webSearchEnabled: z.boolean().optional().default(false),
    reasoning_effort: z
      .enum(['auto', 'none', 'low', 'medium', 'high'])
      .default('auto'),
  })
  .strict()

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function formatZodIssues(issues: Array<z.ZodIssue>): string {
  return issues
    .map((issue, i) => {
      const path = issue.path.length ? issue.path.join('.') : '(root)'
      return `${i + 1}. ${path}: ${issue.message}`
    })
    .join('\n')
}

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url)
  const functionName = url.pathname.split('/').pop()
  console.log(
    `[${new Date().toISOString()}][${functionName}]: Request received`,
  )

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const method = req.method
    if (method !== 'POST') {
      throw new HttpError(405, 'Método no permitido.', 'METHOD_NOT_ALLOWED', {
        method,
      })
    }

    const authHeaderRaw =
      req.headers.get('Authorization') ?? req.headers.get('authorization')
    if (!authHeaderRaw) {
      throw new HttpError(401, 'No autorizado.', 'UNAUTHORIZED', {
        reason: 'missing_authorization_header',
      })
    }

    const contentType = (req.headers.get('content-type') || '').toLowerCase()
    if (!contentType.includes('application/json')) {
      throw new HttpError(
        415,
        'Content-Type no soportado.',
        'UNSUPPORTED_MEDIA_TYPE',
        { contentType },
      )
    }

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch (e) {
      throw new HttpError(400, 'Body JSON inválido.', 'INVALID_JSON', {
        cause: e,
      })
    }

    const validated = RequestSchema.safeParse(rawBody)
    if (!validated.success) {
      throw new HttpError(
        422,
        formatZodIssues(validated.error.issues),
        'VALIDATION_ERROR',
        validated.error,
      )
    }

    const {
      plan_estudio_id,
      // numero_de_ciclo,
      enfoque,
      cantidad_de_sugerencias,
      sugerencias_conservadas,
      references: rawReferences,
      webSearchEnabled,
      reasoning_effort,
    } = validated.data
    const references = normalizeGenerationReferences(rawReferences)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
      throw new HttpError(
        500,
        'Configuración del servidor incompleta.',
        'MISSING_ENV',
        {
          missing: [
            !SUPABASE_URL ? 'SUPABASE_URL' : null,
            !SUPABASE_ANON_KEY ? 'SUPABASE_ANON_KEY' : null,
            !SERVICE_ROLE_KEY ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
          ].filter(Boolean),
        },
      )
    }

    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeaderRaw } },
    })
    const { data: userData, error: userError } =
      await supabaseAnon.auth.getUser()
    if (userError || !userData.user) {
      throw new HttpError(401, 'Token inválido.', 'UNAUTHORIZED', {
        reason: userError?.message ?? 'invalid_token',
      })
    }

    const supabaseService = createClient<Database>(
      SUPABASE_URL,
      SERVICE_ROLE_KEY,
    )

    const { data: puedeUsarIA, error: authzError } = await supabaseService.rpc(
      'usuario_puede_usar_ia_plan',
      {
        p_usuario_id: userData.user.id,
        p_plan_id: plan_estudio_id,
      },
    )

    if (authzError) {
      throw new HttpError(
        500,
        'No se pudo validar el estado del plan.',
        'AUTHZ_ERROR',
        authzError,
      )
    }

    if (!puedeUsarIA) {
      throw new HttpError(
        403,
        'Este plan de estudios ya no permite generar sugerencias con IA porque se encuentra en una etapa de revisión o aprobación.',
        'PLAN_IA_FROZEN',
        { plan_estudio_id },
      )
    }

    // Model name controlled via env var
    const GENERATE_SUBJECT_SUGGESTIONS_MODELO =
      Deno.env.get('GENERATE_SUBJECT_SUGGESTIONS_MODELO') ?? 'gpt-5-mini'

    const { data: plan, error: planError } = await supabaseService
      .from('planes_estudio')
      .select(
        'id,nombre,nombre_propuesto,nombre_display,carreras(nivel),tipo_ciclo,numero_ciclos,datos',
      )
      .eq('id', plan_estudio_id)
      .single()
    if (planError) {
      const maybeCode = (planError as { code?: string }).code
      if (maybeCode === 'PGRST116') {
        throw new HttpError(
          404,
          'No se encontró el plan de estudio.',
          'NOT_FOUND',
          { table: 'planes_estudio', id: plan_estudio_id },
        )
      }
      throw new HttpError(
        500,
        'No se pudo obtener el plan de estudio.',
        'SUPABASE_QUERY_FAILED',
        planError,
      )
    }

    const { data: asignaturas, error: asignaturasError } = await supabaseService
      .from('asignaturas')
      .select('id,nombre,numero_ciclo,codigo,tipo,creditos')
      .eq('plan_estudio_id', plan_estudio_id)
    if (asignaturasError) {
      throw new HttpError(
        500,
        'No se pudieron obtener las asignaturas del plan de estudio.',
        'SUPABASE_QUERY_FAILED',
        asignaturasError,
      )
    }

    const existingNames = new Set(
      (asignaturas ?? []).map((a) => normalizeName(a.nombre)).filter(Boolean),
    )

    const conservedNames = new Set(
      (sugerencias_conservadas ?? [])
        .map((s) => normalizeName(s.nombre))
        .filter(Boolean),
    )

    const forbiddenNames = Array.from(
      new Set([...existingNames, ...conservedNames]),
    )

    const asignaturasResumen = (asignaturas ?? [])
      .map((a) => {
        const ciclo = a.numero_ciclo == null ? '(sin ciclo)' : a.numero_ciclo
        const codigo = a.codigo ? ` - ${a.codigo}` : ''
        return `- [ciclo ${ciclo}] ${a.nombre}${codigo}`
      })
      .join('\n')

    const sugerenciasConservadasResumen = (sugerencias_conservadas ?? [])
      .map((s) => `- ${s.nombre}: ${s.descripcion}`)
      .join('\n')

    const systemPrompt =
      'Eres un asistente experto en diseño curricular. Responde únicamente con JSON válido que cumpla estrictamente el esquema proporcionado.'
    const planNombre =
      plan.nombre_display ?? plan.nombre_propuesto ?? plan.nombre

    const userPrompt =
      `Necesito sugerencias NUEVAS de asignaturas para un plan de estudios.\n\n` +
      `Plan de estudio:\n` +
      `- id: ${plan.id}\n` +
      `- nombre: ${planNombre}\n` +
      `- nivel: ${plan.carreras.nivel}\n` +
      `- tipo_ciclo: ${plan.tipo_ciclo}\n` +
      `- numero_ciclos: ${plan.numero_ciclos}\n\n` +
      `Datos del plan (JSON):\n${JSON.stringify(plan.datos)}\n\n` +
      `Asignaturas existentes en el plan (NO repetir):\n${
        asignaturasResumen || '(ninguna)'
      }\n\n` +
      `Sugerencias conservadas por el usuario (NO repetir):\n${
        sugerenciasConservadasResumen || '(ninguna)'
      }\n\n` +
      `Enfoque (opcional): ${enfoque ?? '(ninguno)'}\n\n` +
      `Requisitos estrictos:\n` +
      `1) Genera EXACTAMENTE ${cantidad_de_sugerencias} sugerencias.\n` +
      `2) No repitas nombres que ya existan en el plan ni los nombres de las sugerencias conservadas.\n` +
      `3) Tampoco repitas nombres entre tus nuevas sugerencias.\n` +
      `4) Evita nombres demasiado similares (diferencias solo por mayúsculas, tildes, signos o palabras triviales).\n` +
      `5) Cada sugerencia debe incluir un nombre y una descripción clara y útil (sin pasarse del límite de 200 caracteres).\n\n` +
      `Lista de nombres prohibidos (normalizados):\n` +
      forbiddenNames.map((n) => `- ${n}`).join('\n')

    const documentReferences = await resolveDocumentReferences({
      supabase: supabaseService,
      userId: userData.user.id,
      fileIds: references.fileIds,
      collectionIds: references.collectionIds,
      query: userPrompt,
      conversationId: null,
    })
    const promptWithReferences = documentReferences.context
      ? `${userPrompt}\n\n${documentReferences.context}`
      : userPrompt

    const AsignaturaSugeridaSchema = z
      .object({
        sugerencias: z
          .array(AsignaturaSugeridaItemSchema)
          .length(cantidad_de_sugerencias)
          .describe(
            `Arreglo de ${cantidad_de_sugerencias} sugerencias de asignatura`,
          ),
      })
      .describe(
        `Respuesta estructurada con ${cantidad_de_sugerencias} sugerencias de asignatura`,
      )
    const reasoning = buildReasoningParam(
      GENERATE_SUBJECT_SUGGESTIONS_MODELO,
      reasoning_effort,
    )

    const svc = OpenAIService.fromEnv()
    if (!(svc instanceof OpenAIService)) {
      throw new HttpError(
        500,
        'Configuración del servidor incompleta.',
        'OPENAI_MISCONFIGURED',
        svc,
      )
    }

    const options: StructuredResponseOptions = {
      model: GENERATE_SUBJECT_SUGGESTIONS_MODELO,
      ...(reasoning ? { reasoning } : {}),
      tools: buildReferenceTools({
        webSearchEnabled,
        vectorStoreId: documentReferences.vectorStoreId,
      }),
      input: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: promptWithReferences,
            },
            ...documentReferences.inputFiles,
          ],
        },
      ],
      text: {
        format: zodTextFormat(
          AsignaturaSugeridaSchema,
          'estructura_asignaturas',
        ),
      },
    }

    const aiResult =
      await svc.createStructuredResponse<
        typeof AsignaturaSugeridaSchema._output
      >(options)
    if (!aiResult.ok) {
      const status = aiResult.code === 'MissingEnv' ? 500 : 502
      throw new HttpError(
        status,
        'No se pudieron generar sugerencias con IA.',
        'OPENAI_REQUEST_FAILED',
        aiResult,
      )
    }

    if (documentReferences.mode !== 'none') {
      await persistDocumentReferences({
        supabase: supabaseService,
        tenantId: await resolveTenantId(supabaseService, userData.user.id),
        requestId: aiResult.responseId,
        conversationType: 'asignatura',
        // El wizard aún no tiene conversación ni asignatura persistida; el plan
        // es su contexto estable y permite conservar la evidencia del request.
        conversationId: plan_estudio_id,
        references: documentReferences.references,
        mode: documentReferences.mode,
        query: userPrompt,
      })
    }

    let output = aiResult.output ?? null
    if (output == null && aiResult.outputText) {
      try {
        output = JSON.parse(aiResult.outputText)
      } catch {
        throw new HttpError(
          502,
          'La respuesta de la IA no es JSON válido.',
          'OPENAI_INVALID_JSON',
          { outputText: aiResult.outputText },
        )
      }
    }
    if (output == null) {
      throw new HttpError(
        502,
        'La respuesta de la IA no contiene salida estructurada.',
        'OPENAI_MISSING_STRUCTURED_OUTPUT',
        { outputText: aiResult.outputText ?? null },
      )
    }

    const parsed = AsignaturaSugeridaSchema.safeParse(output)
    if (!parsed.success) {
      throw new HttpError(
        502,
        'La salida estructurada no coincide con el esquema esperado.',
        'OPENAI_SCHEMA_MISMATCH',
        parsed.error,
      )
    }

    console.log(
      `[${new Date().toISOString()}][${functionName}]: Request processed successfully`,
    )
    return sendSuccess(parsed.data.sugerencias)
  } catch (error) {
    if (error instanceof HttpError) {
      console.error(
        `[${new Date().toISOString()}][${functionName}] ⚠️ Handled Error:`,
        {
          message: error.message,
          code: error.code,
          internalDetails: error.internalDetails || 'N/A',
        },
      )

      return sendError(error.status, error.message, error.code)
    }

    const unexpectedError =
      error instanceof Error ? error : new Error(String(error))

    console.error(
      `[${new Date().toISOString()}][${functionName}] 💥 CRITICAL UNHANDLED ERROR:`,
      unexpectedError.stack || unexpectedError.message,
    )

    return sendError(
      500,
      'Ocurrió un error inesperado en el servidor.',
      'INTERNAL_SERVER_ERROR',
    )
  }
})
