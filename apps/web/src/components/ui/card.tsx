import type { HTMLAttributes, JSX, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({
  children,
  className,
  ...props
}: CardProps): JSX.Element {
  return (
    <div className={cn("surface-card", className)} {...props}>
      {children}
    </div>
  );
}
