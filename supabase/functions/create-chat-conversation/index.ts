import { Hono } from 'hono'

import { registrarInteraccionIA } from '../_shared/interacciones-ia.ts'
import { OpenAIService } from '../_shared/openai-service.ts'

import { corsHeaders, withCors } from './lib/cors.ts'
import { HttpError, jsonResponse } from './lib/errors.ts'
import { getOpenAI } from './lib/openai.ts'
import {
  assertUuid,
  getAsignaturaSystemPrompt,
  pickSchemaAsignaturaFields,
  pickSchemaFields,
  safePlanForPrompt,
} from './lib/plan.ts'
import { getSupabaseServiceClient, requireUser } from './lib/supabase.ts'

import type { StructuredResponseOptions } from '../_shared/openai-service.ts'

type CreateBody = {
  plan_estudio_id: string
  asignatura_id?: string
  instanciador?: string
  system_prompt?: string
  nombre?: string
}

type AddMessageBody = {
  // Guarda mensaje en OpenAI conversation
  content: string
  // IDs de archivos ya subidos a OpenAI (files) para usarlos como referencia.
  archivosReferencia?: Array<string>
  // IDs de vector stores de OpenAI para file_search.
  repositoriosIds?: Array<string>
  // Si quieres forzar mejoras estructuradas:
  campos?: Array<string>
  user_prompt?: string // si no mandas, usa content
  model?: string // default gpt-5-nano
  webSearchEnabled?: boolean
  reasoningEffort?: ReasoningEffort
}

type ReasoningEffort = 'auto' | 'none' | 'low' | 'medium' | 'high'

const app = new Hono()

type BeforeUnloadWithDetail = Event & { detail?: { reason?: unknown } }

addEventListener('beforeunload', (ev: BeforeUnloadWithDetail) => {
  console.error('ALERTA: La función se va a apagar. Razón:', ev.detail?.reason)
})

// Preflight CORS
app.options(
  '*',
  (_c) => new Response(null, { status: 204, headers: corsHeaders }),
)

const prefix = '/create-chat-conversation'
// Model names (module-level) — pueden ser sobrescritos por variables de entorno
const CREATE_CHAT_CONVERSATION_NONSTRUCTURED_MODELO =
  Deno.env.get('CREATE_CHAT_CONVERSATION_NONSTRUCTURED_MODELO') ?? 'gpt-5-nano'
const CREATE_CHAT_CONVERSATION_STRUCTURED_MODELO =
  Deno.env.get('CREATE_CHAT_CONVERSATION_STRUCTURED_MODELO') ?? 'gpt-5-nano'

const buildResponseTools = (
  vectorStoreIds: Array<string>,
  webSearchEnabled = false,
): StructuredResponseOptions['tools'] => {
  const tools: NonNullable<StructuredResponseOptions['tools']> = []

  if (vectorStoreIds.length > 0) {
    tools.push({
      type: 'file_search',
      vector_store_ids: vectorStoreIds,
    })
  }

  if (webSearchEnabled) {
    tools.push({
      type: 'web_search',
    })
  }

  return tools.length > 0 ? tools : undefined
}

function buildChatReasoningParam(
  model: string,
  effort?: ReasoningEffort | null,
): { effort: Exclude<ReasoningEffort, 'auto'> } | undefined {
  if (!effort || effort === 'auto') return undefined

  if (effort === 'none' && !supportsNoReasoning(model)) {
    throw new HttpError(
      422,
      'unsupported_reasoning_effort',
      'El nivel de razonamiento "Ninguno" solo esta disponible para modelos GPT-5.1 o superiores. Elige Auto, Bajo, Medio o Alto.',
      { model, effort },
    )
  }

  return { effort }
}

function supportsNoReasoning(model: string): boolean {
  const normalized = model.toLowerCase()
  return normalized.includes('gpt-5.1') || normalized.includes('gpt-5-1')
}

function sanitizeConversationName(name: unknown): string | undefined {
  if (typeof name !== 'string') return undefined

  const trimmed = name.replace(/\s+/g, ' ').trim()
  return trimmed ? trimmed.slice(0, 80) : undefined
}

