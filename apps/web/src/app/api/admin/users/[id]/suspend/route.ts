import { suspendAdminUser } from "@/lib/api/admin";
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

export async function PATCH(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await executeWithBackendAccess((accessToken) =>
      suspendAdminUser(accessToken, id),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("admin user suspend failed", error);
    return createBackendErrorResponse(error);
  }
}
