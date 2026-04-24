import { NextResponse } from "next/server";

import { createAdminAircraft } from "@/lib/api/admin";
import type { AdminAircraftPayload } from "@/lib/api/types";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError } from "@/lib/observability/log";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AdminAircraftPayload;
    const result = await executeWithBackendAccess((accessToken) =>
      createAdminAircraft(accessToken, payload),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession, 201);
  } catch (error) {
    logWebError("admin aircraft create failed", error);
    return createBackendErrorResponse(error);
  }
}
