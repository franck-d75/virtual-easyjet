import { NextResponse } from "next/server";

import { buildMySimbriefDispatchUrl } from "@/lib/api/pilot";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError } from "@/lib/observability/log";

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const bookingId = normalizeOptionalString(payload.bookingId);
    const returnUrl = normalizeOptionalString(payload.returnUrl);

    if (!bookingId) {
      return NextResponse.json(
        { message: "La reservation est requise." },
        { status: 400 },
      );
    }

    const result = await executeWithBackendAccess((accessToken) =>
      buildMySimbriefDispatchUrl(accessToken, {
        bookingId,
        ...(returnUrl ? { returnUrl } : {}),
      }),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("pilot simbrief dispatch url failed", error);
    return createBackendErrorResponse(error);
  }
}
