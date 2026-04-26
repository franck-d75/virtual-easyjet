import type { JSX } from "react";

import { AdminHubsManager } from "@/components/admin/admin-hubs-manager";
import { Card } from "@/components/ui/card";
import { getAdminReferenceData, listAdminHubs } from "@/lib/api/admin";
import type { AdminReferenceDataResponse } from "@/lib/api/types";
import { requireAdminSession } from "@/lib/auth/guards";
import { logWebWarning } from "@/lib/observability/log";

export const dynamic = "force-dynamic";

const EMPTY_REFERENCE_DATA: AdminReferenceDataResponse = {
  airports: [],
  hubs: [],
  aircraftTypes: [],
  simbriefAirframes: [],
};

export default async function AdminHubsPage(): Promise<JSX.Element> {
  const session = await requireAdminSession();
  const [hubsResult, referenceDataResult] = await Promise.allSettled([
    listAdminHubs(session.accessToken),
    getAdminReferenceData(session.accessToken),
  ]);

  const hubs = hubsResult.status === "fulfilled" ? hubsResult.value : [];
  const referenceData =
    referenceDataResult.status === "fulfilled"
      ? referenceDataResult.value
      : EMPTY_REFERENCE_DATA;
  const isDegraded =
    hubsResult.status !== "fulfilled" ||
    referenceDataResult.status !== "fulfilled";

  if (hubsResult.status !== "fulfilled") {
    logWebWarning("admin hubs list fetch failed", hubsResult.reason);
  }

  if (referenceDataResult.status !== "fulfilled") {
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
