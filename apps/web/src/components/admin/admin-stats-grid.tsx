import type { JSX } from "react";

import { Card } from "@/components/ui/card";
import type { AdminStatsResponse } from "@/lib/api/types";

type AdminStatsGridProps = {
  stats: AdminStatsResponse;
};

export function AdminStatsGrid({ stats }: AdminStatsGridProps): JSX.Element {
  const items = [
    { label: "Utilisateurs", value: stats.totalUsers },
    { label: "Pilotes", value: stats.totalPilots },
    { label: "Appareils", value: stats.totalAircraft },
    { label: "Hubs", value: stats.totalHubs },
    { label: "Routes", value: stats.totalRoutes },
    { label: "Réservations actives", value: stats.activeBookings },
    { label: "Vols en cours", value: stats.inProgressFlights },
  ];

  return (
    <section className="admin-stats-grid">
      {items.map((item) => (
        <Card className="admin-stat-card" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </Card>
      ))}
    </section>
  );
}
