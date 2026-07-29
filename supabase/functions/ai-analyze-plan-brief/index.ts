import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'

import { corsHeaders } from '../_shared/cors.ts'
import {
  buildReferenceTools,
  resolveDocumentReferences,
} from '../_shared/documentos-referencias.ts'
import { buildReasoningParam } from '../_shared/openai-response-controls.ts'
import { OpenAIService } from '../_shared/openai-service.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'
import {
  construirPromptEncuadre,
  filtrarPreguntasRedundantes,
  INSTRUCCIONES_SISTEMA,
  preguntasDesdeJson,
} from './encuadre.ts'

import type { StructuredResponseOptions } from '../_shared/openai-service.ts'

/**
 * Todo lo que el wizard ya sabe cuando pide el encuadre. Se manda completo a
 * propósito: mientras el modelo no tuvo estos datos, gastaba sus preguntas en
 * volver a pedir el nivel académico o la duración del plan.
 */
const ContextoSchema = z
  .object({
    carrera: z.string().trim().min(1).max(240),
    nivel: z.string().trim().max(120).nullable().optional(),
    facultad: z.string().trim().max(240).nullable().optional(),
    tipoCiclo: z.string().trim().max(60).nullable().optional(),
    numCiclos: z.number().int().min(1).max(99).nullable().optional(),
    semanasPorCiclo: z.number().int().min(1).max(104).nullable().optional(),
    tipoEstructura: z
      .enum(['CURRICULAR', 'NO_CURRICULAR'])
      .nullable()
      .optional(),
    estructura: z.string().trim().max(240).nullable().optional(),
    fechaInicioImparticion: z.string().trim().max(40).nullable().optional(),
    instruccionesAdicionales: z.string().trim().max(4000).nullable().optional(),
  })
  .strict()

const RequestSchema = z
  .object({
    borradorId: z.uuid().nullable().optional(),
    ronda: z.number().int().min(0).max(1),
    contexto: ContextoSchema,
    solicitud: z.string().trim().min(1).max(7000),
    respuestas: z.record(z.string(), z.string().trim().min(1)),
    webSearchEnabled: z.boolean().optional().default(false),
    reasoningEffort: z
      .enum(['auto', 'none', 'low', 'medium', 'high'])
      .optional()
      .default('auto'),
    references: z
      .object({
        fileIds: z.array(z.uuid()).max(20),
        collectionIds: z.array(z.uuid()).max(20),
      })
      .strict(),
  })
  .strict()

// Una opción es una ruta de diseño con su consecuencia declarada, no un
// "sí/no": es lo que permite decidir sin abrir otra ronda de preguntas.
const OpcionSchema = z
  .object({
    etiqueta: z.string().min(1).max(60),
    implicacion: z.string().min(1).max(140),
  })
  .strict()

const PreguntaSchema = z
  .object({
    id: z.string().min(1).max(60),
    pregunta: z.string().min(1).max(180),
    porQue: z.string().min(1).max(180),
    opciones: z.array(OpcionSchema).min(2).max(3),
  })
  .strict()

const OportunidadSchema = z
  .object({
    titulo: z.string().min(1).max(140),
    detalle: z.string().min(1).max(600),
  })
  .strict()

const ReferenteSchema = z
  .object({
    nombre: z.string().min(1).max(180),
    aporte: z.string().min(1).max(400),
    origen: z.enum(['WEB', 'DOCUMENTO', 'CONOCIMIENTO']),
  })
  .strict()

const ResultadoSchema = z
  .object({
    estado: z.enum(['REQUIERE_ACLARACION', 'LISTO', 'INCOMPATIBLE']),
    fundamentos: z
      .object({
        perfilIngreso: z.string().max(1600),
        perfilEgreso: z.string().max(1600),
        finesAprendizaje: z.string().max(1600),
      })
      .strict(),
    contradicciones: z.array(z.string().max(400)).max(8),
    oportunidades: z.array(OportunidadSchema).max(4),
    referentes: z.array(ReferenteSchema).max(6),
    preguntas: z.array(PreguntaSchema).max(2),
    supuestos: z.array(z.string().max(400)).max(8),
    explicacion: z.string().max(240),
  })
  .strict()

