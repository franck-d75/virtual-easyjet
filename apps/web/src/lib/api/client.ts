import { getApiBaseUrl } from "../config/env";

export class ApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiRequestNextOptions = {
  revalidate?: number;
  tags?: string[];
};

type ApiRequestOptions = RequestInit & {
  accessToken?: string;
  next?: ApiRequestNextOptions;
  retryCount?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
};

const DEFAULT_FETCH_TIMEOUT_MS = 8_000;
const DEFAULT_RETRY_COUNT = 1;
const DEFAULT_RETRY_DELAY_MS = 350;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const SHOULD_LOG_DEBUG =
  process.env.NODE_ENV !== "production" ||
  process.env.VEJ_WEB_DEBUG_API === "true";
let dnsPreferenceConfigured = false;

function buildUrl(path: string): string {
  const baseUrl = `${getApiBaseUrl().replace(/\/+$/, "")}/`;
  const normalizedPath = path.replace(/^\/+/, "");
  return new URL(normalizedPath, baseUrl).toString();
}

function serializeError(error: unknown): { type: string; message: string } {
  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message,
    };
  }

  return {
    type: typeof error,
    message: String(error),
  };
}

function extractMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  return fallback;
}

function isIdempotentMethod(method: string | undefined): boolean {
  if (!method) {
    return true;
  }

  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function mergeAbortSignal(
  signal: AbortSignal | null | undefined,
  timeoutSignal: AbortSignal,
): AbortSignal {
  if (!signal) {
    return timeoutSignal;
  }

  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([signal, timeoutSignal]);
  }

  return signal.aborted ? signal : timeoutSignal;
}

function shouldRetryStatus(
  status: number,
  isIdempotentRequest: boolean,
): boolean {
  return isIdempotentRequest && RETRYABLE_STATUS_CODES.has(status);
}

async function waitBeforeRetry(delayMs: number): Promise<void> {
  if (delayMs <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function ensureServerDnsPreference(): Promise<void> {
  if (typeof window !== "undefined" || dnsPreferenceConfigured) {
    return;
  }

  dnsPreferenceConfigured = true;

  try {
    const importDns = new Function(
      "specifier",
      "return import(specifier);",
    ) as (
      specifier: string,
    ) => Promise<{ setDefaultResultOrder?: (value: "ipv4first") => void }>;
    const dnsModule = await importDns("node:dns");

    dnsModule.setDefaultResultOrder?.("ipv4first");
  } catch {
    // Keep the runtime default when DNS preferences cannot be overridden.
  }
}

export async function apiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  await ensureServerDnsPreference();

  const {
    accessToken,
    headers: inputHeaders,
    next: nextOptions,
    retryCount = DEFAULT_RETRY_COUNT,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
    ...init
  } = options;
  const headers = new Headers(inputHeaders);
  const url = buildUrl(path);
  const requestMethod = init.method ?? "GET";
  const idempotentRequest = isIdempotentMethod(requestMethod);
  const attempts = idempotentRequest ? Math.max(1, retryCount + 1) : 1;

  if (
    init.body !== undefined &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let response: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, timeoutMs);

    try {
      response = await fetch(url, {
        ...init,
        cache: init.cache ?? "no-store",
        headers,
        next: {
          revalidate: 0,
          ...nextOptions,
        },
        signal: mergeAbortSignal(init.signal, timeoutController.signal),
      });
    } catch (error) {
      lastError = error;
      clearTimeout(timeoutId);

      if (SHOULD_LOG_DEBUG || attempt >= attempts) {
        console.warn("[web] api request attempt failed", {
          attempt,
          attempts,
          method: requestMethod,
          url,
          error: serializeError(error),
        });
      }

      if (attempt >= attempts) {
        console.error("[web] api request failed", {
          attempts,
          method: requestMethod,
          url,
          error: serializeError(error),
        });
        throw error;
      }

      await waitBeforeRetry(retryDelayMs * attempt);
      continue;
    }

    clearTimeout(timeoutId);

    if (
      response.ok ||
      !shouldRetryStatus(response.status, idempotentRequest) ||
      attempt >= attempts
    ) {
      break;
    }

    if (SHOULD_LOG_DEBUG) {
      console.warn("[web] api request retry scheduled", {
        attempt,
        attempts,
        method: requestMethod,
        url,
        status: response.status,
      });
    }

    await waitBeforeRetry(retryDelayMs * attempt);
    response = null;
  }

  if (!response) {
    throw (lastError ?? new Error("API request failed without response.")) as Error;
  }

  const responseText = await response.text();
  const responsePayload =
    responseText.length > 0 ? tryParseJson(responseText) : undefined;

  if (!response.ok) {
    throw new ApiError(
      extractMessage(
        responsePayload,
        response.statusText || "Une erreur inattendue est survenue côté API.",
      ),
      response.status,
      responsePayload,
    );
  }

  if (response.status === 204 || responseText.length === 0) {
    return undefined as TResponse;
  }

  return responsePayload as TResponse;
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}
