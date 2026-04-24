import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { SimbriefVaMatchResult } from "@/lib/utils/simbrief-match";
import { getSimbriefVaMatchPresentation } from "@/lib/utils/status";

type SimbriefMatchBadgeProps = {
  match: SimbriefVaMatchResult;
};

export function SimbriefMatchBadge({
  match,
}: SimbriefMatchBadgeProps): JSX.Element {
  const presentation = getSimbriefVaMatchPresentation(match.status);

  return (
    <div className="table-badge-stack">
      <Badge label={presentation.label} tone={presentation.tone} />
      <small>{match.detail}</small>
    </div>
  );
}
