import type { JSX } from "react";

import { AdminUserDetails } from "@/components/admin/admin-user-details";
import { Card } from "@/components/ui/card";
import { getAdminUser } from "@/lib/api/admin";
import type { AdminUserDetailResponse } from "@/lib/api/types";
import { requireAdminSession } from "@/lib/auth/guards";
import { logWebWarning } from "@/lib/observability/log";

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
  let user: AdminUserDetailResponse | null = null;

  try {
    user = await getAdminUser(session.accessToken, id);
  } catch (error) {
    logWebWarning("admin user details fetch failed", error);
  }

  return (
    <div className="admin-page">
      <section className="admin-page-header">
        <div>
          <span className="section-eyebrow">Administration utilisateurs</span>
          <h1>Fiche utilisateur</h1>
          <p>
            Consultez l&apos;historique recent, ajustez l&apos;acces et gerez
            l&apos;identite pilote depuis une fiche privee unique.
          </p>
        </div>
      </section>

      {user ? (
        <AdminUserDetails initialUser={user} />
      ) : (
        <Card className="ops-card">
          <span className="section-eyebrow">Indisponible</span>
          <h2>La fiche utilisateur n&apos;a pas pu etre chargee</h2>
          <p>
            Reessayez dans quelques instants. L&apos;authentification et les
            autres modules d&apos;administration restent disponibles.
          </p>
        </Card>
      )}
    </div>
  );
}
