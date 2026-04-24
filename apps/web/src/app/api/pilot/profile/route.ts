import { NextResponse } from "next/server";

import { updateMyPilotProfile } from "@/lib/api/pilot";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError } from "@/lib/observability/log";

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as {
      simbriefPilotId?: string | null;
    };

    const simbriefPilotId =
      typeof payload.simbriefPilotId === "string"
        ? payload.simbriefPilotId.trim() || null
        : payload.simbriefPilotId ?? null;

    if (
      simbriefPilotId !== null &&
      (typeof simbriefPilotId !== "string" || !/^\d+$/.test(simbriefPilotId))
    ) {
      return NextResponse.json(
        {
          message:
            "Le SimBrief Pilot ID doit contenir uniquement des chiffres.",
        },
        {
          status: 400,
        },
      );
    }

    const result = await executeWithBackendAccess((accessToken) =>
      updateMyPilotProfile(accessToken, {
        simbriefPilotId,
      }),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("pilot profile update failed", error);
    return createBackendErrorResponse(error);
  }
}
