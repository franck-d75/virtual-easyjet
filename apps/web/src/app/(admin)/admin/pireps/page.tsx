import type { JSX } from "react";

import { AdminPirepsManager } from "@/components/admin/admin-pireps-manager";
import { Card } from "@/components/ui/card";
import { listAdminPireps } from "@/lib/api/admin";
import type { AdminPirepResponse } from "@/lib/api/types";
import {
  handleProtectedPageApiError,
  requireAdminSession,
} from "@/lib/auth/guards";
import { logWebWarning } from "@/lib/observability/log";

export const dynamic = "force-dynamic";

export default async function AdminPirepsPage(): Promise<JSX.Element> {
  const session = await requireAdminSession();
  let pireps: AdminPirepResponse[] = [];
  let isDegraded = false;

  try {
    const response = await listAdminPireps(session.accessToken);
    pireps = Array.isArray(response) ? response : [];
  } catch (error) {
    handleProtectedPageApiError(error);
    isDegraded = true;
    logWebWarning("admin pireps list fetch failed", error);
  }

  return (
    <div className="admin-page">
      <section className="admin-page-header">
        <div>
          <span className="section-eyebrow">Administration exploitation</span>
          <h1>Rapports de vol</h1>
          <p>
            Validez ou rejetez les PIREPs générés par ACARS et suivez l’historique
            des rapports déjà relus.
          </p>
        </div>
      </section>

      {isDegraded ? (
        <Card className="ops-card">
          <span className="section-eyebrow">Mode dégradé</span>
          <h2>La revue des rapports reste accessible</h2>
          <p>
            Les rapports de vol n&apos;ont pas pu être rechargés complètement pour
            le moment. Réessayez dans quelques instants.
          </p>
        </Card>
      ) : null}

      <AdminPirepsManager initialPireps={pireps} />
    </div>
  );
}
