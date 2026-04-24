import { NextResponse } from "next/server";

import { loginWithBackend } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { applySessionCookies } from "@/lib/auth/cookies";
import { logWebError } from "@/lib/observability/log";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      identifier?: string;
      password?: string;
    };

    const identifier = payload.identifier?.trim();
    const password = payload.password?.trim();

    if (!identifier || !password) {
      return NextResponse.json(
        { message: "Identifiant et mot de passe requis." },
        { status: 400 },
      );
    }

    const session = await loginWithBackend({
      identifier,
      password,
    });

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

    logWebError("session login failed", error);
    return NextResponse.json(
      { message: "Connexion impossible pour le moment." },
      { status: 500 },
    );
  }
}
