import { resyncMyPilotProgress } from "@/lib/api/pilot";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError } from "@/lib/observability/log";

export async function POST() {
  try {
    const result = await executeWithBackendAccess((accessToken) =>
      resyncMyPilotProgress(accessToken),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("pilot profile progress resync failed", error);
    return createBackendErrorResponse(error);
  }
}
