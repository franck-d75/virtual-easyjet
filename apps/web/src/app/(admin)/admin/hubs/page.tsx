import type { JSX } from "react";

import { AdminHubsManager } from "@/components/admin/admin-hubs-manager";
import { Card } from "@/components/ui/card";
import { getAdminReferenceData, listAdminHubs } from "@/lib/api/admin";
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

export default async function AdminHubsPage(): Promise<JSX.Element> {
  const session = await requireAdminSession();
  const [hubsResult, referenceDataResult] = await Promise.allSettled([
    listAdminHubs(session.accessToken),
    getAdminReferenceData(session.accessToken),
  ]);

  const hubs =
    hubsResult.status === "fulfilled" && Array.isArray(hubsResult.value)
      ? hubsResult.value
      : [];
  const referenceData =
    referenceDataResult.status === "fulfilled"
      ? normalizeReferenceData(referenceDataResult.value)
      : EMPTY_REFERENCE_DATA;
  const isDegraded =
    hubsResult.status !== "fulfilled" ||
    referenceDataResult.status !== "fulfilled";

  if (hubsResult.status !== "fulfilled") {
    handleProtectedPageApiError(hubsResult.reason);
    logWebWarning("admin hubs list fetch failed", hubsResult.reason);
  }

  if (referenceDataResult.status !== "fulfilled") {
    handleProtectedPageApiError(referenceDataResult.reason);
    logWebWarning(
      "admin hubs reference data fetch failed",
      referenceDataResult.reason,
    );
  }

  return (
    <div className="admin-page">
      <section className="admin-page-header">
        <div>
          <span className="section-eyebrow">Administration hubs</span>
          <h1>Gestion des hubs</h1>
          <p>Maintenez les bases actives utilisees par les pilotes et la flotte.</p>
        </div>
      </section>

      {isDegraded ? (
        <Card className="ops-card">
          <span className="section-eyebrow">Mode degrade</span>
          <h2>Les hubs restent accessibles</h2>
          <p>
            Certaines donnees de reference n&apos;ont pas pu etre rechargees. Les
            hubs deja recuperes restent visibles.
          </p>
        </Card>
      ) : null}

      <AdminHubsManager initialHubs={hubs} referenceData={referenceData} />
    </div>
  );
}
