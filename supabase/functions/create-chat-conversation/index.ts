import { Hono } from "hono";

import { registrarInteraccionIA } from "../_shared/interacciones-ia.ts";
import {
  documentFileIds,
  resolveDocumentReferences,
  resolveFrozenDocumentReferences,
} from "../_shared/documentos-referencias.ts";
import { serviceClient } from "../_shared/documentos-academicos.ts";
import { OpenAIService } from "../_shared/openai-service.ts";
import { supportsNoReasoning } from "../_shared/openai-response-controls.ts";

import { corsHeaders, withCors } from "./lib/cors.ts";
import { HttpError, httpErrorResponse, jsonResponse } from "./lib/errors.ts";
import { getEnv } from "./lib/env.ts";
import { getOpenAI } from "./lib/openai.ts";
import { pruneOrphanFunctionCalls } from "./lib/conversation-heal.ts";
import {
  buildIntentSystemPrompt,
  detectUserIntent,
  type UserIntentResult,
} from "./lib/intent.ts";
import {
  assertUuid,
  getAsignaturaEditableFields,
  getPlanEditableFields,
  getProposalSystemPrompt,
  pickProposalSchema,
  safeAsignaturaForPrompt,
  safePlanForPrompt,
} from "./lib/plan.ts";
import { getSupabaseServiceClient, requireUser } from "./lib/supabase.ts";
import { generateInitialChatTitle } from "./lib/chat-title.ts";
import {
  buildChatAttemptOpenAIRequest,
  prepareChatGenerationAttempt,
  publishDurableChatResponse,
  requeueChatGenerationAttempt,
} from "./lib/publication.ts";
import { resolveChatRequest } from "./lib/retry.ts";

import type { StructuredResponseOptions } from "../_shared/openai-service.ts";
import type { AddMessageBody, ReasoningEffort } from "./lib/retry.ts";

type CreateBody = {
  plan_estudio_id: string;
  asignatura_id?: string;
  instanciador?: string;
  system_prompt?: string;
  nombre?: string;
  title_prompt?: string;
  campos?: Array<string>;
};

const app = new Hono();

type BeforeUnloadWithDetail = Event & { detail?: { reason?: unknown } };

addEventListener("beforeunload", (ev: BeforeUnloadWithDetail) => {
  console.error("ALERTA: La función se va a apagar. Razón:", ev.detail?.reason);
});

// Preflight CORS
app.options(
  "*",
  (_c) => new Response(null, { status: 204, headers: corsHeaders }),
);

const prefix = "/create-chat-conversation";
// Model names (module-level) — pueden ser sobrescritos por variables de entorno
const CREATE_CHAT_CONVERSATION_INTENT_MODELO =
  getEnv("CREATE_CHAT_CONVERSATION_INTENT_MODELO") ?? "gpt-5.6-luna";
const CREATE_CHAT_CONVERSATION_NONSTRUCTURED_MODELO =
  getEnv("CREATE_CHAT_CONVERSATION_NONSTRUCTURED_MODELO") ?? "gpt-5.6-luna";
const CREATE_CHAT_CONVERSATION_STRUCTURED_MODELO =
  getEnv("CREATE_CHAT_CONVERSATION_STRUCTURED_MODELO") ?? "gpt-5.6-luna";

const buildResponseTools = (
  webSearchEnabled = false,
  vectorStoreId: string | null = null,
): StructuredResponseOptions["tools"] => {
  const tools: NonNullable<StructuredResponseOptions["tools"]> = [];

  if (webSearchEnabled) {
    tools.push({
      type: "web_search",
    });
  }
  if (vectorStoreId) {
    tools.push({
      type: "file_search",
      vector_store_ids: [vectorStoreId],
    });
  }

  return tools.length > 0 ? tools : undefined;
};

function buildChatReasoningParam(
  model: string,
  effort?: ReasoningEffort | null,
): { effort: Exclude<ReasoningEffort, "auto"> } | undefined {
  if (!effort || effort === "auto") return undefined;

  if (effort === "none" && !supportsNoReasoning(model)) {
    throw new HttpError(
      422,
      "unsupported_reasoning_effort",
      'El nivel de razonamiento "Ninguno" solo esta disponible para modelos GPT-5.1 o superiores. Elige Auto, Bajo, Medio o Alto.',
      { model, effort },
    );
  }

  return { effort };
}

function withMentionedContext(
  content: string,
  mentions: Array<{ sourceMessageId: string; excerpt: string }>,
) {
  if (mentions.length === 0) return content;
  return `${content}\n\nContexto mencionado por el usuario (trátalo como una cita inmutable):\n${
    mentions
      .map((mention) => `> ${mention.excerpt}`)
      .join("\n\n")
  }`;
}

type ChatEntityType = "plan" | "asignatura";

type ChatMessageTable = {
  plan: "plan_mensajes_ia";
  asignatura: "asignatura_mensajes_ia";
};

const MESSAGE_TABLE: ChatMessageTable = {
  plan: "plan_mensajes_ia",
  asignatura: "asignatura_mensajes_ia",
};

function chatMessageTable(type: ChatEntityType) {
  return MESSAGE_TABLE[type];
}

async function setMessageIntent(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  type: ChatEntityType,
  messageId: string,
  intencion: "consultar" | "editar",
  campos: string[],
) {
  const table = chatMessageTable(type);
  const { error } = await supabase
    .from(table)
    .update({ intencion, campos })
    .eq("id", messageId)
    .eq("estado", "PROCESANDO");

  if (error) {
    console.error(`[${type}] Error guardando intencion:`, error);
  }
}

