import { NextRequest } from "next/server";

import { getAdminRules, updateAdminRules } from "@/lib/api/admin";
import type { AdminRulesPayload } from "@/lib/api/types";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError } from "@/lib/observability/log";

export async function GET() {
  try {
    const result = await executeWithBackendAccess((accessToken) =>
      getAdminRules(accessToken),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession, 200);
  } catch (error) {
    logWebError("admin rules fetch failed", error);
    return createBackendErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = (await request.json()) as AdminRulesPayload;
    const result = await executeWithBackendAccess((accessToken) =>
      updateAdminRules(accessToken, payload),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession, 200);
  } catch (error) {
    logWebError("admin rules update failed", error);
    return createBackendErrorResponse(error);
  }
}
