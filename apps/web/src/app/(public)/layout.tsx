import type { JSX, ReactNode } from "react";

import { PublicLayoutShell } from "@/components/layout/public-layout-shell";

type PublicLayoutProps = {
  children: ReactNode;
};

export default function PublicLayout({
  children,
}: PublicLayoutProps): JSX.Element {
  return <PublicLayoutShell>{children}</PublicLayoutShell>;
}
