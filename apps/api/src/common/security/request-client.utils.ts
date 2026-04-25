import { createHash } from "node:crypto";

type HeaderValue = string | string[] | undefined;

type RequestLike = {
  ip?: string;
  socket?: {
    remoteAddress?: string | null;
  };
  headers?: Record<string, HeaderValue>;
  user?: {
    id?: string;
  };
};

function getHeaderValue(headers: Record<string, HeaderValue>, name: string): string | null {
  const header = headers[name];

  if (Array.isArray(header)) {
    return header[0] ?? null;
  }

  return typeof header === "string" ? header : null;
}

function normalizeIp(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const firstValue = value.split(",")[0]?.trim();

  if (!firstValue) {
    return null;
  }

  return firstValue.replace(/^::ffff:/i, "");
}

export function getRequestClientIp(request: RequestLike): string {
  const headers = request.headers ?? {};

  return (
    normalizeIp(getHeaderValue(headers, "cf-connecting-ip")) ??
    normalizeIp(getHeaderValue(headers, "x-real-ip")) ??
    normalizeIp(getHeaderValue(headers, "x-forwarded-for")) ??
    normalizeIp(request.ip) ??
    normalizeIp(request.socket?.remoteAddress) ??
    "unknown"
  );
}

export function getRequestActorKey(request: RequestLike): string {
  const userId = request.user?.id;

  if (typeof userId === "string" && userId.length > 0) {
    return `user:${userId}`;
  }

  return `ip:${getRequestClientIp(request)}`;
}

export function hashSecurityValue(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}
