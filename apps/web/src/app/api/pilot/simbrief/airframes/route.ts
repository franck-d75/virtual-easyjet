import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import {
  createMySimbriefAirframe,
  getMySimbriefAirframes,
} from "@/lib/api/pilot";
import { logWebError } from "@/lib/observability/log";

export async function GET() {
  try {
    const result = await executeWithBackendAccess((accessToken) =>
      getMySimbriefAirframes(accessToken),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("pilot simbrief airframes fetch failed", error);
    return createBackendErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Parameters<
      typeof createMySimbriefAirframe
    >[1];
    const result = await executeWithBackendAccess((accessToken) =>
      createMySimbriefAirframe(accessToken, payload),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("pilot simbrief airframe create failed", error);
    return createBackendErrorResponse(error);
  }
}
