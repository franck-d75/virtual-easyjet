import type { JSX } from "react";

import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { getPublicRules } from "@/lib/api/public";
import type { RulesContentResponse } from "@/lib/api/types";
import { logWebError } from "@/lib/observability/log";

export const dynamic = "force-dynamic";

function RulesSectionGrid({ rules }: { rules: RulesContentResponse }): JSX.Element {
  return (
    <section className="rules-grid">
      {rules.sections.map((section) => (
        <Card className="rules-card" key={section.key}>
          <h2>{section.title}</h2>
          <p className="rules-card__summary">{section.summary}</p>
          <div className="rules-card__body">
            {section.body.map((paragraph) => (
              <p key={`${section.key}-${paragraph.slice(0, 32)}`}>{paragraph}</p>
            ))}
          </div>
        </Card>
      ))}
    </section>
  );
}

export default async function RulesPage(): Promise<JSX.Element> {
  try {
    const rules = await getPublicRules();

    return (
      <>
        <section className="page-hero">
          <span className="section-eyebrow">Règlement</span>
          <h1>Règlement de la compagnie</h1>
          <p>
            Pour garantir une expérience agréable à tous, chaque pilote doit
            respecter les règles de comportement, de réservation et
            d&apos;exploitation des vols.
          </p>
        </section>

        <RulesSectionGrid rules={rules} />
      </>
    );
  } catch (error) {
    logWebError("rules page failed", error);
    return (
      <ErrorState
        title="Règlement indisponible"
        description="Le règlement n'a pas pu être chargé pour le moment."
      />
    );
  }
}
