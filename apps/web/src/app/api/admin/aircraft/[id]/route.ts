import { deleteAdminAircraft, updateAdminAircraft } from "@/lib/api/admin";
import type { AdminAircraftPayload } from "@/lib/api/types";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError } from "@/lib/observability/log";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payload = (await request.json()) as Partial<AdminAircraftPayload>;
    const result = await executeWithBackendAccess((accessToken) =>
      updateAdminAircraft(accessToken, id, payload),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("admin aircraft update failed", error);
    return createBackendErrorResponse(error);
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await executeWithBackendAccess((accessToken) =>
      deleteAdminAircraft(accessToken, id),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("admin aircraft delete failed", error);
    return createBackendErrorResponse(error);
  }
}
