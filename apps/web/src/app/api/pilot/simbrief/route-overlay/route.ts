import { ApiError } from "@/lib/api/client";
import { getMyLatestSimbriefOfp } from "@/lib/api/pilot";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError, logWebWarning } from "@/lib/observability/log";
import { buildSimbriefRouteOverlay } from "@/lib/utils/simbrief-route";

export async function GET() {
  try {
    const result = await executeWithBackendAccess((accessToken) =>
      getMyLatestSimbriefOfp(accessToken),
    );

    return createBackendJsonResponse(
      buildSimbriefRouteOverlay(result.data),
      result.refreshedSession,
    );
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
