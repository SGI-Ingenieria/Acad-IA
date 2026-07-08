// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment

import "@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "openai";

import {
  handleAsignaturaMensajesResponse,
  handleAsignaturaMensajesUnsuccessfulResponse,
} from "../create-chat-conversation/asignatura/crear.ts";
import {
  handlePlanMensajesResponse,
  handlePlanMensajesUnsuccessfulResponse,
} from "../create-chat-conversation/plan/crear.ts";

import {
  handleAsignaturasResponse,
  handleAsignaturasUnsuccesfulResponse,
} from "./asignaturas/index.ts";
import {
  handlePlanesEstudioResponse,
  handlePlanesEstudioUnsuccesfulResponse,
} from "./planes_estudio/index.ts";
import { supabase } from "./supabase.ts";

import type { ResponseMetadata } from "../_shared/utils.ts";

const observabilityDb = supabase as any;

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

type ObservabilityMetadata = ResponseMetadata & {
  accion?: string;
  observability_test_run_id?: string;
};

type WebhookEvent =
  | OpenAI.Webhooks.ResponseCompletedWebhookEvent
  | OpenAI.Webhooks.ResponseCancelledWebhookEvent
  | OpenAI.Webhooks.ResponseFailedWebhookEvent
  | OpenAI.Webhooks.ResponseIncompleteWebhookEvent
  | OpenAI.Webhooks.UnwrapWebhookEvent;

console.log("Starting OpenAI webhook responses function");
const client = new OpenAI({
  webhookSecret: Deno.env.get("OPENAI_WEBHOOK_SECRET"),
});

function nowIso() {
  return new Date().toISOString();
}

function getEventResponseId(event: WebhookEvent) {
  const data = (event as { data?: { id?: unknown } }).data;
  return typeof data?.id === "string" ? data.id : null;
}

function getEventId(event: WebhookEvent) {
  return typeof event.id === "string"
    ? event.id
    : `evt_local_${crypto.randomUUID()}`;
}

async function recordWebhookEvent(event: WebhookEvent) {
  const responseId = getEventResponseId(event);
  let testRunId: string | null = null;

  if (responseId) {
    const { data } = await observabilityDb
      .from("observability_test_runs")
      .select("id")
      .eq("openai_response_id", responseId)
      .maybeSingle();

    testRunId = data && typeof data.id === "string" ? String(data.id) : null;
  }

  const { error } = await observabilityDb
    .from("observability_webhook_events")
    .upsert(
      {
        event_id: getEventId(event),
        event_type: event.type,
        openai_response_id: responseId,
        test_run_id: testRunId,
        received_at: nowIso(),
        signature_valid: true,
        payload: event,
        processing_status: "received",
        processing_error: null,
      },
      { onConflict: "event_id" },
    );

  if (error) {
    console.warn("No se pudo registrar evento de observabilidad:", error);
  }
}

async function markWebhookEvent(
  event: WebhookEvent,
  status: "processed" | "ignored" | "failed",
  errorMessage?: string,
) {
  const { error } = await observabilityDb
    .from("observability_webhook_events")
    .update({
      processing_status: status,
      processing_error: errorMessage ?? null,
    })
    .eq("event_id", getEventId(event));

  if (error) {
    console.warn("No se pudo actualizar evento de observabilidad:", error);
  }
}

