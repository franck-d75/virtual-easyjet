import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { fetchAuthenticatedUser, refreshWithBackend } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  ACCESS_COOKIE_NAME,
  applySessionCookies,
  clearSessionCookies,
  REFRESH_COOKIE_NAME,
} from "@/lib/auth/cookies";
import { logWebError } from "@/lib/observability/log";

const INVALID_SESSION_MESSAGE = "Session d’authentification invalide.";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

  if (accessToken) {
    try {
      const user = await fetchAuthenticatedUser(accessToken);
      return NextResponse.json({
        authenticated: true,
        user,
      });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        logWebError("session me failed", error);
      }
    }
  }

  if (!refreshToken) {
    const response = NextResponse.json(
      { authenticated: false, message: INVALID_SESSION_MESSAGE },
      { status: 401 },
    );
    clearSessionCookies(response);
    return response;
  }

  try {
    const session = await refreshWithBackend({ refreshToken });
    const user = await fetchAuthenticatedUser(session.tokens.accessToken);
    const response = NextResponse.json({
      authenticated: true,
      user,
    });

    applySessionCookies(response, session);
    return response;
  } catch {
    const response = NextResponse.json(
      { authenticated: false, message: INVALID_SESSION_MESSAGE },
      { status: 401 },
    );
    clearSessionCookies(response);
    return response;
  }
}
