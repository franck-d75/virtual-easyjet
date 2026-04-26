import type { JSX } from "react";

import { DashboardStats } from "@/components/pilot/dashboard-stats";
import { PirepsTable } from "@/components/pilot/pireps-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMyFlights } from "@/lib/api/pilot";
import type { FlightResponse } from "@/lib/api/types";
import { requirePilotSession } from "@/lib/auth/guards";
import { logWebWarning } from "@/lib/observability/log";
import { formatDateTime, formatDurationMinutes } from "@/lib/utils/format";
import { getPirepStatusPresentation } from "@/lib/utils/status";

type PirepsPageProps = {
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

export default async function PirepsPage({
  searchParams,
}: PirepsPageProps): Promise<JSX.Element> {
  const session = await requirePilotSession();
  const query = await searchParams;
  let flights: FlightResponse[] = [];

  try {
    const response = await getMyFlights(session.accessToken);
    flights = Array.isArray(response) ? response : [];
  } catch (error) {
    logWebWarning("pireps page flights fetch failed", error);
  }
  const pirepFlights = flights.filter((flight) => flight.pirep !== null);
  const selectedFlightId = getFirstQueryValue(query.flight);
  const highlightedFlight =
    (selectedFlightId
      ? pirepFlights.find((flight) => flight.id === selectedFlightId)
      : null) ??
    pirepFlights[0] ??
    null;
  const submittedCount = pirepFlights.filter(
    (flight) => flight.pirep?.status === "SUBMITTED",
  ).length;
  const acceptedCount = pirepFlights.filter(
    (flight) => flight.pirep?.status === "ACCEPTED",
  ).length;
  const rejectedCount = pirepFlights.filter(
    (flight) => flight.pirep?.status === "REJECTED",
  ).length;

  return (
    <>
      <section className="page-hero">
        <span className="section-eyebrow">Opérations VA</span>
        <h1>Mes PIREPs</h1>
        <p>
          Consultez vos rapports automatiques, leur statut et leur cohérence
          avec les vols déjà effectués.
        </p>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Vue rapide</span>
            <h2>État des rapports de vol</h2>
          </div>
          <p>
            Chaque PIREP reste rattaché à un vol canonique. La page conserve ce
            lien pour que le parcours reste lisible de bout en bout.
          </p>
        </div>

        <DashboardStats
          items={[
            {
              label: "PIREPs générés",
              value: String(pirepFlights.length),
              helper: "Tous les rapports liés à un vol",
            },
            {
              label: "Soumis",
              value: String(submittedCount),
              helper: "En attente de revue ou déjà visibles",
            },
            {
              label: "Validés",
              value: String(acceptedCount),
              helper: "Rapports acceptés",
            },
            {
              label: "Rejetés",
              value: String(rejectedCount),
              helper: "Rapports refusés",
            },
          ]}
        />
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Rapport mis en avant</span>
            <h2>
              {highlightedFlight ? highlightedFlight.flightNumber : "Aucun PIREP"}
            </h2>
          </div>
          <p>
            {highlightedFlight
              ? "Ce rapport sert de point de reprise rapide entre vos opérations web et le suivi ACARS."
              : "Aucun PIREP n’a encore été généré pour ce pilote."}
          </p>
        </div>

        <section className="panel-grid">
          <Card className="ops-card ops-card--highlight">
            <span className="section-eyebrow">Dernier rapport</span>
            <h2>
              {highlightedFlight
                ? `${highlightedFlight.departureAirport.icao} → ${highlightedFlight.arrivalAirport.icao}`
                : "En attente d’un premier rapport"}
            </h2>
            <p>
              {highlightedFlight
                ? `Vol terminé le ${formatDateTime(highlightedFlight.actualOnBlockAt ?? highlightedFlight.actualLandingAt)}.`
                : "Terminez un vol via ACARS pour voir apparaître votre premier PIREP."}
            </p>
            {highlightedFlight?.pirep ? (
              <div className="ops-meta-grid">
                <div className="ops-meta-item">
                  <span>Statut</span>
                  <strong>
                    {getPirepStatusPresentation(highlightedFlight.pirep.status).label}
                  </strong>
                </div>
                <div className="ops-meta-item">
                  <span>Source</span>
                  <strong>{highlightedFlight.pirep.source}</strong>
                </div>
                <div className="ops-meta-item">
                  <span>Durée de vol</span>
                  <strong>
                    {formatDurationMinutes(highlightedFlight.durationMinutes)}
                  </strong>
                </div>
                <div className="ops-meta-item">
                  <span>Vol lié</span>
                  <strong>{highlightedFlight.flightNumber}</strong>
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="ops-card">
            <span className="section-eyebrow">Cohérence produit</span>
            <h2>Vol et PIREP restent liés</h2>
            <div className="status-list">
              <div className="status-list__item">
                <span>Source du rapport</span>
                <span className="table-muted">
                  ACARS automatique pour le MVP
                </span>
              </div>
              <div className="status-list__item">
                <span>Référence métier</span>
                <span className="table-muted">
                  Le vol canonique reste l’unique exécution
                </span>
              </div>
              <div className="status-list__item">
                <span>Relecture</span>
                <span className="table-muted">
                  Les statuts suivent le cycle backend existant
                </span>
              </div>
            </div>
            {highlightedFlight ? (
              <div className="inline-actions">
                <Badge
                  label={
                    getPirepStatusPresentation(
                      highlightedFlight.pirep?.status ?? "DRAFT",
                    ).label
                  }
                  tone={
                    getPirepStatusPresentation(
                      highlightedFlight.pirep?.status ?? "DRAFT",
                    ).tone
                  }
                />
                <Button href={`/vols?flight=${highlightedFlight.id}`} variant="secondary">
                  Voir le vol associé
                </Button>
              </div>
            ) : null}
          </Card>
        </section>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Tableau des PIREPs</span>
            <h2>Historique des rapports</h2>
          </div>
          <p>
            Le tableau reprend uniquement les vols disposant déjà d’un rapport,
            avec un lien direct vers le vol correspondant.
          </p>
        </div>

        <Card>
          <PirepsTable flights={flights} />
        </Card>
      </section>
    </>
  );
}
