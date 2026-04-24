import type { JSX } from "react";

import type { BadgeTone } from "@/lib/utils/status";
import { cn } from "@/lib/utils/cn";

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

export function Badge({
  label,
  tone = "neutral",
}: BadgeProps): JSX.Element {
  return <span className={cn("badge", `badge--${tone}`)}>{label}</span>;
}
