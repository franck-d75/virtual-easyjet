import { NextResponse } from "next/server";

import {
  type UpdateMyPilotProfilePayload,
  updateMyPilotProfile,
} from "@/lib/api/pilot";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError } from "@/lib/observability/log";

function normalizeRequiredText(
  value: unknown,
  transform: (input: string) => string = (input) => input,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = transform(value.trim());
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeNullableText(
  value: unknown,
  transform: (input: string) => string = (input) => input,
): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = transform(value.trim());
  return normalized.length > 0 ? normalized : null;
}

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as UpdateMyPilotProfilePayload;

    const username = normalizeRequiredText(payload.username, (value) =>
      value.toLowerCase(),
    );
    const firstName = normalizeRequiredText(payload.firstName);
    const lastName = normalizeRequiredText(payload.lastName);
    const pilotNumber = normalizeNullableText(payload.pilotNumber, (value) =>
      value.toUpperCase(),
    );
    const countryCode = normalizeNullableText(payload.countryCode, (value) =>
      value.toUpperCase(),
    );
    const callsign = normalizeNullableText(payload.callsign, (value) =>
      value.toUpperCase(),
    );
    const simbriefPilotId = normalizeNullableText(payload.simbriefPilotId);
    const preferredHubId = normalizeNullableText(payload.preferredHubId);

    if (username !== undefined && !/^[a-z0-9._-]{3,24}$/i.test(username)) {
      return badRequest(
        "Le nom d'utilisateur doit contenir entre 3 et 24 caractères, avec lettres, chiffres, points, tirets ou underscores.",
      );
    }

    if (firstName !== undefined && firstName.length > 80) {
      return badRequest("Le prénom doit contenir entre 1 et 80 caractères.");
    }

    if (lastName !== undefined && lastName.length > 80) {
      return badRequest("Le nom doit contenir entre 1 et 80 caractères.");
    }

    if (
      pilotNumber !== undefined &&
      pilotNumber !== null &&
      !/^[A-Z0-9-]{3,16}$/.test(pilotNumber)
    ) {
      return badRequest(
        "Le numéro pilote doit contenir entre 3 et 16 caractères, avec lettres, chiffres ou tirets.",
      );
    }

    if (
      countryCode !== undefined &&
      countryCode !== null &&
      !/^[A-Z]{2}$/.test(countryCode)
    ) {
      return badRequest("Le pays doit être renseigné avec un code ISO à 2 lettres.");
    }

    if (
      callsign !== undefined &&
      callsign !== null &&
      !/^[A-Z0-9-]{2,16}$/.test(callsign)
    ) {
      return badRequest(
        "L'indicatif doit contenir entre 2 et 16 caractères, avec lettres, chiffres ou tirets.",
      );
    }

    if (
      simbriefPilotId !== undefined &&
      simbriefPilotId !== null &&
      !/^\d+$/.test(simbriefPilotId)
    ) {
      return badRequest(
        "Le SimBrief Pilot ID doit contenir uniquement des chiffres.",
      );
    }

    const updatePayload: UpdateMyPilotProfilePayload = {
      ...(username !== undefined ? { username } : {}),
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(pilotNumber !== undefined ? { pilotNumber } : {}),
      ...(countryCode !== undefined ? { countryCode } : {}),
      ...(callsign !== undefined ? { callsign } : {}),
      ...(simbriefPilotId !== undefined ? { simbriefPilotId } : {}),
      ...(preferredHubId !== undefined ? { preferredHubId } : {}),
    };

    const result = await executeWithBackendAccess((accessToken) =>
      updateMyPilotProfile(accessToken, updatePayload),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("pilot profile update failed", error);
    return createBackendErrorResponse(error);
  }
}
