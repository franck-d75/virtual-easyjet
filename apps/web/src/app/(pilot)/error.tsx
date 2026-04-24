"use client";

import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { PageShell } from "@/components/layout/page-shell";

type PilotErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function PilotError({
  error,
  reset,
}: PilotErrorProps): JSX.Element {
  return (
    <PageShell width="wide">
      <ErrorState
        title="Espace pilote indisponible"
        description={
          error.message ||
          "Les données pilote n’ont pas pu être chargées pour le moment."
        }
        action={
          <Button onClick={reset} type="button" variant="secondary">
            Réessayer
          </Button>
        }
      />
    </PageShell>
  );
}
