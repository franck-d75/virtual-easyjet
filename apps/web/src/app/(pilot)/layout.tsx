import type { JSX, ReactNode } from "react";

import { SessionKeepAlive } from "@/components/auth/session-keepalive";
import { Footer } from "@/components/layout/footer";
import { PageShell } from "@/components/layout/page-shell";
import { PilotHeader } from "@/components/layout/pilot-header";
import { getMyBookings } from "@/lib/api/pilot";
import { requirePilotSession } from "@/lib/auth/guards";
import { logWebWarning } from "@/lib/observability/log";
import { isActiveBooking } from "@/lib/utils/booking-opportunities";
import { buildUserDisplayName } from "@/lib/utils/user-display";

type PilotLayoutProps = {
  children: ReactNode;
};

export const dynamic = "force-dynamic";

export default async function PilotLayout({
  children,
}: PilotLayoutProps): Promise<JSX.Element> {
  const session = await requirePilotSession();
  const pilotProfile = session.user.pilotProfile;
  const pilotName = buildUserDisplayName({
    firstName: pilotProfile.firstName,
    lastName: pilotProfile.lastName,
    username: session.user.username,
  });
  const hasActiveBooking = await getMyBookings(session.accessToken)
    .then((bookings) => bookings.some(isActiveBooking))
    .catch((error: unknown) => {
      logWebWarning("pilot header bookings state failed", error);
      return false;
    });

  return (
    <div className="site-frame site-frame--pilot">
      <SessionKeepAlive />
      <PilotHeader
        avatarUrl={session.user.avatarUrl}
        hasActiveBooking={hasActiveBooking}
        isAdmin={session.user.role === "ADMIN"}
        pilotName={pilotName}
        pilotNumber={pilotProfile.pilotNumber}
      />
      <PageShell width="wide">{children}</PageShell>
      <Footer />
    </div>
  );
}
