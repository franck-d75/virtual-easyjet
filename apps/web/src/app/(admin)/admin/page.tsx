import type { JSX } from "react";
import Link from "next/link";

import { AdminStatsGrid } from "@/components/admin/admin-stats-grid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAdminStats } from "@/lib/api/admin";
import { requireAdminSession } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage(): Promise<JSX.Element> {
  const session = await requireAdminSession();
  const stats = await getAdminStats(session.accessToken);

  return (
    <div className="admin-page">
      <section className="admin-page-header">
        <div>
          <span className="section-eyebrow">Administration privee</span>
          <h1>Supervision de la plateforme</h1>
          <p>
            Accedez rapidement aux modules de gestion utilisateurs, flotte, hubs
            et routes depuis le tableau de pilotage prive.
          </p>
        </div>
        <div className="admin-page-actions">
          <Button href="/admin/utilisateurs">Gerer les utilisateurs</Button>
          <Button href="/admin/flotte">Gerer la flotte</Button>
          <Button href="/admin/routes" variant="secondary">
            Gerer les routes
          </Button>
        </div>
      </section>

      <AdminStatsGrid stats={stats} />

      <section className="admin-grid">
        <Card>
          <span className="section-eyebrow">Comptes</span>
          <h2>Utilisateurs</h2>
          <p>
            Supervisez les comptes, les avatars, les roles et les statuts depuis
            l'annuaire prive.
          </p>
          <Link className="table-inline-link" href="/admin/utilisateurs">
            Ouvrir la gestion utilisateurs
          </Link>
        </Card>
        <Card>
          <span className="section-eyebrow">Exploitation</span>
          <h2>Flotte</h2>
          <p>
            Creez, modifiez ou retirez les appareils disponibles pour la
            compagnie.
          </p>
          <Link className="table-inline-link" href="/admin/flotte">
            Ouvrir la gestion flotte
          </Link>
        </Card>
        <Card>
          <span className="section-eyebrow">Reseau</span>
          <h2>Hubs</h2>
          <p>
            Maintenez les hubs actifs et leur rattachement aux aeroports de base.
          </p>
          <Link className="table-inline-link" href="/admin/hubs">
            Ouvrir la gestion hubs
          </Link>
        </Card>
        <Card>
          <span className="section-eyebrow">Planification</span>
          <h2>Routes</h2>
          <p>
            Structurez le reseau publie et les couples depart/arrivee de la VA.
          </p>
          <Link className="table-inline-link" href="/admin/routes">
            Ouvrir la gestion routes
          </Link>
        </Card>
      </section>
    </div>
  );
}