async function markObservabilityRun(args: {
  metadata: ObservabilityMetadata;
  responseId: string;
  estado: "completed" | "failed";
  latencyMs?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  const runId = args.metadata.observability_test_run_id;
  if (!runId) return;

  const { error } = await observabilityDb
    .from("observability_test_runs")
    .update({
      estado: args.estado,
      openai_response_id: args.responseId,
      completed_at: nowIso(),
      latency_ms: args.latencyMs ?? null,
      error_code: args.errorCode ?? null,
      error_message: args.errorMessage ?? null,
      metadata: {
        tabla: args.metadata.tabla,
        accion: args.metadata.accion ?? null,
      },
    })
    .eq("id", runId);

  if (error) {
    console.warn("No se pudo cerrar prueba de observabilidad:", error);
  }
}

async function retrieveResponseOrMarkSample(
  event: WebhookEvent,
  responseId: string,
) {
  try {
    return await client.responses.retrieve(responseId);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "No se pudo recuperar la respuesta de OpenAI.";

    await markWebhookEvent(event, "ignored", message);
    console.warn("Webhook registrado sin recuperar response:", message);
    return null;
  }
}

async function handleCompletedResponse(
  event: OpenAI.Webhooks.ResponseCompletedWebhookEvent,
) {
  const responseId = event.data.id;
  const response = await retrieveResponseOrMarkSample(event, responseId);
  if (!response) return;

  const metadata = response.metadata as ObservabilityMetadata | null;

  if (!metadata || !metadata.tabla) {
    await markWebhookEvent(event, "ignored", "Respuesta sin metadata tabla.");
    console.warn("No se recibio metadata o tabla en la respuesta");
    return;
  }

  if (metadata.tabla === "observability") {
    await markObservabilityRun({
      metadata,
      responseId,
      estado: "completed",
    });
    await markWebhookEvent(event, "processed");
    return;
  }

  switch (metadata.tabla) {
    case "planes_estudio":
      await handlePlanesEstudioResponse(response);
      break;
    case "asignaturas":
      await handleAsignaturasResponse(response);
      break;
    case "plan_mensajes_ia":
      await handlePlanMensajesResponse(response);
      break;
    case "asignatura_mensajes_ia":
      await handleAsignaturaMensajesResponse(response);
      break;
    default:
      await markWebhookEvent(
        event,
        "ignored",
        `Tabla no reconocida: ${metadata.tabla}`,
      );
      console.warn("Tabla no reconocida:", metadata.tabla);
      return;
  }

  await markWebhookEvent(event, "processed");
}

async function handleUnsuccesfulResponse(
  event:
    | OpenAI.Webhooks.ResponseCancelledWebhookEvent
    | OpenAI.Webhooks.ResponseFailedWebhookEvent
    | OpenAI.Webhooks.ResponseIncompleteWebhookEvent,
): Promise<void> {
  try {
    const responseId = event.data.id;
    const response = await retrieveResponseOrMarkSample(event, responseId);
    if (!response) return;

    const metadata = response.metadata as ObservabilityMetadata | null;

    if (!metadata || !metadata.tabla) {
      await markWebhookEvent(
        event,
        "ignored",
        "Respuesta no exitosa sin metadata tabla.",
      );
      console.warn(
        "No se recibio metadata o tabla en la respuesta UNSUCCESSFUL",
      );
      return;
    }

    if (metadata.tabla === "observability") {
      await markObservabilityRun({
        metadata,
        responseId,
        estado: "failed",
        errorCode: event.type,
        errorMessage: `OpenAI envio ${event.type}.`,
      });
      await markWebhookEvent(event, "processed");
      return;
    }

    switch (metadata.tabla) {
      case "planes_estudio":
        await handlePlanesEstudioUnsuccesfulResponse(response);
        break;
      case "asignaturas":
        await handleAsignaturasUnsuccesfulResponse(response);
        break;
      case "plan_mensajes_ia":
        await handlePlanMensajesUnsuccessfulResponse(response);
        break;
      case "asignatura_mensajes_ia":
        await handleAsignaturaMensajesUnsuccessfulResponse(response);
        break;
      default:
        await markWebhookEvent(
          event,
          "ignored",
          `Tabla no reconocida en UNSUCCESSFUL: ${metadata.tabla}`,
        );
        console.warn("Tabla no reconocida en UNSUCCESSFUL:", metadata.tabla);
        return;
    }

    await markWebhookEvent(event, "processed");
  } catch (error) {
    await markWebhookEvent(
      event,
      "failed",
      error instanceof Error ? error.message : String(error),
    );
    console.error("Error procesando respuesta UNSUCCESSFUL:", error);
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const functionName = url.pathname.split("/").pop();
  console.log(
    `[${new Date().toISOString()}][${functionName}]: Request received`,
  );

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const payload = await req.text();
    const event = await client.webhooks.unwrap(payload, req.headers);
    await recordWebhookEvent(event);

    switch (event.type) {
      case "response.completed": {
        EdgeRuntime.waitUntil(handleCompletedResponse(event));
        break;
      }
      case "response.cancelled":
      case "response.failed":
      case "response.incomplete": {
        EdgeRuntime.waitUntil(handleUnsuccesfulResponse(event));
        break;
      }
      default: {
        EdgeRuntime.waitUntil(
          markWebhookEvent(
            event,
            "ignored",
            `Evento no procesado: ${event.type}`,
          ),
        );
      }
    }

    console.log(
      `[${
        new Date().toISOString()
      }][${functionName}]: Request processed successfully`,
    );
    return new Response("OK", { status: 200 });
  } catch (error) {
    if (error instanceof OpenAI.InvalidWebhookSignatureError) {
      const signatureError = error as Error;
      console.error("Invalid signature:", signatureError.message);
      return new Response("Invalid signature", { status: 400 });
    }

    console.error("Internal Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});