app.get(`${prefix}/health`, (_c) => withCors(jsonResponse({ ok: true })))

/**
 * POST /conversations
 * Crea conversación OpenAI + registro en conversaciones_plan
 */
app.post(`${prefix}/plan/conversations`, async (c) => {
  try {
    const auth = c.req.header('authorization')
    const user = await requireUser(auth)

    const body = (await c.req.json().catch(() => ({}))) as Partial<CreateBody>
    const plan_estudio_id = body.plan_estudio_id
    assertUuid(plan_estudio_id ?? '', 'plan_estudio_id')

    const instanciador = user.email ?? user.id ?? body.instanciador ?? 'unknown'
    const nombre = sanitizeConversationName(body.nombre)
    const system_prompt =
      body.system_prompt ??
      'En caso de que te pidan algo que no tiene nada que ver con planes de estudio o asignatura responde con un refusal.'

    const supabase = getSupabaseServiceClient()
    const openai = getOpenAI()

    // Cargar plan + estructura
    const { data: plan, error: planErr } = await supabase
      .from('planes_estudio')
      .select('*, estructuras_plan (definicion)')
      .eq('id', plan_estudio_id)
      .single()

    if (planErr || !plan) {
      throw new HttpError(
        404,
        'plan_not_found',
        'Plan de estudio no encontrado',
        planErr,
      )
    }

    // Crear conversación en OpenAI
    const conv = await openai.conversations.create({
      metadata: {
        tabla: 'planes_estudio',
        id: plan.id,
        instanciador,
      },
      items: [{ type: 'message', role: 'system', content: system_prompt }],
    })

    // Crear registro en Supabase
    const { data: row, error: insErr } = await supabase
      .from('conversaciones_plan')
      .insert({
        openai_conversation_id: conv.id,
        plan_estudio_id: plan.id,
        estado: 'ACTIVA',
        creado_por: user.id,
        ...(nombre ? { nombre } : {}),
      })
      .select('id, plan_estudio_id, openai_conversation_id, estado, nombre')
      .single()

    if (insErr || !row) {
      // rollback best-effort
      try {
        await openai.conversations.delete(conv.id)
      } catch {
        /* ignore rollback */
      }
      throw new HttpError(
        500,
        'db_insert_failed',
        'No se pudo registrar la conversación',
        insErr,
      )
    }

    return withCors(jsonResponse({ conversation_plan: row }, 201))
  } catch (err) {
    return withCors(handleErr(err))
  }
})
app.post(`${prefix}/asignatura/conversations`, async (c) => {
  try {
    const auth = c.req.header('authorization')
    const user = await requireUser(auth)

    const body = (await c.req.json().catch(() => ({}))) as Partial<CreateBody>
    const asignatura_id = body.asignatura_id
    assertUuid(asignatura_id ?? '', 'asignatura_id')

    const instanciador = user.email ?? user.id ?? body.instanciador ?? 'unknown'
    const nombre = sanitizeConversationName(body.nombre)
    const system_prompt =
      body.system_prompt ??
      'Eres un asistente experto en currículo académico. Si te piden algo ajeno a la asignatura, responde con un refusal.'

    const supabase = getSupabaseServiceClient()
    const openai = getOpenAI()

    // 1. Verificar que la asignatura existe
    const { data: asignatura, error: asigErr } = await supabase
      .from('asignaturas')
      .select('*')
      .eq('id', asignatura_id)
      .single()

    if (asigErr || !asignatura) {
      throw new HttpError(
        404,
        'asignatura_not_found',
        'Asignatura no encontrada',
      )
    }

    // 2. Crear conversación en OpenAI
    const conv = await openai.conversations.create({
      metadata: {
        tabla: 'asignaturas',
        id: asignatura.id,
        instanciador,
      },
      items: [{ type: 'message', role: 'system', content: system_prompt }],
    })

    // 3. Insertar en conversaciones_asignatura (coincidiendo con tu SQL)
    const { data: row, error: insErr } = await supabase
      .from('conversaciones_asignatura')
      .insert({
        openai_conversation_id: conv.id,
        asignatura_id: asignatura.id,
        estado: 'ACTIVA',
        conversacion_json: [],
        creado_por: user.id,
        ...(nombre ? { nombre } : {}),
      })
      .select('id, asignatura_id, openai_conversation_id, estado, nombre')
      .single()

    if (insErr || !row) {
      try {
        await openai.conversations.delete(conv.id)
      } catch {
        /* ignore rollback */
      }
      throw new HttpError(
        500,
        'db_insert_failed',
        'Error al registrar conversación',
        insErr,
      )
    }

    return withCors(jsonResponse({ conversation_asignatura: row }, 201))
  } catch (err) {
    return withCors(handleErr(err))
  }
})

