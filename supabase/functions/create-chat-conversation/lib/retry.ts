import { HttpError } from "./errors.ts";

import type { getSupabaseServiceClient } from "./supabase.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ReasoningEffort = "auto" | "none" | "low" | "medium" | "high";

export type AddMessageBody = {
  content?: string;
  mentions?: Array<{ sourceMessageId?: string; excerpt?: string }>;
  references?: {
    fileIds?: Array<string>;
    collectionIds?: Array<string>;
  };
  campos?: Array<string>;
  user_prompt?: string;
  model?: string;
  webSearchEnabled?: boolean;
  reasoningEffort?: ReasoningEffort;
  retryOfMessageId?: string;
};

export type ResolvedChatRequest = {
  content: string;
  mentions: Array<{ sourceMessageId: string; excerpt: string }>;
  campos: Array<string>;
  webSearchEnabled: boolean;
  reasoningEffort: ReasoningEffort;
  retryOfMessageId: string | null;
};

type OriginalMessage = {
  id: string;
  enviado_por: string;
  mensaje: string;
  campos: Array<string>;
  web_search_enabled: boolean;
  reasoning_effort: string;
  conversacion_plan_id?: string;
  conversacion_asignatura_id?: string;
};

const REASONING_EFFORTS = new Set<ReasoningEffort>([
  "auto",
  "none",
  "low",
  "medium",
  "high",
]);

function reasoningEffort(value: unknown, status = 400): ReasoningEffort {
  if (
    typeof value === "string" &&
    REASONING_EFFORTS.has(value as ReasoningEffort)
  ) {
    return value as ReasoningEffort;
  }

  if (value === undefined || value === null) return "auto";

  throw new HttpError(
    status,
    status === 400 ? "bad_input" : "retry_snapshot_invalid",
    "El nivel de razonamiento no es válido.",
  );
}

function fieldKeys(value: unknown, status = 400): Array<string> {
  if (value === undefined || value === null) return [];
  if (
    Array.isArray(value) &&
    value.every((field) => typeof field === "string")
  ) {
    return [...value];
  }

  throw new HttpError(
    status,
    status === 400 ? "bad_input" : "retry_snapshot_invalid",
    "Los campos de la solicitud no son válidos.",
  );
}

function mentions(value: unknown, status = 400) {
  if (value === undefined || value === null) return [];
  if (
    Array.isArray(value) &&
    value.every(
      (mention) =>
        typeof mention?.sourceMessageId === "string" &&
        typeof mention?.excerpt === "string" &&
        mention.excerpt.trim().length > 0 &&
        mention.excerpt.length <= 4_000,
    )
  ) {
    return value.map((mention) => ({
      sourceMessageId: String(mention.sourceMessageId),
      excerpt: String(mention.excerpt).trim(),
    }));
  }
  throw new HttpError(
    status,
    status === 400 ? "bad_input" : "retry_snapshot_invalid",
    "Las menciones de contexto no son válidas.",
  );
}

/**
 * Para un reintento, reemplaza por completo el cuerpo enviado por el cliente
 * con el snapshot autoritativo del mensaje original.
 */
export async function resolveChatRequest(args: {
  supabase: ReturnType<typeof getSupabaseServiceClient>;
  conversationType: "plan" | "asignatura";
  conversationId: string;
  userId: string;
  body: AddMessageBody;
}): Promise<ResolvedChatRequest> {
  const retryOfMessageId = args.body.retryOfMessageId;
  if (retryOfMessageId !== undefined) {
    if (typeof retryOfMessageId !== "string" || !UUID.test(retryOfMessageId)) {
      throw new HttpError(
        400,
        "bad_input",
        "retryOfMessageId debe ser un UUID válido.",
      );
    }

    const table = args.conversationType === "plan"
      ? "plan_mensajes_ia"
      : "asignatura_mensajes_ia";
    const conversationColumn = args.conversationType === "plan"
      ? "conversacion_plan_id"
      : "conversacion_asignatura_id";
    const { data, error } = await args.supabase
      .from(table)
      .select(
        `id, enviado_por, mensaje, campos, web_search_enabled, reasoning_effort, ${conversationColumn}`,
      )
      .eq("id", retryOfMessageId)
      .maybeSingle();

    if (error) {
      throw new HttpError(
        500,
        "retry_source_read_failed",
        "No se pudo recuperar el mensaje original.",
        error,
      );
    }
    if (!data) {
      throw new HttpError(
        404,
        "retry_source_not_found",
        "No se encontró el mensaje original para reintentar.",
      );
    }

    const original = data as unknown as OriginalMessage;
    if (original[conversationColumn] !== args.conversationId) {
      throw new HttpError(
        409,
        "retry_conversation_mismatch",
        "El mensaje original no pertenece a esta conversación.",
      );
    }
    if (original.enviado_por !== args.userId) {
      throw new HttpError(
        403,
        "retry_author_mismatch",
        "Solo el autor original puede volver a generar esta solicitud.",
      );
    }
    if (typeof original.mensaje !== "string" || !original.mensaje) {
      throw new HttpError(
        500,
        "retry_snapshot_invalid",
        "El mensaje original no conserva un texto válido.",
      );
    }

    return {
      content: original.mensaje,
      mentions: [],
      campos: fieldKeys(original.campos, 500),
      webSearchEnabled: original.web_search_enabled === true,
      reasoningEffort: reasoningEffort(original.reasoning_effort, 500),
      retryOfMessageId,
    };
  }

  if (!args.body.content || typeof args.body.content !== "string") {
    throw new HttpError(400, "bad_input", "content es requerido");
  }

  return {
    content: args.body.content,
    mentions: mentions(args.body.mentions),
    campos: fieldKeys(args.body.campos),
    webSearchEnabled: args.body.webSearchEnabled === true,
    reasoningEffort: reasoningEffort(args.body.reasoningEffort),
    retryOfMessageId: null,
  };
}
