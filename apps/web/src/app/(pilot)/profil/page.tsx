import type { JSX } from "react";

import { ApiActionButton } from "@/components/pilot/api-action-button";
import { BrowserDiagnosticsCard } from "@/components/pilot/browser-diagnostics-card";
import { ProfileCard } from "@/components/pilot/profile-card";
import { SimbriefAirframesCard } from "@/components/pilot/simbrief-airframes-card";
import { SimbriefLatestOfpCard } from "@/components/pilot/simbrief-latest-ofp-card";
import { SimbriefSettingsCard } from "@/components/pilot/simbrief-settings-card";
import { Card } from "@/components/ui/card";
import {
  getMyLatestSimbriefOfp,
  getMyPilotProfile,
  getMySimbriefAirframes,
} from "@/lib/api/pilot";
import { getPublicHubs } from "@/lib/api/public";
import type {
  HubResponse,
  PilotProfileResponse,
  SimbriefAirframesResponse,
  SimbriefLatestOfpResponse,
  UserMeResponse,
} from "@/lib/api/types";
import { requirePilotSession } from "@/lib/auth/guards";
import { logWebWarning } from "@/lib/observability/log";

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
    countryCode: user.pilotProfile.countryCode,
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
  detail = "Le service SimBrief est momentanément indisponible.",
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

function buildFallbackAirframes(
  pilotId: string | null,
  status: SimbriefAirframesResponse["status"] = "ERROR",
  detail = "La synchronisation des airframes SimBrief est momentanément indisponible.",
): SimbriefAirframesResponse {
  return {
    status,
    pilotId,
    detail,
    fetchStatus: null,
    fetchedAt: new Date().toISOString(),
    source: null,
    airframes: [],
  };
}

export default async function ProfilePage(): Promise<JSX.Element> {
  const session = await requirePilotSession();
  const fallbackProfile = buildFallbackProfile(session.user);
  const [
    profileResult,
    latestSimbriefOfpResult,
    simbriefAirframesResult,
    hubsResult,
  ] = await Promise.allSettled([
    getMyPilotProfile(session.accessToken),
    getMyLatestSimbriefOfp(session.accessToken),
    getMySimbriefAirframes(session.accessToken),
    getPublicHubs(),
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
  const simbriefAirframes =
    simbriefAirframesResult.status === "fulfilled"
      ? simbriefAirframesResult.value
      : buildFallbackAirframes(
          profile.simbriefPilotId,
          profile.simbriefPilotId ? "ERROR" : "NOT_CONFIGURED",
        );
  const availableHubs =
    hubsResult.status === "fulfilled" && Array.isArray(hubsResult.value)
      ? hubsResult.value
      : ([] as HubResponse[]);
  const isDegraded =
    profileResult.status !== "fulfilled" ||
    latestSimbriefOfpResult.status !== "fulfilled" ||
    simbriefAirframesResult.status !== "fulfilled";

  if (profileResult.status !== "fulfilled") {
    logWebWarning("profile page profile fetch failed", profileResult.reason);
  }

  if (latestSimbriefOfpResult.status !== "fulfilled") {
    logWebWarning(
      "profile page latest simbrief fetch failed",
      latestSimbriefOfpResult.reason,
    );
  }

  if (simbriefAirframesResult.status !== "fulfilled") {
    logWebWarning(
      "profile page simbrief airframes fetch failed",
      simbriefAirframesResult.reason,
    );
  }

  return (
    <>
      <section className="page-hero">
        <span className="section-eyebrow">Profil</span>
        <h1>Mon profil pilote</h1>
        <p>
          Consultez vos informations pilote, votre rang, votre hub et votre
          progression au sein de la compagnie, puis mettez à jour ici votre
          identité pilote, votre hub préféré et votre liaison SimBrief.
        </p>
      </section>
      {isDegraded ? (
        <section className="section-band">
          <Card className="ops-card">
            <span className="section-eyebrow">Mode dégradé</span>
            <h2>Le profil reste accessible</h2>
            <p>
              Certaines données n&apos;ont pas pu être rechargées depuis l&apos;API.
              Les informations essentielles restent visibles et vous pourrez
              réessayer dans quelques instants.
            </p>
          </Card>
        </section>
      ) : null}
      <section className="panel-grid">
        <ProfileCard profile={profile} />
        <SimbriefSettingsCard
          availableHubs={availableHubs.map((hub) => ({
            id: hub.id,
            code: hub.code,
            name: hub.name,
          }))}
          initialCallsign={profile.callsign}
          initialCountryCode={profile.countryCode}
          initialFirstName={profile.firstName}
          initialPilotNumber={profile.pilotNumber}
          initialPreferredHubId={profile.hub?.id ?? null}
          initialLastName={profile.lastName}
          initialUsername={profile.user.username}
          initialAvatarUrl={profile.user.avatarUrl}
          initialSimbriefPilotId={profile.simbriefPilotId}
        />
      </section>
      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Progression</span>
            <h2>Heures et XP pilote</h2>
          </div>
          <p>
            Si un vol terminé n&apos;a pas encore été crédité, ce recalcul
            resynchronise vos heures, votre expérience et votre rang à partir
            des vols déjà clôturés.
          </p>
        </div>

        <Card className="ops-card">
          <span className="section-eyebrow">Réparation ponctuelle</span>
          <h2>Recalculer ma progression</h2>
          <p>
            Utilisez cette action pour recréditer proprement un vol déjà terminé,
            comme votre vol d&apos;aujourd&apos;hui, sans modifier manuellement vos
            données pilote.
          </p>
          <div className="inline-actions">
            <ApiActionButton
              endpoint="/api/pilot/profile/resync-progress"
              label="Recalculer mes heures et mon XP"
              pendingLabel="Recalcul en cours..."
              successMessage="Votre progression pilote a été resynchronisée."
            />
          </div>
        </Card>
      </section>
      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Diagnostic</span>
            <h2>Traces locales du site</h2>
          </div>
          <p>
            Exportez ici le journal local du navigateur pour nous aider à
            reproduire et corriger plus vite les futurs incidents web.
          </p>
        </div>

        <BrowserDiagnosticsCard />
      </section>
      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Airframes</span>
            <h2>Synchronisation de vos airframes SimBrief</h2>
          </div>
          <p>
            Cette section récupère vos airframes SimBrief réelles pour préparer
            la flotte, relier vos appareils VA et garantir que vos OFP utilisent
            le bon appareil avant le vol ACARS.
          </p>
        </div>

        <SimbriefAirframesCard initialAirframes={simbriefAirframes} />
      </section>
      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Dernier OFP</span>
            <h2>Lecture SimBrief isolée</h2>
          </div>
          <p>
            Le web récupère ici le dernier plan de vol SimBrief en temps réel à
            partir du SimBrief Pilot ID stocké dans votre profil, puis tente
            d’associer l’airframe utilisée à votre flotte réelle si elle est
            déjà synchronisée.
          </p>
        </div>

        <SimbriefLatestOfpCard latestOfp={latestSimbriefOfp} />
      </section>
    </>
  );
}
