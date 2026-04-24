import type { JSX } from "react";

import { Card } from "@/components/ui/card";

type DashboardStatItem = {
  label: string;
  value: string;
  helper?: string;
};

type DashboardStatsProps = {
  items: DashboardStatItem[];
};

export function DashboardStats({ items }: DashboardStatsProps): JSX.Element {
  return (
    <section className="stats-grid dashboard-stats-grid">
      {items.map((item) => (
        <Card className="stat-card" key={item.label}>
          <strong>{item.value}</strong>
          <span>{item.label}</span>
          {item.helper ? <small>{item.helper}</small> : null}
        </Card>
      ))}
    </section>
  );
}