function formatIssues(issues: Array<z.ZodIssue>) {
  return issues
    .map((issue) => `${issue.path.join('.') || 'solicitud'}: ${issue.message}`)
    .join('\n')
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      throw new HttpError(405, 'Método no permitido.', 'METHOD_NOT_ALLOWED')
    }

    const authHeader =
      req.headers.get('Authorization') ?? req.headers.get('authorization')
    if (!authHeader) {
      throw new HttpError(401, 'No autorizado.', 'UNAUTHORIZED')
    }

    const parsedRequest = RequestSchema.safeParse(await req.json())
    if (!parsedRequest.success) {
      throw new HttpError(
        422,
        formatIssues(parsedRequest.error.issues),
        'VALIDATION_ERROR',
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceKey) {
      throw new HttpError(
        500,
        'Configuración del servidor incompleta.',
        'MISSING_ENV',
      )
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: authData, error: authError } =
      await supabaseUser.auth.getUser()
    if (authError || !authData.user) {
      throw new HttpError(401, 'Token inválido.', 'UNAUTHORIZED')
    }

    const { data: canUseAI, error: permissionError } = await supabaseUser.rpc(
      'authz_has_permission',
      {
        p_permiso: 'ia.usar',
      },
    )
    if (permissionError || !canUseAI) {
      throw new HttpError(
        403,
        'No tienes permiso para usar la generación asistida.',
        'FORBIDDEN',
      )
    }

    const input = parsedRequest.data
    const supabaseService = createClient(supabaseUrl, serviceKey)
    const documents = await resolveDocumentReferences({
      supabase: supabaseService,
      userId: authData.user.id,
      fileIds: input.references.fileIds,
      collectionIds: input.references.collectionIds,
      query: input.solicitud,
      conversationId: null,
    })

    // El borrador es la fuente autoritativa del hilo: de ahí salen las
    // preguntas de la ronda anterior para citarlas textualmente junto a su
    // respuesta (el cliente sólo envía respuestas indexadas por id).
    let preguntasPrevias: ReturnType<typeof preguntasDesdeJson> = []
    if (input.borradorId && input.ronda > 0) {
      const { data: borradorPrevio } = await supabaseUser
        .from('borradores_diseno_plan')
        .select('preguntas')
        .eq('id', input.borradorId)
        .maybeSingle()
      preguntasPrevias = preguntasDesdeJson(borradorPrevio?.preguntas)
    }

    const prompt = construirPromptEncuadre({
      contexto: input.contexto,
      solicitud: input.solicitud,
      ronda: input.ronda,
      respuestas: input.respuestas,
      preguntasPrevias,
      webSearchEnabled: input.webSearchEnabled,
      documentosContexto: documents.context,
      totalDocumentos: documents.references.length,
    })

    const service = OpenAIService.fromEnv()
    if (!(service instanceof OpenAIService)) {
      throw new HttpError(
        500,
        'Configuración de IA incompleta.',
        'OPENAI_MISCONFIGURED',
      )
    }

    const model = Deno.env.get('AI_ANALYZE_PLAN_BRIEF_MODEL') ?? 'gpt-5-mini'
    const reasoning = buildReasoningParam(model, input.reasoningEffort)

    const options: StructuredResponseOptions = {
      model,
      tools: buildReferenceTools({
        webSearchEnabled: input.webSearchEnabled,
        vectorStoreId: documents.vectorStoreId,
      }),
      ...(reasoning ? { reasoning } : {}),
      input: [
        { role: 'system', content: INSTRUCCIONES_SISTEMA },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            ...documents.inputFiles,
          ],
        },
      ],
      text: {
        format: zodTextFormat(ResultadoSchema, 'encuadre_curricular'),
      },
    }

    const response =
      await service.createStructuredResponse<typeof ResultadoSchema._output>(
        options,
      )
    if (!response.ok) {
      throw new HttpError(
        502,
        'No se pudo analizar el encuadre curricular.',
        'OPENAI_REQUEST_FAILED',
        response,
      )
    }

    const raw =
      response.output ??
      (response.outputText ? JSON.parse(response.outputText) : null)
    const parsedOutput = ResultadoSchema.safeParse(raw)
    if (!parsedOutput.success) {
      throw new HttpError(
        502,
        'La respuesta no cumple el contrato curricular.',
        'OPENAI_SCHEMA_MISMATCH',
        parsedOutput.error,
      )
    }

    const result = parsedOutput.data

    // El prompt prohíbe preguntar lo que el wizard ya capturó; el filtro es la
    // garantía de que una reincidencia no le cueste una ronda al usuario.
    const { conservadas, descartadas } = filtrarPreguntasRedundantes(
      result.preguntas,
    )
    if (descartadas.length) {
      console.warn(
        'encuadre: preguntas descartadas por redundantes',
        descartadas.map((pregunta) => pregunta.pregunta),
      )
    }
    result.preguntas = conservadas

    if (input.ronda >= 1) {
      result.estado = 'LISTO'
      result.preguntas = []
    }
    if (result.estado === 'LISTO') result.preguntas = []
    // Sin preguntas que resolver no queda aclaración pendiente: dejarlo en
    // REQUIERE_ACLARACION bloquearía el wizard sin nada que responder.
    if (result.estado === 'REQUIERE_ACLARACION' && !result.preguntas.length) {
      result.estado = 'LISTO'
    }

    const borradorId = input.borradorId ?? crypto.randomUUID()
    const estado = result.estado === 'LISTO' ? 'LISTO' : 'ACLARANDO'
    const { error: draftError } = await supabaseUser
      .from('borradores_diseno_plan')
      .upsert({
        id: borradorId,
        usuario_id: authData.user.id,
        estado,
        ronda: input.ronda,
        datos_basicos: input.contexto,
        solicitud: {
          texto: input.solicitud,
          webSearchEnabled: input.webSearchEnabled,
          reasoningEffort: input.reasoningEffort,
        },
        analisis: result,
        preguntas: result.preguntas,
        respuestas: input.respuestas,
        referencias: input.references,
        actualizado_en: new Date().toISOString(),
      })
    if (draftError) {
      throw new HttpError(
        500,
        'No se pudo conservar el borrador de encuadre.',
        'DRAFT_PERSIST_FAILED',
        draftError,
      )
    }

    return sendSuccess({
      borradorId,
      ronda: input.ronda,
      ...result,
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return sendError(error.status, error.message, error.code)
    }
    console.error(error)
    return sendError(
      500,
      'Ocurrió un error al analizar el encuadre curricular.',
      'INTERNAL_SERVER_ERROR',
    )
  }
})
