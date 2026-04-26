"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  SimbriefAirframeResponse,
  SimbriefAirframesResponse,
} from "@/lib/api/types";

type SimbriefAirframesCardProps = {
  initialAirframes: SimbriefAirframesResponse;
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

function getStatusLabel(response: SimbriefAirframesResponse): {
  tone: "success" | "warning" | "danger" | "neutral";
  label: string;
} {
  switch (response.status) {
    case "AVAILABLE":
      return {
        tone: response.airframes.length > 0 ? "success" : "neutral",
        label:
          response.airframes.length > 0
            ? `${response.airframes.length} airframe(s) détectée(s)`
            : "Aucune airframe détectée",
      };
    case "NOT_CONFIGURED":
      return { tone: "warning", label: "SimBrief non configuré" };
    case "NOT_FOUND":
      return { tone: "warning", label: "Aucune airframe récupérée" };
    case "ERROR":
    default:
      return { tone: "danger", label: "Synchronisation indisponible" };
  }
}

function buildAirframeMeta(airframe: SimbriefAirframeResponse): string {
  return [
    airframe.aircraftIcao,
    airframe.registration,
    airframe.equipment,
    airframe.engineType,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

export function SimbriefAirframesCard({
  initialAirframes,
}: SimbriefAirframesCardProps): JSX.Element {
  const router = useRouter();
  const [airframesState, setAirframesState] =
    useState<SimbriefAirframesResponse>(initialAirframes);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isPending, startTransition] = useTransition();

  const presentation = useMemo(
    () => getStatusLabel(airframesState),
    [airframesState],
  );

  async function handleSync(): Promise<void> {
    setFeedback(null);

    const response = await fetch("/api/pilot/simbrief/airframes/sync", {
      method: "POST",
    });

    const rawPayload = await response.text();
    const payload = rawPayload.length > 0 ? parsePayload(rawPayload) : null;

    if (!response.ok) {
      setFeedback({
        tone: "danger",
        message: extractMessage(
          payload,
          "Impossible de synchroniser vos airframes SimBrief pour le moment.",
        ),
      });
      return;
    }

    const syncedAirframes = payload as SimbriefAirframesResponse;
    setAirframesState(syncedAirframes);
    setFeedback({
      tone: syncedAirframes.airframes.length > 0 ? "success" : "danger",
      message:
        syncedAirframes.airframes.length > 0
          ? "Airframes SimBrief synchronisées."
          : syncedAirframes.detail ??
            "Aucune airframe SimBrief exploitable n'a été récupérée.",
    });

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Card className="ops-card simbrief-airframes-card">
      <div className="ops-card__header">
        <div>
          <span className="section-eyebrow">SimBrief Airframes</span>
          <h2>Airframes SimBrief</h2>
          <p className="simbrief-card__note">
            Synchronisez ici vos airframes SimBrief réelles pour préparer la
            flotte, relier vos appareils VA et exploiter des OFP cohérents avec
            votre Fenix A320 ou vos autres profils réels.
          </p>
        </div>
        <div className="inline-actions">
          <Badge label={presentation.label} tone={presentation.tone} />
          <Button
            disabled={isPending || airframesState.status === "NOT_CONFIGURED"}
            onClick={() => {
              void handleSync();
            }}
            type="button"
          >
            {isPending ? "Synchronisation..." : "Synchroniser mes airframes"}
          </Button>
        </div>
      </div>

      {airframesState.status === "NOT_CONFIGURED" ? (
        <EmptyState
          description="Renseignez d'abord votre SimBrief Pilot ID dans votre profil pour permettre la récupération de vos airframes personnelles."
          title="SimBrief Pilot ID requis"
        />
      ) : null}

      {airframesState.status !== "NOT_CONFIGURED" &&
      airframesState.airframes.length === 0 ? (
        <EmptyState
          description={
            airframesState.detail ??
            "Aucune airframe SimBrief exploitable n'a été récupérée pour le moment."
          }
          title="Aucune airframe SimBrief"
        />
      ) : null}

      {airframesState.airframes.length > 0 ? (
        <div className="simbrief-airframes-card__list">
          {airframesState.airframes.map((airframe) => (
            <article
              className="simbrief-airframes-card__item"
              key={`${airframe.simbriefAirframeId}-${airframe.id ?? "live"}`}
            >
              <div className="simbrief-airframes-card__item-head">
                <div>
                  <strong>{airframe.name}</strong>
                  <span>{buildAirframeMeta(airframe) || "Profil sans détails complémentaires"}</span>
                </div>
                <Badge
                  label={
                    airframe.linkedAircraft
                      ? `Liée à ${airframe.linkedAircraft.registration}`
                      : "Non liée"
                  }
                  tone={airframe.linkedAircraft ? "success" : "warning"}
                />
              </div>

              <div className="definition-grid">
                <div>
                  <span>ID airframe</span>
                  <strong>{airframe.simbriefAirframeId}</strong>
                </div>
                <div>
                  <span>Type mappé</span>
                  <strong>
                    {airframe.linkedAircraftType
                      ? `${airframe.linkedAircraftType.icaoCode} · ${airframe.linkedAircraftType.name}`
                      : "Aucun type de référence"}
                  </strong>
                </div>
                <div>
                  <span>Appareil flotte</span>
                  <strong>
                    {airframe.linkedAircraft
                      ? `${airframe.linkedAircraft.registration}${airframe.linkedAircraft.label ? ` · ${airframe.linkedAircraft.label}` : ""}`
                      : "Aucun appareil lié"}
                  </strong>
                </div>
                <div>
                  <span>Dernière synchro</span>
                  <strong>{airframe.syncedAt ?? "Lecture en direct"}</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

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
