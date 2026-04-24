import type { JSX, ReactNode } from "react";

import { SessionKeepAlive } from "@/components/auth/session-keepalive";
import { Footer } from "@/components/layout/footer";
import { PageShell } from "@/components/layout/page-shell";
import { PilotHeader } from "@/components/layout/pilot-header";
import { requirePilotSession } from "@/lib/auth/guards";

type PilotLayoutProps = {
  children: ReactNode;
};

export const dynamic = "force-dynamic";

export default async function PilotLayout({
  children,
}: PilotLayoutProps): Promise<JSX.Element> {
  const session = await requirePilotSession();
  const pilotProfile = session.user.pilotProfile;

  return (
    <div className="site-frame site-frame--pilot">
      <SessionKeepAlive />
      <PilotHeader
        avatarUrl={session.user.avatarUrl}
        isAdmin={session.user.role === "ADMIN"}
        pilotName={`${pilotProfile.firstName} ${pilotProfile.lastName}`}
        pilotNumber={pilotProfile.pilotNumber}
      />
      <PageShell width="wide">{children}</PageShell>
      <Footer />
    </div>
  );
}
