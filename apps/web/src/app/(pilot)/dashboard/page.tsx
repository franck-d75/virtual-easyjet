import type { JSX } from "react";

import { BookingsTable } from "@/components/pilot/bookings-table";
import { DashboardStats } from "@/components/pilot/dashboard-stats";
import { FlightsTable } from "@/components/pilot/flights-table";
import { PirepsTable } from "@/components/pilot/pireps-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getMyBookings, getMyFlights, getMyPilotProfile } from "@/lib/api/pilot";
import type { BookingResponse, FlightResponse } from "@/lib/api/types";
import { requirePilotSession } from "@/lib/auth/guards";
import { formatDateTime, formatDurationMinutes } from "@/lib/utils/format";
import {
  getFlightStatusPresentation,
  getPirepStatusPresentation,
  getSessionStatusPresentation,
} from "@/lib/utils/status";

type NextAction = {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

function getActiveFlight(flights: FlightResponse[]): FlightResponse | null {
  return (
    flights.find((flight) => flight.status === "IN_PROGRESS") ??
    flights.find((flight) => flight.status === "PLANNED") ??
    null
  );
}

function getOpenBooking(bookings: BookingResponse[]): BookingResponse | null {
  return (
    bookings.find(
      (booking) => booking.status === "RESERVED" && booking.flight === null,
    ) ?? null
  );
}

function getLatestPirepFlight(flights: FlightResponse[]): FlightResponse | null {
  return flights.find((flight) => flight.pirep !== null) ?? null;
}

function buildNextAction(
  bookings: BookingResponse[],
  flights: FlightResponse[],
): NextAction {
  const activeFlight = getActiveFlight(flights);

  if (activeFlight?.acarsSession) {
    return {
      eyebrow: "À faire maintenant",
      title: `Poursuivre ${activeFlight.flightNumber}`,
      description: `Votre vol est déjà suivi par ACARS (${activeFlight.acarsSession.detectedPhase}). Continuez l’exploitation dans le client desktop, puis revenez ici pour suivre le PIREP.`,
      primaryLabel: "Suivre mes vols",
      primaryHref: "/vols",
      secondaryLabel: "Voir mes PIREPs",
      secondaryHref: "/pireps",
    };
  }

  if (activeFlight) {
    return {
      eyebrow: "À faire maintenant",
      title: `Lancer l’exploitation de ${activeFlight.flightNumber}`,
      description:
        "Un vol canonique existe déjà. Ouvrez le client ACARS pour créer la session, envoyer la télémétrie et finaliser le PIREP.",
      primaryLabel: "Voir le vol actif",
      primaryHref: "/vols",
      secondaryLabel: "Voir mes réservations",
      secondaryHref: "/bookings",
    };
  }

  const openBooking = getOpenBooking(bookings);

  if (openBooking) {
    return {
      eyebrow: "À faire maintenant",
      title: `Exploiter ${openBooking.reservedFlightNumber}`,
      description:
        "Votre prochaine réservation est prête. Transformez-la en vol canonique puis poursuivez l’exploitation dans ACARS.",
      primaryLabel: "Ouvrir mes réservations",
      primaryHref: "/bookings",
      secondaryLabel: "Voir mes vols",
      secondaryHref: "/vols",
    };
  }

  return {
    eyebrow: "À faire maintenant",
    title: "Réserver une nouvelle rotation",
    description:
      "Aucun vol actif n’est en attente. Choisissez une rotation disponible depuis la page Réservations pour repartir sur un cycle complet réservation → vol → PIREP.",
    primaryLabel: "Choisir une rotation",
    primaryHref: "/bookings",
    secondaryLabel: "Explorer le réseau",
    secondaryHref: "/routes",
  };
}

export default async function DashboardPage(): Promise<JSX.Element> {
  const session = await requirePilotSession();
  const [profile, bookings, flights] = await Promise.all([
    getMyPilotProfile(session.accessToken),
    getMyBookings(session.accessToken),
    getMyFlights(session.accessToken),
  ]);

  const activeBookings = bookings.filter((booking) =>
    ["RESERVED", "IN_PROGRESS"].includes(booking.status),
  );
  const activeFlight = getActiveFlight(flights);
  const latestPirepFlight = getLatestPirepFlight(flights);
  const nextAction = buildNextAction(bookings, flights);
  const submittedPireps = flights.filter((flight) => flight.pirep !== null).length;
  const completedFlights = flights.filter(
    (flight) => flight.status === "COMPLETED",
  ).length;
  const nextBooking = getOpenBooking(bookings);

  return (
    <>
      <section className="page-hero">
        <span className="section-eyebrow">Espace pilote</span>
        <h1>Tableau de bord pilote</h1>
        <p>
          Retrouvez vos opérations en cours, vos réservations prioritaires et
          la prochaine action utile pour poursuivre votre activité sur Virtual
          Easyjet.
        </p>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Vue d’ensemble</span>
            <h2>Une lecture opérationnelle claire de votre activité</h2>
          </div>
          <p>
            L’objectif du tableau de bord est simple : vous montrer ce qui
            compte maintenant, sans vous noyer dans des données secondaires.
          </p>
        </div>

        <DashboardStats
          items={[
            {
              label: "Numéro pilote",
              value: profile.pilotNumber,
              helper: `${profile.firstName} ${profile.lastName}`,
            },
            {
              label: "Rang",
              value: profile.rank?.name ?? "Non attribué",
              helper: profile.hub?.name ?? "Aucun hub attribué",
            },
            {
              label: "Heures de vol",
              value: formatDurationMinutes(profile.hoursFlownMinutes),
              helper: `${profile.experiencePoints} XP`,
            },
            {
              label: "Réservations actives",
              value: String(activeBookings.length),
              helper: "Rotations réservées ou déjà exploitées",
            },
            {
              label: "Vols terminés",
              value: String(completedFlights),
              helper: "Historique canonique de vos exécutions",
            },
            {
              label: "PIREPs",
              value: String(submittedPireps),
              helper: "Rapports liés à vos vols",
            },
          ]}
        />
      </section>

      <section className="section-band">
        <section className="panel-grid">
          <Card className="ops-card ops-card--profile">
            <span className="section-eyebrow">Identité pilote</span>
            <div className="profile-spotlight">
              <UserAvatar
                avatarUrl={profile.user.avatarUrl}
                name={`${profile.firstName} ${profile.lastName}`}
                size="xl"
              />
              <div>
                <h2>
                  {profile.firstName} {profile.lastName}
                </h2>
                <p>
                  {profile.user.username} • {profile.rank?.name ?? "Rang non attribué"}
                </p>
              </div>
            </div>
            <div className="inline-actions">
              <Button href="/profil" variant="secondary">
                Ouvrir mon profil
              </Button>
            </div>
          </Card>
        </section>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">{nextAction.eyebrow}</span>
            <h2>{nextAction.title}</h2>
          </div>
          <p>{nextAction.description}</p>
        </div>

        <section className="panel-grid">
          <Card className="ops-card ops-card--highlight">
            <span className="section-eyebrow">Action prioritaire</span>
            <h2>{nextAction.title}</h2>
            <p>{nextAction.description}</p>
            <div className="inline-actions">
              <Button href={nextAction.primaryHref}>{nextAction.primaryLabel}</Button>
              {nextAction.secondaryHref && nextAction.secondaryLabel ? (
                <Button href={nextAction.secondaryHref} variant="secondary">
                  {nextAction.secondaryLabel}
                </Button>
              ) : null}
            </div>
          </Card>

          <Card className="ops-card">
            <span className="section-eyebrow">État des opérations</span>
            <h2>Lecture rapide de votre activité</h2>
            <div className="status-list">
              <div className="status-list__item">
                <span>Vol actif</span>
                {activeFlight ? (
                  <div className="table-badge-stack">
                    <Badge
                      label={getFlightStatusPresentation(activeFlight.status).label}
                      tone={getFlightStatusPresentation(activeFlight.status).tone}
                    />
                    <small>{activeFlight.flightNumber}</small>
                  </div>
                ) : (
                  <span className="table-muted">Aucun vol en cours</span>
                )}
              </div>
              <div className="status-list__item">
                <span>Session ACARS</span>
                {activeFlight?.acarsSession ? (
                  <div className="table-badge-stack">
                    <Badge
                      label={
                        getSessionStatusPresentation(
                          activeFlight.acarsSession.status,
                        ).label
                      }
                      tone={
                        getSessionStatusPresentation(
                          activeFlight.acarsSession.status,
                        ).tone
                      }
                    />
                    <small>{activeFlight.acarsSession.detectedPhase}</small>
                  </div>
                ) : (
                  <span className="table-muted">Aucune session ouverte</span>
                )}
              </div>
              <div className="status-list__item">
                <span>Dernier PIREP</span>
                {latestPirepFlight?.pirep ? (
                  <div className="table-badge-stack">
                    <Badge
                      label={
                        getPirepStatusPresentation(
                          latestPirepFlight.pirep.status,
                        ).label
                      }
                      tone={
                        getPirepStatusPresentation(
                          latestPirepFlight.pirep.status,
                        ).tone
                      }
                    />
                    <small>{latestPirepFlight.flightNumber}</small>
                  </div>
                ) : (
                  <span className="table-muted">Aucun PIREP soumis</span>
                )}
              </div>
            </div>
          </Card>
        </section>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Résumé pilote</span>
            <h2>L’essentiel à garder sous les yeux</h2>
          </div>
          <p>
            Les cartes ci-dessous relient réservations, vols et PIREPs pour
            vous permettre de reprendre une rotation rapidement.
          </p>
        </div>

        <section className="panel-grid">
          <Card className="ops-card">
            <span className="section-eyebrow">Prochaine réservation</span>
            <h2>{nextBooking?.reservedFlightNumber ?? "Aucune réservation ouverte"}</h2>
            <p>
              {nextBooking
                ? `Départ prévu le ${formatDateTime(nextBooking.bookedFor)}.`
                : "Passez par la page Réservations pour réserver une nouvelle rotation."}
            </p>
            <div className="inline-actions">
              <Button href="/bookings" variant="secondary">
                Gérer mes réservations
              </Button>
            </div>
          </Card>

          <Card className="ops-card">
            <span className="section-eyebrow">Vol en cours</span>
            <h2>{activeFlight?.flightNumber ?? "Aucun vol actif"}</h2>
            <p>
              {activeFlight
                ? `Rotation ${activeFlight.departureAirport.icao} → ${activeFlight.arrivalAirport.icao}.`
                : "Aucun vol canonique n’est actuellement en cours d’exploitation."}
            </p>
            <div className="inline-actions">
              <Button href="/vols" variant="secondary">
                Ouvrir mes vols
              </Button>
            </div>
          </Card>

          <Card className="ops-card ops-card--full">
            <span className="section-eyebrow">Dernier rapport</span>
            <h2>
              {latestPirepFlight?.flightNumber ?? "Aucun PIREP disponible"}
            </h2>
            <p>
              {latestPirepFlight?.pirep
                ? `Dernier statut : ${
                    getPirepStatusPresentation(latestPirepFlight.pirep.status).label
                  }.`
                : "Vos prochains rapports ACARS apparaîtront ici après la finalisation d’un vol."}
            </p>
            <div className="inline-actions">
              <Button href="/pireps" variant="secondary">
                Consulter mes PIREPs
              </Button>
            </div>
          </Card>
        </section>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Activité récente</span>
            <h2>Réservations, vols et rapports</h2>
          </div>
          <p>
            Les tableaux ci-dessous restent volontairement compacts : ils
            servent de relais rapide avant d’ouvrir la page détaillée.
          </p>
        </div>

        <section className="dashboard-grid">
          <Card>
            <h2>Mes réservations actives</h2>
            <BookingsTable bookings={bookings.slice(0, 5)} />
          </Card>
          <Card>
            <h2>Mes vols récents</h2>
            <FlightsTable flights={flights.slice(0, 5)} />
          </Card>
          <Card>
            <h2>Derniers PIREPs</h2>
            <PirepsTable flights={flights.slice(0, 8)} />
          </Card>
        </section>
      </section>
    </>
  );
}

