import type { JSX, ReactNode } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import type { FlightResponse } from "@/lib/api/types";
import {
  formatDateTime,
  formatDurationMinutes,
  formatNumber,
} from "@/lib/utils/format";
import type { SimbriefVaMatchResult } from "@/lib/utils/simbrief-match";
import {
  getFlightStatusPresentation,
  getPirepStatusPresentation,
  getSessionStatusPresentation,
} from "@/lib/utils/status";
import { SimbriefMatchBadge } from "./simbrief-match-badge";

type FlightsTableProps = {
  flights: FlightResponse[];
  simbriefMatches?: Record<string, SimbriefVaMatchResult>;
  renderActions?: (flight: FlightResponse) => ReactNode;
};

export function FlightsTable({
  flights,
  simbriefMatches,
  renderActions,
}: FlightsTableProps): JSX.Element {
  const safeFlights = Array.isArray(flights) ? flights : [];

  if (safeFlights.length === 0) {
    return (
      <EmptyState
        title="Aucun vol"
        description="Vos vols apparaîtront ici dès qu’une réservation sera exploitée."
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
              <strong>{flight.flightNumber ?? "-"}</strong>
              <span>
                {flight.departureAirport?.icao ?? "-"} →{" "}
                {flight.arrivalAirport?.icao ?? "-"}
              </span>
            </div>
          ),
        },
        {
          id: "timing",
          header: "Horaires",
          render: (flight) => (
            <div className="table-secondary">
              <strong>
                {formatDateTime(
                  flight.actualOnBlockAt ?? flight.plannedOffBlockAt ?? null,
                )}
              </strong>
              <span>{formatDurationMinutes(flight.durationMinutes ?? null)}</span>
            </div>
          ),
        },
        {
          id: "distance",
          header: "Distance",
          render: (flight) => (
            <span>
              {typeof flight.distanceFlownNm === "number"
                ? `${formatNumber(flight.distanceFlownNm)} NM`
                : "-"}
            </span>
          ),
        },
        {
          id: "status",
          header: "Statut du vol",
          render: (flight) => {
            const status = getFlightStatusPresentation(flight.status);
            return <Badge label={status.label} tone={status.tone} />;
          },
        },
        {
          id: "simbrief",
          header: "SimBrief",
          render: (flight) => {
            const match = simbriefMatches?.[flight.id];

            if (!match) {
              return <span className="table-muted">Analyse indisponible</span>;
            }

            return <SimbriefMatchBadge match={match} />;
          },
        },
        {
          id: "session",
          header: "ACARS",
          render: (flight) => {
            if (!flight.acarsSession) {
              return <Badge label="Aucune session" tone="neutral" />;
            }

            const status = getSessionStatusPresentation(flight.acarsSession.status);
            return (
              <div className="table-badge-stack">
                <Badge label={status.label} tone={status.tone} />
                <small>{flight.acarsSession.detectedPhase}</small>
              </div>
            );
          },
        },
        {
          id: "pirep",
          header: "PIREP",
          render: (flight) => {
            if (!flight.pirep) {
              return <Badge label="Aucun PIREP" tone="neutral" />;
            }

            const status = getPirepStatusPresentation(flight.pirep.status);
            return (
              <div className="table-badge-stack">
                <Badge label={status.label} tone={status.tone} />
                <Link
                  className="table-inline-link"
                  href={`/pireps?flight=${flight.id}`}
                >
                  Voir le rapport
                </Link>
              </div>
            );
          },
        },
        ...(renderActions
          ? [
              {
                id: "actions",
                header: "Actions",
                className: "table-cell-actions",
                render: (flight: FlightResponse) => renderActions(flight),
              },
            ]
          : []),
      ]}
      rowKey={(flight) => flight.id}
      rows={safeFlights}
    />
  );
}
