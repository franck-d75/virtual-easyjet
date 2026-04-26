import type { JSX } from "react";

import { ProfileCard } from "@/components/pilot/profile-card";
import { SimbriefLatestOfpCard } from "@/components/pilot/simbrief-latest-ofp-card";
import { SimbriefSettingsCard } from "@/components/pilot/simbrief-settings-card";
import { Card } from "@/components/ui/card";
import { getMyLatestSimbriefOfp, getMyPilotProfile } from "@/lib/api/pilot";
import type {
  PilotProfileResponse,
  SimbriefLatestOfpResponse,
  UserMeResponse,
} from "@/lib/api/types";
import { requirePilotSession } from "@/lib/auth/guards";
import { logWebWarning } from "@/lib/observability/log";
import { buildUserDisplayName } from "@/lib/utils/user-display";

function buildFallbackProfile(
  user: UserMeResponse & {
    pilotProfile: NonNullable<UserMeResponse["pilotProfile"]>;
  },
): PilotProfileResponse {
  return {
    id: user.pilotProfile.id,
    pilotNumber: user.pilotProfile.pilotNumber,
    callsign: null,
    firstName: user.pilotProfile.firstName,
    lastName: user.pilotProfile.lastName,
    countryCode: null,
    simbriefPilotId: user.pilotProfile.simbriefPilotId,
    status: user.pilotProfile.status,
    experiencePoints: 0,
    hoursFlownMinutes: user.pilotProfile.hoursFlownMinutes,
    joinedAt: user.createdAt,
    createdAt: user.createdAt,
    updatedAt: user.createdAt,
    simbrief: null,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      status: user.status,
    },
    hub: user.pilotProfile.hub
      ? {
          id: user.pilotProfile.hub.code,
          code: user.pilotProfile.hub.code,
          name: user.pilotProfile.hub.name,
        }
      : null,
    rank: user.pilotProfile.rank
      ? {
          id: user.pilotProfile.rank.code,
          code: user.pilotProfile.rank.code,
          name: user.pilotProfile.rank.name,
          sortOrder: 0,
        }
      : null,
  };
}

function buildFallbackLatestOfp(
  pilotId: string | null,
  status: SimbriefLatestOfpResponse["status"] = "ERROR",
  detail = "Le service SimBrief est momentanement indisponible.",
): SimbriefLatestOfpResponse {
  return {
    status,
    pilotId,
    detail,
    fetchStatus: null,
    fetchedAt: new Date().toISOString(),
    source: null,
    plan: null,
  };
}

export default async function ProfilePage(): Promise<JSX.Element> {
  const session = await requirePilotSession();
  const fallbackProfile = buildFallbackProfile(session.user);
  const [profileResult, latestSimbriefOfpResult] = await Promise.allSettled([
    getMyPilotProfile(session.accessToken),
    getMyLatestSimbriefOfp(session.accessToken),
  ]);

  const profile =
    profileResult.status === "fulfilled"
      ? profileResult.value
      : fallbackProfile;
  const latestSimbriefOfp =
    latestSimbriefOfpResult.status === "fulfilled"
      ? latestSimbriefOfpResult.value
      : buildFallbackLatestOfp(
          profile.simbriefPilotId,
          profile.simbriefPilotId ? "ERROR" : "NOT_CONFIGURED",
        );
  const isDegraded =
    profileResult.status !== "fulfilled" ||
    latestSimbriefOfpResult.status !== "fulfilled";

  if (profileResult.status !== "fulfilled") {
    logWebWarning("profile page profile fetch failed", profileResult.reason);
  }

  if (latestSimbriefOfpResult.status !== "fulfilled") {
    logWebWarning(
      "profile page latest simbrief fetch failed",
      latestSimbriefOfpResult.reason,
    );
  }

  const displayName = buildUserDisplayName({
    firstName: profile.firstName,
    lastName: profile.lastName,
    username: profile.user.username,
  });

  return (
    <>
      <section className="page-hero">
        <span className="section-eyebrow">Profil</span>
        <h1>Mon profil pilote</h1>
        <p>
          Consultez vos informations pilote, votre rang, votre hub et votre
          progression au sein de la compagnie, puis configurez ici votre liaison
          SimBrief pour les futures recuperations de plan de vol.
        </p>
      </section>
      {isDegraded ? (
        <section className="section-band">
          <Card className="ops-card">
            <span className="section-eyebrow">Mode degrade</span>
            <h2>Le profil reste accessible</h2>
            <p>
              Certaines donnees n&apos;ont pas pu etre rechargees depuis l&apos;API.
              Les informations essentielles restent visibles et vous pourrez
              reessayer dans quelques instants.
            </p>
          </Card>
        </section>
      ) : null}
      <section className="panel-grid">
        <ProfileCard profile={profile} />
        <SimbriefSettingsCard
          displayName={displayName}
          initialPilotNumber={profile.pilotNumber}
          initialAvatarUrl={profile.user.avatarUrl}
          initialSimbriefPilotId={profile.simbriefPilotId}
        />
      </section>
      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Dernier OFP</span>
            <h2>Lecture SimBrief isolee</h2>
          </div>
          <p>
            Le web recupere ici le dernier plan de vol SimBrief en temps reel a
            partir du SimBrief Pilot ID stocke dans votre profil, sans encore
            injecter automatiquement ces donnees dans ACARS.
          </p>
        </div>

        <SimbriefLatestOfpCard latestOfp={latestSimbriefOfp} />
      </section>
    </>
  );
}
