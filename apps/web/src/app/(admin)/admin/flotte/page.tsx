import type { JSX } from "react";

import { AdminAircraftManager } from "@/components/admin/admin-aircraft-manager";
import { getAdminReferenceData, listAdminAircraft } from "@/lib/api/admin";
import { requireAdminSession } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminFleetPage(): Promise<JSX.Element> {
  const session = await requireAdminSession();
  const [aircraft, referenceData] = await Promise.all([
    listAdminAircraft(session.accessToken),
    getAdminReferenceData(session.accessToken),
  ]);

  return (
    <div className="admin-page">
      <section className="admin-page-header">
        <div>
          <span className="section-eyebrow">Administration flotte</span>
          <h1>Gestion de la flotte</h1>
          <p>Ajoutez et maintenez les appareils de la compagnie virtuelle.</p>
        </div>
      </section>

      <AdminAircraftManager
        initialAircraft={aircraft}
        referenceData={referenceData}
      />
    </div>
  );
}
