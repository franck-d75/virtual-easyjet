import { deleteAdminRoute, updateAdminRoute } from "@/lib/api/admin";
import type { AdminRoutePayload } from "@/lib/api/types";
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
    const payload = (await request.json()) as Partial<AdminRoutePayload>;
    const result = await executeWithBackendAccess((accessToken) =>
      updateAdminRoute(accessToken, id, payload),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("admin route update failed", error);
    return createBackendErrorResponse(error);
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await executeWithBackendAccess((accessToken) =>
      deleteAdminRoute(accessToken, id),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("admin route delete failed", error);
    return createBackendErrorResponse(error);
  }
}
