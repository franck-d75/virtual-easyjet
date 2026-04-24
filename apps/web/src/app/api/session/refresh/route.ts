import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { refreshWithBackend } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  applySessionCookies,
  clearSessionCookies,
  REFRESH_COOKIE_NAME,
} from "@/lib/auth/cookies";

const INVALID_SESSION_MESSAGE = "Session d’authentification invalide.";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

  if (!refreshToken) {
    const response = NextResponse.json(
      { message: INVALID_SESSION_MESSAGE },
      { status: 401 },
    );
    clearSessionCookies(response);
    return response;
  }

  try {
    const session = await refreshWithBackend({ refreshToken });
    const response = NextResponse.json({
      authenticated: true,
      user: session.user,
    });

    applySessionCookies(response, session);

    return response;
  } catch (error) {
    const response = NextResponse.json(
      {
        message:
          error instanceof ApiError ? error.message : INVALID_SESSION_MESSAGE,
      },
      {
        status: error instanceof ApiError ? error.status : 401,
      },
    );
    clearSessionCookies(response);
    return response;
  }
}
