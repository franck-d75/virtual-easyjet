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

  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(buildUrl(path), {
    ...init,
    headers,
  });

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
