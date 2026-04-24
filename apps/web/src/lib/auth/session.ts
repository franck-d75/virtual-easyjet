import { cache } from "react";
import { cookies } from "next/headers";

import { fetchAuthenticatedUser } from "../api/auth";
import { ApiError } from "../api/client";
import type { UserMeResponse } from "../api/types";
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from "./cookies";

export interface WebSession {
  accessToken: string;
  refreshToken: string | null;
  user: UserMeResponse;
}

export const getServerSession = cache(async (): Promise<WebSession | null> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;

  if (!accessToken) {
    return null;
  }

  try {
    const user = await fetchAuthenticatedUser(accessToken);

    return {
      accessToken,
      refreshToken: cookieStore.get(REFRESH_COOKIE_NAME)?.value ?? null,
      user,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }

    throw error;
  }
});
