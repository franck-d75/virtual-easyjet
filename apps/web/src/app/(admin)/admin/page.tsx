import type { JSX } from "react";
import Link from "next/link";

import { AdminAcarsCleanupCard } from "@/components/admin/admin-acars-cleanup-card";
import { AdminSimbriefConfigCard } from "@/components/admin/admin-simbrief-config-card";
import { AdminStatsGrid } from "@/components/admin/admin-stats-grid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAdminSimbriefConfig, getAdminStats } from "@/lib/api/admin";
import type {
  AdminSimbriefConfigResponse,
  AdminStatsResponse,
} from "@/lib/api/types";
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

const EMPTY_ADMIN_SIMBRIEF_CONFIG: AdminSimbriefConfigResponse = {
  hasApiKey: false,
  maskedApiKey: null,
  updatedAt: null,
  updatedBy: null,
};

export default async function AdminDashboardPage(): Promise<JSX.Element> {
  const session = await requireAdminSession();
  let stats = EMPTY_ADMIN_STATS;
  let simbriefConfig = EMPTY_ADMIN_SIMBRIEF_CONFIG;
  let isDegraded = false;

  try {
    [stats, simbriefConfig] = await Promise.all([
      getAdminStats(session.accessToken),
      getAdminSimbriefConfig(session.accessToken),
    ]);
  } catch (error) {
    handleProtectedPageApiError(error);
    isDegraded = true;
    logWebWarning("admin dashboard data fetch failed", error);
  }

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
          <Button href="/admin/pireps" variant="secondary">
            Revoir les rapports
          </Button>
          <Button href="/admin/flotte">Gerer la flotte</Button>
          <Button href="/admin/routes" variant="secondary">
            Gerer les routes
          </Button>
        </div>
      </section>

      {isDegraded ? (
        <Card className="ops-card">
          <span className="section-eyebrow">Mode degrade</span>
          <h2>Le tableau d'administration reste disponible</h2>
          <p>
            Certaines donnees n'ont pas pu etre rechargees pour le moment. Les
            acces aux modules restent disponibles.
          </p>
        </Card>
      ) : null}

      <AdminStatsGrid stats={stats} />

      <section className="admin-grid">
        <AdminAcarsCleanupCard />
        <AdminSimbriefConfigCard initialConfig={simbriefConfig} />
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
          <span className="section-eyebrow">Validation</span>
          <h2>Rapports de vol</h2>
          <p>
            Controlez les PIREPs ACARS, appliquez une decision de validation ou
            de rejet et conservez une trace de revue propre.
          </p>
          <Link className="table-inline-link" href="/admin/pireps">
            Ouvrir la revue des rapports
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
            Maintenez les hubs actifs et leur rattachement aux aeroports de
            base.
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
