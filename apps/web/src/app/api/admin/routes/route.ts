import { createAdminRoute } from "@/lib/api/admin";
import type { AdminRoutePayload } from "@/lib/api/types";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError } from "@/lib/observability/log";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AdminRoutePayload;
    const result = await executeWithBackendAccess((accessToken) =>
      createAdminRoute(accessToken, payload),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession, 201);
  } catch (error) {
    logWebError("admin route create failed", error);
    return createBackendErrorResponse(error);
  }
}
