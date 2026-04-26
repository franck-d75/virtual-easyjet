"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  CreateSimbriefAirframePayload,
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

type AirframeFormState = {
  name: string;
  simbriefAirframeId: string;
  registration: string;
  aircraftIcao: string;
  engineType: string;
  notes: string;
};

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

function sortAirframes(
  airframes: SimbriefAirframeResponse[],
): SimbriefAirframeResponse[] {
  return [...airframes].sort((left, right) => {
    const leftKey = left.registration ?? left.name;
    const rightKey = right.registration ?? right.name;
    return leftKey.localeCompare(rightKey);
  });
}

function createInitialFormState(): AirframeFormState {
  return {
    name: "",
    simbriefAirframeId: "",
    registration: "",
    aircraftIcao: "A320",
    engineType: "",
    notes: "",
  };
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
            ? `${response.airframes.length} airframe(s) enregistree(s)`
            : "Aucune airframe enregistree",
      };
    case "NOT_CONFIGURED":
      return { tone: "warning", label: "SimBrief Pilot ID requis" };
    case "NOT_FOUND":
      return { tone: "warning", label: "Ajout manuel requis" };
    case "ERROR":
    default:
      return { tone: "danger", label: "Airframes indisponibles" };
  }
}

function buildAirframeMeta(airframe: SimbriefAirframeResponse): string {
  return [
    airframe.aircraftIcao,
    airframe.registration,
    airframe.engineType,
    airframe.notes,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

export function SimbriefAirframesCard({
  initialAirframes,
}: SimbriefAirframesCardProps): JSX.Element {
  const router = useRouter();
  const [airframesState, setAirframesState] = useState<SimbriefAirframesResponse>({
    ...initialAirframes,
    airframes: sortAirframes(initialAirframes.airframes),
  });
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [formState, setFormState] = useState<AirframeFormState>(
    createInitialFormState(),
  );
  const [isPending, startTransition] = useTransition();
  const [isCreating, setIsCreating] = useState(false);

  const presentation = useMemo(
    () => getStatusLabel(airframesState),
    [airframesState],
  );

  function updateFormState<Field extends keyof AirframeFormState>(
    field: Field,
    value: AirframeFormState[Field],
  ): void {
    setFormState((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  }

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
          "Impossible de verifier les airframes SimBrief pour le moment.",
        ),
      });
      return;
    }

    const syncedAirframes = payload as SimbriefAirframesResponse;
    setAirframesState({
      ...syncedAirframes,
      airframes: sortAirframes(syncedAirframes.airframes),
    });
    setFeedback({
      tone: "success",
      message:
        syncedAirframes.detail ??
        "Les airframes SimBrief locales ont ete rechargees sans erreur.",
    });

    startTransition(() => {
      router.refresh();
    });
  }

  async function handleCreate(): Promise<void> {
    setFeedback(null);
    setIsCreating(true);

    try {
      const payload: CreateSimbriefAirframePayload = {
        name: formState.name.trim(),
        simbriefAirframeId: formState.simbriefAirframeId.trim() || null,
        registration: formState.registration.trim().toUpperCase(),
        aircraftIcao: formState.aircraftIcao.trim().toUpperCase(),
        engineType: formState.engineType.trim() || null,
        notes: formState.notes.trim() || null,
      };

      const response = await fetch("/api/pilot/simbrief/airframes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const rawPayload = await response.text();
      const responsePayload = rawPayload.length > 0 ? parsePayload(rawPayload) : null;

      if (!response.ok) {
        setFeedback({
          tone: "danger",
          message: extractMessage(
            responsePayload,
            "Impossible d'ajouter cette airframe SimBrief.",
          ),
        });
        return;
      }

      const createdAirframe = responsePayload as SimbriefAirframeResponse;
      setAirframesState((currentValue) => ({
        ...currentValue,
        status: "AVAILABLE",
        detail:
          "Airframe SimBrief enregistree localement. Vous pouvez maintenant la lier a la flotte.",
        airframes: sortAirframes([...currentValue.airframes, createdAirframe]),
      }));
      setFormState(createInitialFormState());
      setFeedback({
        tone: "success",
        message:
          "Airframe SimBrief ajoutee. Elle est maintenant disponible dans la gestion de flotte.",
      });

      startTransition(() => {
        router.refresh();
      });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Card className="ops-card simbrief-airframes-card">
      <div className="ops-card__header">
        <div>
          <span className="section-eyebrow">SimBrief Airframes</span>
          <h2>Airframes SimBrief</h2>
          <p className="simbrief-card__note">
            Le dernier OFP reste importe via SimBrief, mais la liste des
            airframes doit etre geree ici manuellement pour garantir une flotte
            reelle, stable et exploitable avec ACARS.
          </p>
        </div>
        <div className="inline-actions">
          <Badge label={presentation.label} tone={presentation.tone} />
          <Button
            disabled={isPending}
            onClick={() => {
              void handleSync();
            }}
            type="button"
          >
            {isPending ? "Verification..." : "Verifier la synchro auto"}
          </Button>
        </div>
      </div>

      <div className="auth-form admin-form-grid">
        <div className="field">
          <label htmlFor="simbrief-airframe-name">Nom</label>
          <input
            id="simbrief-airframe-name"
            onChange={(event) => updateFormState("name", event.target.value)}
            placeholder="Fenix A320 easyJet Switzerland"
            type="text"
            value={formState.name}
          />
        </div>

        <div className="field">
          <label htmlFor="simbrief-airframe-id">ID airframe SimBrief connu</label>
          <input
            id="simbrief-airframe-id"
            onChange={(event) =>
              updateFormState("simbriefAirframeId", event.target.value)
            }
            placeholder="Optionnel"
            type="text"
            value={formState.simbriefAirframeId}
          />
        </div>

        <div className="field">
          <label htmlFor="simbrief-airframe-registration">Immatriculation</label>
          <input
            id="simbrief-airframe-registration"
            onChange={(event) =>
              updateFormState("registration", event.target.value)
            }
            placeholder="HB-JXB"
            type="text"
            value={formState.registration}
          />
        </div>

        <div className="field">
          <label htmlFor="simbrief-airframe-icao">Type ICAO</label>
          <select
            id="simbrief-airframe-icao"
            onChange={(event) => updateFormState("aircraftIcao", event.target.value)}
            value={formState.aircraftIcao}
          >
            <option value="A319">A319</option>
            <option value="A320">A320</option>
            <option value="A20N">A20N</option>
            <option value="A21N">A21N</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="simbrief-airframe-engine">Type moteur</label>
          <input
            id="simbrief-airframe-engine"
            onChange={(event) => updateFormState("engineType", event.target.value)}
            placeholder="CFM56"
            type="text"
            value={formState.engineType}
          />
        </div>

        <div className="field field--full">
          <label htmlFor="simbrief-airframe-notes">Notes</label>
          <textarea
            id="simbrief-airframe-notes"
            onChange={(event) => updateFormState("notes", event.target.value)}
            placeholder="Fenix A320 personnel, pret pour HB-JXB / HB-JXT / HB-JZR."
            rows={3}
            value={formState.notes}
          />
        </div>

        <div className="admin-form-actions">
          <Button
            disabled={isCreating}
            onClick={() => {
              void handleCreate();
            }}
            type="button"
          >
            {isCreating ? "Enregistrement..." : "Ajouter une airframe SimBrief"}
          </Button>
        </div>
      </div>

      {airframesState.airframes.length === 0 ? (
        <EmptyState
          description={
            airframesState.detail ??
            "Aucune airframe SimBrief n'est encore enregistree pour ce profil."
          }
          title="Aucune airframe SimBrief"
        />
      ) : (
        <div className="simbrief-airframes-card__list">
          {airframesState.airframes.map((airframe) => (
            <article
              className="simbrief-airframes-card__item"
              key={`${airframe.simbriefAirframeId}-${airframe.id ?? "local"}`}
            >
              <div className="simbrief-airframes-card__item-head">
                <div>
                  <strong>{airframe.name}</strong>
                  <span>
                    {buildAirframeMeta(airframe) ||
                      "Profil sans details complementaires"}
                  </span>
                </div>
                <Badge
                  label={
                    airframe.linkedAircraft
                      ? `Liee a ${airframe.linkedAircraft.registration}`
                      : "Non liee"
                  }
                  tone={airframe.linkedAircraft ? "success" : "warning"}
                />
              </div>

              <div className="definition-grid">
                <div>
                  <span>Origine</span>
                  <strong>
                    {airframe.source === "MANUAL"
                      ? "Ajout manuel"
                      : "SimBrief"}
                  </strong>
                </div>
                <div>
                  <span>Reference airframe</span>
                  <strong>{airframe.externalAirframeId ?? "Non renseignee"}</strong>
                </div>
                <div>
                  <span>Type mappe</span>
                  <strong>
                    {airframe.linkedAircraftType
                      ? `${airframe.linkedAircraftType.icaoCode} · ${airframe.linkedAircraftType.name}`
                      : "Aucun type de reference"}
                  </strong>
                </div>
                <div>
                  <span>Appareil flotte</span>
                  <strong>
                    {airframe.linkedAircraft
                      ? `${airframe.linkedAircraft.registration}${airframe.linkedAircraft.label ? ` · ${airframe.linkedAircraft.label}` : ""}`
                      : "Aucun appareil lie"}
                  </strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

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
