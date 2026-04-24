import type { JSX } from "react";

import { AdminRoutesManager } from "@/components/admin/admin-routes-manager";
import { getAdminReferenceData, listAdminRoutes } from "@/lib/api/admin";
import { requireAdminSession } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminRoutesPage(): Promise<JSX.Element> {
  const session = await requireAdminSession();
  const [routes, referenceData] = await Promise.all([
    listAdminRoutes(session.accessToken),
    getAdminReferenceData(session.accessToken),
  ]);

  return (
    <div className="admin-page">
      <section className="admin-page-header">
        <div>
          <span className="section-eyebrow">Administration routes</span>
          <h1>Gestion des routes</h1>
          <p>Publiez et maintenez les liaisons exploitées par la compagnie.</p>
        </div>
      </section>

      <AdminRoutesManager initialRoutes={routes} referenceData={referenceData} />
    </div>
  );
}
