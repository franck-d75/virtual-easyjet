import { NextResponse } from "next/server";

import { createBooking, getMyBookings } from "@/lib/api/pilot";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError } from "@/lib/observability/log";

export async function GET() {
  try {
    const result = await executeWithBackendAccess((accessToken) =>
      getMyBookings(accessToken),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("pilot bookings fetch failed", error);
    return createBackendErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      scheduleId?: string;
      routeId?: string;
      bookedFor?: string;
      notes?: string;
    };

    const scheduleId = payload.scheduleId?.trim();
    const routeId = payload.routeId?.trim();
    const bookedFor = payload.bookedFor?.trim();
    const notes = payload.notes?.trim();

    if (!scheduleId && !routeId) {
      return NextResponse.json(
        {
          message: "La route ou le planning est requis.",
        },
        {
          status: 400,
        },
      );
    }

    if (scheduleId && !bookedFor) {
      return NextResponse.json(
        {
          message: "La date de reservation est requise pour ce planning.",
        },
        {
          status: 400,
        },
      );
    }

    const result = await executeWithBackendAccess((accessToken) =>
      createBooking(accessToken, {
        ...(scheduleId ? { scheduleId } : {}),
        ...(routeId ? { routeId } : {}),
        ...(bookedFor ? { bookedFor } : {}),
        ...(notes ? { notes } : {}),
      }),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("pilot booking create failed", error);
    return createBackendErrorResponse(error);
  }
}