/**
 * POST /conversations/:conversation_plan_id/messages
 * Agrega mensaje y opcionalmente solicita respuesta estructurada (json_schema)
 */
app.post(`${prefix}/conversations/plan/:id/messages`, async (c) => {
  try {
    const conversation_plan_id = c.req.param('id')
    assertUuid(conversation_plan_id, 'conversation_plan_id')

    const user = await requireUser(c.req.header('authorization'))

    const body = (await c.req
      .json()
      .catch(() => ({}))) as Partial<AddMessageBody>
    if (!body.content || typeof body.content !== 'string') {
      throw new HttpError(400, 'bad_input', 'content es requerido')
    }

    console.log('Iniciando generación en background para mensaje_id:')
    const supabase = getSupabaseServiceClient()
    const svc = OpenAIService.fromEnv()
    if (!(svc instanceof OpenAIService)) {
      throw new HttpError(
        500,
        'openai_misconfigured',
        'OpenAI no está configurado',
        svc,
      )
    }

    // 1. Validar existencia y estado de la conversación
    const { data: row, error } = await supabase
      .from('conversaciones_plan')
      .select(
        'id, openai_conversation_id, plan_estudio_id, estado, planes_estudio(*, estructuras_plan(definicion))',
      )
      .eq('id', conversation_plan_id)
      .single()

    if (error || !row)
      throw new HttpError(404, 'not_found', 'Conversación no encontrada')
    if (row.estado === 'ARCHIVADA')
      throw new HttpError(409, 'archived', 'Conversación archivada')

    const plan =
      (row as unknown as { planes_estudio?: Record<string, unknown> | null })
        .planes_estudio ?? null
    const definicion = (
      plan?.['estructuras_plan'] as Record<string, unknown> | null
    )?.['definicion']
    const isStructured = !!definicion

    // 2. Insertar el mensaje en estado PENDIENTE
    // Guardamos los metadatos necesarios para procesar la respuesta después
    const { data: mensajeInsertado, error: insertErr } = await supabase
      .from('plan_mensajes_ia')
      .insert({
        conversacion_plan_id: conversation_plan_id,
        enviado_por: user.id,
        mensaje: body.content,
        campos: body.campos ?? [],
        estado: 'PROCESANDO', // Estado inicial
      })
      .select()
      .single()

    if (insertErr)
      throw new HttpError(500, 'db_error', 'No se pudo crear el registro')

    // 3. Preparar Schema y Prompt
    const schema = isStructured
      ? pickSchemaFields(definicion, body.campos ?? [])
      : {
          type: 'object',
          properties: {
            'ai-message': { type: 'string' },
            is_refusal: { type: 'boolean' },
          },
        }

    const openaiFileIds = (body.archivosReferencia ?? []).filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    )
    const vectorStoreIds = (body.repositoriosIds ?? []).filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    )
    console.log('Analizando vectores')

    console.log(body.repositoriosIds)
    console.log(vectorStoreIds)

    const promptText = body.user_prompt ?? body.content
    const userContent = openaiFileIds.length
      ? [
          ...openaiFileIds.map((id) => ({
            type: 'input_file' as const,
            file_id: id,
          })),
          {
            type: 'input_text' as const,
            text: `Usa estos archivos como referencia.\n\n${promptText}`,
          },
        ]
      : promptText

    // 4. Llamada asincrónica a OpenAI con Webhook
    // Nota: El SDK de OpenAI permite pasar webhooks en ciertos modelos/endpoints
    console.log('mandando a openaai ')
    const modelToUse = isStructured
      ? CREATE_CHAT_CONVERSATION_STRUCTURED_MODELO
      : CREATE_CHAT_CONVERSATION_NONSTRUCTURED_MODELO
    const reasoning = buildChatReasoningParam(modelToUse, body.reasoningEffort)

    const aiResult = await svc.createStructuredResponse({
      conversation: row.openai_conversation_id,
      model: modelToUse,
      background: true, // <--- ESTO ES LO QUE TE FALTABA
      metadata: {
        tabla: 'plan_mensajes_ia',
        mensaje_id: String(mensajeInsertado.id), // Siempre string
        is_structured: String(isStructured),
      },

      tools: buildResponseTools(vectorStoreIds, body.webSearchEnabled === true),
      ...(reasoning ? { reasoning } : {}),
      text: {
        format: {
          type: 'json_schema',
          name: 'definicion',
          schema: schema,
        },
      },
      input: [
        {
          role: 'system',
          content: `Asistente de plan: ${JSON.stringify(safePlanForPrompt(plan))}`,
        },
        { role: 'user', content: userContent },
      ],
    })
    console.log(aiResult)

    if (!aiResult.ok) {
      throw new HttpError(
        500,
        'openai_error',
        'No se pudo encolar la respuesta',
      )
    }

    // 4.5 Registrar mejora estructurada en interacciones_ia (best-effort).
    // Solo cuenta como MEJORAR_SECCION cuando el usuario edita campos
    // específicos del plan; los mensajes conversacionales se omiten.
    if ((body.campos ?? []).length > 0) {
      await registrarInteraccionIA(supabase, {
        usuarioId: user.id,
        tipo: 'MEJORAR_SECCION',
        planEstudioId:
          (row as unknown as { plan_estudio_id?: string }).plan_estudio_id ??
          null,
        conversacionId: conversation_plan_id,
        modelo: modelToUse,
        openaiFileIds,
        vectorStoreIds,
      })
    }

    // 5. Responder al cliente de inmediato
    return withCors(
      jsonResponse({
        ok: true,
        mensaje_id: mensajeInsertado.id,
        openai_response_id: aiResult.responseId, // Para seguimiento
      }),
    )
  } catch (err) {
    return withCors(handleErr(err))
  }
})

