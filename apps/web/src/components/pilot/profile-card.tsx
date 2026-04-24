import type { JSX } from "react";

import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { PilotProfileResponse } from "@/lib/api/types";
import {
  formatDate,
  formatDurationMinutes,
  formatNullableText,
  formatNumber,
} from "@/lib/utils/format";

type ProfileCardProps = {
  profile: PilotProfileResponse;
};

export function ProfileCard({ profile }: ProfileCardProps): JSX.Element {
  const displayName = `${profile.firstName} ${profile.lastName}`;

  return (
    <Card className="profile-card">
      <div className="profile-card__header">
        <div className="profile-card__hero">
          <UserAvatar
            avatarUrl={profile.user.avatarUrl}
            name={displayName}
            size="lg"
          />
          <div>
            <span className="section-eyebrow">Profil pilote</span>
            <h2>{displayName}</h2>
          </div>
        </div>
        <div className="profile-card__identity">
          <strong>{profile.pilotNumber}</strong>
          <span>{profile.user.username}</span>
        </div>
      </div>

      <div className="definition-grid">
        <div>
          <span>Rang</span>
          <strong>{profile.rank?.name ?? "Non attribue"}</strong>
        </div>
        <div>
          <span>Hub</span>
          <strong>{profile.hub?.name ?? "Non attribue"}</strong>
        </div>
        <div>
          <span>Heures de vol</span>
          <strong>{formatDurationMinutes(profile.hoursFlownMinutes)}</strong>
        </div>
        <div>
          <span>Experience</span>
          <strong>{formatNumber(profile.experiencePoints)} XP</strong>
        </div>
        <div>
          <span>Statut</span>
          <strong>{profile.status}</strong>
        </div>
        <div>
          <span>Indicatif</span>
          <strong>{formatNullableText(profile.callsign)}</strong>
        </div>
        <div>
          <span>Pays</span>
          <strong>{formatNullableText(profile.countryCode)}</strong>
        </div>
        <div>
          <span>Date d'inscription</span>
          <strong>{formatDate(profile.joinedAt)}</strong>
        </div>
        <div>
          <span>Avatar</span>
          <strong>{profile.user.avatarUrl ? "Configure" : "Aucun avatar"}</strong>
        </div>
        <div>
          <span>SimBrief Pilot ID</span>
          <strong>{formatNullableText(profile.simbriefPilotId)}</strong>
        </div>
      </div>
    </Card>
  );
}