async function completeMessageAsChat(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  type: ChatEntityType,
  messageId: string,
  respuesta: string,
) {
  const table = chatMessageTable(type);
  const { error } = await supabase
    .from(table)
    .update({
      estado: "COMPLETADO",
      respuesta,
      intencion: "consultar",
      propuesta: { recommendations: [] },
      is_refusal: false,
    })
    .eq("id", messageId)
    .eq("estado", "PROCESANDO");

  if (error) {
    console.error(`[${type}] Error guardando respuesta conversacional:`, error);
  }
}

async function completeMessageAsAction(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  messageId: string,
  respuesta: string,
  actionProposals: Array<Record<string, unknown>>,
) {
  const { error } = await supabase
    .from("plan_mensajes_ia")
    .update({
      estado: "COMPLETADO",
      respuesta,
      intencion: "consultar",
      propuesta: {
        recommendations: [],
        action_proposals: actionProposals,
      },
      is_refusal: false,
    } as any)
    .eq("id", messageId)
    .eq("estado", "PROCESANDO");

  if (error) {
    throw new HttpError(
      500,
      "db_error",
      "No se pudo guardar la propuesta de acción.",
      error,
    );
  }
}

function readStructuredOutput(result: any): Record<string, unknown> {
  if (result?.output && typeof result.output === "object") {
    return result.output as Record<string, unknown>;
  }
  if (typeof result?.outputText === "string") {
    return JSON.parse(result.outputText) as Record<string, unknown>;
  }
  throw new HttpError(
    502,
    "ai_error",
    "La IA no devolvió una propuesta estructurada.",
  );
}

