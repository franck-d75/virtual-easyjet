import type { JSX } from "react";

import { AdminAircraftManager } from "@/components/admin/admin-aircraft-manager";
import { Card } from "@/components/ui/card";
import { getAdminReferenceData, listAdminAircraft } from "@/lib/api/admin";
import type { AdminReferenceDataResponse } from "@/lib/api/types";
import { requireAdminSession } from "@/lib/auth/guards";
import { logWebWarning } from "@/lib/observability/log";

export const dynamic = "force-dynamic";

const EMPTY_REFERENCE_DATA: AdminReferenceDataResponse = {
  airports: [],
  hubs: [],
  aircraftTypes: [],
};

export default async function AdminFleetPage(): Promise<JSX.Element> {
  const session = await requireAdminSession();
  const [aircraftResult, referenceDataResult] = await Promise.allSettled([
    listAdminAircraft(session.accessToken),
    getAdminReferenceData(session.accessToken),
  ]);

  const aircraft =
    aircraftResult.status === "fulfilled" ? aircraftResult.value : [];
  const referenceData =
    referenceDataResult.status === "fulfilled"
      ? referenceDataResult.value
      : EMPTY_REFERENCE_DATA;
  const isDegraded =
    aircraftResult.status !== "fulfilled" ||
    referenceDataResult.status !== "fulfilled";

  if (aircraftResult.status !== "fulfilled") {
    logWebWarning("admin fleet aircraft fetch failed", aircraftResult.reason);
  }

  if (referenceDataResult.status !== "fulfilled") {
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
          <p>Ajoutez et maintenez les appareils de la compagnie virtuelle.</p>
        </div>
      </section>

      {isDegraded ? (
        <Card className="ops-card">
          <span className="section-eyebrow">Mode degrade</span>
          <h2>La flotte reste consultable</h2>
          <p>
            Certaines donnees de reference sont temporairement indisponibles.
            Les appareils deja recuperes restent affiches.
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
