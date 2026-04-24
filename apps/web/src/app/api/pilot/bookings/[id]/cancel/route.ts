import { cancelBooking } from "@/lib/api/pilot";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError } from "@/lib/observability/log";

type CancelBookingRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  _request: Request,
  context: CancelBookingRouteContext,
) {
  try {
    const { id } = await context.params;
    const bookingId = id.trim();

    const result = await executeWithBackendAccess((accessToken) =>
      cancelBooking(accessToken, bookingId),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("pilot booking cancel failed", error);
    return createBackendErrorResponse(error);
  }
}
