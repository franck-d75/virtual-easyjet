import { ApiError } from "@/lib/api/client";
import { getMySimbriefRouteOverlay } from "@/lib/api/pilot";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError, logWebWarning } from "@/lib/observability/log";

export async function GET() {
  try {
    const result = await executeWithBackendAccess((accessToken) =>
      getMySimbriefRouteOverlay(accessToken),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return createBackendJsonResponse(null);
    }

    if (error instanceof ApiError) {
      logWebWarning("live map simbrief route overlay unavailable", error);
      return createBackendJsonResponse(null);
    }

    logWebError("live map simbrief route overlay failed", error);
    return createBackendErrorResponse(error);
  }
}
