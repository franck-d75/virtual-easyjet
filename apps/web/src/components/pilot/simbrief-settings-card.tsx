"use client";

import type { FormEvent, JSX } from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type SimbriefSettingsCardProps = {
  initialSimbriefPilotId: string | null;
};

type FormFeedback = {
  tone: "success" | "danger";
  message: string;
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

export function SimbriefSettingsCard({
  initialSimbriefPilotId,
}: SimbriefSettingsCardProps): JSX.Element {
  const router = useRouter();
  const [simbriefPilotId, setSimbriefPilotId] = useState(
    initialSimbriefPilotId ?? "",
  );
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const normalizedValue = simbriefPilotId.trim();

    if (normalizedValue.length > 0 && !/^\d+$/.test(normalizedValue)) {
      setFeedback({
        tone: "danger",
        message: "Le SimBrief Pilot ID doit contenir uniquement des chiffres.",
      });
      return;
    }

    setFeedback(null);

    const response = await fetch("/api/pilot/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        simbriefPilotId: normalizedValue.length > 0 ? normalizedValue : null,
      }),
    });

    const rawPayload = await response.text();
    const payload = rawPayload.length > 0 ? parsePayload(rawPayload) : null;

    if (!response.ok) {
      setFeedback({
        tone: "danger",
        message: extractMessage(
          payload,
          "Impossible de mettre à jour votre identifiant SimBrief.",
        ),
      });
      return;
    }

    setFeedback({
      tone: "success",
      message:
        normalizedValue.length > 0
          ? "Identifiant SimBrief enregistré."
          : "Identifiant SimBrief supprimé.",
    });

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Card className="profile-card simbrief-card">
      <div className="profile-card__header">
        <div>
          <span className="section-eyebrow">SimBrief</span>
          <h2>Préparation du plan de vol</h2>
          <p className="simbrief-card__note">
            Renseignez votre SimBrief Pilot ID numérique. C’est l’identifiant
            le plus stable pour préparer la récupération future de votre
            dernier plan de vol dans le web et dans ACARS.
          </p>
        </div>
        <div className="profile-card__identity">
          <strong>{initialSimbriefPilotId ?? "Non configuré"}</strong>
          <span>{initialSimbriefPilotId ? "Identifiant actif" : "À renseigner"}</span>
        </div>
      </div>

      <div className="definition-grid">
        <div>
          <span>Stratégie retenue</span>
          <strong>SimBrief Pilot ID</strong>
        </div>
        <div>
          <span>Usage futur</span>
          <strong>Récupération du dernier OFP</strong>
        </div>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="simbrief-pilot-id">SimBrief Pilot ID</label>
          <input
            autoComplete="off"
            id="simbrief-pilot-id"
            inputMode="numeric"
            maxLength={32}
            onChange={(event) => {
              setSimbriefPilotId(event.target.value);
            }}
            placeholder="123456"
            type="text"
            value={simbriefPilotId}
          />
        </div>

        <p className="simbrief-card__note">
          Laissez ce champ vide puis enregistrez si vous souhaitez retirer la
          liaison SimBrief de votre profil.
        </p>

        {feedback ? (
          <p
            className={`inline-feedback inline-feedback--${feedback.tone}`}
            role="status"
          >
            {feedback.message}
          </p>
        ) : null}

        <div className="profile-card__actions">
          <Button disabled={isPending} type="submit">
            {isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
