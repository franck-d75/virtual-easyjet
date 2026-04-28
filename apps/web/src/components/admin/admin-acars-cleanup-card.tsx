"use client";

import type { JSX } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AdminAcarsCleanupResponse } from "@/lib/api/types";

import {
  extractApiMessage,
  handleAdminUnauthorized,
  parseJsonPayload,
  type AdminFeedback,
} from "./admin-feedback";

export function AdminAcarsCleanupCard(): JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<AdminFeedback | null>(null);
  const [result, setResult] = useState<AdminAcarsCleanupResponse | null>(null);

  async function handleCleanup(): Promise<void> {
    setFeedback(null);

    const response = await fetch("/api/admin/acars/cleanup-test-data", {
      method: "POST",
      credentials: "include",
    });

    const rawPayload = await response.text();
    const payload = rawPayload ? parseJsonPayload(rawPayload) : null;

    if (!response.ok) {
      if (handleAdminUnauthorized(response)) {
        return;
      }

      setFeedback({
        tone: "danger",
        message: extractApiMessage(
          payload,
          "Impossible de nettoyer les donnees ACARS de test.",
        ),
      });
      return;
    }

    const cleanupResult = payload as AdminAcarsCleanupResponse;
    setResult(cleanupResult);
    setFeedback({
      tone: "success",
      message:
        cleanupResult.deleted && cleanupResult.deleted.bookings > 0
          ? `${cleanupResult.deleted.bookings} reservation(s) de test et les sessions liees ont ete supprimees.`
          : "Aucune donnee ACARS de test ciblee n'a ete trouvee.",
    });

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Card className="ops-card ops-card--highlight">
      <span className="section-eyebrow">Maintenance ACARS</span>
      <h2>Nettoyer les donnees de test</h2>
      <p>
        Supprime les reservations, vols, sessions ACARS et PIREPs de test
        identifies via <strong>EZY1000</strong>, le prefixe{" "}
        <strong>AUTO_SIMBRIEF_OFP</strong> et le pilote <strong>VEZY001</strong>.
      </p>
      <div className="admin-page-actions">
        <Button disabled={isPending} onClick={() => void handleCleanup()}>
          {isPending ? "Nettoyage en cours..." : "Nettoyer donnees ACARS test"}
        </Button>
      </div>
      {feedback ? (
        <p
          className={`inline-feedback inline-feedback--${feedback.tone}`}
          role="status"
        >
          {feedback.message}
        </p>
      ) : null}
      {result ? (
        <p className="inline-feedback">
          Sessions ciblees : {result.counts.sessions} | PIREPs cibles :{" "}
          {result.counts.pireps} | Telemetries ciblees :{" "}
          {result.counts.telemetryPoints}
        </p>
      ) : null}
    </Card>
  );
}
