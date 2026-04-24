import type { JSX, ReactNode } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import type { BookingResponse } from "@/lib/api/types";
import { formatDateTime, formatDaysOfWeek } from "@/lib/utils/format";
import type { SimbriefVaMatchResult } from "@/lib/utils/simbrief-match";
import {
  getBookingStatusPresentation,
  getFlightStatusPresentation,
} from "@/lib/utils/status";
import { SimbriefMatchBadge } from "./simbrief-match-badge";

type BookingsTableProps = {
  bookings: BookingResponse[];
  simbriefMatches?: Record<string, SimbriefVaMatchResult>;
  renderActions?: (booking: BookingResponse) => ReactNode;
};

export function BookingsTable({
  bookings,
  simbriefMatches,
  renderActions,
}: BookingsTableProps): JSX.Element {
  if (bookings.length === 0) {
    return (
      <EmptyState
        title="Aucune réservation"
        description="Vos réservations apparaîtront ici dès qu’un vol sera réservé."
      />
    );
  }

  return (
    <DataTable
      columns={[
        {
          id: "flight",
          header: "Vol",
          render: (booking) => (
            <div className="table-primary">
              <strong>{booking.reservedFlightNumber}</strong>
              <span>{booking.route?.code ?? "Route libre"}</span>
            </div>
          ),
        },
        {
          id: "route",
          header: "Rotation",
          render: (booking) => (
            <div className="table-secondary">
              <strong>
                {booking.departureAirport.icao} → {booking.arrivalAirport.icao}
              </strong>
              <span>{booking.aircraft.aircraftType.name}</span>
            </div>
          ),
        },
        {
          id: "schedule",
          header: "Planning",
          render: (booking) => (
            <div className="table-secondary">
              <strong>{formatDateTime(booking.bookedFor)}</strong>
              <span>
                {booking.schedule
                  ? `${formatDaysOfWeek(booking.schedule.daysOfWeek)} · ${booking.schedule.departureTimeUtc}Z`
                  : "Hors planning"}
              </span>
            </div>
          ),
        },
        {
          id: "status",
          header: "Statut",
          render: (booking) => {
            const status = getBookingStatusPresentation(booking.status);
            return <Badge label={status.label} tone={status.tone} />;
          },
        },
        {
          id: "simbrief",
          header: "SimBrief",
          render: (booking) => {
            const match = simbriefMatches?.[booking.id];

            if (!match) {
              return <span className="table-muted">Analyse indisponible</span>;
            }

            return <SimbriefMatchBadge match={match} />;
          },
        },
        {
          id: "linked-flight",
          header: "Vol associé",
          render: (booking) => {
            if (!booking.flight) {
              return <span className="table-muted">Aucun vol créé</span>;
            }

            const status = getFlightStatusPresentation(booking.flight.status);

            return (
              <div className="table-badge-stack">
                <Badge label={status.label} tone={status.tone} />
                <Link
                  className="table-inline-link"
                  href={`/vols?flight=${booking.flight.id}`}
                >
                  Ouvrir le vol
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
                render: (booking: BookingResponse) => renderActions(booking),
              },
            ]
          : []),
      ]}
      rowKey={(booking) => booking.id}
      rows={bookings}
    />
  );
}
