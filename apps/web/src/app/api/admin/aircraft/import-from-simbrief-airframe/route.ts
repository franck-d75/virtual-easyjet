import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { importAdminAircraftFromSimbriefAirframe } from "@/lib/api/admin";
import type { AdminAircraftImportFromSimbriefAirframePayload } from "@/lib/api/types";
import { logWebError } from "@/lib/observability/log";

export async function POST(request: Request) {
  try {
    const payload =
      (await request.json()) as AdminAircraftImportFromSimbriefAirframePayload;
    const result = await executeWithBackendAccess((accessToken) =>
      importAdminAircraftFromSimbriefAirframe(accessToken, payload),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession, 201);
  } catch (error) {
    logWebError("admin aircraft import from simbrief airframe failed", error);
    return createBackendErrorResponse(error);
  }
}