async function generateConversationalAction(args: {
  svc: OpenAIService;
  supabase: ReturnType<typeof getSupabaseServiceClient>;
  planId: string;
  action:
    | "proponer_linea"
    | "proponer_asignaturas"
    | "asignar_asignatura"
    | "cambio_ciclo"
    | "eliminar_linea";
  userContent: string;
  cantidad?: number;
  nombre?: string;
  asignaturaNombre?: string;
  lineaNombre?: string;
  numeroCiclo?: number;
}) {
  const {
    svc,
    supabase,
    planId,
    action,
    userContent,
    cantidad = 1,
    nombre,
    asignaturaNombre,
    lineaNombre,
    numeroCiclo,
  } = args;
  const [lineasResult, asignaturasResult] = await Promise.all([
    supabase
      .from("lineas_plan")
      .select("id,nombre,orden")
      .eq("plan_estudio_id", planId)
      .order("orden", { ascending: true }),
    supabase
      .from("asignaturas")
      .select(
        "id,nombre,codigo,tipo,creditos,horas_academicas,horas_independientes,numero_ciclo,linea_plan_id,prerrequisito_asignatura_id",
      )
      .eq("plan_estudio_id", planId)
      .neq("estado", "archivada"),
  ]);

  if (lineasResult.error || asignaturasResult.error) {
    throw new HttpError(
      500,
      "db_error",
      "No se pudo leer el mapa curricular del plan.",
    );
  }

  const mapa = JSON.stringify({
    lineas: lineasResult.data ?? [],
    asignaturas: asignaturasResult.data ?? [],
  });
  if (action === "asignar_asignatura") {
    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    const asignatura = (asignaturasResult.data ?? []).find(
      (item) => normalize(item.nombre) === normalize(asignaturaNombre ?? ""),
    );
    const linea = (lineasResult.data ?? []).find(
      (item) => normalize(item.nombre) === normalize(lineaNombre ?? ""),
    );
    if (!asignatura || !linea) {
      return {
        error: `No encontré ${
          !asignatura ? `la asignatura «${asignaturaNombre ?? ""}»` : ""
        }${!asignatura && !linea ? " ni " : ""}${
          !linea ? `la línea «${lineaNombre ?? ""}»` : ""
        }.`,
      };
    }
    return {
      asignatura_id: asignatura.id,
      asignatura_nombre: asignatura.nombre,
      linea_plan_id: linea.id,
      linea_nombre: linea.nombre,
      numero_ciclo: asignatura.numero_ciclo,
    };
  }
  if (action === "cambio_ciclo") {
    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    const asignatura = (asignaturasResult.data ?? []).find(
      (item) => normalize(item.nombre) === normalize(asignaturaNombre ?? ""),
    );
    if (!asignatura) {
      return {
        error: `No encontré la asignatura «${asignaturaNombre ?? ""}».`,
      };
    }
    return {
      asignatura_id: asignatura.id,
      asignatura_nombre: asignatura.nombre,
      numero_ciclo: numeroCiclo,
      ciclo_anterior: asignatura.numero_ciclo,
    };
  }
  if (action === "eliminar_linea") {
    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    const linea = (lineasResult.data ?? []).find(
      (item) => normalize(item.nombre) === normalize(lineaNombre ?? ""),
    );
    if (!linea) {
      return { error: `No encontré la línea «${lineaNombre ?? ""}».` };
    }
    const afectadas = (asignaturasResult.data ?? []).filter(
      (item) => item.linea_plan_id === linea.id,
    ).length;
    return {
      linea_plan_id: linea.id,
      linea_nombre: linea.nombre,
      asignaturas_afectadas: afectadas,
    };
  }
  const model = getEnv("CREATE_CHAT_CONVERSATION_ACTION_MODELO") ??
    CREATE_CHAT_CONVERSATION_STRUCTURED_MODELO;
  const schema = action === "proponer_linea"
    ? {
      type: "object",
      properties: {
        nombre: { type: "string" },
        color: { type: ["string", "null"] },
        justificacion: { type: "string" },
      },
      required: ["nombre", "color", "justificacion"],
      additionalProperties: false,
    }
    : {
      type: "object",
      properties: {
        sugerencias: {
          type: "array",
          minItems: cantidad,
          maxItems: cantidad,
          items: {
            type: "object",
            properties: {
              nombre: { type: "string" },
              codigo: { type: ["string", "null"] },
              tipo: { type: ["string", "null"] },
              creditos: { type: ["number", "null"] },
              horasAcademicas: { type: ["number", "null"] },
              horasIndependientes: { type: ["number", "null"] },
              numeroCiclo: { type: ["integer", "null"] },
              lineaCurricular: { type: ["string", "null"] },
              descripcion: { type: "string" },
            },
            required: [
              "nombre",
              "codigo",
              "tipo",
              "creditos",
              "horasAcademicas",
              "horasIndependientes",
              "numeroCiclo",
              "lineaCurricular",
              "descripcion",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["sugerencias"],
      additionalProperties: false,
    };
  const prompt = action === "proponer_linea"
    ? `El usuario quiere crear una línea curricular${
      nombre ? ` llamada "${nombre}"` : ""
    } y asignarle después una asignatura existente. Propón la línea solicitada sin repetir las existentes. Devuelve español académico, color hexadecimal opcional y una justificación breve. Solicitud: ${userContent}\nMapa actual: ${mapa}`
    : `El usuario quiere exactamente ${cantidad} asignaturas nuevas para su plan y desea poder seleccionarlas para crearlas. Propón materias distintas a las existentes, con ciclo y línea curricular sugeridos cuando sea posible. Solicitud: ${userContent}\nMapa actual: ${mapa}`;
  const result = await svc.createStructuredResponse({
    model,
    input: [
      {
        role: "system",
        content:
          "Eres un experto en diseño curricular. Devuelve únicamente JSON válido según el esquema.",
      },
      { role: "user", content: prompt },
    ],
    text: {
      format: {
        type: "json_schema",
        name: action === "proponer_linea"
          ? "propuesta_linea_chat"
          : "propuestas_asignaturas_chat",
        strict: true,
        schema,
      },
    },
  });
  if (!result.ok) {
    throw new HttpError(
      502,
      "ai_error",
      "No se pudo generar la propuesta curricular.",
    );
  }
  return readStructuredOutput(result);
}

async function detectChatIntent(args: {
  svc: OpenAIService;
  userContent: string;
  entityType: ChatEntityType;
  entityJson: Record<string, unknown>;
  editableFields: Array<{ key: string; label: string }>;
  explicitlySelectedFields: string[];
  conversationId?: string;
}): Promise<UserIntentResult> {
  const {
    svc,
    userContent,
    entityType,
    entityJson,
    editableFields,
    explicitlySelectedFields,
    conversationId,
  } = args;

  const systemPrompt = buildIntentSystemPrompt({
    entityType,
    entityJson,
    editableFields,
    explicitlySelectedFields,
  });

  return detectUserIntent({
    svc,
    model: CREATE_CHAT_CONVERSATION_INTENT_MODELO,
    userContent,
    systemPrompt,
    conversation: conversationId,
  });
}

function sanitizeConversationName(name: unknown): string | undefined {
  if (typeof name !== "string") return undefined;

  const trimmed = name.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, 80) : undefined;
}

async function assertCanUsePlanIA(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  userId: string,
  planId: string,
) {
  const { data, error } = await supabase.rpc("usuario_puede_usar_ia_plan", {
    p_usuario_id: userId,
    p_plan_id: planId,
  });

  if (error) {
    throw new HttpError(
      500,
      "authz_error",
      "No se pudo validar el estado del plan.",
      error,
    );
  }

  if (!data) {
    throw new HttpError(
      403,
      "plan_ia_frozen",
      "Este plan de estudios ya no permite usar IA porque se encuentra en una etapa de revisión o aprobación.",
    );
  }
}

async function assertCanUseAsignaturaIA(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  userId: string,
  asignaturaId: string,
) {
  const { data, error } = await supabase.rpc(
    "usuario_puede_usar_ia_asignatura",
    {
      p_usuario_id: userId,
      p_asignatura_id: asignaturaId,
    },
  );

  if (error) {
    throw new HttpError(
      500,
      "authz_error",
      "No se pudo validar el estado de la asignatura.",
      error,
    );
  }

  if (!data) {
    throw new HttpError(
      403,
      "asignatura_ia_frozen",
      "Esta asignatura ya no permite usar IA porque su plan de estudios se encuentra en una etapa de revisión o aprobación.",
    );
  }
}

async function resolveGeneratedConversationName(body: Partial<CreateBody>) {
  const titleSeed = typeof body.title_prompt === "string"
    ? body.title_prompt
    : typeof body.nombre === "string"
    ? body.nombre
    : "";
  const fieldKeys = Array.isArray(body.campos) ? body.campos : [];

  if (titleSeed.trim() || fieldKeys.length > 0) {
    return generateInitialChatTitle({
      userMessage: titleSeed,
      fieldKeys,
    });
  }

  return sanitizeConversationName(body.nombre);
}

app.get(`${prefix}/health`, (_c) => withCors(jsonResponse({ ok: true })));

/**
 * POST /conversations
 * Crea conversación OpenAI + registro en conversaciones_plan
 */
app.post(`${prefix}/plan/conversations`, async (c) => {
  try {
    const auth = c.req.header("authorization");
    const user = await requireUser(auth);

    const body = (await c.req.json().catch(() => ({}))) as Partial<CreateBody>;
    const plan_estudio_id = body.plan_estudio_id;
    assertUuid(plan_estudio_id ?? "", "plan_estudio_id");
    if (!plan_estudio_id) {
      throw new HttpError(400, "bad_input", "plan_estudio_id es requerido");
    }

    const instanciador = user.email ?? user.id ?? body.instanciador ??
      "unknown";
    const nombre = sanitizeConversationName(
      await resolveGeneratedConversationName(body),
    );
    const system_prompt = body.system_prompt ??
      "En caso de que te pidan algo que no tiene nada que ver con planes de estudio o asignatura responde con un refusal.";

    const supabase = getSupabaseServiceClient();
    const openai = getOpenAI();
    await assertCanUsePlanIA(supabase, user.id, plan_estudio_id);

    // Cargar plan + estructura
    const { data: plan, error: planErr } = await supabase
      .from("planes_estudio")
      .select(
        "*, estructuras_plan!planes_estudio_estructura_id_fkey (definicion)",
      )
      .eq("id", plan_estudio_id)
      .single();

    if (planErr || !plan) {
      throw new HttpError(
        404,
        "plan_not_found",
        "Plan de estudio no encontrado",
        planErr,
      );
    }

    // Crear conversación en OpenAI
    const conv = await openai.conversations.create({
      metadata: {
        tabla: "planes_estudio",
        id: plan.id,
        instanciador,
      },
      items: [{ type: "message", role: "system", content: system_prompt }],
    });

    // Crear registro en Supabase
    const { data: row, error: insErr } = await supabase
      .from("conversaciones_plan")
      .insert({
        openai_conversation_id: conv.id,
        plan_estudio_id: plan.id,
        estado: "ACTIVA",
        creado_por: user.id,
        ...(nombre ? { nombre } : {}),
      })
      .select("id, plan_estudio_id, openai_conversation_id, estado, nombre")
      .single();

    if (insErr || !row) {
      // rollback best-effort
      try {
        await openai.conversations.delete(conv.id);
      } catch {
        /* ignore rollback */
      }
      throw new HttpError(
        500,
        "db_insert_failed",
        "No se pudo registrar la conversación",
        insErr,
      );
    }

    return withCors(jsonResponse({ conversation_plan: row }, 201));
  } catch (err) {
    return withCors(handleErr(err));
  }
});
app.post(`${prefix}/asignatura/conversations`, async (c) => {
  try {
    const auth = c.req.header("authorization");
    const user = await requireUser(auth);

    const body = (await c.req.json().catch(() => ({}))) as Partial<CreateBody>;
    const asignatura_id = body.asignatura_id;
    assertUuid(asignatura_id ?? "", "asignatura_id");
    if (!asignatura_id) {
      throw new HttpError(400, "bad_input", "asignatura_id es requerido");
    }

    const instanciador = user.email ?? user.id ?? body.instanciador ??
      "unknown";
    const nombre = sanitizeConversationName(
      await resolveGeneratedConversationName(body),
    );
    const system_prompt = body.system_prompt ??
      "Eres un asistente experto en currículo académico. Si te piden algo ajeno a la asignatura, responde con un refusal.";

    const supabase = getSupabaseServiceClient();
    const openai = getOpenAI();
    await assertCanUseAsignaturaIA(supabase, user.id, asignatura_id);

    // 1. Verificar que la asignatura existe
    const { data: asignatura, error: asigErr } = await supabase
      .from("asignaturas")
      .select("*")
      .eq("id", asignatura_id)
      .single();

    if (asigErr || !asignatura) {
      throw new HttpError(
        404,
        "asignatura_not_found",
        "Asignatura no encontrada",
      );
    }

    // 2. Crear conversación en OpenAI
    const conv = await openai.conversations.create({
      metadata: {
        tabla: "asignaturas",
        id: asignatura.id,
        instanciador,
      },
      items: [{ type: "message", role: "system", content: system_prompt }],
    });

    // 3. Insertar en conversaciones_asignatura (coincidiendo con tu SQL)
    const { data: row, error: insErr } = await supabase
      .from("conversaciones_asignatura")
      .insert({
        openai_conversation_id: conv.id,
        asignatura_id: asignatura.id,
        estado: "ACTIVA",
        conversacion_json: [],
        creado_por: user.id,
        ...(nombre ? { nombre } : {}),
      })
      .select("id, asignatura_id, openai_conversation_id, estado, nombre")
      .single();

    if (insErr || !row) {
      try {
        await openai.conversations.delete(conv.id);
      } catch {
        /* ignore rollback */
      }
      throw new HttpError(
        500,
        "db_insert_failed",
        "Error al registrar conversación",
        insErr,
      );
    }

    return withCors(jsonResponse({ conversation_asignatura: row }, 201));
  } catch (err) {
    return withCors(handleErr(err));
  }
});

/**
 * POST /conversations/:conversation_plan_id/messages
 * Agrega mensaje y opcionalmente solicita respuesta estructurada (json_schema)
 */
app.post(`${prefix}/conversations/plan/:id/messages`, async (c) => {
  let insertedMessageId: string | null = null;
  let durableAttemptPrepared = false;

  try {
    const conversation_plan_id = c.req.param("id");
    assertUuid(conversation_plan_id, "conversation_plan_id");

    const user = await requireUser(c.req.header("authorization"));

    const body = (await c.req.json().catch(() => ({}))) as AddMessageBody;

    console.log("Iniciando generación en background para mensaje_id:");
    const supabase = getSupabaseServiceClient();
    const svc = OpenAIService.fromEnv();
    if (!(svc instanceof OpenAIService)) {
      throw new HttpError(
        500,
        "openai_misconfigured",
        "OpenAI no está configurado",
        svc,
      );
    }

    // 1. Validar existencia y estado de la conversación
    const { data: row, error } = await supabase
      .from("conversaciones_plan")
      .select(
        "id, openai_conversation_id, plan_estudio_id, estado, planes_estudio(*, estructuras_plan!planes_estudio_estructura_id_fkey(definicion))",
      )
      .eq("id", conversation_plan_id)
      .single();

    if (error || !row) {
      throw new HttpError(404, "not_found", "Conversación no encontrada");
    }
    if (row.estado === "ARCHIVADA") {
      throw new HttpError(409, "archived", "Conversación archivada");
    }
    await assertCanUsePlanIA(
      supabase,
      user.id,
      (row as unknown as { plan_estudio_id: string }).plan_estudio_id,
    );
    const request = await resolveChatRequest({
      supabase,
      conversationType: "plan",
      conversationId: conversation_plan_id,
      userId: user.id,
      body,
    });

    const plan =
      (row as unknown as { planes_estudio?: Record<string, unknown> | null })
        .planes_estudio ?? null;
    const definicion = (
      plan?.["estructuras_plan"] as Record<string, unknown> | null
    )?.["definicion"];

    // La interfaz los muestra como bloques de conocimiento; en el chat también
    // son las líneas curriculares del plan.
    const { data: lineasCurriculares, error: lineasCurricularesError } =
      await supabase
        .from("lineas_plan")
        .select(
          "id,nombre,orden,area,color,proposito,aporte_perfil_egreso,alcance_formativo",
        )
        .eq("plan_estudio_id", row.plan_estudio_id)
        .order("orden", { ascending: true });

    if (lineasCurricularesError) {
      throw new HttpError(
        500,
        "curricular_lines_read_failed",
        "No se pudieron cargar las líneas curriculares del plan.",
        lineasCurricularesError,
      );
    }

    // 2. Insertar el mensaje en estado PROCESANDO
    // La intencion se resuelve a continuacion (Fase 1).
    const { data: mensajeInsertado, error: insertErr } = await supabase
      .from("plan_mensajes_ia")
      .insert({
        conversacion_plan_id: conversation_plan_id,
        enviado_por: user.id,
        mensaje: request.content,
        campos: request.campos,
        web_search_enabled: request.webSearchEnabled,
        reasoning_effort: request.reasoningEffort,
        retry_of_message_id: request.retryOfMessageId,
        estado: "PROCESANDO",
        intencion: null,
      })
      .select()
      .single();

    if (insertErr) {
      throw new HttpError(500, "db_error", "No se pudo crear el registro");
    }

    insertedMessageId = String(mensajeInsertado.id);

    // 2.5 Fase 1: detectar intencion de edicion vs consulta.
    const editableFields = getPlanEditableFields(definicion);
    const planPromptJson = {
      ...(safePlanForPrompt(plan) ?? {}),
      lineas_curriculares: lineasCurriculares ?? [],
    };
    let editFields = request.campos;

    if (editFields.length === 0) {
      const intent = await detectChatIntent({
        svc,
        userContent: withMentionedContext(request.content, request.mentions),
        entityType: "plan",
        entityJson: planPromptJson,
        editableFields,
        explicitlySelectedFields: editFields,
        conversationId: row.openai_conversation_id,
      });

      if (intent.type === "accion") {
        const actionOutput = await generateConversationalAction({
          svc,
          supabase,
          planId: String((row as any).plan_estudio_id),
          action: intent.accion,
          userContent: withMentionedContext(request.content, request.mentions),
          cantidad: intent.cantidad,
          nombre: intent.nombre,
          asignaturaNombre: intent.asignaturaNombre,
          lineaNombre: intent.lineaNombre,
          numeroCiclo: intent.numeroCiclo,
        });
        const actionProposals = intent.accion === "proponer_linea"
          ? [{ tipo: "linea", ...(actionOutput as Record<string, unknown>) }]
          : intent.accion === "eliminar_linea"
          ? "error" in actionOutput
            ? []
            : [{ tipo: "eliminar_linea", ...actionOutput }]
          : intent.accion === "asignar_asignatura"
          ? "error" in actionOutput
            ? []
            : [{ tipo: "asignacion", ...actionOutput }]
          : intent.accion === "cambio_ciclo"
          ? "error" in actionOutput
            ? []
            : [{ tipo: "cambio_ciclo", ...actionOutput }]
          : (
            (actionOutput.sugerencias as Array<
              Record<string, unknown>
            >) ?? []
          ).map((proposal) => ({ tipo: "asignatura", ...proposal }));
        const actionResponse = intent.accion === "proponer_linea"
          ? `Propongo la línea curricular “${
            String(actionOutput.nombre ?? intent.nombre ?? "")
          }”. ${String(actionOutput.justificacion ?? "")}`
          : intent.accion === "eliminar_linea"
          ? "error" in actionOutput
            ? String(actionOutput.error)
            : `Encontré la línea curricular “${
              String(actionOutput.linea_nombre ?? intent.lineaNombre ?? "")
            }”. Confirma la eliminación para continuar.`
          : intent.accion === "asignar_asignatura"
          ? "error" in actionOutput
            ? String(actionOutput.error)
            : "Preparé el movimiento de la asignatura. Revisa la propuesta y decide si deseas aplicarlo."
          : intent.accion === "cambio_ciclo"
          ? "error" in actionOutput
            ? String(actionOutput.error)
            : `Preparé el cambio de “${
              String(actionOutput.asignatura_nombre ?? "")
            }” al ${
              String(actionOutput.numero_ciclo ?? "")
            }° semestre. Revisa la propuesta y decide si deseas aplicarlo.`
          : `Preparé ${actionProposals.length} propuestas de asignatura para tu plan. Selecciona las que quieras crear.`;
        await completeMessageAsAction(
          supabase,
          insertedMessageId,
          actionResponse,
          actionProposals,
        );
        return withCors(
          jsonResponse({
            ok: true,
            mensaje_id: mensajeInsertado.id,
            openai_response_id: null,
          }),
        );
      }

      if (intent.type === "consulta") {
        await completeMessageAsChat(
          supabase,
          "plan",
          insertedMessageId,
          intent.respuesta,
        );
        return withCors(
          jsonResponse({
            ok: true,
            mensaje_id: mensajeInsertado.id,
            openai_response_id: null,
          }),
        );
      }

      if (intent.type === "clarificacion") {
        await completeMessageAsChat(
          supabase,
          "plan",
          insertedMessageId,
          `${intent.respuesta}\n\n${intent.pregunta}`,
        );
        return withCors(
          jsonResponse({
            ok: true,
            mensaje_id: mensajeInsertado.id,
            openai_response_id: null,
          }),
        );
      }

      editFields = intent.campos;
    }

    const validFieldKeys = new Set(editableFields.map((field) => field.key));
    editFields = editFields.filter((key) => validFieldKeys.has(key));

    if (editFields.length === 0) {
      await completeMessageAsChat(
        supabase,
        "plan",
        insertedMessageId,
        'No detecté un campo editable para mejorar. Puedes seleccionarlo con "/" o indicarme claramente de qué sección quieres trabajar.',
      );
      return withCors(
        jsonResponse({
          ok: true,
          mensaje_id: mensajeInsertado.id,
          openai_response_id: null,
        }),
      );
    }

    await setMessageIntent(
      supabase,
      "plan",
      insertedMessageId,
      "editar",
      editFields,
    );
    request.campos = editFields;

    // 3. Preparar Schema y Prompt de propuesta (Fase 2)
    const proposalSchema = pickProposalSchema(editFields);
    const proposalSystemPrompt = getProposalSystemPrompt({
      entityType: "plan",
      entityJson: planPromptJson,
      campos: editFields.map((key) => ({
        key,
        label: editableFields.find((field) => field.key === key)?.label ?? key,
      })),
    });

    const documentSupabase = serviceClient();
    const promptText = request.retryOfMessageId
      ? request.content
      : (body.user_prompt ?? request.content);
    const promptWithMentions = withMentionedContext(
      promptText,
      request.mentions,
    );
    const frozenDocumentReferences = request.retryOfMessageId
      ? await resolveFrozenDocumentReferences({
        supabase: documentSupabase,
        userId: user.id,
        conversationType: "plan",
        conversationId: conversation_plan_id,
        messageId: request.retryOfMessageId,
      })
      : null;
    const documentReferences = frozenDocumentReferences ??
      (await resolveDocumentReferences({
        supabase: documentSupabase,
        userId: user.id,
        fileIds: documentFileIds(body.references?.fileIds),
        collectionIds: documentFileIds(body.references?.collectionIds),
        query: promptWithMentions,
        conversationId: conversation_plan_id,
      }));
    const documentReferenceQuery = frozenDocumentReferences?.query ??
      promptWithMentions;
    const augmentedPrompt = documentReferences.context
      ? `${documentReferences.context}\n\nSolicitud del usuario:\n${promptWithMentions}`
      : promptWithMentions;
    const durableUserContent = documentReferences.inputFiles.length
      ? `Usa únicamente estas referencias autorizadas cuando sean pertinentes.\n\n${augmentedPrompt}`
      : augmentedPrompt;

    // 4. Llamada asincrónica a OpenAI con Webhook
    // Sana conversaciones contaminadas por el bug histórico de intención antes
    // de cargarlas (no bloquea si falla).
    await pruneOrphanFunctionCalls(getOpenAI(), row.openai_conversation_id);
    console.log("[plan] enviando propuesta estructurada a openai");
    const modelToUse = CREATE_CHAT_CONVERSATION_STRUCTURED_MODELO;
    const reasoning = buildChatReasoningParam(
      modelToUse,
      request.reasoningEffort,
    );

    const durableRequest: StructuredResponseOptions = {
      conversation: row.openai_conversation_id,
      model: modelToUse,
      background: true,
      metadata: {
        tabla: "plan_mensajes_ia",
        mensaje_id: String(mensajeInsertado.id),
        is_structured: "true",
      },
      tools: buildResponseTools(
        request.webSearchEnabled,
        documentReferences.vectorStoreId,
      ),
      ...(reasoning ? { reasoning } : {}),
      text: {
        format: {
          type: "json_schema",
          name: "propuesta_chat",
          schema: proposalSchema,
        },
      },
      input: [
        {
          role: "system",
          content: proposalSystemPrompt,
        },
        { role: "user", content: durableUserContent },
      ],
    };
    const chatAttempt = await prepareChatGenerationAttempt({
      supabase,
      attemptId: crypto.randomUUID(),
      conversationType: "plan",
      conversationId: conversation_plan_id,
      messageId: String(mensajeInsertado.id),
      userId: user.id,
      request: durableRequest,
      referenceMode: documentReferences.mode,
      referenceQuery: documentReferenceQuery,
      references: documentReferences.references,
    });
    durableAttemptPrepared = true;

    const aiRequest = await buildChatAttemptOpenAIRequest({
      attempt: chatAttempt,
      supabase: documentSupabase,
      directInputFiles: documentReferences.inputFiles,
    });
    const aiResult = await svc.createStructuredResponse(aiRequest);
    console.log(aiResult);

    if (!aiResult.ok) {
      await requeueChatGenerationAttempt({
        supabase,
        attempt: chatAttempt,
        error: aiResult,
      });

      return withCors(
        jsonResponse(
          {
            ok: true,
            mensaje_id: mensajeInsertado.id,
            openai_response_id: null,
            recovery_pending: true,
          },
          202,
        ),
      );
    }

    const publication = await publishDurableChatResponse({
      supabase,
      attempt: chatAttempt,
      response: aiResult,
      cancelDuplicateResponse: (responseId) => svc.cancelResponse(responseId),
    });
    const publishedResponseId = publication.attempt?.openai_response_id ??
      aiResult.responseId;

    // 4.5 Registrar mejora estructurada en interacciones_ia (best-effort).
    // Solo cuenta como MEJORAR_SECCION cuando el usuario edita campos
    // específicos del plan; los mensajes conversacionales se omiten.
    if (request.campos.length > 0) {
      await registrarInteraccionIA(supabase, {
        usuarioId: user.id,
        tipo: "MEJORAR_SECCION",
        planEstudioId:
          (row as unknown as { plan_estudio_id?: string }).plan_estudio_id ??
            null,
        conversacionId: conversation_plan_id,
        modelo: modelToUse,
        openaiFileIds: [],
        vectorStoreIds: [],
      });
    }

    // 5. Responder al cliente de inmediato
    return withCors(
      jsonResponse({
        ok: true,
        mensaje_id: mensajeInsertado.id,
        openai_response_id: publishedResponseId,
      }),
    );
  } catch (err) {
    if (insertedMessageId && !durableAttemptPrepared) {
      await getSupabaseServiceClient()
        .from("plan_mensajes_ia")
        .update({
          estado: "ERROR",
          respuesta: "No se pudo generar la respuesta de la IA.",
          propuesta: { recommendations: [] },
          is_refusal: false,
        })
        .eq("id", insertedMessageId)
        .eq("estado", "PROCESANDO")
        .is("openai_response_id", null);
    }

    return withCors(handleErr(err));
  }
});

app.post(`${prefix}/conversations/asignatura/:id/messages`, async (c) => {
  let insertedMessageId: string | null = null;
  let durableAttemptPrepared = false;

  try {
    const conversation_asig_id = c.req.param("id");
    assertUuid(conversation_asig_id, "conversation_asig_id");

    const user = await requireUser(c.req.header("authorization"));

    const body = (await c.req.json().catch(() => ({}))) as AddMessageBody;

    const supabase = getSupabaseServiceClient();
    // Usamos el servicio que ya tienes configurado para background
    const svc = OpenAIService.fromEnv();
    if (!(svc instanceof OpenAIService)) {
      throw new HttpError(
        500,
        "openai_misconfigured",
        "OpenAI no está configurado",
        svc,
      );
    }

    // 1. Traer datos de la asignatura
    const { data: row, error } = await supabase
      .from("conversaciones_asignatura")
      .select(
        `id, openai_conversation_id, asignatura_id, asignaturas(*, estructuras_asignatura(definicion))`,
      )
      .eq("id", conversation_asig_id)
      .single();

    if (error || !row) {
      throw new HttpError(404, "not_found", "Conversación no encontrada");
    }
    await assertCanUseAsignaturaIA(
      supabase,
      user.id,
      (row as unknown as { asignatura_id: string }).asignatura_id,
    );
    const request = await resolveChatRequest({
      supabase,
      conversationType: "asignatura",
      conversationId: conversation_asig_id,
      userId: user.id,
      body,
    });

    const asignatura = (
      row as unknown as {
        asignaturas?: Record<string, unknown> | null;
      }
    ).asignaturas ?? null;
    const definicion = (
      asignatura?.["estructuras_asignatura"] as Record<string, unknown> | null
    )?.["definicion"];
    // 2. Insertar el mensaje en estado PROCESANDO
    // La intencion se resuelve a continuacion (Fase 1).
    const { data: mensajeInsertado, error: insertErr } = await supabase
      .from("asignatura_mensajes_ia")
      .insert({
        conversacion_asignatura_id: conversation_asig_id,
        enviado_por: user.id,
        mensaje: request.content,
        campos: request.campos,
        web_search_enabled: request.webSearchEnabled,
        reasoning_effort: request.reasoningEffort,
        retry_of_message_id: request.retryOfMessageId,
        estado: "PROCESANDO",
        intencion: null,
      })
      .select()
      .single();

    if (insertErr) {
      throw new HttpError(500, "db_error", "No se pudo crear el registro");
    }

    insertedMessageId = String(mensajeInsertado.id);

    // 2.5 Fase 1: detectar intencion de edicion vs consulta.
    const editableFields = getAsignaturaEditableFields(definicion);
    const asignaturaPromptJson = safeAsignaturaForPrompt(asignatura);
    let editFields = request.campos;

    if (editFields.length === 0) {
      const intent = await detectChatIntent({
        svc,
        userContent: withMentionedContext(request.content, request.mentions),
        entityType: "asignatura",
        entityJson: asignaturaPromptJson,
        editableFields,
        explicitlySelectedFields: editFields,
        conversationId: row.openai_conversation_id,
      });

      if (intent.type === "consulta") {
        await completeMessageAsChat(
          supabase,
          "asignatura",
          insertedMessageId,
          intent.respuesta,
        );
        return withCors(
          jsonResponse({
            ok: true,
            mensaje_id: mensajeInsertado.id,
            openai_response_id: null,
          }),
        );
      }

      if (intent.type === "clarificacion") {
        await completeMessageAsChat(
          supabase,
          "asignatura",
          insertedMessageId,
          `${intent.respuesta}\n\n${intent.pregunta}`,
        );
        return withCors(
          jsonResponse({
            ok: true,
            mensaje_id: mensajeInsertado.id,
            openai_response_id: null,
          }),
        );
      }

      editFields = intent.campos;
    }

    const validFieldKeys = new Set(editableFields.map((field) => field.key));
    editFields = editFields.filter((key) => validFieldKeys.has(key));

    if (editFields.length === 0) {
      await completeMessageAsChat(
        supabase,
        "asignatura",
        insertedMessageId,
        'No detecté un campo editable para mejorar. Puedes seleccionarlo con "/" o indicarme claramente de qué sección quieres trabajar.',
      );
      return withCors(
        jsonResponse({
          ok: true,
          mensaje_id: mensajeInsertado.id,
          openai_response_id: null,
        }),
      );
    }

    await setMessageIntent(
      supabase,
      "asignatura",
      insertedMessageId,
      "editar",
      editFields,
    );
    request.campos = editFields;

    // 3. Preparar Schema y Prompt de propuesta (Fase 2)
    const proposalSchema = pickProposalSchema(editFields);
    const proposalSystemPrompt = getProposalSystemPrompt({
      entityType: "asignatura",
      entityJson: asignaturaPromptJson,
      campos: editFields.map((key) => ({
        key,
        label: editableFields.find((field) => field.key === key)?.label ?? key,
      })),
    });

    const documentSupabase = serviceClient();
    const promptText = request.retryOfMessageId
      ? request.content
      : (body.user_prompt ?? request.content);
    const promptWithMentions = withMentionedContext(
      promptText,
      request.mentions,
    );
    const frozenDocumentReferences = request.retryOfMessageId
      ? await resolveFrozenDocumentReferences({
        supabase: documentSupabase,
        userId: user.id,
        conversationType: "asignatura",
        conversationId: conversation_asig_id,
        messageId: request.retryOfMessageId,
      })
      : null;
    const documentReferences = frozenDocumentReferences ??
      (await resolveDocumentReferences({
        supabase: documentSupabase,
        userId: user.id,
        fileIds: documentFileIds(body.references?.fileIds),
        collectionIds: documentFileIds(body.references?.collectionIds),
        query: promptWithMentions,
        conversationId: conversation_asig_id,
      }));
    const documentReferenceQuery = frozenDocumentReferences?.query ??
      promptWithMentions;
    const augmentedPrompt = documentReferences.context
      ? `${documentReferences.context}\n\nSolicitud del usuario:\n${promptWithMentions}`
      : promptWithMentions;
    const durableUserContent = documentReferences.inputFiles.length
      ? `Usa únicamente estas referencias autorizadas cuando sean pertinentes.\n\n${augmentedPrompt}`
      : augmentedPrompt;

    // 4. Llamada asincrónica con background: true
    // Sana conversaciones contaminadas por el bug histórico de intención antes
    // de cargarlas (no bloquea si falla).
    await pruneOrphanFunctionCalls(getOpenAI(), row.openai_conversation_id);
    console.log("[asignatura] enviando propuesta estructurada a openai");
    const modelToUse = CREATE_CHAT_CONVERSATION_STRUCTURED_MODELO;
    const reasoning = buildChatReasoningParam(
      modelToUse,
      request.reasoningEffort,
    );

    const durableRequest: StructuredResponseOptions = {
      conversation: row.openai_conversation_id,
      model: modelToUse,
      background: true,
      metadata: {
        tabla: "asignatura_mensajes_ia",
        mensaje_id: String(mensajeInsertado.id),
        is_structured: "true",
        conversation_id: conversation_asig_id,
      },
      tools: buildResponseTools(
        request.webSearchEnabled,
        documentReferences.vectorStoreId,
      ),
      ...(reasoning ? { reasoning } : {}),
      text: {
        format: {
          type: "json_schema",
          name: "propuesta_chat",
          schema: proposalSchema,
        },
      },
      input: [
        {
          role: "system",
          content: proposalSystemPrompt,
        },
        { role: "user", content: durableUserContent },
      ],
    };
    const chatAttempt = await prepareChatGenerationAttempt({
      supabase,
      attemptId: crypto.randomUUID(),
      conversationType: "asignatura",
      conversationId: conversation_asig_id,
      messageId: String(mensajeInsertado.id),
      userId: user.id,
      request: durableRequest,
      referenceMode: documentReferences.mode,
      referenceQuery: documentReferenceQuery,
      references: documentReferences.references,
    });
    durableAttemptPrepared = true;

    const aiRequest = await buildChatAttemptOpenAIRequest({
      attempt: chatAttempt,
      supabase: documentSupabase,
      directInputFiles: documentReferences.inputFiles,
    });
    const aiResult = await svc.createStructuredResponse(aiRequest);

    if (!aiResult.ok) {
      await requeueChatGenerationAttempt({
        supabase,
        attempt: chatAttempt,
        error: aiResult,
      });

      return withCors(
        jsonResponse(
          {
            ok: true,
            mensaje_id: mensajeInsertado.id,
            openai_response_id: null,
            recovery_pending: true,
          },
          202,
        ),
      );
    }

    const publication = await publishDurableChatResponse({
      supabase,
      attempt: chatAttempt,
      response: aiResult,
      cancelDuplicateResponse: (responseId) => svc.cancelResponse(responseId),
    });
    const publishedResponseId = publication.attempt?.openai_response_id ??
      aiResult.responseId;

    // 4.5 Registrar MEJORAR_SECCION (asignatura) en interacciones_ia
    // best-effort, solo cuando hay campos editados.
    if (request.campos.length > 0) {
      await registrarInteraccionIA(supabase, {
        usuarioId: user.id,
        tipo: "MEJORAR_SECCION",
        asignaturaId:
          (row as unknown as { asignatura_id?: string }).asignatura_id ?? null,
        conversacionId: conversation_asig_id,
        modelo: modelToUse,
        openaiFileIds: [],
        vectorStoreIds: [],
      });
    }

    // 5. Responder al cliente de inmediato
    return withCors(
      jsonResponse({
        ok: true,
        mensaje_id: mensajeInsertado.id,
        openai_response_id: publishedResponseId,
      }),
    );
  } catch (err) {
    if (insertedMessageId && !durableAttemptPrepared) {
      await getSupabaseServiceClient()
        .from("asignatura_mensajes_ia")
        .update({
          estado: "ERROR",
          respuesta: "No se pudo generar la respuesta de la IA.",
          propuesta: { recommendations: [] },
          is_refusal: false,
        })
        .eq("id", insertedMessageId)
        .eq("estado", "PROCESANDO")
        .is("openai_response_id", null);
    }

    return withCors(handleErr(err));
  }
});

/**
 * Unknown routes
 */
app.all("*", (c) =>
  withCors(
    jsonResponse(
      {
        error: "not_found",
        message: `Route ${c.req.url} not found`,
      },
      404,
    ),
  ));

function handleErr(err: unknown): Response {
  const response = httpErrorResponse(err);
  if (response) return response;

  console.error("Unhandled error:", err);
  return jsonResponse(
    { error: "internal_error", message: "Unexpected error" },
    500,
  );
}

Deno.serve(app.fetch);
