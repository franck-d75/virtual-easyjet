import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/client";
import { registerWithBackend } from "@/lib/api/auth";
import { applySessionCookies } from "@/lib/auth/cookies";
import { logWebError } from "@/lib/observability/log";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      email?: string;
      username?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
      countryCode?: string;
    };

    const countryCode = payload.countryCode?.trim();
    const registerPayload = {
      email: payload.email?.trim() ?? "",
      username: payload.username?.trim() ?? "",
      password: payload.password?.trim() ?? "",
      firstName: payload.firstName?.trim() ?? "",
      lastName: payload.lastName?.trim() ?? "",
      ...(countryCode ? { countryCode } : {}),
    };

    const session = await registerWithBackend(registerPayload);

    const response = NextResponse.json({
      authenticated: true,
      user: session.user,
    });

    applySessionCookies(response, session);

    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }

    logWebError("session register failed", error);
    return NextResponse.json(
      { message: "Inscription impossible pour le moment." },
      { status: 500 },
    );
  }
}
