"use client";

import type { FormEvent, JSX } from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { AvatarUploadControl } from "@/components/ui/avatar-upload-control";
import { UserAvatar } from "@/components/ui/user-avatar";
import type {
  AdminUserDetailResponse,
  AdminUserPayload,
} from "@/lib/api/types";
import {
  formatDate,
  formatDateTime,
  formatDurationMinutes,
  formatNumber,
  formatNullableText,
} from "@/lib/utils/format";
import {
  getBookingStatusPresentation,
  getPirepStatusPresentation,
  getUserRolePresentation,
  getUserStatusPresentation,
} from "@/lib/utils/status";

import {
  extractApiMessage,
  parseJsonPayload,
  type AdminFeedback,
} from "./admin-feedback";

type AdminUserDetailsProps = {
  initialUser: AdminUserDetailResponse;
};

type FormState = {
  username: string;
  firstName: string;
  lastName: string;
  pilotNumber: string;
  callsign: string;
  countryCode: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "PENDING" | "SUSPENDED";
};

function createFormState(user: AdminUserDetailResponse): FormState {
  return {
    username: user.username,
    firstName: user.pilotProfile?.firstName ?? "",
    lastName: user.pilotProfile?.lastName ?? "",
    pilotNumber: user.pilotProfile?.pilotNumber ?? "",
    callsign: user.pilotProfile?.callsign ?? "",
    countryCode: user.pilotProfile?.countryCode ?? "",
    role: user.role,
    status:
      user.status === "ACTIVE" || user.status === "SUSPENDED"
        ? user.status
        : "PENDING",
  };
}

