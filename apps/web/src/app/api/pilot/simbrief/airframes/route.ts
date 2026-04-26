import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { getMySimbriefAirframes } from "@/lib/api/pilot";
import { logWebError } from "@/lib/observability/log";

export async function GET() {
  try {
    const result = await executeWithBackendAccess((accessToken) =>
      getMySimbriefAirframes(accessToken),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("pilot simbrief airframes fetch failed", error);
    return createBackendErrorResponse(error);
  }
}
