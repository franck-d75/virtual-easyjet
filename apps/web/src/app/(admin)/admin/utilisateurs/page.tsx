import type { JSX } from "react";

import { AdminUsersManager } from "@/components/admin/admin-users-manager";
import { Card } from "@/components/ui/card";
import { listAdminUsers } from "@/lib/api/admin";
import type { AdminUserSummaryResponse } from "@/lib/api/types";
import { requireAdminSession } from "@/lib/auth/guards";
import { logWebWarning } from "@/lib/observability/log";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage(): Promise<JSX.Element> {
  const session = await requireAdminSession();
  let users: AdminUserSummaryResponse[] = [];
  let isDegraded = false;

  try {
    const response = await listAdminUsers(session.accessToken);
    users = Array.isArray(response) ? response : [];
  } catch (error) {
    isDegraded = true;
    logWebWarning("admin users list fetch failed", error);
  }

  return (
    <div className="admin-page">
      <section className="admin-page-header">
        <div>
          <span className="section-eyebrow">Administration utilisateurs</span>
          <h1>Gestion des utilisateurs</h1>
          <p>
            Supervisez les comptes, les profils pilotes, les rôles et les statuts
            depuis un espace privé centralisé.
          </p>
        </div>
      </section>

      {isDegraded ? (
        <Card className="ops-card">
          <span className="section-eyebrow">Mode dégradé</span>
          <h2>La gestion utilisateurs reste accessible</h2>
          <p>
            L&apos;annuaire n&apos;a pas pu être rechargé complètement. La page
            reste disponible avec les données actuellement exploitables.
          </p>
        </Card>
      ) : null}

      <AdminUsersManager initialUsers={users} />
    </div>
  );
}
