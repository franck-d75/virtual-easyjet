import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import {
  linkAdminAircraftToSimbriefAirframe,
  unlinkAdminAircraftFromSimbriefAirframe,
} from "@/lib/api/admin";
import type { AdminAircraftLinkSimbriefAirframePayload } from "@/lib/api/types";
import { logWebError } from "@/lib/observability/log";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payload =
      (await request.json()) as AdminAircraftLinkSimbriefAirframePayload;
    const result = await executeWithBackendAccess((accessToken) =>
      linkAdminAircraftToSimbriefAirframe(accessToken, id, payload),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("admin aircraft simbrief airframe link failed", error);
    return createBackendErrorResponse(error);
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await executeWithBackendAccess((accessToken) =>
      unlinkAdminAircraftFromSimbriefAirframe(accessToken, id),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("admin aircraft simbrief airframe unlink failed", error);
    return createBackendErrorResponse(error);
  }
}
