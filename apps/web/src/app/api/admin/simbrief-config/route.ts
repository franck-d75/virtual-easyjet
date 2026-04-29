import { NextRequest } from "next/server";

import {
  getAdminSimbriefConfig,
  updateAdminSimbriefConfig,
} from "@/lib/api/admin";
import type { AdminSimbriefConfigPayload } from "@/lib/api/types";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError } from "@/lib/observability/log";

export async function GET() {
  try {
    const result = await executeWithBackendAccess((accessToken) =>
      getAdminSimbriefConfig(accessToken),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession, 200);
  } catch (error) {
    logWebError("admin simbrief config fetch failed", error);
    return createBackendErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = (await request.json()) as AdminSimbriefConfigPayload;
    const result = await executeWithBackendAccess((accessToken) =>
      updateAdminSimbriefConfig(accessToken, payload),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession, 200);
  } catch (error) {
    logWebError("admin simbrief config update failed", error);
    return createBackendErrorResponse(error);
  }
}
