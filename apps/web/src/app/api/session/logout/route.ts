import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { logoutWithBackend } from "@/lib/api/auth";
import { clearSessionCookies, REFRESH_COOKIE_NAME } from "@/lib/auth/cookies";
import { logWebWarning } from "@/lib/observability/log";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

  if (refreshToken) {
    try {
      await logoutWithBackend({ refreshToken });
    } catch (error) {
      logWebWarning("session logout backend warning", error);
    }
  }

  const response = NextResponse.json({ success: true });
  clearSessionCookies(response);

  return response;
}
