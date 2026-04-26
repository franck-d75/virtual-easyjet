import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { syncMySimbriefAirframes } from "@/lib/api/pilot";
import { logWebError } from "@/lib/observability/log";

export async function POST() {
  try {
    const result = await executeWithBackendAccess((accessToken) =>
      syncMySimbriefAirframes(accessToken),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("pilot simbrief airframes sync failed", error);
    return createBackendErrorResponse(error);
  }
}