app.post(`${prefix}/conversations/asignatura/:id/messages`, async (c) => {
  try {
    const conversation_asig_id = c.req.param('id')
    assertUuid(conversation_asig_id, 'conversation_asig_id')

    const user = await requireUser(c.req.header('authorization'))

    const body = (await c.req
      .json()
      .catch(() => ({}))) as Partial<AddMessageBody>
    if (!body.content || typeof body.content !== 'string') {
      throw new HttpError(400, 'bad_input', 'content es requerido')
    }

    const supabase = getSupabaseServiceClient()
    // Usamos el servicio que ya tienes configurado para background
    const svc = OpenAIService.fromEnv()
    if (!(svc instanceof OpenAIService)) {
      throw new HttpError(
        500,
        'openai_misconfigured',
        'OpenAI no está configurado',
        svc,
      )
    }

    // 1. Traer datos de la asignatura
    const { data: row, error } = await supabase
      .from('conversaciones_asignatura')
      .select(
        `id, openai_conversation_id, asignatura_id, asignaturas(*, estructuras_asignatura(definicion))`,
      )
      .eq('id', conversation_asig_id)
      .single()

    if (error || !row)
      throw new HttpError(404, 'not_found', 'Conversación no encontrada')

    const asignatura =
      (
        row as unknown as {
          asignaturas?: Record<string, unknown> | null
        }
      ).asignaturas ?? null
    const definicion = (
      asignatura?.['estructuras_asignatura'] as Record<string, unknown> | null
    )?.['definicion']
    const campos = body.campos ?? []
    const isStructured = !!definicion && campos.length > 0
    // 2. Insertar el mensaje en estado PROCESANDO (para que el front vea el spinner)
    const { data: mensajeInsertado, error: insertErr } = await supabase
      .from('asignatura_mensajes_ia')
      .insert({
        conversacion_asignatura_id: conversation_asig_id,
        enviado_por: user.id,
        mensaje: body.content,
        campos: body.campos ?? [],
        estado: 'PROCESANDO',
      })
      .select()
      .single()

    if (insertErr)
      throw new HttpError(500, 'db_error', 'No se pudo crear el registro')

    // 3. Preparar Schema (Usando tu lógica de asignatura)
    const schema = isStructured
      ? pickSchemaAsignaturaFields(definicion, body.campos ?? [])
      : {
          type: 'object',
          properties: {
            'ai-message': { type: 'string' },
            is_refusal: { type: 'boolean' },
          },
          required: ['ai-message', 'is_refusal'],
          additionalProperties: false,
        }

    const openaiFileIds = (body.archivosReferencia ?? []).filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    )
    const vectorStoreIds = (body.repositoriosIds ?? []).filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    )
    const promptText = body.user_prompt ?? body.content
    const userContent = openaiFileIds.length
      ? [
          ...openaiFileIds.map((id) => ({
            type: 'input_file' as const,
            file_id: id,
          })),
          {
            type: 'input_text' as const,
            text: `Usa estos archivos como referencia.\n\n${promptText}`,
          },
        ]
      : promptText

    // 4. Llamada asincrónica con background: true
    const modelToUse = isStructured
      ? CREATE_CHAT_CONVERSATION_STRUCTURED_MODELO
      : CREATE_CHAT_CONVERSATION_NONSTRUCTURED_MODELO
    const reasoning = buildChatReasoningParam(modelToUse, body.reasoningEffort)

    const aiResult = await svc.createStructuredResponse({
      conversation: row.openai_conversation_id,
      model: modelToUse,
      background: true, // <--- Ahora sí, activamos el modo background
      metadata: {
        tabla: 'asignatura_mensajes_ia', // El webhook usará esto para saber dónde hacer el UPDATE
        mensaje_id: String(mensajeInsertado.id),
        is_structured: String(isStructured),
        conversation_id: conversation_asig_id, // Extra para el webhook si lo necesita
      },
      tools: buildResponseTools(vectorStoreIds, body.webSearchEnabled === true),
      ...(reasoning ? { reasoning } : {}),
      text: {
        format: {
          type: 'json_schema',
          name: 'mejoras_asignatura',
          schema: schema,
        },
      },
      input: [
        {
          role: 'system',
          content: getAsignaturaSystemPrompt(asignatura, campos),
        },
        { role: 'user', content: userContent },
      ],
    })

    if (!aiResult.ok) {
      throw new HttpError(
        500,
        'openai_error',
        'No se pudo encolar la respuesta',
      )
    }

    // 4.5 Registrar MEJORAR_SECCION (asignatura) en interacciones_ia
    // best-effort, solo cuando hay campos editados.
    if ((body.campos ?? []).length > 0) {
      await registrarInteraccionIA(supabase, {
        usuarioId: user.id,
        tipo: 'MEJORAR_SECCION',
        asignaturaId:
          (row as unknown as { asignatura_id?: string }).asignatura_id ?? null,
        conversacionId: conversation_asig_id,
        modelo: modelToUse,
        openaiFileIds,
        vectorStoreIds,
      })
    }

    // 5. Responder al cliente de inmediato
    return withCors(
      jsonResponse({
        ok: true,
        mensaje_id: mensajeInsertado.id,
        openai_response_id: aiResult.responseId,
      }),
    )
  } catch (err) {
    return withCors(handleErr(err))
  }
})

/**
 * Unknown routes
 */
app.all('*', (c) =>
  withCors(
    jsonResponse(
      {
        error: 'not_found',
        message: `Route ${c.req.url} not found`,
      },
      404,
    ),
  ),
)

function handleErr(err: unknown): Response {
  if (err instanceof HttpError) {
    return jsonResponse(
      { error: err.code, message: err.message, details: err.details ?? null },
      err.status,
    )
  }
  console.error('Unhandled error:', err)
  return jsonResponse(
    { error: 'internal_error', message: 'Unexpected error' },
    500,
  )
}

Deno.serve(app.fetch)
