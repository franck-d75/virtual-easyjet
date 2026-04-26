import type { JSX, ReactNode } from "react";

import { SessionKeepAlive } from "@/components/auth/session-keepalive";
import { Footer } from "@/components/layout/footer";
import { PageShell } from "@/components/layout/page-shell";
import { AdminHeader } from "@/components/layout/admin-header";
import { requireAdminSession } from "@/lib/auth/guards";
import { buildUserDisplayName } from "@/lib/utils/user-display";

type AdminLayoutProps = {
  children: ReactNode;
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: AdminLayoutProps): Promise<JSX.Element> {
  const session = await requireAdminSession();
  const pilotProfile = session.user.pilotProfile;
  const adminName = buildUserDisplayName({
    firstName: pilotProfile?.firstName,
    lastName: pilotProfile?.lastName,
    username: session.user.username,
  });

  return (
    <div className="site-frame site-frame--pilot">
      <SessionKeepAlive />
      <AdminHeader adminName={adminName} avatarUrl={session.user.avatarUrl} />
      <PageShell width="wide">{children}</PageShell>
      <Footer />
    </div>
  );
}
