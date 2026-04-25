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

type ApiRequestOptions = RequestInit & {
  accessToken?: string;
};

function buildUrl(path: string): string {
  const baseUrl = getApiBaseUrl().replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  return `${baseUrl}/${normalizedPath}`;
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

export async function apiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const { accessToken, headers: inputHeaders, ...init } = options;
  const headers = new Headers(inputHeaders);
  const url = buildUrl(path);

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

  console.info("[web] api request", {
    method: init.method ?? "GET",
    url,
  });

  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers,
    });
  } catch (error) {
    console.error("[web] api request failed", {
      method: init.method ?? "GET",
      url,
      error: serializeError(error),
    });
    throw error;
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
