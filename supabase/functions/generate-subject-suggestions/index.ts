import '@supabase/functions-js/edge-runtime.d.ts'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'

import { preflightResponse } from '../_shared/cors.ts'
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
import { resolveStructuredResponseOutput } from '../_shared/openai-response.ts'
import { OpenAIService } from '../_shared/openai-service.ts'
import {
  logEdgeRequest,
  readJsonBody,
  requireJsonContentType,
  requireMethod,
} from '../_shared/request.ts'
import { createAuthenticatedContext } from '../_shared/supabase.ts'
import { edgeErrorResponse, HttpError, sendSuccess } from '../_shared/utils.ts'
import { validateInput } from '../_shared/validation.ts'

import type { Tables } from '../_shared/database.types.ts'
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
  numeroCiclo?: number | null
  lineaCurricular?: string | null
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
    numeroCiclo: z
      .number()
      .int()
      .positive()
      .optional()
      .nullable()
      .describe('Ciclo recomendado dentro del plan. Opcional.'),
    lineaCurricular: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .optional()
      .nullable()
      .describe(
        'Nombre de la línea curricular existente que corresponde, o de una nueva línea necesaria.',
      ),
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

Deno.serve(async (req: Request): Promise<Response> => {
  const functionName = logEdgeRequest(req, 'generate-subject-suggestions')

  if (req.method === 'OPTIONS') {
    return preflightResponse()
  }

  try {
    requireMethod(req, 'POST')
    requireJsonContentType(req)
    const { user, serviceClient: supabaseService } =
      await createAuthenticatedContext(req, {
        missingAuthorizationMessage: 'No autorizado.',
        invalidAuthorizationMessage: 'Token inválido.',
      })
    const rawBody = await readJsonBody(req)

    const validated = validateInput(RequestSchema, rawBody)

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

    const { data: puedeUsarIA, error: authzError } = await supabaseService.rpc(
      'usuario_puede_usar_ia_plan',
      {
        p_usuario_id: user.id,
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

    const { data: lineas, error: lineasError } = await supabaseService
      .from('lineas_plan')
      .select('nombre,orden')
      .eq('plan_estudio_id', plan_estudio_id)
      .order('orden', { ascending: true })
    if (lineasError) {
      throw new HttpError(
        500,
        'No se pudieron obtener las líneas curriculares del plan.',
        'SUPABASE_QUERY_FAILED',
        lineasError,
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

    const lineasResumen = (lineas ?? [])
      .map((linea) => `- ${linea.nombre}`)
      .join('\n')

    const systemPrompt =
      'Eres un asistente experto en diseño curricular. Responde únicamente con JSON válido que cumpla estrictamente el esquema proporcionado.'
    const planNombre =
      plan.nombre_display ?? plan.nombre_propuesto ?? plan.nombre
    const carrera = Array.isArray(plan.carreras)
      ? plan.carreras[0]
      : plan.carreras

    const userPrompt =
      `Necesito sugerencias NUEVAS de asignaturas para un plan de estudios.\n\n` +
      `Plan de estudio:\n` +
      `- id: ${plan.id}\n` +
      `- nombre: ${planNombre}\n` +
      `- nivel: ${carrera?.nivel ?? '(sin nivel)'}\n` +
      `- tipo_ciclo: ${plan.tipo_ciclo}\n` +
      `- numero_ciclos: ${plan.numero_ciclos}\n\n` +
      `Datos del plan (JSON):\n${JSON.stringify(plan.datos)}\n\n` +
      `Asignaturas existentes en el plan (NO repetir):\n${
        asignaturasResumen || '(ninguna)'
      }\n\n` +
      `Sugerencias conservadas por el usuario (NO repetir):\n${
        sugerenciasConservadasResumen || '(ninguna)'
      }\n\n` +
      `Líneas curriculares existentes:\n${lineasResumen || '(ninguna)'}\n\n` +
      `Enfoque (opcional): ${enfoque ?? '(ninguno)'}\n\n` +
      `Requisitos estrictos:\n` +
      `1) Genera EXACTAMENTE ${cantidad_de_sugerencias} sugerencias.\n` +
      `2) No repitas nombres que ya existan en el plan ni los nombres de las sugerencias conservadas.\n` +
      `3) Tampoco repitas nombres entre tus nuevas sugerencias.\n` +
      `4) Evita nombres demasiado similares (diferencias solo por mayúsculas, tildes, signos o palabras triviales).\n` +
      `5) Cada sugerencia debe incluir un nombre y una descripción clara y útil (sin pasarse del límite de 200 caracteres).\n` +
      `6) Propón numeroCiclo cuando el plan tenga ciclos. Debe estar entre 1 y ${
        plan.numero_ciclos ?? 1
      }.\n` +
      `7) Propón lineaCurricular. Si el enfoque menciona una línea curricular concreta, usa exactamente ese nombre. Prioriza una línea existente; sólo propone un nombre nuevo cuando realmente haga falta crearla.\n\n` +
      `8) Si el enfoque contiene “LÍNEA CURRICULAR OBLIGATORIA”, cada sugerencia DEBE pertenecer a esa línea y el campo lineaCurricular debe repetir exactamente su nombre. No sustituyas esa línea por otra.\n\n` +
      `Lista de nombres prohibidos (normalizados):\n` +
      forbiddenNames.map((n) => `- ${n}`).join('\n')

    const documentReferences = await resolveDocumentReferences({
      supabase: supabaseService,
      userId: user.id,
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
        tenantId: await resolveTenantId(supabaseService, user.id),
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

    const output = resolveStructuredResponseOutput(aiResult)
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
    return edgeErrorResponse(error, functionName)
  }
})
