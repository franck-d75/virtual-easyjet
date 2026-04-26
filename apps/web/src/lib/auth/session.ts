import { cache } from "react";
import { cookies } from "next/headers";

import { fetchAuthenticatedUser, refreshWithBackend } from "../api/auth";
import { ApiError } from "../api/client";
import type { UserMeResponse } from "../api/types";
import { logWebWarning } from "../observability/log";
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from "./cookies";

export interface WebSession {
  accessToken: string;
  refreshToken: string | null;
  user: UserMeResponse;
}

export const getServerSession = cache(async (): Promise<WebSession | null> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value ?? null;

  if (!accessToken) {
    return null;
  }

  try {
    const user = await fetchAuthenticatedUser(accessToken);

    return {
      accessToken,
      refreshToken,
      user,
    };
  } catch (error) {
    if (!refreshToken) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        logWebWarning("server session user lookup failed", error);
      }
      return null;
    }

    try {
      const refreshedSession = await refreshWithBackend({ refreshToken });
      const user = await fetchAuthenticatedUser(
        refreshedSession.tokens.accessToken,
      );

      return {
        accessToken: refreshedSession.tokens.accessToken,
        refreshToken: refreshedSession.tokens.refreshToken,
        user,
      };
    } catch (refreshError) {
      logWebWarning("server session refresh failed", refreshError);
      return null;
    }
  }
});