export function AdminUserDetails({
  initialUser,
}: AdminUserDetailsProps): JSX.Element {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [formState, setFormState] = useState<FormState>(() =>
    createFormState(initialUser),
  );
  const [feedback, setFeedback] = useState<AdminFeedback | null>(null);
  const [isPending, startTransition] = useTransition();

  const displayName = user.pilotProfile
    ? `${user.pilotProfile.firstName} ${user.pilotProfile.lastName}`
    : user.username;
  const roleBadge = getUserRolePresentation(user.role);
  const statusBadge = getUserStatusPresentation(user.status);

  function applyUser(nextUser: AdminUserDetailResponse): void {
    setUser(nextUser);
    setFormState(createFormState(nextUser));
  }

  function updateField<Field extends keyof FormState>(
    field: Field,
    value: FormState[Field],
  ): void {
    setFormState((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  }

  async function submitPatch(payload: AdminUserPayload, successMessage: string) {
    setFeedback(null);

    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const rawPayload = await response.text();
    const responsePayload = rawPayload ? parseJsonPayload(rawPayload) : null;

    if (!response.ok) {
      setFeedback({
        tone: "danger",
        message: extractApiMessage(
          responsePayload,
          "Impossible de mettre à jour cet utilisateur.",
        ),
      });
      return;
    }

    const updatedUser = responsePayload as AdminUserDetailResponse;

    startTransition(() => {
      applyUser(updatedUser);
      setFeedback({
        tone: "success",
        message: successMessage,
      });
      router.refresh();
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const payload: AdminUserPayload = {
      username: formState.username.trim(),
      firstName: formState.firstName.trim(),
      lastName: formState.lastName.trim(),
      countryCode: formState.countryCode.trim()
        ? formState.countryCode.trim().toUpperCase()
        : null,
      role: formState.role,
      status: formState.status,
    };

    if (user.pilotProfile) {
      payload.pilotNumber = formState.pilotNumber.trim().toUpperCase();
      payload.callsign = formState.callsign.trim()
        ? formState.callsign.trim().toUpperCase()
        : null;
    }

    await submitPatch(
      payload,
      "Utilisateur mis à jour avec succès.",
    );
  }

  async function handlePromoteAdmin(): Promise<void> {
    await submitPatch(
      {
        role: "ADMIN",
      },
      "Le rôle administrateur a été attribué.",
    );
  }

  async function handleSuspend(): Promise<void> {
    setFeedback(null);

    const response = await fetch(`/api/admin/users/${user.id}/suspend`, {
      method: "PATCH",
    });

    const rawPayload = await response.text();
    const responsePayload = rawPayload ? parseJsonPayload(rawPayload) : null;

    if (!response.ok) {
      setFeedback({
        tone: "danger",
        message: extractApiMessage(
          responsePayload,
          "Impossible de suspendre cet utilisateur.",
        ),
      });
      return;
    }

    startTransition(() => {
      applyUser(responsePayload as AdminUserDetailResponse);
      setFeedback({
        tone: "success",
        message: "Utilisateur suspendu.",
      });
      router.refresh();
    });
  }

  async function handleActivate(): Promise<void> {
    setFeedback(null);

    const response = await fetch(`/api/admin/users/${user.id}/activate`, {
      method: "PATCH",
    });

    const rawPayload = await response.text();
    const responsePayload = rawPayload ? parseJsonPayload(rawPayload) : null;

    if (!response.ok) {
      setFeedback({
        tone: "danger",
        message: extractApiMessage(
          responsePayload,
          "Impossible de réactiver cet utilisateur.",
        ),
      });
      return;
    }

    startTransition(() => {
      applyUser(responsePayload as AdminUserDetailResponse);
      setFeedback({
        tone: "success",
        message: "Utilisateur réactivé.",
      });
      router.refresh();
    });
  }

  return (
    <div className="admin-panel-stack">
      <Card className="admin-user-hero">
        <div className="admin-user-hero__identity">
          <UserAvatar avatarUrl={user.avatarUrl} name={displayName} size="xl" />
          <div className="admin-user-hero__copy">
            <span className="section-eyebrow">Fiche utilisateur</span>
            <h2>{displayName}</h2>
            <p>{user.email}</p>
            <div className="table-badge-stack">
              <Badge label={roleBadge.label} tone={roleBadge.tone} />
              <Badge label={statusBadge.label} tone={statusBadge.tone} />
            </div>
          </div>
        </div>

        <div className="admin-page-actions">
          {user.role !== "ADMIN" ? (
            <Button disabled={isPending} onClick={() => void handlePromoteAdmin()}>
              Promouvoir administrateur
            </Button>
          ) : null}
          {user.status === "SUSPENDED" ? (
            <Button
              disabled={isPending}
              onClick={() => void handleActivate()}
              variant="secondary"
            >
              Réactiver
            </Button>
          ) : (
            <Button
              disabled={isPending}
              onClick={() => void handleSuspend()}
              variant="secondary"
            >
              Suspendre
            </Button>
          )}
        </div>
      </Card>

      <section className="admin-stats-grid">
        <Card className="admin-stat-card">
          <span>Numéro pilote</span>
          <strong>{user.pilotProfile?.pilotNumber ?? "-"}</strong>
        </Card>
        <Card className="admin-stat-card">
          <span>Heures de vol</span>
          <strong>{formatDurationMinutes(user.stats.hoursFlownMinutes)}</strong>
        </Card>
        <Card className="admin-stat-card">
          <span>Réservations</span>
          <strong>{formatNumber(user.stats.bookingsCount)}</strong>
        </Card>
        <Card className="admin-stat-card">
          <span>PIREPs</span>
          <strong>{formatNumber(user.stats.pirepsCount)}</strong>
        </Card>
      </section>

      <section className="admin-grid admin-grid--two">
        <Card>
          <div className="admin-card-head">
            <div>
              <span className="section-eyebrow">Profil pilote</span>
              <h2>Informations principales</h2>
            </div>
          </div>

          <div className="definition-grid">
            <div>
              <span>Nom d'utilisateur</span>
              <strong>{user.username}</strong>
            </div>
            <div>
              <span>Callsign</span>
              <strong>{formatNullableText(user.pilotProfile?.callsign)}</strong>
            </div>
            <div>
              <span>Pays</span>
              <strong>{formatNullableText(user.pilotProfile?.countryCode)}</strong>
            </div>
            <div>
              <span>Rang</span>
              <strong>{user.pilotProfile?.rank?.name ?? "Non attribué"}</strong>
            </div>
            <div>
              <span>Hub</span>
              <strong>{user.pilotProfile?.hub?.name ?? "Non attribué"}</strong>
            </div>
            <div>
              <span>SimBrief Pilot ID</span>
              <strong>{formatNullableText(user.pilotProfile?.simbriefPilotId)}</strong>
            </div>
            <div>
              <span>Inscription</span>
              <strong>{formatDate(user.createdAt)}</strong>
            </div>
            <div>
              <span>Dernière connexion</span>
              <strong>{formatDateTime(user.lastLoginAt)}</strong>
            </div>
          </div>
        </Card>

        <Card className="admin-form-card">
          <div className="admin-card-head">
            <div>
              <span className="section-eyebrow">Édition</span>
              <h2>Mettre à jour l'utilisateur</h2>
            </div>
            <p>
              Modifiez l'accès et l'identité pilote, puis gérez l'avatar avec
              un téléversement local sécurisé.
            </p>
          </div>

          <AvatarUploadControl<AdminUserDetailResponse>
            currentAvatarUrl={user.avatarUrl}
            description="Choisissez une image locale depuis votre ordinateur. L'avatar sera mis à jour sur la fiche utilisateur et dans l'espace pilote."
            displayName={displayName}
            onUploaded={(payload) => {
              applyUser(payload);
            }}
            saveLabel="Enregistrer l'avatar"
            title="Téléverser un avatar"
            uploadUrl={`/api/admin/users/${user.id}/avatar`}
          />

          <form className="auth-form admin-form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="admin-user-username">Nom d'utilisateur</label>
              <input
                id="admin-user-username"
                onChange={(event) => updateField("username", event.target.value)}
                required
                type="text"
                value={formState.username}
              />
            </div>

            <div className="field">
              <label htmlFor="admin-user-pilot-number">Numéro pilote</label>
              <input
                disabled={!user.pilotProfile}
                id="admin-user-pilot-number"
                onChange={(event) => updateField("pilotNumber", event.target.value)}
                required={Boolean(user.pilotProfile)}
                type="text"
                value={formState.pilotNumber}
              />
            </div>

            <div className="field">
              <label htmlFor="admin-user-callsign">Indicatif</label>
              <input
                disabled={!user.pilotProfile}
                id="admin-user-callsign"
                onChange={(event) => updateField("callsign", event.target.value)}
                placeholder="VAU5CNIR"
                type="text"
                value={formState.callsign}
              />
            </div>

            <div className="field">
              <label htmlFor="admin-user-first-name">Prénom</label>
              <input
                disabled={!user.pilotProfile}
                id="admin-user-first-name"
                onChange={(event) => updateField("firstName", event.target.value)}
                type="text"
                value={formState.firstName}
              />
            </div>

            <div className="field">
              <label htmlFor="admin-user-last-name">Nom</label>
              <input
                disabled={!user.pilotProfile}
                id="admin-user-last-name"
                onChange={(event) => updateField("lastName", event.target.value)}
                type="text"
                value={formState.lastName}
              />
            </div>

            <div className="field">
              <label htmlFor="admin-user-country">Pays (ISO)</label>
              <input
                disabled={!user.pilotProfile}
                id="admin-user-country"
                maxLength={2}
                onChange={(event) => updateField("countryCode", event.target.value)}
                placeholder="FR"
                type="text"
                value={formState.countryCode}
              />
            </div>

            <div className="field">
              <label htmlFor="admin-user-role">Rôle</label>
              <select
                id="admin-user-role"
                onChange={(event) =>
                  updateField("role", event.target.value as "USER" | "ADMIN")
                }
                value={formState.role}
              >
                <option value="USER">Utilisateur</option>
                <option value="ADMIN">Administrateur</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="admin-user-status">Statut</label>
              <select
                id="admin-user-status"
                onChange={(event) =>
                  updateField(
                    "status",
                    event.target.value as "ACTIVE" | "PENDING" | "SUSPENDED",
                  )
                }
                value={formState.status}
              >
                <option value="ACTIVE">Actif</option>
                <option value="PENDING">En attente</option>
                <option value="SUSPENDED">Suspendu</option>
              </select>
            </div>

            {feedback ? (
              <p className={`inline-feedback inline-feedback--${feedback.tone}`} role="status">
                {feedback.message}
              </p>
            ) : null}

            <div className="admin-form-actions">
              <Button disabled={isPending} type="submit">
                {isPending ? "Enregistrement..." : "Enregistrer les modifications"}
              </Button>
            </div>
          </form>
        </Card>
      </section>

      <section className="admin-grid admin-grid--two">
        <Card>
          <div className="admin-card-head">
            <div>
              <span className="section-eyebrow">Réservations</span>
              <h2>Dernières réservations</h2>
            </div>
            <p>{formatNumber(user.recentBookings.length)} élément(s) affiché(s).</p>
          </div>

          {user.recentBookings.length === 0 ? (
            <EmptyState
              title="Aucune réservation récente"
              description="Les futures réservations de ce pilote apparaîtront ici."
            />
          ) : (
            <DataTable
              columns={[
                {
                  id: "flight",
                  header: "Vol",
                  render: (booking) => (
                    <div className="table-primary">
                      <strong>{booking.reservedFlightNumber}</strong>
                      <small>
                        {booking.departureAirport.icao} → {booking.arrivalAirport.icao}
                      </small>
                    </div>
                  ),
                },
                {
                  id: "date",
                  header: "Programme",
                  render: (booking) => (
                    <div className="table-secondary">
                      <strong>{formatDateTime(booking.bookedFor)}</strong>
                      <span>{booking.aircraft.registration}</span>
                    </div>
                  ),
                },
                {
                  id: "status",
                  header: "Statut",
                  render: (booking) => {
                    const status = getBookingStatusPresentation(booking.status);
                    return <Badge label={status.label} tone={status.tone} />;
                  },
                },
              ]}
              rowKey={(booking) => booking.id}
              rows={user.recentBookings}
            />
          )}
        </Card>

        <Card>
          <div className="admin-card-head">
            <div>
              <span className="section-eyebrow">PIREPs</span>
              <h2>Derniers rapports</h2>
            </div>
            <p>{formatNumber(user.recentPireps.length)} rapport(s) affiché(s).</p>
          </div>

          {user.recentPireps.length === 0 ? (
            <EmptyState
              title="Aucun PIREP récent"
              description="Les prochains rapports soumis par ce pilote apparaîtront ici."
            />
          ) : (
            <DataTable
              columns={[
                {
                  id: "flight",
                  header: "Vol",
                  render: (pirep) => (
                    <div className="table-primary">
                      <strong>{pirep.flight?.flightNumber ?? "Vol inconnu"}</strong>
                      <small>
                        {pirep.departureAirport.icao} → {pirep.arrivalAirport.icao}
                      </small>
                    </div>
                  ),
                },
                {
                  id: "status",
                  header: "Statut",
                  render: (pirep) => {
                    const status = getPirepStatusPresentation(pirep.status);
                    return <Badge label={status.label} tone={status.tone} />;
                  },
                },
                {
                  id: "score",
                  header: "Score",
                  render: (pirep) => (
                    <span>{pirep.score === null ? "-" : formatNumber(pirep.score)}</span>
                  ),
                },
                {
                  id: "submittedAt",
                  header: "Soumis le",
                  render: (pirep) => (
                    <span>{formatDateTime(pirep.submittedAt ?? pirep.createdAt)}</span>
                  ),
                },
              ]}
              rowKey={(pirep) => pirep.id}
              rows={user.recentPireps}
            />
          )}
        </Card>
      </section>
    </div>
  );
}

