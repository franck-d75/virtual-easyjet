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
  initialSimbriefPilotId,
  initialAvatarUrl,
  displayName,
}: SimbriefSettingsCardProps): JSX.Element {
  const router = useRouter();
  const [simbriefPilotId, setSimbriefPilotId] = useState(
    initialSimbriefPilotId ?? "",
  );
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? "");
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const normalizedSimbriefPilotId = simbriefPilotId.trim();

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
          "Impossible de mettre à jour votre profil pilote.",
        ),
      });
      return;
    }

    setFeedback({
      tone: "success",
      message: "Profil pilote mis à jour.",
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
            <span className="section-eyebrow">Identité et SimBrief</span>
            <h2>Paramètres du profil</h2>
            <p className="simbrief-card__note">
              Téléversez votre avatar puis renseignez votre SimBrief Pilot ID
              pour enrichir votre identité pilote sur le web.
            </p>
          </div>
        </div>
        <div className="profile-card__identity">
          <strong>{simbriefPilotId.trim() || "Non configuré"}</strong>
          <span>{avatarUrl ? "Avatar actif" : "Avatar non renseigné"}</span>
        </div>
      </div>

      <div className="definition-grid">
        <div>
          <span>Avatar</span>
          <strong>{avatarUrl ? "Téléversé" : "Fallback initiales"}</strong>
        </div>
        <div>
          <span>Préparation OFP</span>
          <strong>{simbriefPilotId.trim() ? "Prêt" : "Non configuré"}</strong>
        </div>
      </div>

      <AvatarUploadControl<UserMeResponse>
        currentAvatarUrl={avatarUrl}
        description="Choisissez une image locale depuis votre ordinateur. L'avatar sera mis à jour sur votre espace pilote et dans le header."
        displayName={displayName}
        onUploaded={(payload) => {
          setAvatarUrl(payload.avatarUrl ?? "");
        }}
        saveLabel="Enregistrer l'avatar"
        title="Téléverser un avatar"
        uploadUrl="/api/pilot/avatar"
      />

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
          Laissez ce champ vide puis enregistrez pour supprimer la valeur
          actuellement configurée.
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
