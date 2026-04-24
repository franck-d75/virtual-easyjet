import type { JSX } from "react";

import { AdminUsersManager } from "@/components/admin/admin-users-manager";
import { listAdminUsers } from "@/lib/api/admin";
import { requireAdminSession } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage(): Promise<JSX.Element> {
  const session = await requireAdminSession();
  const users = await listAdminUsers(session.accessToken);

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

      <AdminUsersManager initialUsers={users} />
    </div>
  );
}

