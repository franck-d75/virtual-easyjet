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
  PilotProfileResponse,
  RankResponse,
  UserMeResponse,
} from "@/lib/api/types";
import { requirePilotSession } from "@/lib/auth/guards";
import { logWebError, logWebWarning } from "@/lib/observability/log";
import {
  formatDateTime,
  formatDurationMinutes,
  formatNumber,
} from "@/lib/utils/format";
import { buildUserDisplayName } from "@/lib/utils/user-display";
import {
  getBookingStatusPresentation,
  getFlightStatusPresentation,
  getPirepStatusPresentation,
  getSessionStatusPresentation,
  type BadgeTone,
} from "@/lib/utils/status";

type DashboardProfile = Pick<
  PilotProfileResponse,
  | "pilotNumber"
  | "callsign"
  | "firstName"
  | "lastName"
  | "hoursFlownMinutes"
  | "experiencePoints"
  | "hub"
  | "rank"
> & {
  user: {
    avatarUrl: string | null;
    username: string;
  };
};

type DashboardData = {
  profile: DashboardProfile;
  bookings: BookingResponse[];
  flights: FlightResponse[];
  ranks: RankResponse[];
  isDegraded: boolean;
};

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

function toSafeNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function buildFallbackProfile(
  user: UserMeResponse & {
    pilotProfile: NonNullable<UserMeResponse["pilotProfile"]>;
  },
): DashboardProfile {
  return {
    pilotNumber: user.pilotProfile.pilotNumber,
    callsign: null,
    firstName: user.pilotProfile.firstName,
    lastName: user.pilotProfile.lastName,
    hoursFlownMinutes: toSafeNumber(user.pilotProfile.hoursFlownMinutes),
    experiencePoints: 0,
    hub: user.pilotProfile.hub
      ? {
          id: "session-hub",
          code: user.pilotProfile.hub.code,
          name: user.pilotProfile.hub.name,
        }
      : null,
    rank: user.pilotProfile.rank
      ? {
          id: "session-rank",
          code: user.pilotProfile.rank.code,
          name: user.pilotProfile.rank.name,
          sortOrder: 0,
        }
      : null,
    user: {
      avatarUrl: user.avatarUrl,
      username: user.username,
    },
  };
}

function isFulfilled<T>(
  result: PromiseSettledResult<T>,
): result is PromiseFulfilledResult<T> {
  return result.status === "fulfilled";
}

async function loadDashboardData(
  accessToken: string,
  fallbackUser: UserMeResponse & {
    pilotProfile: NonNullable<UserMeResponse["pilotProfile"]>;
  },
): Promise<DashboardData> {
  const fallbackProfile = buildFallbackProfile(fallbackUser);
  const [profileResult, bookingsResult, flightsResult, ranksResult] =
    await Promise.allSettled([
      getMyPilotProfile(accessToken),
      getMyBookings(accessToken),
      getMyFlights(accessToken),
      getPublicRanks(),
    ]);

  let isDegraded = false;

  if (!isFulfilled(profileResult)) {
    isDegraded = true;
    logWebWarning("dashboard profile failed", profileResult.reason);
  }

  if (!isFulfilled(bookingsResult)) {
    isDegraded = true;
    logWebWarning("dashboard bookings failed", bookingsResult.reason);
  }

  if (!isFulfilled(flightsResult)) {
    isDegraded = true;
    logWebWarning("dashboard flights failed", flightsResult.reason);
  }

  if (!isFulfilled(ranksResult)) {
    isDegraded = true;
    logWebWarning("dashboard ranks failed", ranksResult.reason);
  }

  const profile = isFulfilled(profileResult)
    ? {
        pilotNumber: profileResult.value.pilotNumber ?? fallbackProfile.pilotNumber,
        callsign: profileResult.value.callsign ?? null,
        firstName: profileResult.value.firstName ?? fallbackProfile.firstName,
        lastName: profileResult.value.lastName ?? fallbackProfile.lastName,
        hoursFlownMinutes: toSafeNumber(profileResult.value.hoursFlownMinutes),
        experiencePoints: toSafeNumber(profileResult.value.experiencePoints),
        hub: profileResult.value.hub ?? fallbackProfile.hub,
        rank: profileResult.value.rank ?? fallbackProfile.rank,
        user: {
          avatarUrl:
            profileResult.value.user?.avatarUrl ?? fallbackProfile.user.avatarUrl,
          username:
            profileResult.value.user?.username ?? fallbackProfile.user.username,
        },
      }
    : fallbackProfile;

  const bookings =
    isFulfilled(bookingsResult) && Array.isArray(bookingsResult.value)
      ? bookingsResult.value
      : [];
  const flights =
    isFulfilled(flightsResult) && Array.isArray(flightsResult.value)
      ? flightsResult.value
      : [];
  const ranks =
    isFulfilled(ranksResult) && Array.isArray(ranksResult.value)
      ? ranksResult.value
      : [];

  return {
    profile,
    bookings,
    flights,
    ranks,
    isDegraded,
  };
}

