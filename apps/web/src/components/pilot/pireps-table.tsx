import type { JSX } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import type { FlightResponse } from "@/lib/api/types";
import {
  formatDateTime,
  formatDurationMinutes,
  formatNullableText,
} from "@/lib/utils/format";
import { getPirepStatusPresentation } from "@/lib/utils/status";

type PirepsTableProps = {
  flights: FlightResponse[];
};

export function PirepsTable({ flights }: PirepsTableProps): JSX.Element {
  const pirepFlights = flights.filter((flight) => flight.pirep);

  if (pirepFlights.length === 0) {
    return (
      <EmptyState
        title="Aucun PIREP"
        description="Les rapports de vol soumis s’afficheront ici."
      />
    );
  }

  return (
    <DataTable
      columns={[
        {
          id: "flight",
          header: "Vol",
          render: (flight) => (
            <div className="table-primary">
              <strong>{flight.flightNumber}</strong>
              <span>
                {flight.departureAirport.icao} → {flight.arrivalAirport.icao}
              </span>
            </div>
          ),
        },
        {
          id: "status",
          header: "Statut",
          render: (flight) => {
            const pirep = flight.pirep;

            if (!pirep) {
              return <Badge label="Aucun" tone="neutral" />;
            }

            const status = getPirepStatusPresentation(pirep.status);
            return <Badge label={status.label} tone={status.tone} />;
          },
        },
        {
          id: "source",
          header: "Source",
          render: (flight) => (
            <span>{formatNullableText(flight.pirep?.source)}</span>
          ),
        },
        {
          id: "time",
          header: "Durée",
          render: (flight) => (
            <span>{formatDurationMinutes(flight.durationMinutes)}</span>
          ),
        },
        {
          id: "submitted",
          header: "Dernière activité",
          render: (flight) => (
            <span>
              {formatDateTime(flight.actualOnBlockAt ?? flight.actualLandingAt)}
            </span>
          ),
        },
        {
          id: "linked-flight",
          header: "Vol associé",
          render: (flight) => (
            <Link className="table-inline-link" href={`/vols?flight=${flight.id}`}>
              Voir le vol
            </Link>
          ),
        },
      ]}
      rowKey={(flight) => flight.id}
      rows={pirepFlights}
    />
  );
}
