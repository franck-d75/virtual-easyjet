import type { JSX } from "react";

import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils/format";

type StatsStripItem = {
  label: string;
  value: number;
};

type StatsStripProps = {
  items: StatsStripItem[];
};

export function StatsStrip({ items }: StatsStripProps): JSX.Element {
  return (
    <section className="stats-grid">
      {items.map((item) => (
        <Card className="stat-card" key={item.label}>
          <strong>{formatNumber(item.value)}</strong>
          <span>{item.label}</span>
        </Card>
      ))}
    </section>
  );
}
