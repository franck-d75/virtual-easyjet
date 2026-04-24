import { createAdminHub } from "@/lib/api/admin";
import type { AdminHubPayload } from "@/lib/api/types";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError } from "@/lib/observability/log";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AdminHubPayload;
    const result = await executeWithBackendAccess((accessToken) =>
      createAdminHub(accessToken, payload),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession, 201);
  } catch (error) {
    logWebError("admin hub create failed", error);
    return createBackendErrorResponse(error);
  }
}