function getBookingDate(booking: BookingResponse | null): string | null {
  return booking?.bookedFor ?? null;
}

function getFlightReferenceDate(flight: FlightResponse | null): string | null {
  return (
    flight?.actualOnBlockAt ??
    flight?.actualLandingAt ??
    flight?.plannedOffBlockAt ??
    flight?.booking?.bookedFor ??
    null
  );
}

function getActiveFlight(flights: FlightResponse[]): FlightResponse | null {
  return (
    [...flights]
      .sort(
        (left, right) =>
          toTimestamp(getFlightReferenceDate(right)) -
          toTimestamp(getFlightReferenceDate(left)),
      )
      .find((flight) => ["IN_PROGRESS", "PLANNED"].includes(flight.status)) ??
    null
  );
}

function getNextAvailableRotation(
  bookings: BookingResponse[],
): BookingResponse | null {
  return (
    [...bookings]
      .filter(
        (booking) => booking.status === "RESERVED" && (booking.flight ?? null) === null,
      )
      .sort(
        (left, right) =>
          toTimestamp(getBookingDate(left)) - toTimestamp(getBookingDate(right)),
      )[0] ?? null
  );
}

function getLatestCompletedFlight(
  flights: FlightResponse[],
): FlightResponse | null {
  return (
    [...flights]
      .filter((flight) => flight.status === "COMPLETED")
      .sort(
        (left, right) =>
          toTimestamp(getFlightReferenceDate(right)) -
          toTimestamp(getFlightReferenceDate(left)),
      )[0] ?? null
  );
}

