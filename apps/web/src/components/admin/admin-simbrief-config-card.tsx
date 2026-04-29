"use client";

import type { ChangeEvent, JSX } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  AdminSimbriefConfigPayload,
  AdminSimbriefConfigResponse,
} from "@/lib/api/types";

import {
  extractApiMessage,
  handleAdminUnauthorized,
  parseJsonPayload,
  type AdminFeedback,
} from "./admin-feedback";

type AdminSimbriefConfigCardProps = {
  initialConfig: AdminSimbriefConfigResponse;
};

function formatUpdatedAt(value: string | null): string {
  if (!value) {
    return "Jamais configuree";
  }

  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function AdminSimbriefConfigCard({
  initialConfig,
}: AdminSimbriefConfigCardProps): JSX.Element {
  const router = useRouter();
  const [config, setConfig] = useState(initialConfig);
  const [apiKey, setApiKey] = useState("");
  const [feedback, setFeedback] = useState<AdminFeedback | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submitPayload(
    payload: AdminSimbriefConfigPayload,
    successMessage: string,
  ): Promise<void> {
    setFeedback(null);

    const response = await fetch("/api/admin/simbrief-config", {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const rawPayload = await response.text();
    const responsePayload = rawPayload ? parseJsonPayload(rawPayload) : null;

    if (!response.ok) {
      if (handleAdminUnauthorized(response)) {
        return;
      }

      setFeedback({
        tone: "danger",
        message: extractApiMessage(
          responsePayload,
          "Impossible de mettre a jour la configuration SimBrief.",
        ),
      });
      return;
    }

    const savedConfig = responsePayload as AdminSimbriefConfigResponse;
    setConfig(savedConfig);
    setApiKey("");
    setFeedback({
      tone: "success",
      message: successMessage,
    });

    startTransition(() => {
      router.refresh();
    });
  }

  async function handleSave(): Promise<void> {
    const normalizedApiKey = apiKey.trim();
    if (normalizedApiKey.length === 0) {
      setFeedback({
        tone: "danger",
        message: "Saisissez une cle API SimBrief avant d'enregistrer.",
      });
      return;
    }

    await submitPayload(
      { apiKey: normalizedApiKey },
      "La cle API SimBrief a ete enregistree cote serveur.",
    );
  }

  async function handleClear(): Promise<void> {
    if (
      !window.confirm(
        "Effacer la cle API SimBrief stockee cote serveur ?",
      )
    ) {
      return;
    }

    await submitPayload(
      { clearApiKey: true },
      "La cle API SimBrief a ete supprimee.",
    );
  }

  return (
    <Card className="ops-card ops-card--highlight">
      <span className="section-eyebrow">SimBrief prive</span>
      <h2>Cle API SimBrief</h2>
      <p>
        Enregistrez votre cle cote serveur pour preparer les futurs flux
        SimBrief sans jamais l'exposer dans le navigateur ni dans le depot.
      </p>

      <div className="admin-panel-stack">
        <div className="field">
          <label htmlFor="admin-simbrief-api-key">Nouvelle cle API</label>
          <input
            id="admin-simbrief-api-key"
            autoComplete="off"
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setApiKey(event.target.value)
            }
            placeholder="Collez votre cle SimBrief ici"
            type="password"
            value={apiKey}
          />
        </div>

        <div className="table-secondary">
          <strong>Etat :</strong>{" "}
          {config.hasApiKey
            ? `Configuree (${config.maskedApiKey ?? "masquee"})`
            : "Aucune cle enregistree"}
        </div>
        <div className="table-muted">
          Derniere mise a jour : {formatUpdatedAt(config.updatedAt)}
          {config.updatedBy ? ` par ${config.updatedBy.username}` : ""}
        </div>

        <div className="admin-page-actions">
          <Button disabled={isPending} onClick={() => void handleSave()}>
            {isPending ? "Enregistrement..." : "Enregistrer la cle"}
          </Button>
          {config.hasApiKey ? (
            <Button
              disabled={isPending}
              onClick={() => void handleClear()}
              variant="secondary"
            >
              Effacer la cle
            </Button>
          ) : null}
        </div>

        <p className="table-muted">
          L'import de route depuis l'administration utilise deja votre dernier
          OFP SimBrief. Cette cle privee est stockee cote serveur pour les
          integrations SimBrief enrichies et les futurs flux de generation.
        </p>

        {feedback ? (
          <p
            className={`inline-feedback inline-feedback--${feedback.tone}`}
            role="status"
          >
            {feedback.message}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
