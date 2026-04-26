import type { JSX } from "react";

import { AdminRoutesManager } from "@/components/admin/admin-routes-manager";
import { Card } from "@/components/ui/card";
import { getAdminReferenceData, listAdminRoutes } from "@/lib/api/admin";
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

export default async function AdminRoutesPage(): Promise<JSX.Element> {
  const session = await requireAdminSession();
  const [routesResult, referenceDataResult] = await Promise.allSettled([
    listAdminRoutes(session.accessToken),
    getAdminReferenceData(session.accessToken),
  ]);

  const routes = routesResult.status === "fulfilled" ? routesResult.value : [];
  const referenceData =
    referenceDataResult.status === "fulfilled"
      ? referenceDataResult.value
      : EMPTY_REFERENCE_DATA;
  const isDegraded =
    routesResult.status !== "fulfilled" ||
    referenceDataResult.status !== "fulfilled";

  if (routesResult.status !== "fulfilled") {
    logWebWarning("admin routes list fetch failed", routesResult.reason);
  }

  if (referenceDataResult.status !== "fulfilled") {
    logWebWarning(
      "admin routes reference data fetch failed",
      referenceDataResult.reason,
    );
  }

  return (
    <div className="admin-page">
      <section className="admin-page-header">
        <div>
          <span className="section-eyebrow">Administration routes</span>
          <h1>Gestion des routes</h1>
          <p>Publiez et maintenez les liaisons exploitees par la compagnie.</p>
        </div>
      </section>

      {isDegraded ? (
        <Card className="ops-card">
          <span className="section-eyebrow">Mode degrade</span>
          <h2>Les routes restent accessibles</h2>
          <p>
            Certaines donnees n&apos;ont pas pu etre rechargees depuis l&apos;API.
            Les routes deja disponibles restent consultables.
          </p>
        </Card>
      ) : null}

      <AdminRoutesManager initialRoutes={routes} referenceData={referenceData} />
    </div>
  );
}
