import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/layout/page-shell";
import { APP_NAME } from "@/lib/config/env";

export default function NotFound(): JSX.Element {
  return (
    <PageShell width="narrow">
      <Card className="not-found-card">
        <span className="section-eyebrow">{APP_NAME}</span>
        <h1>Page introuvable</h1>
        <p>
          La page demandée n’existe pas ou n’est plus disponible dans cette
          version du site.
        </p>
        <Button href="/">Retour à l’accueil</Button>
      </Card>
    </PageShell>
  );
}
