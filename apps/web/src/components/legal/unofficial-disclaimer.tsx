import type { JSX } from "react";

import { UNOFFICIAL_DISCLAIMER } from "@/lib/config/env";
import { cn } from "@/lib/utils/cn";

type UnofficialDisclaimerProps = {
  compact?: boolean;
};

export function UnofficialDisclaimer({
  compact = false,
}: UnofficialDisclaimerProps): JSX.Element {
  return (
    <div className={cn("disclaimer-banner", compact && "disclaimer-banner--compact")}>
      <strong>Important</strong>
      <p>{UNOFFICIAL_DISCLAIMER}</p>
    </div>
  );
}