function getLatestPirepFlight(flights: FlightResponse[]): FlightResponse | null {
  return (
    [...flights]
      .filter((flight) => flight.pirep !== null)
      .sort(
        (left, right) =>
          toTimestamp(getFlightReferenceDate(right)) -
          toTimestamp(getFlightReferenceDate(left)),
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
    .filter((rank) => Boolean(rank?.isActive))
    .sort(
      (left, right) => toSafeNumber(left.sortOrder) - toSafeNumber(right.sortOrder),
    );

  const currentRank = currentRankCode
    ? orderedRanks.find((rank) => rank.code === currentRankCode) ?? null
    : null;
  const nextRank = currentRank
    ? orderedRanks.find(
        (rank) => toSafeNumber(rank.sortOrder) > toSafeNumber(currentRank.sortOrder),
      ) ?? null
    : orderedRanks[0] ?? null;

  if (!nextRank) {
    return null;
  }

  const flightsRequired = Math.max(toSafeNumber(nextRank.minFlights), 1);
  const hoursRequiredMinutes = Math.max(toSafeNumber(nextRank.minHoursMinutes), 1);
  const flightsRemaining = Math.max(
    toSafeNumber(nextRank.minFlights) - completedFlights,
    0,
  );
  const hoursRemainingMinutes = Math.max(
    toSafeNumber(nextRank.minHoursMinutes) - hoursFlownMinutes,
    0,
  );
  const flightsProgress = Math.min(completedFlights / flightsRequired, 1);
  const hoursProgress = Math.min(hoursFlownMinutes / hoursRequiredMinutes, 1);

  return {
    currentRankName: currentRankName ?? "Rang non attribue",
    nextRankName: nextRank.name ?? "Rang suivant",
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
      eyebrow: "Reservation prete",
      title: `${nextRotation.reservedFlightNumber} · ${nextRotation.departureAirport?.icao ?? "-"} -> ${nextRotation.arrivalAirport?.icao ?? "-"}`,
      description:
        "Rotation deja reservee et prete a etre exploitee depuis l'espace pilote.",
      occurredAt: nextRotation.bookedFor ?? null,
      badgeLabel: bookingStatus.label,
      badgeTone: bookingStatus.tone,
    });
  }

  if (activeFlight) {
    const flightStatus = getFlightStatusPresentation(activeFlight.status);
    items.push({
      id: `flight-${activeFlight.id}`,
      eyebrow: "Vol actif",
      title: `${activeFlight.flightNumber} · ${activeFlight.departureAirport?.icao ?? "-"} -> ${activeFlight.arrivalAirport?.icao ?? "-"}`,
      description:
        activeFlight.acarsSession !== null
          ? `Session ACARS ${activeFlight.acarsSession.detectedPhase.toLowerCase().replaceAll("_", " ")}.`
          : "Vol canonique cree, pret pour un suivi ACARS live.",
      occurredAt: getFlightReferenceDate(activeFlight),
      badgeLabel: flightStatus.label,
      badgeTone: flightStatus.tone,
    });
  }

  if (latestCompletedFlight) {
    const completedStatus = getFlightStatusPresentation(latestCompletedFlight.status);
    items.push({
      id: `completed-${latestCompletedFlight.id}`,
      eyebrow: "Dernier vol",
      title: `${latestCompletedFlight.flightNumber} · ${latestCompletedFlight.departureAirport?.icao ?? "-"} -> ${latestCompletedFlight.arrivalAirport?.icao ?? "-"}`,
      description: `Rotation bouclee en ${formatDurationMinutes(latestCompletedFlight.durationMinutes)} avec ${latestCompletedFlight.distanceFlownNm ? `${formatNumber(latestCompletedFlight.distanceFlownNm)} NM` : "distance non renseignee"}.`,
      occurredAt: getFlightReferenceDate(latestCompletedFlight),
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
      occurredAt: getFlightReferenceDate(latestPirepFlight),
      badgeLabel: pirepStatus.label,
      badgeTone: pirepStatus.tone,
    });
  }

  return items
    .sort(
      (left, right) => toTimestamp(right.occurredAt) - toTimestamp(left.occurredAt),
    )
    .slice(0, 4);
}

