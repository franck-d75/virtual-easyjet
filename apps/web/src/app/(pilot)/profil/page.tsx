import type { JSX } from "react";

import { ProfileCard } from "@/components/pilot/profile-card";
import { SimbriefLatestOfpCard } from "@/components/pilot/simbrief-latest-ofp-card";
import { SimbriefSettingsCard } from "@/components/pilot/simbrief-settings-card";
import { getMyLatestSimbriefOfp, getMyPilotProfile } from "@/lib/api/pilot";
import { requirePilotSession } from "@/lib/auth/guards";

export default async function ProfilePage(): Promise<JSX.Element> {
  const session = await requirePilotSession();
  const [profile, latestSimbriefOfp] = await Promise.all([
    getMyPilotProfile(session.accessToken),
    getMyLatestSimbriefOfp(session.accessToken),
  ]);

  return (
    <>
      <section className="page-hero">
        <span className="section-eyebrow">Profil</span>
        <h1>Mon profil pilote</h1>
        <p>
          Consultez vos informations pilote, votre rang, votre hub et votre
          progression au sein de la compagnie, puis configurez ici votre
          liaison
          SimBrief pour les futures récupérations de plan de vol.
        </p>
      </section>
      <section className="panel-grid">
        <ProfileCard profile={profile} />
        <SimbriefSettingsCard
          displayName={`${profile.firstName} ${profile.lastName}`}
          initialAvatarUrl={profile.user.avatarUrl}
          initialSimbriefPilotId={profile.simbriefPilotId}
        />
      </section>
      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Dernier OFP</span>
            <h2>Lecture SimBrief isolée</h2>
          </div>
          <p>
            Le web récupère ici le dernier plan de vol SimBrief en temps réel à
            partir du SimBrief Pilot ID stocké dans votre profil, sans encore
            injecter automatiquement ces données dans ACARS.
          </p>
        </div>

        <SimbriefLatestOfpCard latestOfp={latestSimbriefOfp} />
      </section>
    </>
  );
}
