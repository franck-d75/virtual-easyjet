import type { JSX } from "react";

import { AdminAircraftManager } from "@/components/admin/admin-aircraft-manager";
import { Card } from "@/components/ui/card";
import {
  listAdminAircraft,
  listAdminAircraftTypes,
  listAdminHubs,
  listAdminSimbriefAirframes,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { getPublicAircraft } from "@/lib/api/public";
import type {
  AdminReferenceDataResponse,
  AircraftResponse,
} from "@/lib/api/types";
import {
  handleProtectedPageApiError,
  requireAdminSession,
} from "@/lib/auth/guards";
import { logWebWarning } from "@/lib/observability/log";

export const dynamic = "force-dynamic";

const EMPTY_REFERENCE_DATA: AdminReferenceDataResponse = {
  airports: [],
  hubs: [],
  aircraftTypes: [],
  simbriefAirframes: [],
};

type AdminFleetIssue = {
  title: string;
  message: string;
};

function normalizeReferenceData(
  referenceData: Partial<AdminReferenceDataResponse> | null | undefined,
): AdminReferenceDataResponse {
  return {
    airports: Array.isArray(referenceData?.airports) ? referenceData.airports : [],
    hubs: Array.isArray(referenceData?.hubs) ? referenceData.hubs : [],
    aircraftTypes: Array.isArray(referenceData?.aircraftTypes)
      ? referenceData.aircraftTypes
      : [],
    simbriefAirframes: Array.isArray(referenceData?.simbriefAirframes)
      ? referenceData.simbriefAirframes
      : [],
  };
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `${error.status} ${error.message}`;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Erreur interne serveur";
}

export default async function AdminFleetPage(): Promise<JSX.Element> {
  const session = await requireAdminSession();
  const [
    aircraftResult,
    publicAircraftFallbackResult,
    aircraftTypesResult,
    hubsResult,
    simbriefAirframesResult,
  ] = await Promise.allSettled([
    listAdminAircraft(session.accessToken),
    getPublicAircraft(),
    listAdminAircraftTypes(session.accessToken),
    listAdminHubs(session.accessToken),
    listAdminSimbriefAirframes(session.accessToken),
  ]);

  const issues: AdminFleetIssue[] = [];

  if (aircraftResult.status !== "fulfilled") {
    handleProtectedPageApiError(aircraftResult.reason);
    logWebWarning("admin fleet aircraft fetch failed", aircraftResult.reason);
    issues.push({
      title: "Liste flotte admin",
      message:
        extractErrorMessage(aircraftResult.reason) +
        (publicAircraftFallbackResult.status === "fulfilled"
          ? " Les appareils publiés restent affichés en secours."
          : ""),
    });
  }

  if (aircraftTypesResult.status !== "fulfilled") {
    handleProtectedPageApiError(aircraftTypesResult.reason);
    logWebWarning(
      "admin fleet aircraft types fetch failed",
      aircraftTypesResult.reason,
    );
    issues.push({
      title: "Types appareil",
      message: extractErrorMessage(aircraftTypesResult.reason),
    });
  }

  if (hubsResult.status !== "fulfilled") {
    handleProtectedPageApiError(hubsResult.reason);
    logWebWarning("admin fleet hubs fetch failed", hubsResult.reason);
    issues.push({
      title: "Hubs",
      message: extractErrorMessage(hubsResult.reason),
    });
  }

  if (simbriefAirframesResult.status !== "fulfilled") {
    handleProtectedPageApiError(simbriefAirframesResult.reason);
    logWebWarning(
      "admin fleet simbrief airframes fetch failed",
      simbriefAirframesResult.reason,
    );
    issues.push({
      title: "Airframes SimBrief",
      message: extractErrorMessage(simbriefAirframesResult.reason),
    });
  }

  const aircraft: AircraftResponse[] =
    aircraftResult.status === "fulfilled" && Array.isArray(aircraftResult.value)
      ? aircraftResult.value
      : publicAircraftFallbackResult.status === "fulfilled" &&
          Array.isArray(publicAircraftFallbackResult.value)
        ? publicAircraftFallbackResult.value
        : [];

  const referenceData = normalizeReferenceData({
    ...EMPTY_REFERENCE_DATA,
    aircraftTypes:
      aircraftTypesResult.status === "fulfilled" ? aircraftTypesResult.value : [],
    hubs: hubsResult.status === "fulfilled" ? hubsResult.value : [],
    simbriefAirframes:
      simbriefAirframesResult.status === "fulfilled"
        ? simbriefAirframesResult.value
        : [],
  });

  return (
    <div className="admin-page">
      <section className="admin-page-header">
        <div>
          <span className="section-eyebrow">Administration flotte</span>
          <h1>Gestion de la flotte</h1>
          <p>
            Ajoutez, liez et maintenez les appareils réels de la compagnie
            virtuelle, y compris vos airframes SimBrief synchronisées.
          </p>
        </div>
      </section>

      {issues.length > 0 ? (
        <Card className="ops-card">
          <span className="section-eyebrow">Diagnostic admin</span>
          <h2>Certaines données n&apos;ont pas pu être chargées</h2>
          <p>
            La page reste accessible, et les appareils déjà disponibles
            continuent d&apos;être affichés quand un secours est possible.
          </p>
          <ul className="ops-list">
            {issues.map((issue) => (
              <li key={issue.title}>
                <strong>{issue.title} :</strong> {issue.message}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <AdminAircraftManager
        initialAircraft={aircraft}
        referenceData={referenceData}
      />
    </div>
  );
}