export default async function DashboardPage(): Promise<JSX.Element> {
  const session = await requirePilotSession();

  let dashboardData: DashboardData;

  try {
    dashboardData = await loadDashboardData(session.accessToken, session.user);
  } catch (error) {
    logWebError("dashboard page failed", error);
    dashboardData = {
      profile: buildFallbackProfile(session.user),
      bookings: [],
      flights: [],
      ranks: [],
      isDegraded: true,
    };
  }

  const { profile, bookings, flights, ranks, isDegraded } = dashboardData;
  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const safeFlights = Array.isArray(flights) ? flights : [];
  const safeRanks = Array.isArray(ranks) ? ranks : [];

  const activeBookings = safeBookings.filter((booking) =>
    ["RESERVED", "IN_PROGRESS"].includes(booking.status),
  );
  const completedFlights = safeFlights.filter(
    (flight) => flight.status === "COMPLETED",
  ).length;
  const activeFlight = getActiveFlight(safeFlights);
  const nextRotation = getNextAvailableRotation(safeBookings);
  const latestCompletedFlight = getLatestCompletedFlight(safeFlights);
  const latestPirepFlight = getLatestPirepFlight(safeFlights);
  const nextAction = buildNextAction(safeBookings, safeFlights);
  const recentActivity = buildRecentActivity(safeBookings, safeFlights);
  const submittedPireps = safeFlights.filter((flight) => flight.pirep !== null).length;
  const rankProgress = buildRankProgress(
    profile.rank?.code ?? null,
    profile.rank?.name ?? null,
    toSafeNumber(profile.hoursFlownMinutes),
    completedFlights,
    safeRanks,
  );
  const hasOperationalData =
    safeBookings.length > 0 || safeFlights.length > 0 || submittedPireps > 0;
  const displayName = buildUserDisplayName({
    firstName: profile.firstName,
    lastName: profile.lastName,
    username: profile.user.username,
  });

  return (
    <>
      <section className="page-hero">
        <span className="section-eyebrow">Espace pilote</span>
        <h1>Tableau de bord pilote</h1>
        <p>
          Retrouvez vos operations prioritaires, votre prochaine rotation et les
          reperes utiles pour continuer a progresser chez Virtual Easyjet.
        </p>
      </section>

      {isDegraded ? (
        <section className="section-band">
          <Card className="ops-card">
            <span className="section-eyebrow">Mode degrade</span>
            <h2>Les donnees pilote sont partiellement indisponibles</h2>
            <p>
              Le dashboard reste accessible avec des valeurs de repli. Vous pouvez
              recharger la page dans quelques instants pour recuperer les donnees
              les plus recentes.
            </p>
          </Card>
        </section>
      ) : null}

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Vue d'ensemble</span>
            <h2>Une lecture rapide de votre activite pilote</h2>
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
              label: "Numero pilote",
              value: profile.pilotNumber || "-",
              helper: displayName,
            },
            {
              label: "Rang actuel",
              value: profile.rank?.name ?? "Non attribue",
              helper: profile.hub?.name ?? "Aucun hub attribue",
            },
            {
              label: "Heures de vol",
              value: formatDurationMinutes(toSafeNumber(profile.hoursFlownMinutes)),
              helper: `${toSafeNumber(profile.experiencePoints)} XP`,
            },
            {
              label: "Reservations actives",
              value: String(activeBookings.length || 0),
              helper: "Rotations reservees ou deja engagees",
            },
            {
              label: "Vols termines",
              value: String(completedFlights || 0),
              helper: "Historique canonique de vos executions",
            },
            {
              label: "PIREPs",
              value: String(submittedPireps || 0),
              helper: "Rapports deja generes par vos vols",
            },
          ]}
        />
      </section>

      <section className="section-band">
        <section className="panel-grid">
          <Card className="ops-card ops-card--profile">
            <span className="section-eyebrow">Identite pilote</span>
            <div className="profile-spotlight">
              <UserAvatar
                avatarUrl={profile.user.avatarUrl}
                name={displayName}
                size="xl"
              />
              <div>
                <h2>{displayName}</h2>
                <p>
                  {profile.user.username} · {profile.callsign ?? profile.pilotNumber}
                </p>
                <small>
                  {profile.rank?.name ?? "Rang non attribue"} ·{" "}
                  {profile.hub?.name ?? "Hub non attribue"}
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
            <span className="section-eyebrow">Etat des operations</span>
            <h2>Lecture rapide de votre activite</h2>
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
            <span className="section-eyebrow">Reperes pilote</span>
            <h2>Ce qui compte sur votre prochaine session</h2>
          </div>
          <p>
            Ces cartes relient votre planning, votre dernier vol et votre
            progression de carriere pour garder une lecture claire du moment.
          </p>
        </div>

        <section className="panel-grid">
          <Card className="ops-card">
            <span className="section-eyebrow">Prochaine rotation disponible</span>
            <h2>
              {nextRotation?.reservedFlightNumber ?? "Aucune rotation reservee"}
            </h2>
            <p>
              {nextRotation
                ? `${nextRotation.departureAirport?.icao ?? "-"} -> ${nextRotation.arrivalAirport?.icao ?? "-"} le ${formatDateTime(nextRotation.bookedFor)}.`
                : "Reservez une nouvelle rotation depuis la page Reservations pour preparer votre prochain cycle complet."}
            </p>
            <div className="definition-grid">
              <div>
                <span>Appareil</span>
                <strong>
                  {nextRotation
                    ? `${nextRotation.aircraft?.registration ?? "-"} · ${nextRotation.aircraft?.aircraftType?.name ?? "Type non renseigne"}`
                    : "-"}
                </strong>
              </div>
              <div>
                <span>Statut</span>
                <strong>
                  {nextRotation
                    ? getBookingStatusPresentation(nextRotation.status).label
                    : "Aucune reservation"}
                </strong>
              </div>
            </div>
            <div className="inline-actions">
              <Button href="/bookings" variant="secondary">
                Gerer mes reservations
              </Button>
            </div>
          </Card>

          <Card className="ops-card">
            <span className="section-eyebrow">Dernier vol</span>
            <h2>{latestCompletedFlight?.flightNumber ?? "Aucun vol termine"}</h2>
            <p>
              {latestCompletedFlight
                ? `${latestCompletedFlight.departureAirport?.icao ?? "-"} -> ${latestCompletedFlight.arrivalAirport?.icao ?? "-"}, bloque le ${formatDateTime(
                    latestCompletedFlight.actualOnBlockAt,
                  )}.`
                : "Votre historique de vol apparaitra ici des qu'une premiere rotation sera terminee."}
            </p>
            <div className="definition-grid">
              <div>
                <span>Duree</span>
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
                      {`${rankProgress.currentRankName} -> ${rankProgress.nextRankName}`}
                    </h2>
                    <p>
                      Vous approchez du rang suivant. Le dashboard suit
                      simultanement vos vols termines et vos heures de vol.
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
                    <span>Vols termines</span>
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
                <h2>Progression indisponible</h2>
                <p>
                  Aucun rang superieur n'est disponible pour le moment, ou les
                  donnees de progression n'ont pas pu etre chargees.
                </p>
              </>
            )}
          </Card>
        </section>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Activite recente</span>
            <h2>Les derniers evenements utiles a reprendre</h2>
          </div>
          <p>
            Ce fil d'activite garde en memoire les elements les plus utiles de
            votre cycle pilote : reservation, exploitation, cloture et PIREP.
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
              <h2>Aucune activite recente</h2>
              <p>
                {hasOperationalData
                  ? "Les donnees de recents evenements ne sont pas disponibles pour le moment."
                  : "Reservez une premiere rotation pour commencer a construire votre historique pilote."}
              </p>
            </>
          )}
        </Card>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Activite detaillee</span>
            <h2>Reservations, vols et rapports</h2>
          </div>
          <p>
            Les tableaux restent compacts et servent de relais rapide avant
            d'ouvrir les pages specialisees de votre espace pilote.
          </p>
        </div>

        <section className="dashboard-grid">
          <Card>
            <h2>Mes reservations actives</h2>
            <BookingsTable bookings={safeBookings.slice(0, 6)} />
          </Card>
          <Card>
            <h2>Mes vols recents</h2>
            <FlightsTable flights={safeFlights.slice(0, 6)} />
          </Card>
          <Card>
            <h2>Derniers PIREPs</h2>
            <PirepsTable flights={safeFlights.slice(0, 10)} />
          </Card>
        </section>
      </section>
    </>
  );
}
