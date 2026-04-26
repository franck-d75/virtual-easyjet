import { NextResponse } from "next/server";

import { initializeAdminAircraftTypes } from "@/lib/api/admin";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError } from "@/lib/observability/log";

export async function POST() {
  try {
    const result = await executeWithBackendAccess((accessToken) =>
      initializeAdminAircraftTypes(accessToken),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("admin aircraft type reference init failed", error);
    return createBackendErrorResponse(error);
  }
}
