import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SimbriefLatestOfpResponse } from "@/lib/api/types";
import type { SimbriefVaMatchOverview } from "@/lib/utils/simbrief-match";
import { formatNullableText } from "@/lib/utils/format";
import {
  getSimbriefAvailabilityPresentation,
  getSimbriefVaMatchPresentation,
} from "@/lib/utils/status";

type SimbriefMatchOverviewCardProps = {
  latestOfp: SimbriefLatestOfpResponse;
  summary: SimbriefVaMatchOverview;
  title: string;
};

export function SimbriefMatchOverviewCard({
  latestOfp,
  summary,
  title,
}: SimbriefMatchOverviewCardProps): JSX.Element {
  const matchPresentation = getSimbriefVaMatchPresentation(summary.status);
  const availabilityPresentation = getSimbriefAvailabilityPresentation(
    latestOfp.status,
  );

  return (
    <Card className="ops-card">
      <div className="ops-card__header">
        <div>
          <span className="section-eyebrow">SimBrief</span>
          <h2>{title}</h2>
        </div>
        <Badge label={matchPresentation.label} tone={matchPresentation.tone} />
      </div>

      <p>{summary.detail}</p>

      <div className="definition-grid">
        <div>
          <span>Dernier OFP</span>
          <strong>{formatNullableText(summary.latestOfpLabel)}</strong>
        </div>
        <div>
          <span>Rotation OFP</span>
          <strong>{formatNullableText(summary.latestOfpRoute)}</strong>
        </div>
        <div>
          <span>Disponibilité SimBrief</span>
          <strong>{availabilityPresentation.label}</strong>
        </div>
        <div>
          <span>Correspondance trouvée</span>
          <strong>
            {summary.matchedCandidate
              ? summary.matchedCandidate.label
              : "Aucune"}
          </strong>
        </div>
      </div>

      {latestOfp.status === "AVAILABLE" && latestOfp.plan ? (
        <div className="panel-note simbrief-ofp-card__route">
          <p>{formatNullableText(latestOfp.plan.route)}</p>
        </div>
      ) : null}

      <div className="inline-actions">
        {summary.matchedCandidate ? (
          <Button href={summary.matchedCandidate.href} variant="secondary">
            Ouvrir {summary.matchedCandidate.label}
          </Button>
        ) : null}
        <Button href="/profil" variant="ghost">
          Gérer SimBrief
        </Button>
      </div>
    </Card>
  );
}
