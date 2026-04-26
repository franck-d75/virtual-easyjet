import type { JSX } from "react";

import { AdminAircraftManager } from "@/components/admin/admin-aircraft-manager";
import { Card } from "@/components/ui/card";
import { getAdminReferenceData, listAdminAircraft } from "@/lib/api/admin";
import type { AdminReferenceDataResponse } from "@/lib/api/types";
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

function normalizeReferenceData(
  referenceData: AdminReferenceDataResponse | null | undefined,
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

export default async function AdminFleetPage(): Promise<JSX.Element> {
  const session = await requireAdminSession();
  const [aircraftResult, referenceDataResult] = await Promise.allSettled([
    listAdminAircraft(session.accessToken),
    getAdminReferenceData(session.accessToken),
  ]);

  const aircraft =
    aircraftResult.status === "fulfilled" && Array.isArray(aircraftResult.value)
      ? aircraftResult.value
      : [];
  const referenceData =
    referenceDataResult.status === "fulfilled"
      ? normalizeReferenceData(referenceDataResult.value)
      : EMPTY_REFERENCE_DATA;
  const isDegraded =
    aircraftResult.status !== "fulfilled" ||
    referenceDataResult.status !== "fulfilled";

  if (aircraftResult.status !== "fulfilled") {
    handleProtectedPageApiError(aircraftResult.reason);
    logWebWarning("admin fleet aircraft fetch failed", aircraftResult.reason);
  }

  if (referenceDataResult.status !== "fulfilled") {
    handleProtectedPageApiError(referenceDataResult.reason);
    logWebWarning(
      "admin fleet reference data fetch failed",
      referenceDataResult.reason,
    );
  }

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

      {isDegraded ? (
        <Card className="ops-card">
          <span className="section-eyebrow">Mode dégradé</span>
          <h2>La flotte reste consultable</h2>
          <p>
            Certaines données de référence sont temporairement indisponibles.
            Les appareils déjà récupérés restent affichés.
          </p>
        </Card>
      ) : null}

      <AdminAircraftManager
        initialAircraft={aircraft}
        referenceData={referenceData}
      />
    </div>
  );
}
