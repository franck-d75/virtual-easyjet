"use client";

import type { JSX, ReactNode } from "react";
import { usePathname } from "next/navigation";

import { Footer } from "@/components/layout/footer";
import { PageShell } from "@/components/layout/page-shell";
import { PublicHeader } from "@/components/layout/public-header";
import { UnofficialDisclaimer } from "@/components/legal/unofficial-disclaimer";
import { cn } from "@/lib/utils/cn";

type PublicLayoutShellProps = {
  children: ReactNode;
};

export function PublicLayoutShell({
  children,
}: PublicLayoutShellProps): JSX.Element {
  const pathname = usePathname();
  const isLiveMap = pathname.startsWith("/live-map");

  return (
    <div
      className={cn(
        "site-frame site-frame--public",
        isLiveMap && "site-frame--live-map",
      )}
    >
      <PublicHeader />

      {isLiveMap ? (
        <main className="live-map-shell">{children}</main>
      ) : (
        <>
          <PageShell width="wide">
            <UnofficialDisclaimer compact />
            {children}
          </PageShell>
          <Footer />
        </>
      )}
    </div>
  );
}
