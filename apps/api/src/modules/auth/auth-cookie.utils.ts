import type { AuthSession } from "@va/shared";

export const API_ACCESS_COOKIE_NAME = "vej_access_token";
export const API_REFRESH_COOKIE_NAME = "vej_refresh_token";

type ResponseLike = {
  setHeader: (name: string, value: string | string[]) => void;
};

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

function getCookieDomain(): string | undefined {
  if (!isProductionEnvironment()) {
    return undefined;
  }

  return ".virtual-easyjet.fr";
}

function durationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/i.exec(value.trim());

  if (!match) {
    return 0;
  }

  const amount = Number.parseInt(match[1] ?? "0", 10);
  const unit = (match[2] ?? "s").toLowerCase();

  switch (unit) {
    case "s":
      return amount;
    case "m":
      return amount * 60;
    case "h":
      return amount * 3_600;
    case "d":
      return amount * 86_400;
    default:
      return 0;
  }
}

function serializeCookie(name: string, value: string, maxAge: number): string {
  const segments = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${Math.max(0, maxAge)}`,
    `SameSite=${isProductionEnvironment() ? "None" : "Lax"}`,
  ];

  if (isProductionEnvironment()) {
    segments.push("Secure");
  }

  const domain = getCookieDomain();

  if (domain) {
    segments.push(`Domain=${domain}`);
  }

  return segments.join("; ");
}

export function applyAuthCookies(
  response: ResponseLike,
  session: AuthSession,
): void {
  response.setHeader("Set-Cookie", [
    serializeCookie(
      API_ACCESS_COOKIE_NAME,
      session.tokens.accessToken,
      durationToSeconds(session.tokens.accessTokenExpiresIn),
    ),
    serializeCookie(
      API_REFRESH_COOKIE_NAME,
      session.tokens.refreshToken,
      durationToSeconds(session.tokens.refreshTokenExpiresIn),
    ),
  ]);
}

export function clearAuthCookies(response: ResponseLike): void {
  response.setHeader("Set-Cookie", [
    serializeCookie(API_ACCESS_COOKIE_NAME, "", 0),
    serializeCookie(API_REFRESH_COOKIE_NAME, "", 0),
  ]);
}

export function readRequestCookie(
  request: RequestLike,
  cookieName: string,
): string | null {
  const cookieHeader = request.headers?.cookie;
  const rawCookieValue = Array.isArray(cookieHeader)
    ? cookieHeader.join("; ")
    : cookieHeader;

  if (!rawCookieValue) {
    return null;
  }

  const cookieEntry = rawCookieValue
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${cookieName}=`));

  if (!cookieEntry) {
    return null;
  }

  const [, ...valueParts] = cookieEntry.split("=");
  const encodedValue = valueParts.join("=");

  if (!encodedValue) {
    return null;
  }

  try {
    return decodeURIComponent(encodedValue);
  } catch {
    return encodedValue;
  }
}

