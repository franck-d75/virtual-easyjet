import type { JSX } from "react";

import { ApiActionButton } from "@/components/pilot/api-action-button";
import { DashboardStats } from "@/components/pilot/dashboard-stats";
import { FlightsTable } from "@/components/pilot/flights-table";
import { SimbriefMatchOverviewCard } from "@/components/pilot/simbrief-match-overview-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMyFlights, getMyLatestSimbriefOfp } from "@/lib/api/pilot";
import { requirePilotSession } from "@/lib/auth/guards";
import { formatDateTime, formatDurationMinutes } from "@/lib/utils/format";
import {
  buildFlightSimbriefCandidate,
  buildSimbriefMatchMap,
  summarizeSimbriefMatches,
} from "@/lib/utils/simbrief-match";
import {
  getFlightStatusPresentation,
  getPirepStatusPresentation,
  getSessionStatusPresentation,
} from "@/lib/utils/status";

type FlightsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstQueryValue(
  value: string | string[] | undefined,
): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.find((item) => item.trim().length > 0) ?? null;
  }

  return null;
}

export default async function FlightsPage({
  searchParams,
}: FlightsPageProps): Promise<JSX.Element> {
  const session = await requirePilotSession();
  const query = await searchParams;
  const [flights, latestSimbriefOfp] = await Promise.all([
    getMyFlights(session.accessToken),
    getMyLatestSimbriefOfp(session.accessToken),
  ]);
  const selectedFlightId = getFirstQueryValue(query.flight);
  const highlightedFlight =
    (selectedFlightId
      ? flights.find((flight) => flight.id === selectedFlightId)
      : null) ??
    flights.find((flight) => flight.status === "IN_PROGRESS") ??
    flights[0] ??
    null;
  const activeFlights = flights.filter((flight) =>
    ["PLANNED", "IN_PROGRESS"].includes(flight.status),
  );
  const trackedFlights = flights.filter((flight) => flight.acarsSession !== null);
  const completedFlights = flights.filter(
    (flight) => flight.status === "COMPLETED",
  );
  const pirepFlights = flights.filter((flight) => flight.pirep !== null);
  const flightCandidates = flights.map(buildFlightSimbriefCandidate);
  const flightSimbriefMatches = buildSimbriefMatchMap(
    latestSimbriefOfp,
    flightCandidates,
  );
  const flightSimbriefSummary = summarizeSimbriefMatches(
    latestSimbriefOfp,
    activeFlights.map(buildFlightSimbriefCandidate),
    "vol actif",
  );

  return (
    <>
      <section className="page-hero">
        <span className="section-eyebrow">Opérations VA</span>
        <h1>Mes vols</h1>
        <p>
          Suivez vos vols canoniques, leur état ACARS et la disponibilité de
          leur PIREP final, tout en conservant une logique simple :
          réservation → vol → PIREP.
        </p>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Vue rapide</span>
            <h2>État de votre activité en vol</h2>
          </div>
          <p>
            Le web reste l’interface de gestion. Le client ACARS reste
            l’interface opérationnelle pour les vols suivis en temps réel.
          </p>
        </div>

        <DashboardStats
          items={[
            {
              label: "Vols actifs",
              value: String(activeFlights.length),
              helper: "Planifiés ou en cours",
            },
            {
              label: "Suivis ACARS",
              value: String(trackedFlights.length),
              helper: "Session ACARS déjà ouverte",
            },
            {
              label: "Vols terminés",
              value: String(completedFlights.length),
              helper: "Exécutions clôturées",
            },
            {
              label: "PIREPs générés",
              value: String(pirepFlights.length),
              helper: "Rapports liés à vos vols",
            },
          ]}
        />
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Vol mis en avant</span>
            <h2>
              {highlightedFlight
                ? highlightedFlight.flightNumber
                : "Aucun vol disponible"}
            </h2>
          </div>
          <p>
            {highlightedFlight
              ? "Ce bloc vous donne la lecture la plus utile du vol sélectionné ou actuellement actif."
              : "Créez d’abord un vol depuis une réservation active pour poursuivre votre cycle pilote."}
          </p>
        </div>

        <section className="panel-grid">
          <Card className="ops-card ops-card--highlight">
            <span className="section-eyebrow">Vol canonique</span>
            <h2>
              {highlightedFlight
                ? `${highlightedFlight.departureAirport.icao} → ${highlightedFlight.arrivalAirport.icao}`
                : "Aucune exécution en cours"}
            </h2>
            <p>
              {highlightedFlight
                ? `Réservation prévue pour le ${formatDateTime(highlightedFlight.booking.bookedFor)}.`
                : "Les vols apparaîtront ici dès qu’une réservation sera exploitée."}
            </p>
            {highlightedFlight ? (
              <div className="ops-meta-grid">
                <div className="ops-meta-item">
                  <span>Statut du vol</span>
                  <strong>
                    {getFlightStatusPresentation(highlightedFlight.status).label}
                  </strong>
                </div>
                <div className="ops-meta-item">
                  <span>Durée</span>
                  <strong>
                    {formatDurationMinutes(highlightedFlight.durationMinutes)}
                  </strong>
                </div>
                <div className="ops-meta-item">
                  <span>Session ACARS</span>
                  <strong>
                    {highlightedFlight.acarsSession
                      ? getSessionStatusPresentation(
                          highlightedFlight.acarsSession.status,
                        ).label
                      : "Aucune session"}
                  </strong>
                </div>
                <div className="ops-meta-item">
                  <span>PIREP</span>
                  <strong>
                    {highlightedFlight.pirep
                      ? getPirepStatusPresentation(highlightedFlight.pirep.status)
                          .label
                      : "Pas encore généré"}
                  </strong>
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="ops-card">
            <span className="section-eyebrow">Conduite à tenir</span>
            <h2>Web pour gérer, ACARS pour exploiter</h2>
            <div className="status-list">
              <div className="status-list__item">
                <span>Vol sans session ACARS</span>
                <span className="table-muted">
                  Prêt à être pris en charge par le client ACARS
                </span>
              </div>
              <div className="status-list__item">
                <span>Vol avec session ACARS</span>
                <span className="table-muted">
                  Le suivi temps réel continue côté desktop
                </span>
              </div>
              <div className="status-list__item">
                <span>Vol terminé</span>
                <span className="table-muted">
                  Le PIREP final doit ensuite apparaître ici
                </span>
              </div>
            </div>
          </Card>
        </section>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Rapprochement SimBrief</span>
            <h2>Dernier OFP et exécutions canoniques</h2>
          </div>
          <p>
            Cette vue rapproche votre dernier OFP SimBrief avec les vols VA
            visibles dans votre historique pilote.
          </p>
        </div>

        <SimbriefMatchOverviewCard
          latestOfp={latestSimbriefOfp}
          summary={flightSimbriefSummary}
          title="Correspondance avec mes vols"
        />
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Tableau des vols</span>
            <h2>Exécutions et suivi</h2>
          </div>
          <p>
            Les actions restent limitées au MVP : clôturer ou abandonner un vol
            lorsqu’aucune session ACARS active ne le suit déjà.
          </p>
        </div>

        <Card>
          <FlightsTable
            flights={flights}
            simbriefMatches={flightSimbriefMatches}
            renderActions={(flight) => {
              if (
                flight.status === "IN_PROGRESS" &&
                flight.acarsSession?.status !== "COMPLETED"
              ) {
                return (
                  <div className="table-action-group">
                    {flight.acarsSession ? (
                      <>
                        <Badge
                          label={
                            getSessionStatusPresentation(flight.acarsSession.status)
                              .label
                          }
                          tone={
                            getSessionStatusPresentation(flight.acarsSession.status)
                              .tone
                          }
                        />
                        <span className="table-muted">
                          Finalisation via ACARS desktop
                        </span>
                      </>
                    ) : (
                      <>
                        <ApiActionButton
                          body={{}}
                          endpoint={`/api/pilot/flights/${flight.id}/complete`}
                          label="Clore"
                          pendingLabel="Clôture..."
                          successMessage="Vol terminé avec succès."
                        />
                        <ApiActionButton
                          confirmMessage="Abandonner ce vol canonique ?"
                          endpoint={`/api/pilot/flights/${flight.id}/abort`}
                          label="Abandonner"
                          pendingLabel="Abandon..."
                          successMessage="Vol abandonné."
                          variant="ghost"
                        />
                      </>
                    )}
                  </div>
                );
              }

              if (flight.pirep) {
                return (
                  <Button href={`/pireps?flight=${flight.id}`} variant="secondary">
                    Voir le PIREP
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
