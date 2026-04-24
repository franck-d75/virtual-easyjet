import { completeFlight } from "@/lib/api/pilot";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError } from "@/lib/observability/log";

type CompleteFlightRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: Request,
  context: CompleteFlightRouteContext,
) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      distanceFlownNm?: number;
      durationMinutes?: number;
    };
    const { id } = await context.params;
    const flightId = id.trim();

    const result = await executeWithBackendAccess((accessToken) =>
      completeFlight(accessToken, flightId, payload),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("pilot flight complete failed", error);
    return createBackendErrorResponse(error);
  }
}
