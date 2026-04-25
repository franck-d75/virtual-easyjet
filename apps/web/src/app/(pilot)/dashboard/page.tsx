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
import { getPublicRanks } from "@/lib/api/public";
import type {
  BookingResponse,
  FlightResponse,
  RankResponse,
} from "@/lib/api/types";
import { requirePilotSession } from "@/lib/auth/guards";
import {
  formatDateTime,
  formatDurationMinutes,
  formatNumber,
} from "@/lib/utils/format";
import {
  getBookingStatusPresentation,
  getFlightStatusPresentation,
  getPirepStatusPresentation,
  getSessionStatusPresentation,
  type BadgeTone,
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

type RecentActivityItem = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  occurredAt: string | null;
  badgeLabel: string;
  badgeTone: BadgeTone;
};

type RankProgress = {
  currentRankName: string;
  nextRankName: string;
  overallPercent: number;
  flightsCompleted: number;
  flightsRequired: number;
  flightsRemaining: number;
  hoursFlownMinutes: number;
  hoursRequiredMinutes: number;
  hoursRemainingMinutes: number;
};

function toTimestamp(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getActiveFlight(flights: FlightResponse[]): FlightResponse | null {
  return (
    [...flights]
      .sort(
        (left, right) =>
          toTimestamp(right.plannedOffBlockAt ?? right.booking.bookedFor) -
          toTimestamp(left.plannedOffBlockAt ?? left.booking.bookedFor),
      )
      .find((flight) => ["IN_PROGRESS", "PLANNED"].includes(flight.status)) ??
    null
  );
}

function getNextAvailableRotation(bookings: BookingResponse[]): BookingResponse | null {
  return (
    [...bookings]
      .filter(
        (booking) => booking.status === "RESERVED" && booking.flight === null,
      )
      .sort(
        (left, right) =>
          toTimestamp(left.bookedFor) - toTimestamp(right.bookedFor),
      )[0] ?? null
  );
}

function getLatestCompletedFlight(flights: FlightResponse[]): FlightResponse | null {
  return (
    [...flights]
      .filter((flight) => flight.status === "COMPLETED")
      .sort(
        (left, right) =>
          toTimestamp(right.actualOnBlockAt ?? right.actualLandingAt) -
          toTimestamp(left.actualOnBlockAt ?? left.actualLandingAt),
      )[0] ?? null
  );
}

function getLatestPirepFlight(flights: FlightResponse[]): FlightResponse | null {
  return (
    [...flights]
      .filter((flight) => flight.pirep !== null)
      .sort(
        (left, right) =>
          toTimestamp(right.actualOnBlockAt ?? right.actualLandingAt) -
          toTimestamp(left.actualOnBlockAt ?? left.actualLandingAt),
      )[0] ?? null
  );
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
      description: `Votre vol est déjà suivi par ACARS (${activeFlight.acarsSession.detectedPhase}). Continuez l'exploitation dans le client desktop, puis revenez ici pour suivre le PIREP.`,
      primaryLabel: "Suivre mes vols",
      primaryHref: "/vols",
      secondaryLabel: "Voir mes PIREPs",
      secondaryHref: "/pireps",
    };
  }

  if (activeFlight) {
    return {
      eyebrow: "À faire maintenant",
      title: `Lancer l'exploitation de ${activeFlight.flightNumber}`,
      description:
        "Un vol canonique existe déjà. Ouvrez le client ACARS pour créer la session, envoyer la télémétrie et finaliser le PIREP.",
      primaryLabel: "Voir le vol actif",
      primaryHref: "/vols",
      secondaryLabel: "Voir mes réservations",
      secondaryHref: "/bookings",
    };
  }

  const nextRotation = getNextAvailableRotation(bookings);

  if (nextRotation) {
    return {
      eyebrow: "À faire maintenant",
      title: `Préparer ${nextRotation.reservedFlightNumber}`,
      description:
        "Votre prochaine rotation est déjà réservée. Elle peut être transformée en vol canonique, puis exploitée dans ACARS.",
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
      "Aucun vol actif n'est en attente. Choisissez une rotation disponible depuis la page Réservations pour repartir sur un cycle complet réservation → vol → PIREP.",
    primaryLabel: "Choisir une rotation",
    primaryHref: "/bookings",
    secondaryLabel: "Explorer le réseau",
    secondaryHref: "/routes",
  };
}

