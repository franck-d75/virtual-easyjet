import { uploadMyAvatar } from "@/lib/api/pilot";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError } from "@/lib/observability/log";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await executeWithBackendAccess((accessToken) =>
      uploadMyAvatar(accessToken, formData),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("pilot avatar upload failed", error);
    return createBackendErrorResponse(error);
  }
}
