"use client";

import type { FormEvent, JSX } from "react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AvatarUploadControl } from "@/components/ui/avatar-upload-control";
import { UserAvatar } from "@/components/ui/user-avatar";
import type {
  HubResponse,
  PilotProfileResponse,
  UserMeResponse,
} from "@/lib/api/types";
import { buildUserDisplayName } from "@/lib/utils/user-display";

type SimbriefSettingsCardProps = {
  initialUsername: string;
  initialFirstName: string;
  initialLastName: string;
  initialPilotNumber: string;
  initialCountryCode: string | null;
  initialCallsign: string | null;
  initialSimbriefPilotId: string | null;
  initialPreferredHubId: string | null;
  initialAvatarUrl: string | null;
  availableHubs: Array<Pick<HubResponse, "id" | "code" | "name">>;
};

type FormFeedback = {
  tone: "success" | "danger";
  message: string;
};

type FormState = {
  username: string;
  firstName: string;
  lastName: string;
  pilotNumber: string;
  countryCode: string;
  callsign: string;
  simbriefPilotId: string;
  preferredHubId: string;
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

function createInitialState(props: SimbriefSettingsCardProps): FormState {
  return {
    username: props.initialUsername,
    firstName: props.initialFirstName,
    lastName: props.initialLastName,
    pilotNumber: props.initialPilotNumber,
    countryCode: props.initialCountryCode ?? "",
    callsign: props.initialCallsign ?? "",
    simbriefPilotId: props.initialSimbriefPilotId ?? "",
    preferredHubId: props.initialPreferredHubId ?? "",
  };
}

function updateStateFromProfile(profile: PilotProfileResponse): FormState {
  return {
    username: profile.user.username,
    firstName: profile.firstName,
    lastName: profile.lastName,
    pilotNumber: profile.pilotNumber,
    countryCode: profile.countryCode ?? "",
    callsign: profile.callsign ?? "",
    simbriefPilotId: profile.simbriefPilotId ?? "",
    preferredHubId: profile.hub?.id ?? "",
  };
}

export function SimbriefSettingsCard(
  props: SimbriefSettingsCardProps,
): JSX.Element {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>(() =>
    createInitialState(props),
  );
  const [avatarUrl, setAvatarUrl] = useState(props.initialAvatarUrl ?? "");
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const [isPending, startTransition] = useTransition();

  const displayName = useMemo(
    () =>
      buildUserDisplayName({
        firstName: formState.firstName,
        lastName: formState.lastName,
        username: formState.username,
        fallback: formState.pilotNumber || "Pilote",
      }),
    [
      formState.firstName,
      formState.lastName,
      formState.pilotNumber,
      formState.username,
    ],
  );

  function updateField<Field extends keyof FormState>(
    field: Field,
    value: FormState[Field],
  ): void {
    setFormState((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const username = formState.username.trim().toLowerCase();
    const firstName = formState.firstName.trim();
    const lastName = formState.lastName.trim();
    const pilotNumber = formState.pilotNumber.trim().toUpperCase();
    const countryCode = formState.countryCode.trim().toUpperCase();
    const callsign = formState.callsign.trim().toUpperCase();
    const simbriefPilotId = formState.simbriefPilotId.trim();
    const preferredHubId = formState.preferredHubId.trim();

    if (!/^[a-z0-9._-]{3,24}$/i.test(username)) {
      setFeedback({
        tone: "danger",
        message:
          "Le nom d'utilisateur doit contenir entre 3 et 24 caractères, avec lettres, chiffres, points, tirets ou underscores.",
      });
      return;
    }

    if (firstName.length === 0 || firstName.length > 80) {
      setFeedback({
        tone: "danger",
        message: "Le prénom doit contenir entre 1 et 80 caractères.",
      });
      return;
    }

    if (lastName.length === 0 || lastName.length > 80) {
      setFeedback({
        tone: "danger",
        message: "Le nom doit contenir entre 1 et 80 caractères.",
      });
      return;
    }

    if (!/^[A-Z0-9-]{3,16}$/.test(pilotNumber)) {
      setFeedback({
        tone: "danger",
        message:
          "Le numéro pilote doit contenir entre 3 et 16 caractères, avec lettres, chiffres ou tirets.",
      });
      return;
    }

    if (countryCode.length > 0 && !/^[A-Z]{2}$/.test(countryCode)) {
      setFeedback({
        tone: "danger",
        message: "Le pays doit être renseigné avec un code ISO à 2 lettres.",
      });
      return;
    }

    if (callsign.length > 0 && !/^[A-Z0-9-]{2,16}$/.test(callsign)) {
      setFeedback({
        tone: "danger",
        message:
          "L'indicatif doit contenir entre 2 et 16 caractères, avec lettres, chiffres ou tirets.",
      });
      return;
    }

    if (simbriefPilotId.length > 0 && !/^\d+$/.test(simbriefPilotId)) {
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
        username,
        firstName,
        lastName,
        pilotNumber,
        countryCode: countryCode.length > 0 ? countryCode : null,
        callsign: callsign.length > 0 ? callsign : null,
        simbriefPilotId: simbriefPilotId.length > 0 ? simbriefPilotId : null,
        preferredHubId: preferredHubId.length > 0 ? preferredHubId : null,
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

    const updatedProfile = payload as PilotProfileResponse;
    setFormState(updateStateFromProfile(updatedProfile));
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
            <span className="section-eyebrow">Édition du profil</span>
            <h2>Informations pilote</h2>
            <p className="simbrief-card__note">
              Mettez à jour votre identité pilote, votre numéro VA, votre
              indicatif, votre SimBrief Pilot ID et votre hub préféré depuis un
              seul formulaire, sans toucher aux champs système calculés.
            </p>
          </div>
        </div>
        <div className="profile-card__identity">
          <strong>{formState.pilotNumber.trim() || "Non renseigné"}</strong>
          <span>{displayName}</span>
        </div>
      </div>

      <div className="definition-grid">
        <div>
          <span>Nom affiché</span>
          <strong>{displayName}</strong>
        </div>
        <div>
          <span>Nom d'utilisateur</span>
          <strong>{formState.username.trim() || "Non renseigné"}</strong>
        </div>
        <div>
          <span>Numéro pilote</span>
          <strong>{formState.pilotNumber.trim() || "Non renseigné"}</strong>
        </div>
        <div>
          <span>Préparation OFP</span>
          <strong>
            {formState.simbriefPilotId.trim() ? "Prête" : "Non configurée"}
          </strong>
        </div>
      </div>

      <AvatarUploadControl<UserMeResponse>
        currentAvatarUrl={avatarUrl}
        description="Choisissez une image locale depuis votre ordinateur. L’avatar sera mis à jour dans votre espace pilote, dans le header et dans l’administration."
        displayName={displayName}
        onUploaded={(payload) => {
          setAvatarUrl(payload.avatarUrl ?? "");
        }}
        saveLabel="Enregistrer l’avatar"
        title="Téléverser un avatar"
        uploadUrl="/api/pilot/avatar"
      />

      <form className="auth-form admin-form-grid" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="pilot-first-name">Prénom</label>
          <input
            autoComplete="given-name"
            id="pilot-first-name"
            onChange={(event) => updateField("firstName", event.target.value)}
            required
            type="text"
            value={formState.firstName}
          />
        </div>

        <div className="field">
          <label htmlFor="pilot-last-name">Nom</label>
          <input
            autoComplete="family-name"
            id="pilot-last-name"
            onChange={(event) => updateField("lastName", event.target.value)}
            required
            type="text"
            value={formState.lastName}
          />
        </div>

        <div className="field">
          <label htmlFor="pilot-username">Nom d'utilisateur</label>
          <input
            autoComplete="username"
            id="pilot-username"
            onChange={(event) => updateField("username", event.target.value)}
            required
            type="text"
            value={formState.username}
          />
        </div>

        <div className="field">
          <label htmlFor="pilot-number">Numéro pilote</label>
          <input
            autoComplete="off"
            id="pilot-number"
            maxLength={16}
            onChange={(event) =>
              updateField("pilotNumber", event.target.value.toUpperCase())
            }
            placeholder="VA00001"
            required
            type="text"
            value={formState.pilotNumber}
          />
        </div>

        <div className="field">
          <label htmlFor="pilot-country">Pays (ISO)</label>
          <input
            autoComplete="country"
            id="pilot-country"
            maxLength={2}
            onChange={(event) =>
              updateField("countryCode", event.target.value.toUpperCase())
            }
            placeholder="FR"
            type="text"
            value={formState.countryCode}
          />
        </div>

        <div className="field">
          <label htmlFor="pilot-callsign">Indicatif</label>
          <input
            autoComplete="off"
            id="pilot-callsign"
            maxLength={16}
            onChange={(event) =>
              updateField("callsign", event.target.value.toUpperCase())
            }
            placeholder="VEJ123"
            type="text"
            value={formState.callsign}
          />
        </div>

        <div className="field">
          <label htmlFor="simbrief-pilot-id">SimBrief Pilot ID</label>
          <input
            autoComplete="off"
            id="simbrief-pilot-id"
            inputMode="numeric"
            maxLength={32}
            onChange={(event) =>
              updateField("simbriefPilotId", event.target.value)
            }
            placeholder="123456"
            type="text"
            value={formState.simbriefPilotId}
          />
        </div>

        <div className="field">
          <label htmlFor="preferred-hub">Hub préféré</label>
          <select
            id="preferred-hub"
            onChange={(event) => updateField("preferredHubId", event.target.value)}
            value={formState.preferredHubId}
          >
            <option value="">Hub non attribué</option>
            {props.availableHubs.map((hub) => (
              <option key={hub.id} value={hub.id}>
                {hub.code} · {hub.name}
              </option>
            ))}
          </select>
          {props.availableHubs.length === 0 ? (
            <p className="field__hint">
              Aucun hub enregistré pour le moment. Vous pourrez en choisir un dès
              qu’un hub réel aura été publié.
            </p>
          ) : null}
        </div>

        <p className="simbrief-card__note field field--full">
          Laissez vides les champs optionnels pour retirer l’indicatif, le pays,
          le SimBrief Pilot ID ou le hub préféré actuellement configurés.
        </p>

        {feedback ? (
          <p
            className={`inline-feedback inline-feedback--${feedback.tone}`}
            role="status"
          >
            {feedback.message}
          </p>
        ) : null}

        <div className="profile-card__actions admin-form-actions">
          <Button disabled={isPending} type="submit">
            {isPending ? "Enregistrement..." : "Enregistrer le profil"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
