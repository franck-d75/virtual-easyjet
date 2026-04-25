import { uploadAdminUserAvatar } from "@/lib/api/admin";
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

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const formData = await request.formData();
    const result = await executeWithBackendAccess((accessToken) =>
      uploadAdminUserAvatar(accessToken, id, formData),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("admin avatar upload failed", error);
    return createBackendErrorResponse(error);
  }
}
