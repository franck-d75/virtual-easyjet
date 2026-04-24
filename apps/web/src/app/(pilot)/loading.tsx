import type { JSX } from "react";

import { PageShell } from "@/components/layout/page-shell";
import { LoadingState } from "@/components/ui/loading-state";

export default function PilotLoading(): JSX.Element {
  return (
    <PageShell width="wide">
      <LoadingState label="Chargement de l'espace pilote..." />
    </PageShell>
  );
}
