import { NextResponse } from "next/server";

import { createFlight } from "@/lib/api/pilot";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError } from "@/lib/observability/log";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      bookingId?: string;
    };
    const bookingId = payload.bookingId?.trim();

    if (!bookingId) {
      return NextResponse.json(
        {
          message: "La réservation à exploiter est requise.",
        },
        {
          status: 400,
        },
      );
    }

    const result = await executeWithBackendAccess((accessToken) =>
      createFlight(accessToken, {
        bookingId,
      }),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("pilot flight create failed", error);
    return createBackendErrorResponse(error);
  }
}
