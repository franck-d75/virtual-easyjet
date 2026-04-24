import type { JSX } from "react";

import { AdminHubsManager } from "@/components/admin/admin-hubs-manager";
import { getAdminReferenceData, listAdminHubs } from "@/lib/api/admin";
import { requireAdminSession } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminHubsPage(): Promise<JSX.Element> {
  const session = await requireAdminSession();
  const [hubs, referenceData] = await Promise.all([
    listAdminHubs(session.accessToken),
    getAdminReferenceData(session.accessToken),
  ]);

  return (
    <div className="admin-page">
      <section className="admin-page-header">
        <div>
          <span className="section-eyebrow">Administration hubs</span>
          <h1>Gestion des hubs</h1>
          <p>Maintenez les bases actives utilisées par les pilotes et la flotte.</p>
        </div>
      </section>

      <AdminHubsManager initialHubs={hubs} referenceData={referenceData} />
    </div>
  );
}
