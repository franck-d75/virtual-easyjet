"use client";

import type { FormEvent, JSX } from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AvatarUploadControl } from "@/components/ui/avatar-upload-control";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { UserMeResponse } from "@/lib/api/types";

type SimbriefSettingsCardProps = {
  initialPilotNumber: string;
  initialSimbriefPilotId: string | null;
  initialAvatarUrl: string | null;
  displayName: string;
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
  initialPilotNumber,
  initialSimbriefPilotId,
  initialAvatarUrl,
  displayName,
}: SimbriefSettingsCardProps): JSX.Element {
  const router = useRouter();
  const [pilotNumber, setPilotNumber] = useState(initialPilotNumber);
  const [simbriefPilotId, setSimbriefPilotId] = useState(
    initialSimbriefPilotId ?? "",
  );
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? "");
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const normalizedPilotNumber = pilotNumber.trim().toUpperCase();
    const normalizedSimbriefPilotId = simbriefPilotId.trim();

    if (!/^[A-Z0-9-]{3,16}$/.test(normalizedPilotNumber)) {
      setFeedback({
        tone: "danger",
        message:
          "Le numero pilote doit contenir entre 3 et 16 caracteres, avec lettres, chiffres ou tirets.",
      });
      return;
    }

    if (
      normalizedSimbriefPilotId.length > 0 &&
      !/^\d+$/.test(normalizedSimbriefPilotId)
    ) {
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
        pilotNumber: normalizedPilotNumber,
        simbriefPilotId:
          normalizedSimbriefPilotId.length > 0 ? normalizedSimbriefPilotId : null,
      }),
    });

    const rawPayload = await response.text();
    const payload = rawPayload.length > 0 ? parsePayload(rawPayload) : null;

    if (!response.ok) {
      setFeedback({
        tone: "danger",
        message: extractMessage(
          payload,
          "Impossible de mettre a jour votre profil pilote.",
        ),
      });
      return;
    }

    setPilotNumber(normalizedPilotNumber);
    setFeedback({
      tone: "success",
      message: "Profil pilote mis a jour.",
    });

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Card className="profile-card simbrief-card">
      <div className="profile-card__header">
        <div className="profile-card__hero">
          <UserAvatar avatarUrl={avatarUrl} name={displayName} size="lg" />
          <div>
            <span className="section-eyebrow">Identite et SimBrief</span>
            <h2>Parametres du profil</h2>
            <p className="simbrief-card__note">
              Televersez votre avatar, mettez a jour votre numero pilote et
              renseignez votre SimBrief Pilot ID pour garder un profil coherent
              sur le web et dans l&apos;ecosysteme ACARS.
            </p>
          </div>
        </div>
        <div className="profile-card__identity">
          <strong>{pilotNumber.trim() || "Non configure"}</strong>
          <span>{avatarUrl ? "Avatar actif" : "Avatar non renseigne"}</span>
        </div>
      </div>

      <div className="definition-grid">
        <div>
          <span>Avatar</span>
          <strong>{avatarUrl ? "Televerse" : "Initiales automatiques"}</strong>
        </div>
        <div>
          <span>Numero pilote</span>
          <strong>{pilotNumber.trim() || "Non configure"}</strong>
        </div>
        <div>
          <span>Preparation OFP</span>
          <strong>{simbriefPilotId.trim() ? "Pret" : "Non configure"}</strong>
        </div>
      </div>

      <AvatarUploadControl<UserMeResponse>
        currentAvatarUrl={avatarUrl}
        description="Choisissez une image locale depuis votre ordinateur. L'avatar sera mis a jour sur votre espace pilote et dans le header."
        displayName={displayName}
        onUploaded={(payload) => {
          setAvatarUrl(payload.avatarUrl ?? "");
        }}
        saveLabel="Enregistrer l'avatar"
        title="Televerser un avatar"
        uploadUrl="/api/pilot/avatar"
      />

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="pilot-number">Numero pilote</label>
          <input
            autoComplete="off"
            id="pilot-number"
            maxLength={16}
            onChange={(event) => {
              setPilotNumber(event.target.value.toUpperCase());
            }}
            placeholder="VA00001"
            type="text"
            value={pilotNumber}
          />
        </div>

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
          Laissez le champ SimBrief vide puis enregistrez pour supprimer la
          valeur actuellement configuree.
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
            {isPending ? "Enregistrement..." : "Enregistrer le profil"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
