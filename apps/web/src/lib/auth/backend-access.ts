import type { AuthSession } from "@va/shared";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { refreshWithBackend } from "../api/auth";
import { ApiError } from "../api/client";
import {
  ACCESS_COOKIE_NAME,
  applySessionCookies,
  clearSessionCookies,
  REFRESH_COOKIE_NAME,
} from "./cookies";

const INVALID_AUTH_SESSION_MESSAGE = "Session d’authentification invalide.";

export interface BackendAccessResult<T> {
  data: T;
  refreshedSession: AuthSession | null;
}

export async function executeWithBackendAccess<T>(
  request: (accessToken: string) => Promise<T>,
): Promise<BackendAccessResult<T>> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value ?? null;
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value ?? null;

  if (accessToken) {
    try {
      return {
        data: await request(accessToken),
        refreshedSession: null,
      };
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error;
      }
    }
  }

  if (!refreshToken) {
    throw new ApiError(INVALID_AUTH_SESSION_MESSAGE, 401);
  }

  const refreshedSession = await refreshWithBackend({ refreshToken });

  return {
    data: await request(refreshedSession.tokens.accessToken),
    refreshedSession,
  };
}

export function createBackendJsonResponse<T>(
  payload: T,
  refreshedSession: AuthSession | null = null,
  status = 200,
): NextResponse {
  const response = NextResponse.json(payload, { status });

  if (refreshedSession) {
    applySessionCookies(response, refreshedSession);
  }

  return response;
}

export function createBackendErrorResponse(error: unknown): NextResponse {
  const status = error instanceof ApiError ? error.status : 500;
  const message =
    error instanceof ApiError
      ? error.message
      : "L’action demandée est momentanément indisponible.";

  const response = NextResponse.json(
    {
      message,
    },
    {
      status,
    },
  );

  if (status === 401) {
    clearSessionCookies(response);
  }

  return response;
}
