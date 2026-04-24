import type { JSX } from "react";

import { AdminUserDetails } from "@/components/admin/admin-user-details";
import { getAdminUser } from "@/lib/api/admin";
import { requireAdminSession } from "@/lib/auth/guards";

type AdminUserDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function AdminUserDetailsPage({
  params,
}: AdminUserDetailsPageProps): Promise<JSX.Element> {
  const session = await requireAdminSession();
  const { id } = await params;
  const user = await getAdminUser(session.accessToken, id);

  return (
    <div className="admin-page">
      <section className="admin-page-header">
        <div>
          <span className="section-eyebrow">Administration utilisateurs</span>
          <h1>Fiche utilisateur</h1>
          <p>
            Consultez l'historique récent, ajustez l'accès et gérez l'identité
            pilote depuis une fiche privée unique.
          </p>
        </div>
      </section>

      <AdminUserDetails initialUser={user} />
    </div>
  );
}

