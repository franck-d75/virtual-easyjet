import type { JSX } from "react";
import Link from "next/link";

import { AdminAcarsCleanupCard } from "@/components/admin/admin-acars-cleanup-card";
import { AdminStatsGrid } from "@/components/admin/admin-stats-grid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAdminStats } from "@/lib/api/admin";
import type { AdminStatsResponse } from "@/lib/api/types";
import {
  handleProtectedPageApiError,
  requireAdminSession,
} from "@/lib/auth/guards";
import { logWebWarning } from "@/lib/observability/log";

export const dynamic = "force-dynamic";

const EMPTY_ADMIN_STATS: AdminStatsResponse = {
  totalUsers: 0,
  totalPilots: 0,
  totalAircraft: 0,
  totalHubs: 0,
  totalRoutes: 0,
  activeBookings: 0,
  inProgressFlights: 0,
};

export default async function AdminDashboardPage(): Promise<JSX.Element> {
  const session = await requireAdminSession();
  let stats = EMPTY_ADMIN_STATS;
  let isDegraded = false;

  try {
    stats = await getAdminStats(session.accessToken);
  } catch (error) {
    handleProtectedPageApiError(error);
    isDegraded = true;
    logWebWarning("admin dashboard stats fetch failed", error);
  }

  return (
    <div className="admin-page">
      <section className="admin-page-header">
        <div>
          <span className="section-eyebrow">Administration privée</span>
          <h1>Supervision de la plateforme</h1>
          <p>
            Accédez rapidement aux modules de gestion utilisateurs, flotte, hubs
            et routes depuis le tableau de pilotage privé.
          </p>
        </div>
        <div className="admin-page-actions">
          <Button href="/admin/utilisateurs">Gérer les utilisateurs</Button>
          <Button href="/admin/flotte">Gérer la flotte</Button>
          <Button href="/admin/routes" variant="secondary">
            Gérer les routes
          </Button>
        </div>
      </section>

      {isDegraded ? (
        <Card className="ops-card">
          <span className="section-eyebrow">Mode degrade</span>
          <h2>Le tableau d&apos;administration reste disponible</h2>
          <p>
            Les statistiques globales n&apos;ont pas pu etre rechargees pour le
            moment. Les acces aux modules restent disponibles.
          </p>
        </Card>
      ) : null}

      <AdminStatsGrid stats={stats} />

      <section className="admin-grid">
        <AdminAcarsCleanupCard />
        <Card>
          <span className="section-eyebrow">Comptes</span>
          <h2>Utilisateurs</h2>
          <p>
            Supervisez les comptes, les avatars, les rôles et les statuts depuis
            l'annuaire privé.
          </p>
          <Link className="table-inline-link" href="/admin/utilisateurs">
            Ouvrir la gestion utilisateurs
          </Link>
        </Card>
        <Card>
          <span className="section-eyebrow">Exploitation</span>
          <h2>Flotte</h2>
          <p>
            Créez, modifiez ou retirez les appareils disponibles pour la
            compagnie.
          </p>
          <Link className="table-inline-link" href="/admin/flotte">
            Ouvrir la gestion flotte
          </Link>
        </Card>
        <Card>
          <span className="section-eyebrow">Réseau</span>
          <h2>Hubs</h2>
          <p>
            Maintenez les hubs actifs et leur rattachement aux aéroports de base.
          </p>
          <Link className="table-inline-link" href="/admin/hubs">
            Ouvrir la gestion hubs
          </Link>
        </Card>
        <Card>
          <span className="section-eyebrow">Planification</span>
          <h2>Routes</h2>
          <p>
            Structurez le réseau publié et les couples départ/arrivée de la VA.
          </p>
          <Link className="table-inline-link" href="/admin/routes">
            Ouvrir la gestion routes
          </Link>
        </Card>
      </section>
    </div>
  );
}

