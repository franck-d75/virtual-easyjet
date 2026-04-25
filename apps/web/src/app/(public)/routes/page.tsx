import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
            Explorez un réseau de lignes européennes pensé pour un rythme de VA
            réaliste, avec des rotations lisibles, fréquentes et cohérentes avec
            la flotte publiée.
          </p>
          <p>
            Chaque route met en avant son départ, son arrivée, sa distance et sa
            durée estimée afin de faciliter la préparation d'une rotation.
          </p>
        </section>

        {routes.length === 0 ? (
          <EmptyState
            title="Aucune route publiée"
            description="Les routes apparaîtront ici dès qu'elles seront disponibles."
          />
        ) : (
          <section className="card-grid">
            {routes.map((route) => (
              <Card key={route.id} className="showcase-card showcase-card--route">
                <div className="showcase-card__header">
                  <div>
                    <span className="section-eyebrow">{route.flightNumber}</span>
                    <h2>{route.code}</h2>
                    <p>
                      {route.aircraftType?.name ?? "Appareil libre"} ·{" "}
                      {route.departureHub?.name ?? route.departureAirport.name}
                    </p>
                  </div>
                  <Badge
                    label={route.isActive ? "Active" : "Inactive"}
                    tone={route.isActive ? "success" : "neutral"}
                  />
                </div>

                <div className="route-card__airports">
                  <div className="route-card__airport">
                    <span>Départ</span>
                    <strong>{route.departureAirport.icao}</strong>
                    <small>{route.departureAirport.city ?? route.departureAirport.name}</small>
                  </div>
                  <div className="route-card__connector" aria-hidden="true">
                    <span />
                  </div>
                  <div className="route-card__airport">
                    <span>Arrivée</span>
                    <strong>{route.arrivalAirport.icao}</strong>
                    <small>{route.arrivalAirport.city ?? route.arrivalAirport.name}</small>
                  </div>
                </div>

                <div className="definition-grid">
                  <div>
                    <span>Distance</span>
                    <strong>
                      {route.distanceNm
                        ? `${formatNumber(route.distanceNm)} NM`
                        : "Non renseignée"}
                    </strong>
                  </div>
                  <div>
                    <span>Durée estimée</span>
                    <strong>{formatDurationMinutes(route.blockTimeMinutes)}</strong>
                  </div>
                  <div>
                    <span>Appareil</span>
                    <strong>{route.aircraftType?.icaoCode ?? "Libre"}</strong>
                  </div>
                  <div>
                    <span>Hub départ</span>
                    <strong>{route.departureHub?.code ?? "-"}</strong>
                  </div>
                  <div>
                    <span>Hub arrivée</span>
                    <strong>{route.arrivalHub?.code ?? "-"}</strong>
                  </div>
                  <div>
                    <span>Rotation</span>
                    <strong>
                      {route.departureAirport.iata ?? route.departureAirport.icao} →{" "}
                      {route.arrivalAirport.iata ?? route.arrivalAirport.icao}
                    </strong>
                  </div>
                </div>
              </Card>
            ))}
          </section>
        )}
      </>
    );
  } catch (error) {
    logWebError("routes page failed", error);
    return (
      <ErrorState
        title="Routes indisponibles"
        description="Le réseau n'a pas pu être chargé depuis l'API."
      />
    );
  }
}
