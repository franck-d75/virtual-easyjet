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
      avatarUrl?: string | null;
    };

    const simbriefPilotId =
      typeof payload.simbriefPilotId === "string"
        ? payload.simbriefPilotId.trim() || null
        : payload.simbriefPilotId ?? null;
    const avatarUrl =
      typeof payload.avatarUrl === "string"
        ? payload.avatarUrl.trim() || null
        : payload.avatarUrl ?? null;

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

    if (avatarUrl !== null) {
      let parsedUrl: URL | null = null;

      try {
        parsedUrl = new URL(avatarUrl);
      } catch {
        parsedUrl = null;
      }

      if (!parsedUrl || parsedUrl.protocol !== "https:") {
        return NextResponse.json(
          {
            message: "L’URL de l’avatar doit être une URL HTTPS valide.",
          },
          {
            status: 400,
          },
        );
      }
    }

    const result = await executeWithBackendAccess((accessToken) =>
      updateMyPilotProfile(accessToken, {
        simbriefPilotId,
        avatarUrl,
      }),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("pilot profile update failed", error);
    return createBackendErrorResponse(error);
  }
}
