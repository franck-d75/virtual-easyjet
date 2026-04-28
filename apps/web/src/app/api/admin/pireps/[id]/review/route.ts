import { reviewAdminPirep } from "@/lib/api/admin";
import type { AdminPirepReviewPayload } from "@/lib/api/types";
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
    const payload = (await request.json()) as AdminPirepReviewPayload;
    const result = await executeWithBackendAccess((accessToken) =>
      reviewAdminPirep(accessToken, id, payload),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("admin pirep review failed", error);
    return createBackendErrorResponse(error);
  }
}
