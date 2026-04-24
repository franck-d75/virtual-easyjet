import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SimbriefLatestOfpResponse } from "@/lib/api/types";
import {
  formatDateTime,
  formatNullableText,
  formatNumber,
} from "@/lib/utils/format";
import { getSimbriefAvailabilityPresentation } from "@/lib/utils/status";

type SimbriefLatestOfpCardProps = {
  latestOfp: SimbriefLatestOfpResponse;
};

function formatAircraft(latestOfp: SimbriefLatestOfpResponse): string {
  if (!latestOfp.plan?.aircraft) {
    return "-";
  }

  const aircraftParts = [
    latestOfp.plan.aircraft.icaoCode,
    latestOfp.plan.aircraft.name,
  ].filter((value): value is string => Boolean(value));

  const registration = latestOfp.plan.aircraft.registration;

  if (registration) {
    aircraftParts.push(`(${registration})`);
  }

  return aircraftParts.join(" ") || "-";
}

function formatCruiseAltitude(latestOfp: SimbriefLatestOfpResponse): string {
  const altitude = latestOfp.plan?.cruiseAltitudeFt;

  if (altitude === null || altitude === undefined) {
    return "-";
  }

  return `${formatNumber(altitude)} ft`;
}

function renderBody(latestOfp: SimbriefLatestOfpResponse): JSX.Element {
  switch (latestOfp.status) {
    case "NOT_CONFIGURED":
      return (
        <>
          <p>
            Aucun SimBrief Pilot ID n’est encore configuré sur votre profil.
            Renseignez-le ci-dessus pour permettre la récupération du dernier
            plan de vol généré.
          </p>
          <div className="panel-note simbrief-ofp-card__route">
            <p>
              Ce sprint ne stocke aucun OFP en base. Le web interroge SimBrief
              à la demande via l’API Virtual Easyjet.
            </p>
          </div>
          <div className="inline-actions">
            <Button href="#simbrief-pilot-id" variant="secondary">
              Configurer mon SimBrief ID
            </Button>
          </div>
        </>
      );
    case "NOT_FOUND":
      return (
        <>
          <p>
            Aucun OFP exploitable n’a été trouvé pour ce SimBrief Pilot ID.
            Vérifiez l’identifiant configuré ou générez un nouveau plan de vol
            dans SimBrief.
          </p>
          <div className="definition-grid">
            <div>
              <span>SimBrief Pilot ID</span>
              <strong>{formatNullableText(latestOfp.pilotId)}</strong>
            </div>
            <div>
              <span>Retour SimBrief</span>
              <strong>{formatNullableText(latestOfp.fetchStatus)}</strong>
            </div>
          </div>
        </>
      );
    case "ERROR":
      return (
        <>
          <p>
            La récupération du dernier OFP SimBrief a échoué pour le moment.
            Le profil pilote reste intact et vous pourrez réessayer sans impact
            sur l’authentification ni sur vos données VA.
          </p>
          <div className="definition-grid">
            <div>
              <span>SimBrief Pilot ID</span>
              <strong>{formatNullableText(latestOfp.pilotId)}</strong>
            </div>
            <div>
              <span>Diagnostic</span>
              <strong>{formatNullableText(latestOfp.detail)}</strong>
            </div>
          </div>
        </>
      );
    case "AVAILABLE":
    default:
      return (
        <>
          <p>
            Le dernier plan de vol disponible a été récupéré en temps réel via
            SimBrief. Cette lecture reste isolée, sans persistance OFP
            supplémentaire dans le MVP.
          </p>
          <div className="definition-grid">
            <div>
              <span>Callsign</span>
              <strong>{formatNullableText(latestOfp.plan?.callsign)}</strong>
            </div>
            <div>
              <span>Numéro de vol</span>
              <strong>{formatNullableText(latestOfp.plan?.flightNumber)}</strong>
            </div>
            <div>
              <span>Départ</span>
              <strong>{formatNullableText(latestOfp.plan?.departureIcao)}</strong>
            </div>
            <div>
              <span>Arrivée</span>
              <strong>{formatNullableText(latestOfp.plan?.arrivalIcao)}</strong>
            </div>
            <div>
              <span>Appareil</span>
              <strong>{formatAircraft(latestOfp)}</strong>
            </div>
            <div>
              <span>Croisière</span>
              <strong>{formatCruiseAltitude(latestOfp)}</strong>
            </div>
            <div>
              <span>Temps estimé</span>
              <strong>
                {formatNullableText(latestOfp.plan?.estimatedTimeEnroute)}
              </strong>
            </div>
            <div>
              <span>Généré le</span>
              <strong>{formatDateTime(latestOfp.plan?.generatedAt ?? null)}</strong>
            </div>
          </div>
          <div className="panel-note simbrief-ofp-card__route">
            <p>{formatNullableText(latestOfp.plan?.route)}</p>
          </div>
        </>
      );
  }
}

export function SimbriefLatestOfpCard({
  latestOfp,
}: SimbriefLatestOfpCardProps): JSX.Element {
  const availability = getSimbriefAvailabilityPresentation(latestOfp.status);

  return (
    <Card className="ops-card simbrief-ofp-card">
      <div className="ops-card__header">
        <div>
          <span className="section-eyebrow">SimBrief</span>
          <h2>Dernier plan de vol disponible</h2>
        </div>
        <Badge label={availability.label} tone={availability.tone} />
      </div>
      {renderBody(latestOfp)}
    </Card>
  );
}
