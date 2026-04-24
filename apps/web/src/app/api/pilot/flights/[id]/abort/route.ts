import { abortFlight } from "@/lib/api/pilot";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError } from "@/lib/observability/log";

type AbortFlightRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, context: AbortFlightRouteContext) {
  try {
    const { id } = await context.params;
    const flightId = id.trim();

    const result = await executeWithBackendAccess((accessToken) =>
      abortFlight(accessToken, flightId),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("pilot flight abort failed", error);
    return createBackendErrorResponse(error);
  }
}
