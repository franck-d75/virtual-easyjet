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
            Consultez l&apos;historique récent, ajustez l&apos;accès et gérez
            l&apos;identité pilote depuis une fiche privée unique.
          </p>
        </div>
      </section>

      {user ? (
        <AdminUserDetails initialUser={user} />
      ) : (
        <Card className="ops-card">
          <span className="section-eyebrow">Indisponible</span>
          <h2>La fiche utilisateur n&apos;a pas pu être chargée</h2>
          <p>
            Réessayez dans quelques instants. L&apos;authentification et les
            autres modules d&apos;administration restent disponibles.
          </p>
        </Card>
      )}
    </div>
  );
}
