import type { JSX } from "react";

import { LoadingState } from "@/components/ui/loading-state";
import { PageShell } from "@/components/layout/page-shell";

export default function Loading(): JSX.Element {
  return (
    <PageShell width="wide">
      <LoadingState label="Chargement de Virtual Easyjet..." />
    </PageShell>
  );
}
