import type { JSX } from "react";

import { ApiActionButton } from "@/components/pilot/api-action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { getPublicRouteCatalog } from "@/lib/api/public";
import { getMyBookings, getMyPilotProfile } from "@/lib/api/pilot";
import type { BookingResponse, RouteDetailResponse } from "@/lib/api/types";
import { getServerSession } from "@/lib/auth/session";
import { logWebError, logWebWarning } from "@/lib/observability/log";
import {
  buildBookingOpportunities,
  buildFirstOpportunityByRouteId,
  isActiveBooking,
  type BookingOpportunity,
} from "@/lib/utils/booking-opportunities";
import {
  formatDateTime,
  formatDaysOfWeek,
  formatDurationMinutes,
  formatNumber,
} from "@/lib/utils/format";

export const dynamic = "force-dynamic";

type RouteReservationContext = {
  isPilotSignedIn: boolean;
  activeBooking: BookingResponse | null;
  opportunityByRouteId: Map<string, BookingOpportunity>;
  pilotRankSortOrder: number | null;
  failedToLoad: boolean;
};

async function getRouteReservationContext(
  routes: RouteDetailResponse[],
): Promise<RouteReservationContext> {
  const session = await getServerSession();

  if (!session?.user.pilotProfile) {
    return {
      isPilotSignedIn: false,
      activeBooking: null,
      opportunityByRouteId: new Map(),
      pilotRankSortOrder: null,
      failedToLoad: false,
    };
  }

  try {
    const [profile, bookings] = await Promise.all([
      getMyPilotProfile(session.accessToken),
      getMyBookings(session.accessToken),
    ]);
    const activeBooking =
      bookings.find((booking) => isActiveBooking(booking)) ?? null;
    const opportunities = buildBookingOpportunities(
      routes,
      profile.rank?.sortOrder ?? null,
    );

    return {
      isPilotSignedIn: true,
      activeBooking,
      opportunityByRouteId: buildFirstOpportunityByRouteId(opportunities),
      pilotRankSortOrder: profile.rank?.sortOrder ?? null,
      failedToLoad: false,
    };
  } catch (error) {
    logWebWarning("routes reservation context failed", error);
    return {
      isPilotSignedIn: true,
      activeBooking: null,
      opportunityByRouteId: new Map(),
      pilotRankSortOrder: null,
      failedToLoad: true,
    };
  }
}

function isRouteRankAllowed(
  route: RouteDetailResponse,
  reservationContext: RouteReservationContext,
): boolean {
  const requiredRank = route.aircraftType?.minRank ?? null;

  return (
    !requiredRank ||
    (reservationContext.pilotRankSortOrder !== null &&
      reservationContext.pilotRankSortOrder >= requiredRank.sortOrder)
  );
}

function renderRouteAction(
  route: RouteDetailResponse,
  reservationContext: RouteReservationContext,
): JSX.Element {
  if (!reservationContext.isPilotSignedIn) {
    return (
      <div className="inline-actions">
        <Button href="/connexion" variant="secondary">
          Se connecter pour réserver
        </Button>
      </div>
    );
  }

  if (reservationContext.activeBooking) {
    return (
      <div className="inline-actions">
        <Button href="/reservation" variant="secondary">
          Ouvrir ma réservation
        </Button>
      </div>
    );
  }

  if (reservationContext.failedToLoad) {
    return (
      <p className="table-muted">
        La réservation est momentanément indisponible. Réessayez dans quelques
        instants.
      </p>
    );
  }

  const opportunity = reservationContext.opportunityByRouteId.get(route.id);

  if (!opportunity) {
    const requiredRank = route.aircraftType?.minRank ?? null;
    const isRankAllowed = isRouteRankAllowed(route, reservationContext);

    return (
      <>
        <div className="definition-grid">
          <div>
            <span>Réservation</span>
            <strong>Vol libre</strong>
          </div>
          <div>
            <span>Planning</span>
            <strong>À préparer via SimBrief</strong>
          </div>
          <div>
            <span>Appareil</span>
            <strong>{route.aircraftType?.icaoCode ?? "Attribué automatiquement"}</strong>
          </div>
          <div>
            <span>Rang requis</span>
            <strong>{requiredRank?.name ?? "Aucune contrainte"}</strong>
          </div>
        </div>
        <div className="inline-actions">
          <ApiActionButton
            body={{
              routeId: route.id,
              notes: "Réservation directe depuis la page Routes.",
            }}
            disabled={!isRankAllowed}
            endpoint="/api/pilot/bookings"
            label="Réserver ce vol"
            pendingLabel="Réservation..."
            redirectTo="/reservation"
            successMessage="Vol réservé. Ouverture de la page Réservation."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="definition-grid">
        <div>
          <span>Prochain départ UTC</span>
          <strong>{formatDateTime(opportunity.bookedFor)}</strong>
        </div>
        <div>
          <span>Planning</span>
          <strong>
            {formatDaysOfWeek(opportunity.schedule.daysOfWeek)} ·{" "}
            {opportunity.schedule.departureTimeUtc}Z
          </strong>
        </div>
        <div>
          <span>Appareil réservé</span>
          <strong>
            {opportunity.schedule.aircraft?.registration ?? "Non assigné"}
          </strong>
        </div>
        <div>
          <span>Rang requis</span>
          <strong>{opportunity.requiredRankName ?? "Aucune contrainte"}</strong>
        </div>
      </div>
      <div className="inline-actions">
        <ApiActionButton
          body={{
            scheduleId: opportunity.schedule.id,
            bookedFor: opportunity.bookedFor,
          }}
          disabled={!opportunity.isRankAllowed}
          endpoint="/api/pilot/bookings"
          label="Réserver ce vol"
          pendingLabel="Réservation..."
          redirectTo="/reservation"
          successMessage="Vol réservé. Ouverture de la page Réservation."
        />
      </div>
    </>
  );
}

export default async function RoutesPage(): Promise<JSX.Element> {
  try {
    const routes = await getPublicRouteCatalog();
    const reservationContext = await getRouteReservationContext(routes);

    return (
      <>
        <section className="page-hero">
          <span className="section-eyebrow">Routes</span>
          <h1>Réseau et routes</h1>
          <p>
            Les routes publiées définissent les rotations réelles exploitables
            par les pilotes, avec leur départ, leur arrivée, leur distance et
            leur durée estimée.
          </p>
          <p>
            Réservez une rotation depuis cette page, puis ouvrez la nouvelle
            page Réservation pour préparer le vol avec votre dernier OFP
            SimBrief.
          </p>
        </section>

        {routes.length === 0 ? (
          <EmptyState
            title="Aucune route publiée"
            description="Les routes apparaîtront ici dès qu'elles seront créées par l'administration."
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
                    <span>Type appareil</span>
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

                {renderRouteAction(route, reservationContext)}
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