function buildRankProgress(
  currentRankCode: string | null,
  currentRankName: string | null,
  hoursFlownMinutes: number,
  completedFlights: number,
  ranks: RankResponse[],
): RankProgress | null {
  const orderedRanks = ranks
    .filter((rank) => rank.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  const currentRank = currentRankCode
    ? orderedRanks.find((rank) => rank.code === currentRankCode) ?? null
    : null;
  const nextRank = currentRank
    ? orderedRanks.find((rank) => rank.sortOrder > currentRank.sortOrder) ?? null
    : orderedRanks[0] ?? null;

  if (!nextRank) {
    return null;
  }

  const flightsRequired = Math.max(nextRank.minFlights, 1);
  const hoursRequiredMinutes = Math.max(nextRank.minHoursMinutes, 1);
  const flightsRemaining = Math.max(nextRank.minFlights - completedFlights, 0);
  const hoursRemainingMinutes = Math.max(
    nextRank.minHoursMinutes - hoursFlownMinutes,
    0,
  );
  const flightsProgress = Math.min(completedFlights / flightsRequired, 1);
  const hoursProgress = Math.min(hoursFlownMinutes / hoursRequiredMinutes, 1);

  return {
    currentRankName: currentRankName ?? "Rang non attribué",
    nextRankName: nextRank.name,
    overallPercent: Math.round(((flightsProgress + hoursProgress) / 2) * 100),
    flightsCompleted: completedFlights,
    flightsRequired,
    flightsRemaining,
    hoursFlownMinutes,
    hoursRequiredMinutes,
    hoursRemainingMinutes,
  };
}

function buildRecentActivity(
  bookings: BookingResponse[],
  flights: FlightResponse[],
): RecentActivityItem[] {
  const items: RecentActivityItem[] = [];
  const nextRotation = getNextAvailableRotation(bookings);
  const activeFlight = getActiveFlight(flights);
  const latestCompletedFlight = getLatestCompletedFlight(flights);
  const latestPirepFlight = getLatestPirepFlight(flights);

  if (nextRotation) {
    const bookingStatus = getBookingStatusPresentation(nextRotation.status);
    items.push({
      id: `booking-${nextRotation.id}`,
      eyebrow: "Réservation prête",
      title: `${nextRotation.reservedFlightNumber} · ${nextRotation.departureAirport.icao} → ${nextRotation.arrivalAirport.icao}`,
      description: "Rotation déjà réservée et prête à être exploitée depuis l'espace pilote.",
      occurredAt: nextRotation.bookedFor,
      badgeLabel: bookingStatus.label,
      badgeTone: bookingStatus.tone,
    });
  }

  if (activeFlight) {
    const flightStatus = getFlightStatusPresentation(activeFlight.status);
    items.push({
      id: `flight-${activeFlight.id}`,
      eyebrow: "Vol actif",
      title: `${activeFlight.flightNumber} · ${activeFlight.departureAirport.icao} → ${activeFlight.arrivalAirport.icao}`,
      description:
        activeFlight.acarsSession !== null
          ? `Session ACARS ${activeFlight.acarsSession.detectedPhase.toLowerCase().replaceAll("_", " ")}.`
          : "Vol canonique créé, prêt pour un suivi ACARS live.",
      occurredAt: activeFlight.plannedOffBlockAt ?? activeFlight.booking.bookedFor,
      badgeLabel: flightStatus.label,
      badgeTone: flightStatus.tone,
    });
  }

  if (latestCompletedFlight) {
    const completedStatus = getFlightStatusPresentation(latestCompletedFlight.status);
    items.push({
      id: `completed-${latestCompletedFlight.id}`,
      eyebrow: "Dernier vol",
      title: `${latestCompletedFlight.flightNumber} · ${latestCompletedFlight.departureAirport.icao} → ${latestCompletedFlight.arrivalAirport.icao}`,
      description: `Rotation bouclée en ${formatDurationMinutes(latestCompletedFlight.durationMinutes)} avec ${latestCompletedFlight.distanceFlownNm ? `${formatNumber(latestCompletedFlight.distanceFlownNm)} NM` : "distance non renseignée"}.`,
      occurredAt:
        latestCompletedFlight.actualOnBlockAt ?? latestCompletedFlight.actualLandingAt,
      badgeLabel: completedStatus.label,
      badgeTone: completedStatus.tone,
    });
  }

  if (latestPirepFlight?.pirep) {
    const pirepStatus = getPirepStatusPresentation(latestPirepFlight.pirep.status);
    items.push({
      id: `pirep-${latestPirepFlight.pirep.id}`,
      eyebrow: "Dernier PIREP",
      title: `${latestPirepFlight.flightNumber} · rapport ${pirepStatus.label.toLowerCase()}`,
      description:
        "Le rapport automatique est disponible depuis la page PIREPs avec son statut de validation.",
      occurredAt:
        latestPirepFlight.actualOnBlockAt ?? latestPirepFlight.actualLandingAt,
      badgeLabel: pirepStatus.label,
      badgeTone: pirepStatus.tone,
    });
  }

  return items
    .sort((left, right) => toTimestamp(right.occurredAt) - toTimestamp(left.occurredAt))
    .slice(0, 4);
}

export default async function DashboardPage(): Promise<JSX.Element> {
  const session = await requirePilotSession();
  const [profile, bookings, flights, ranks] = await Promise.all([
    getMyPilotProfile(session.accessToken),
    getMyBookings(session.accessToken),
    getMyFlights(session.accessToken),
    getPublicRanks(),
  ]);

  const activeBookings = bookings.filter((booking) =>
    ["RESERVED", "IN_PROGRESS"].includes(booking.status),
  );
  const completedFlights = flights.filter(
    (flight) => flight.status === "COMPLETED",
  ).length;
  const activeFlight = getActiveFlight(flights);
  const nextRotation = getNextAvailableRotation(bookings);
  const latestCompletedFlight = getLatestCompletedFlight(flights);
  const latestPirepFlight = getLatestPirepFlight(flights);
  const nextAction = buildNextAction(bookings, flights);
  const recentActivity = buildRecentActivity(bookings, flights);
  const submittedPireps = flights.filter((flight) => flight.pirep !== null).length;
  const rankProgress = buildRankProgress(
    profile.rank?.code ?? null,
    profile.rank?.name ?? null,
    profile.hoursFlownMinutes,
    completedFlights,
    ranks,
  );

  return (
    <>
      <section className="page-hero">
        <span className="section-eyebrow">Espace pilote</span>
        <h1>Tableau de bord pilote</h1>
        <p>
          Retrouvez vos opérations prioritaires, votre prochaine rotation et les
          repères utiles pour continuer à progresser chez Virtual Easyjet.
        </p>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Vue d'ensemble</span>
            <h2>Une lecture rapide de votre activité pilote</h2>
          </div>
          <p>
            Le tableau de bord met en avant l'essentiel : votre rythme
            d'exploitation, la prochaine action utile et votre progression
            globale dans la compagnie.
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
              label: "Rang actuel",
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
              helper: "Rotations réservées ou déjà engagées",
            },
            {
              label: "Vols terminés",
              value: String(completedFlights),
              helper: "Historique canonique de vos exécutions",
            },
            {
              label: "PIREPs",
              value: String(submittedPireps),
              helper: "Rapports déjà générés par vos vols",
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
                  {profile.user.username} · {profile.callsign ?? profile.pilotNumber}
                </p>
                <small>
                  {profile.rank?.name ?? "Rang non attribué"} ·{" "}
                  {profile.hub?.name ?? "Hub non attribué"}
                </small>
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
            <span className="section-eyebrow">Repères pilote</span>
            <h2>Ce qui compte sur votre prochaine session</h2>
          </div>
          <p>
            Ces cartes relient votre planning, votre dernier vol et votre
            progression de carrière pour garder une lecture claire du moment.
          </p>
        </div>

        <section className="panel-grid">
          <Card className="ops-card">
            <span className="section-eyebrow">Prochaine rotation disponible</span>
            <h2>
              {nextRotation?.reservedFlightNumber ?? "Aucune rotation réservée"}
            </h2>
            <p>
              {nextRotation
                ? `${nextRotation.departureAirport.icao} → ${nextRotation.arrivalAirport.icao} le ${formatDateTime(nextRotation.bookedFor)}.`
                : "Réservez une nouvelle rotation depuis la page Réservations pour préparer votre prochain cycle complet."}
            </p>
            <div className="definition-grid">
              <div>
                <span>Appareil</span>
                <strong>
                  {nextRotation
                    ? `${nextRotation.aircraft.registration} · ${nextRotation.aircraft.aircraftType.name}`
                    : "-"}
                </strong>
              </div>
              <div>
                <span>Statut</span>
                <strong>
                  {nextRotation
                    ? getBookingStatusPresentation(nextRotation.status).label
                    : "Aucune réservation"}
                </strong>
              </div>
            </div>
            <div className="inline-actions">
              <Button href="/bookings" variant="secondary">
                Gérer mes réservations
              </Button>
            </div>
          </Card>

          <Card className="ops-card">
            <span className="section-eyebrow">Dernier vol</span>
            <h2>{latestCompletedFlight?.flightNumber ?? "Aucun vol terminé"}</h2>
            <p>
              {latestCompletedFlight
                ? `${latestCompletedFlight.departureAirport.icao} → ${latestCompletedFlight.arrivalAirport.icao}, bloqué le ${formatDateTime(
                    latestCompletedFlight.actualOnBlockAt,
                  )}.`
                : "Votre historique de vol apparaîtra ici dès qu'une première rotation sera terminée."}
            </p>
            <div className="definition-grid">
              <div>
                <span>Durée</span>
                <strong>
                  {latestCompletedFlight
                    ? formatDurationMinutes(latestCompletedFlight.durationMinutes)
                    : "-"}
                </strong>
              </div>
              <div>
                <span>PIREP</span>
                <strong>
                  {latestCompletedFlight?.pirep
                    ? getPirepStatusPresentation(latestCompletedFlight.pirep.status)
                        .label
                    : "Aucun"}
                </strong>
              </div>
            </div>
            <div className="inline-actions">
              <Button href="/vols" variant="secondary">
                Ouvrir mes vols
              </Button>
            </div>
          </Card>

          <Card className="ops-card ops-card--full">
            <span className="section-eyebrow">Progression de rang</span>
            {rankProgress ? (
              <div className="dashboard-progress">
                <div className="dashboard-progress__summary">
                  <div>
                    <h2>
                      {rankProgress.currentRankName} → {rankProgress.nextRankName}
                    </h2>
                    <p>
                      Vous approchez du rang suivant. Le dashboard suit
                      simultanément vos vols terminés et vos heures de vol.
                    </p>
                  </div>
                  <div className="dashboard-progress__meter">
                    <strong>{rankProgress.overallPercent}%</strong>
                    <span>progression globale</span>
                  </div>
                </div>
                <div className="dashboard-progress__bar" aria-hidden="true">
                  <span style={{ width: `${rankProgress.overallPercent}%` }} />
                </div>
                <div className="dashboard-progress__grid">
                  <div>
                    <span>Vols terminés</span>
                    <strong>
                      {rankProgress.flightsCompleted} / {rankProgress.flightsRequired}
                    </strong>
                    <small>
                      {rankProgress.flightsRemaining > 0
                        ? `${rankProgress.flightsRemaining} vol(s) restant(s)`
                        : "Objectif de vols atteint"}
                    </small>
                  </div>
                  <div>
                    <span>Heures de vol</span>
                    <strong>
                      {formatDurationMinutes(rankProgress.hoursFlownMinutes)} /{" "}
                      {formatDurationMinutes(rankProgress.hoursRequiredMinutes)}
                    </strong>
                    <small>
                      {rankProgress.hoursRemainingMinutes > 0
                        ? `${formatDurationMinutes(rankProgress.hoursRemainingMinutes)} restante(s)`
                        : "Objectif horaire atteint"}
                    </small>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h2>Rang maximal atteint</h2>
                <p>
                  Aucun rang supérieur n'est actuellement publié. Continuez à
                  voler pour alimenter votre historique et vos PIREPs.
                </p>
              </>
            )}
          </Card>
        </section>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Activité récente</span>
            <h2>Les derniers événements utiles à reprendre</h2>
          </div>
          <p>
            Ce fil d'activité garde en mémoire les éléments les plus utiles de
            votre cycle pilote : réservation, exploitation, clôture et PIREP.
          </p>
        </div>

        <Card className="ops-card ops-card--full">
          {recentActivity.length > 0 ? (
            <div className="activity-timeline">
              {recentActivity.map((item) => (
                <article key={item.id} className="activity-timeline__item">
                  <div className="activity-timeline__dot" aria-hidden="true" />
                  <div className="activity-timeline__content">
                    <span className="section-eyebrow">{item.eyebrow}</span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <small>{formatDateTime(item.occurredAt)}</small>
                  </div>
                  <Badge label={item.badgeLabel} tone={item.badgeTone} />
                </article>
              ))}
            </div>
          ) : (
            <>
              <h2>Aucune activité récente</h2>
              <p>
                Réservez une première rotation pour commencer à construire votre
                historique pilote.
              </p>
            </>
          )}
        </Card>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Activité détaillée</span>
            <h2>Réservations, vols et rapports</h2>
          </div>
          <p>
            Les tableaux restent compacts et servent de relais rapide avant
            d'ouvrir les pages spécialisées de votre espace pilote.
          </p>
        </div>

        <section className="dashboard-grid">
          <Card>
            <h2>Mes réservations actives</h2>
            <BookingsTable bookings={bookings.slice(0, 6)} />
          </Card>
          <Card>
            <h2>Mes vols récents</h2>
            <FlightsTable flights={flights.slice(0, 6)} />
          </Card>
          <Card>
            <h2>Derniers PIREPs</h2>
            <PirepsTable flights={flights.slice(0, 10)} />
          </Card>
        </section>
      </section>
    </>
  );
}
