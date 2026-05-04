import type { JSX } from "react";

import { ApiActionButton } from "@/components/pilot/api-action-button";
import { BookingsTable } from "@/components/pilot/bookings-table";
import { DashboardStats } from "@/components/pilot/dashboard-stats";
import { SimbriefMatchOverviewCard } from "@/components/pilot/simbrief-match-overview-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getPublicRouteCatalog } from "@/lib/api/public";
import {
  getMyBookings,
  getMyLatestSimbriefOfp,
  getMyPilotProfile,
} from "@/lib/api/pilot";
import { requirePilotSession } from "@/lib/auth/guards";
import { formatDateTime, formatDaysOfWeek } from "@/lib/utils/format";
import {
  buildBookingOpportunities,
  isActiveBooking,
} from "@/lib/utils/booking-opportunities";
import {
  buildBookingSimbriefCandidate,
  buildSimbriefMatchMap,
  summarizeSimbriefMatches,
} from "@/lib/utils/simbrief-match";

export default async function BookingsPage(): Promise<JSX.Element> {
  const session = await requirePilotSession();
  const [profile, bookings, routeCatalog, latestSimbriefOfp] = await Promise.all([
    getMyPilotProfile(session.accessToken),
    getMyBookings(session.accessToken),
    getPublicRouteCatalog(),
    getMyLatestSimbriefOfp(session.accessToken),
  ]);
  const visibleBookings = bookings.filter(
    (booking) => booking.status !== "CANCELLED" && booking.status !== "EXPIRED",
  );
  const opportunities = buildBookingOpportunities(
    routeCatalog,
    profile.rank?.sortOrder ?? null,
  );
  const activeBookings = visibleBookings.filter(isActiveBooking);
  const readyBookings = visibleBookings.filter(
    (booking) => booking.status === "RESERVED" && booking.flight === null,
  );
  const completedBookings = visibleBookings.filter(
    (booking) => booking.status === "COMPLETED",
  );
  const featuredBooking = readyBookings[0] ?? activeBookings[0] ?? null;
  const bookingCandidates = visibleBookings.map(buildBookingSimbriefCandidate);
  const bookingSimbriefMatches = buildSimbriefMatchMap(
    latestSimbriefOfp,
    bookingCandidates,
  );
  const bookingSimbriefSummary = summarizeSimbriefMatches(
    latestSimbriefOfp,
    activeBookings.map(buildBookingSimbriefCandidate),
    "réservation active",
  );

  return (
    <>
      <section className="page-hero">
        <span className="section-eyebrow">Opérations VA</span>
        <h1>Mes réservations</h1>
        <p>
          Réservez une rotation, identifiez les réservations déjà ouvertes et
          transformez-les en vols canoniques prêts pour ACARS.
        </p>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Vue rapide</span>
            <h2>État des réservations</h2>
          </div>
          <p>
            Une réservation active est la prochaine étape. Une fois exploitée,
            elle devient le vol canonique suivi ensuite par ACARS.
          </p>
        </div>

        <DashboardStats
          items={[
            {
              label: "Réservations actives",
              value: String(activeBookings.length),
              helper: "Encore exploitables",
            },
            {
              label: "Prêtes à exploiter",
              value: String(readyBookings.length),
              helper: "Sans vol canonique associé",
            },
            {
              label: "Rotations disponibles",
              value: String(opportunities.length),
              helper: "Schedules publics compatibles",
            },
            {
              label: "Réservations terminées",
              value: String(completedBookings.length),
              helper: "Historique déjà clôturé",
            },
          ]}
        />
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Prochaine action</span>
            <h2>
              {featuredBooking
                ? `Exploiter ${featuredBooking.reservedFlightNumber}`
                : "Choisir une nouvelle rotation"}
            </h2>
          </div>
          <p>
            {featuredBooking
              ? "Votre réservation est déjà en place. Vous pouvez maintenant créer le vol canonique avant de poursuivre dans ACARS."
              : "Aucune réservation ouverte n’est en attente. Choisissez une rotation disponible pour relancer votre cycle pilote."}
          </p>
        </div>

        <section className="panel-grid">
          <Card className="ops-card ops-card--highlight">
            <span className="section-eyebrow">Réservation prioritaire</span>
            <h2>
              {featuredBooking?.reservedFlightNumber ?? "Aucune réservation prioritaire"}
            </h2>
            <p>
              {featuredBooking
                ? `Départ prévu le ${formatDateTime(featuredBooking.bookedFor)} depuis ${featuredBooking.departureAirport.icao} vers ${featuredBooking.arrivalAirport.icao}.`
                : "Parcourez le catalogue ci-dessous pour réserver une rotation compatible avec votre profil pilote."}
            </p>
            <div className="inline-actions">
              {featuredBooking?.flight === null &&
              featuredBooking.status === "RESERVED" ? (
                <ApiActionButton
                  body={{ bookingId: featuredBooking.id }}
                  endpoint="/api/pilot/flights"
                  label="Créer le vol"
                  pendingLabel="Création du vol..."
                  successMessage="Vol canonique créé avec succès."
                />
              ) : (
                <Button href="/vols" variant="secondary">
                  Ouvrir mes vols
                </Button>
              )}
              <Button href="/routes" variant="ghost">
                Voir le réseau
              </Button>
            </div>
          </Card>

          <Card className="ops-card">
            <span className="section-eyebrow">Règle VA</span>
            <h2>Une réservation = un seul vol</h2>
            <p>
              Chaque réservation devient une exécution canonique unique. Si un
              vol est abandonné ou terminé, cette réservation n’est plus
              réutilisable.
            </p>
            <div className="panel-note">
              <p>
                Les actions de cette page restent dans le périmètre pilote :
                réserver, annuler, exploiter, puis poursuivre le suivi dans le
                client ACARS.
              </p>
            </div>
          </Card>
        </section>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Rapprochement SimBrief</span>
            <h2>Dernier OFP et réservations VA</h2>
          </div>
          <p>
            Ce bloc rapproche le dernier OFP SimBrief disponible avec vos
            réservations actives pour vous indiquer si une rotation web
            correspond déjà à votre préparation externe.
          </p>
        </div>

        <SimbriefMatchOverviewCard
          latestOfp={latestSimbriefOfp}
          summary={bookingSimbriefSummary}
          title="Correspondance avec mes réservations"
        />
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Rotations disponibles</span>
            <h2>Réserver une nouvelle rotation</h2>
          </div>
          <p>
            Le catalogue s’appuie sur les routes et schedules publics déjà
            exposés par l’API. La réservation reste validée par le backend.
          </p>
        </div>

        {opportunities.length === 0 ? (
          <EmptyState
            title="Aucune rotation disponible"
            description="Aucun schedule exploitable n’a été trouvé pour le moment."
            action={
              <Button href="/routes" variant="secondary">
                Explorer le réseau
              </Button>
            }
          />
        ) : (
          <section className="card-grid">
            {opportunities.map((opportunity) => (
              <Card className="ops-card" key={opportunity.schedule.id}>
                <div className="ops-card__header">
                  <div>
                    <span className="section-eyebrow">
                      {opportunity.route.code}
                    </span>
                    <h2>{opportunity.schedule.callsign}</h2>
                  </div>
                  <Badge
                    label={
                      opportunity.isRankAllowed
                        ? "Disponible"
                        : `Rang requis : ${opportunity.requiredRankName ?? "Inconnu"}`
                    }
                    tone={opportunity.isRankAllowed ? "success" : "warning"}
                  />
                </div>

                <p>
                  {opportunity.schedule.departureAirport.icao} →{" "}
                  {opportunity.schedule.arrivalAirport.icao} avec{" "}
                  {opportunity.schedule.aircraft?.aircraftType.name ??
                    "appareil non assigné"}
                  .
                </p>

                <div className="ops-meta-grid">
                  <div className="ops-meta-item">
                    <span>Prochain départ UTC</span>
                    <strong>{formatDateTime(opportunity.bookedFor)}</strong>
                  </div>
                  <div className="ops-meta-item">
                    <span>Planning</span>
                    <strong>
                      {formatDaysOfWeek(opportunity.schedule.daysOfWeek)} ·{" "}
                      {opportunity.schedule.departureTimeUtc}Z
                    </strong>
                  </div>
                  <div className="ops-meta-item">
                    <span>Appareil</span>
                    <strong>
                      {opportunity.schedule.aircraft?.registration ??
                        "Non assigné"}
                    </strong>
                  </div>
                  <div className="ops-meta-item">
                    <span>Condition de rang</span>
                    <strong>
                      {opportunity.requiredRankName ?? "Aucune contrainte"}
                    </strong>
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
                    label="Réserver cette rotation"
                    pendingLabel="Réservation..."
                    successMessage="Rotation réservée avec succès."
                  />
                  <Button href="/routes" variant="ghost">
                    Voir les routes
                  </Button>
                </div>
              </Card>
            ))}
          </section>
        )}
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Mes réservations</span>
            <h2>Réservations et exécutions</h2>
          </div>
          <p>
            Depuis ce tableau, vous pouvez annuler une réservation active ou la
            transformer en vol canonique exploitable par le client ACARS.
          </p>
        </div>

        <Card>
          <BookingsTable
            bookings={visibleBookings}
            simbriefMatches={bookingSimbriefMatches}
            renderActions={(booking) => {
              const canCancelPlannedBooking =
                booking.status === "RESERVED" &&
                (booking.flight === null || booking.flight.status === "PLANNED");

              if (booking.status === "RESERVED" && booking.flight === null) {
                return (
                  <div className="table-action-group">
                    <ApiActionButton
                      body={{ bookingId: booking.id }}
                      endpoint="/api/pilot/flights"
                      label="Exploiter"
                      pendingLabel="Création..."
                      successMessage="Vol canonique créé."
                    />
                    <ApiActionButton
                      confirmMessage="Annuler cette réservation ?"
                      endpoint={`/api/pilot/bookings/${booking.id}/cancel`}
                      label="Annuler"
                      pendingLabel="Annulation..."
                      successMessage="Réservation annulée."
                      variant="ghost"
                    />
                  </div>
                );
              }

              if (canCancelPlannedBooking && booking.flight) {
                return (
                  <div className="table-action-group">
                    <Button href={`/vols?flight=${booking.flight.id}`} variant="secondary">
                      Voir le vol
                    </Button>
                    <ApiActionButton
                      confirmMessage="Annuler cette réservation planifiée et le vol prêt associé ?"
                      endpoint={`/api/pilot/bookings/${booking.id}/cancel`}
                      label="Annuler"
                      pendingLabel="Annulation..."
                      successMessage="Réservation planifiée annulée."
                      variant="ghost"
                    />
                  </div>
                );
              }

              if (booking.flight) {
                return (
                  <Button href={`/vols?flight=${booking.flight.id}`} variant="secondary">
                    Voir le vol
                  </Button>
                );
              }

              return <span className="table-muted">Aucune action</span>;
            }}
          />
        </Card>
      </section>
    </>
  );
}
