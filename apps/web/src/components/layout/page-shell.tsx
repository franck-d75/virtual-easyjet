import type { JSX, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type PageShellProps = {
  children: ReactNode;
  width?: "default" | "wide" | "narrow";
};

export function PageShell({
  children,
  width = "default",
}: PageShellProps): JSX.Element {
  return (
    <div className={cn("page-shell", width !== "default" && `page-shell--${width}`)}>
      {children}
    </div>
  );
}
