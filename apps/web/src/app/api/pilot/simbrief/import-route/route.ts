import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { importMySimbriefRoute } from "@/lib/api/pilot";
import { logWebError } from "@/lib/observability/log";

export async function POST() {
  try {
    const result = await executeWithBackendAccess((accessToken) =>
      importMySimbriefRoute(accessToken),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("pilot simbrief import route failed", error);
    return createBackendErrorResponse(error);
  }
}
