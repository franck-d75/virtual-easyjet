import type { AuthSession } from "@va/shared";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  ACCESS_COOKIE_NAME,
  applySessionCookies,
  clearSessionCookies,
  REFRESH_COOKIE_NAME,
} from "@/lib/auth/cookies";
import { getApiBaseUrl } from "@/lib/config/env";

const ACCESS_REFRESH_WINDOW_MS = 30_000;

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  return atob(padded);
}

function getAccessTokenExpiry(token: string): number | null {
  const tokenParts = token.split(".");

  if (tokenParts.length !== 3) {
    return null;
  }

  const payloadLiteral = tokenParts[1];

  if (!payloadLiteral) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(payloadLiteral)) as {
      exp?: number;
    };

    return typeof payload.exp === "number" ? payload.exp * 1_000 : null;
  } catch {
    return null;
  }
}

function shouldRefreshAccessToken(accessToken: string | undefined): boolean {
  if (!accessToken) {
    return true;
  }

  const expiresAt = getAccessTokenExpiry(accessToken);

  if (!expiresAt) {
    return true;
  }

  return expiresAt <= Date.now() + ACCESS_REFRESH_WINDOW_MS;
}

async function refreshSession(refreshToken: string): Promise<AuthSession | null> {
  const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as AuthSession;
}

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (!refreshToken || !shouldRefreshAccessToken(accessToken)) {
    return NextResponse.next();
  }

  try {
    const session = await refreshSession(refreshToken);
    const response = NextResponse.next();

    if (!session) {
      clearSessionCookies(response);
      return response;
    }

    applySessionCookies(response, session);
    return response;
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
