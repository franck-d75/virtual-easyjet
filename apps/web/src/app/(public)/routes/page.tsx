import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { getPublicRoutes } from "@/lib/api/public";
import { logWebError } from "@/lib/observability/log";
import { formatDurationMinutes, formatNumber } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function RoutesPage(): Promise<JSX.Element> {
  try {
    const routes = await getPublicRoutes();

    return (
      <>
        <section className="page-hero">
          <span className="section-eyebrow">Routes</span>
          <h1>Réseau et routes</h1>
          <p>
            Explorez notre réseau de lignes virtuelles et choisissez vos
            rotations selon votre appareil, votre niveau et vos préférences.
          </p>
          <p>
            Le système de réservation vous permet de sélectionner vos vols, de
            suivre vos opérations et d’exploiter votre planning comme dans une
            véritable compagnie virtuelle.
          </p>
        </section>

        {routes.length === 0 ? (
          <EmptyState
            title="Aucune route publiée"
            description="Les routes apparaîtront ici dès qu’elles seront disponibles."
          />
        ) : (
          <Card>
            <DataTable
              columns={[
                {
                  id: "route",
                  header: "Route",
                  render: (route) => (
                    <div className="table-primary">
                      <strong>{route.code}</strong>
                      <span>{route.flightNumber}</span>
                    </div>
                  ),
                },
                {
                  id: "rotation",
                  header: "Rotation",
                  render: (route) => (
                    <div className="table-secondary">
                      <strong>
                        {route.departureAirport.icao} → {route.arrivalAirport.icao}
                      </strong>
                      <span>
                        {route.departureAirport.city ?? route.departureAirport.name} ·{" "}
                        {route.arrivalAirport.city ?? route.arrivalAirport.name}
                      </span>
                    </div>
                  ),
                },
                {
                  id: "aircraft",
                  header: "Appareil",
                  render: (route) => (
                    <span>{route.aircraftType?.name ?? "Libre"}</span>
                  ),
                },
                {
                  id: "distance",
                  header: "Distance",
                  render: (route) => (
                    <span>
                      {route.distanceNm ? `${formatNumber(route.distanceNm)} NM` : "-"}
                    </span>
                  ),
                },
                {
                  id: "block",
                  header: "Temps bloc",
                  render: (route) => (
                    <span>{formatDurationMinutes(route.blockTimeMinutes)}</span>
                  ),
                },
                {
                  id: "status",
                  header: "Statut",
                  render: (route) => (
                    <Badge
                      label={route.isActive ? "Active" : "Inactive"}
                      tone={route.isActive ? "success" : "neutral"}
                    />
                  ),
                },
              ]}
              rowKey={(route) => route.id}
              rows={routes}
            />
          </Card>
        )}
      </>
    );
  } catch (error) {
    logWebError("routes page failed", error);
    return (
      <ErrorState
        title="Routes indisponibles"
        description="Le réseau n’a pas pu être chargé depuis l’API."
      />
    );
  }
}
