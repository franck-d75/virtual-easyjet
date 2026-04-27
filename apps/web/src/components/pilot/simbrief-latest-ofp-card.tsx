"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SimbriefImportedRouteResponse, SimbriefLatestOfpResponse } from "@/lib/api/types";
import {
  formatDateTime,
  formatNullableText,
  formatNumber,
} from "@/lib/utils/format";
import { getSimbriefAvailabilityPresentation } from "@/lib/utils/status";

type SimbriefLatestOfpCardProps = {
  latestOfp: SimbriefLatestOfpResponse;
};

type FeedbackState = {
  tone: "success" | "danger";
  message: string;
} | null;

function extractMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = payload.message;

    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}

function parsePayload(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

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

function formatMatchedAirframe(latestOfp: SimbriefLatestOfpResponse): string {
  const matchedAirframe = latestOfp.plan?.aircraft?.matchedAirframe;

  if (!matchedAirframe) {
    return "Aucune airframe liée";
  }

  if (matchedAirframe.linkedAircraft) {
    return `${matchedAirframe.name} · ${matchedAirframe.linkedAircraft.registration}`;
  }

  return matchedAirframe.name;
}

function formatCruiseAltitude(latestOfp: SimbriefLatestOfpResponse): string {
  const altitude = latestOfp.plan?.cruiseAltitudeFt;

  if (altitude === null || altitude === undefined) {
    return "-";
  }

  return `${formatNumber(altitude)} ft`;
}

function formatDistance(latestOfp: SimbriefLatestOfpResponse): string {
  const distance = latestOfp.plan?.distanceNm;

  if (distance === null || distance === undefined) {
    return "-";
  }

  return `${formatNumber(distance)} NM`;
}

function formatBlockTime(latestOfp: SimbriefLatestOfpResponse): string {
  const blockTimeMinutes = latestOfp.plan?.blockTimeMinutes;

  if (blockTimeMinutes === null || blockTimeMinutes === undefined) {
    return "-";
  }

  const hours = Math.floor(blockTimeMinutes / 60);
  const minutes = blockTimeMinutes % 60;
  return `${String(hours)} h ${String(minutes).padStart(2, "0")} min`;
}

export function SimbriefLatestOfpCard({
  latestOfp,
}: SimbriefLatestOfpCardProps): JSX.Element {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isImporting, startImportTransition] = useTransition();
  const availability = getSimbriefAvailabilityPresentation(latestOfp.status);

  async function handleImportRoute(): Promise<void> {
    setFeedback(null);

    const response = await fetch("/api/pilot/simbrief/import-route", {
      method: "POST",
    });

    const rawPayload = await response.text();
    const payload = rawPayload.length > 0 ? parsePayload(rawPayload) : null;

    if (!response.ok) {
      setFeedback({
        tone: "danger",
        message: extractMessage(
          payload,
          "Impossible d'importer la route SimBrief pour le moment.",
        ),
      });
      return;
    }

    const importedRoute = payload as SimbriefImportedRouteResponse;
    setFeedback({
      tone: "success",
      message:
        importedRoute.message ||
        "La route SimBrief a bien été enregistrée dans la plateforme.",
    });

    startImportTransition(() => {
      router.refresh();
    });
  }

  function renderBody(): JSX.Element {
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
              La récupération du dernier OFP SimBrief a échoué pour le moment. Le
              profil pilote reste intact et vous pourrez réessayer sans impact sur
              l’authentification ni sur vos données VA.
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
              SimBrief. Vous pouvez désormais l’utiliser pour créer ou mettre à
              jour une route VA cohérente avec votre flotte réelle.
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
                <span>Airframe liée</span>
                <strong>{formatMatchedAirframe(latestOfp)}</strong>
              </div>
              <div>
                <span>Croisière</span>
                <strong>{formatCruiseAltitude(latestOfp)}</strong>
              </div>
              <div>
                <span>Distance</span>
                <strong>{formatDistance(latestOfp)}</strong>
              </div>
              <div>
                <span>Temps estimé</span>
                <strong>
                  {formatNullableText(latestOfp.plan?.estimatedTimeEnroute)}
                </strong>
              </div>
              <div>
                <span>Temps bloc estimé</span>
                <strong>{formatBlockTime(latestOfp)}</strong>
              </div>
              <div>
                <span>Généré le</span>
                <strong>{formatDateTime(latestOfp.plan?.generatedAt ?? null)}</strong>
              </div>
            </div>
            <div className="panel-note simbrief-ofp-card__route">
              <p>{formatNullableText(latestOfp.plan?.route)}</p>
            </div>
            <div className="inline-actions">
              <Button
                disabled={isImporting}
                onClick={() => {
                  void handleImportRoute();
                }}
                type="button"
              >
                {isImporting ? "Import en cours..." : "Importer route SimBrief"}
              </Button>
            </div>
          </>
        );
    }
  }

  return (
    <Card className="ops-card simbrief-ofp-card">
      <div className="ops-card__header">
        <div>
          <span className="section-eyebrow">SimBrief</span>
          <h2>Dernier plan de vol disponible</h2>
        </div>
        <Badge label={availability.label} tone={availability.tone} />
      </div>
      {renderBody()}
      {feedback ? (
        <p
          className={`inline-feedback inline-feedback--${feedback.tone}`}
          role="status"
        >
          {feedback.message}
        </p>
      ) : null}
    </Card>
  );
}
