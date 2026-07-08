export type HealthStatus = "ok" | "warning" | "error";

export type EdgeProbeClassificationInput = {
  functionName: string;
  status?: number;
  latencyMs?: number;
  bodyText?: string;
  errorCode?: string | null;
  fetchError?: string;
  timedOut?: boolean;
  treatAuthFailureAsError?: boolean;
};

export type EdgeProbeOutcome = {
  name: string;
  status: HealthStatus;
  httpStatus?: number;
  latencyMs?: number;
  errorKind?: string;
  message?: string;
};

const CRITICAL_EDGE_PATTERNS = [
  "boot_error",
  "internal worker boot error",
  "invalidworkercreation",
  "invalid worker creation",
  "worker_error",
  "load_function",
  "function_worker",
  "failed to create worker",
  "failed to start",
  "worker boot",
  "worker failed",
  "worker resource",
  "relay error",
  "edge function returned a non-2xx",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function parseMaybeJson(bodyText: string | undefined): unknown {
  if (!bodyText?.trim()) return undefined;

  try {
    return JSON.parse(bodyText);
  } catch {
    return undefined;
  }
}

function extractBodySignal(body: unknown): {
  code?: string;
  message?: string;
} {
  if (!isRecord(body)) return {};

  const error = body.error;
  if (isRecord(error)) {
    return {
      code: readString(error.code) ??
        readString(error.error_code) ??
        readString(body.code),
      message: readString(error.message) ??
        readString(error.msg) ??
        readString(error.error) ??
        readString(body.message) ??
        readString(body.msg),
    };
  }

  return {
    code: readString(body.code) ?? readString(body.error_code),
    message: readString(body.message) ??
      readString(body.msg) ??
      readString(body.error),
  };
}

function includesCriticalPattern(...values: Array<string | undefined | null>) {
  const haystack = values
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return CRITICAL_EDGE_PATTERNS.some((pattern) => haystack.includes(pattern));
}

export function classifyEdgeProbeResult(
  input: EdgeProbeClassificationInput,
): EdgeProbeOutcome {
  const parsedBody = parseMaybeJson(input.bodyText);
  const bodySignal = extractBodySignal(parsedBody);
  const errorKind = input.fetchError
    ? input.timedOut ? "timeout" : "fetch_error"
    : (input.errorCode ?? bodySignal.code);
  const message = input.fetchError ??
    bodySignal.message ??
    (input.bodyText && input.bodyText.length <= 260
      ? input.bodyText
      : undefined);

  const base = {
    name: input.functionName,
    httpStatus: input.status,
    latencyMs: input.latencyMs,
  };

  if (input.fetchError || input.timedOut) {
    return {
      ...base,
      status: "error",
      errorKind,
      message: message ?? "No se pudo conectar con la Edge Function.",
    };
  }

  if (
    includesCriticalPattern(
      input.errorCode,
      bodySignal.code,
      bodySignal.message,
      input.bodyText,
    )
  ) {
    return {
      ...base,
      status: "error",
      errorKind: errorKind ?? "edge_worker_error",
      message: message ??
        "La Edge Function reporto un error al iniciar o crear su worker.",
    };
  }

  if (typeof input.status === "number" && input.status >= 500) {
    return {
      ...base,
      status: "error",
      errorKind: errorKind ?? `http_${input.status}`,
      message: message ??
        "La Edge Function respondio con un error del servidor.",
    };
  }

  if (
    typeof input.status === "number" &&
    (input.status === 401 || input.status === 403)
  ) {
    return {
      ...base,
      status: input.treatAuthFailureAsError ? "error" : "warning",
      errorKind: errorKind ?? `http_${input.status}`,
      message: message ??
        "La funcion respondio, pero no acepto el token de acceso.",
    };
  }

  if (typeof input.status === "number" && input.status >= 400) {
    return {
      ...base,
      status: "ok",
      message: message ??
        "La funcion respondio; el codigo corresponde a una solicitud de diagnostico.",
    };
  }

  return {
    ...base,
    status: "ok",
    message: message ?? "La funcion respondio correctamente.",
  };
}

export function summarizeStatuses(items: Array<{ status: HealthStatus }>) {
  const error = items.filter((item) => item.status === "error").length;
  const warning = items.filter((item) => item.status === "warning").length;
  const ok = items.filter((item) => item.status === "ok").length;
  const status: HealthStatus = error > 0
    ? "error"
    : warning > 0
    ? "warning"
    : "ok";

  return { status, ok, warning, error, total: items.length };
}
