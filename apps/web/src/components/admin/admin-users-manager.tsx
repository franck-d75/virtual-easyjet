"use client";

import type { JSX } from "react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { AdminUserSummaryResponse } from "@/lib/api/types";
import {
  formatDate,
  formatDurationMinutes,
  formatNumber,
  formatNullableText,
} from "@/lib/utils/format";
import {
  getUserRolePresentation,
  getUserStatusPresentation,
} from "@/lib/utils/status";

type AdminUsersManagerProps = {
  initialUsers: AdminUserSummaryResponse[];
};

export function AdminUsersManager({
  initialUsers,
}: AdminUsersManagerProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "USER" | "ADMIN">("ALL");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "PENDING" | "SUSPENDED"
  >("ALL");

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return initialUsers.filter((user) => {
      if (roleFilter !== "ALL" && user.role !== roleFilter) {
        return false;
      }

      if (statusFilter !== "ALL" && user.status !== statusFilter) {
        return false;
      }

      if (normalizedQuery.length === 0) {
        return true;
      }

      const searchableValues = [
        user.email,
        user.username,
        user.pilotProfile?.firstName ?? "",
        user.pilotProfile?.lastName ?? "",
        user.pilotProfile?.pilotNumber ?? "",
        user.pilotProfile?.callsign ?? "",
      ];

      return searchableValues.some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      );
    });
  }, [initialUsers, query, roleFilter, statusFilter]);

  return (
    <div className="admin-panel-stack">
      <Card>
        <div className="admin-card-head">
          <div>
            <span className="section-eyebrow">Utilisateurs</span>
            <h2>Recherche et filtres</h2>
          </div>
          <p>
            Recherchez un pilote par nom, identifiant, e-mail, numéro pilote ou
            callsign.
          </p>
        </div>

        <div className="admin-form-grid">
          <div className="field">
            <label htmlFor="admin-user-query">Recherche</label>
            <input
              id="admin-user-query"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="pilotdemo, Demo Pilot, VA00001..."
              type="search"
              value={query}
            />
          </div>

          <div className="field">
            <label htmlFor="admin-user-role-filter">Rôle</label>
            <select
              id="admin-user-role-filter"
              onChange={(event) =>
                setRoleFilter(event.target.value as "ALL" | "USER" | "ADMIN")
              }
              value={roleFilter}
            >
              <option value="ALL">Tous les rôles</option>
              <option value="ADMIN">Administrateurs</option>
              <option value="USER">Utilisateurs</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="admin-user-status-filter">Statut</label>
            <select
              id="admin-user-status-filter"
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as "ALL" | "ACTIVE" | "PENDING" | "SUSPENDED",
                )
              }
              value={statusFilter}
            >
              <option value="ALL">Tous les statuts</option>
              <option value="ACTIVE">Actifs</option>
              <option value="PENDING">En attente</option>
              <option value="SUSPENDED">Suspendus</option>
            </select>
          </div>
        </div>
      </Card>

      <Card>
        <div className="admin-card-head">
          <div>
            <span className="section-eyebrow">Annuaire privé</span>
            <h2>Utilisateurs de la plateforme</h2>
          </div>
          <p>{formatNumber(filteredUsers.length)} utilisateur(s) visible(s).</p>
        </div>

        {filteredUsers.length === 0 ? (
          <EmptyState
            title="Aucun utilisateur"
            description="Aucun utilisateur ne correspond aux filtres actifs."
          />
        ) : (
          <DataTable
            columns={[
              {
                id: "identity",
                header: "Utilisateur",
                render: (user) => {
                  const displayName = user.pilotProfile
                    ? `${user.pilotProfile.firstName} ${user.pilotProfile.lastName}`
                    : user.username;

                  return (
                    <div className="admin-user-cell">
                      <UserAvatar
                        avatarUrl={user.avatarUrl}
                        name={displayName}
                        size="md"
                      />
                      <div className="table-primary">
                        <strong>{displayName}</strong>
                        <small>{user.email}</small>
                      </div>
                    </div>
                  );
                },
              },
              {
                id: "pilot",
                header: "Profil pilote",
                render: (user) => (
                  <div className="table-secondary">
                    <strong>{user.pilotProfile?.pilotNumber ?? "-"}</strong>
                    <span>
                      {formatNullableText(user.pilotProfile?.callsign) === "-"
                        ? user.username
                        : user.pilotProfile?.callsign}
                    </span>
                  </div>
                ),
              },
              {
                id: "access",
                header: "Accès",
                render: (user) => {
                  const role = getUserRolePresentation(user.role);
                  const status = getUserStatusPresentation(user.status);

                  return (
                    <div className="table-badge-stack">
                      <Badge label={role.label} tone={role.tone} />
                      <Badge label={status.label} tone={status.tone} />
                    </div>
                  );
                },
              },
              {
                id: "hours",
                header: "Heures de vol",
                render: (user) => (
                  <span>
                    {formatDurationMinutes(user.stats.hoursFlownMinutes)}
                  </span>
                ),
              },
              {
                id: "pireps",
                header: "PIREPs",
                render: (user) => <span>{formatNumber(user.stats.pirepsCount)}</span>,
              },
              {
                id: "createdAt",
                header: "Inscription",
                render: (user) => <span>{formatDate(user.createdAt)}</span>,
              },
              {
                id: "actions",
                header: "Fiche",
                className: "table-cell-actions",
                render: (user) => (
                  <Link className="table-inline-link" href={`/admin/utilisateurs/${user.id}`}>
                    Ouvrir la fiche
                  </Link>
                ),
              },
            ]}
            rowKey={(user) => user.id}
            rows={filteredUsers}
          />
        )}
      </Card>
    </div>
  );
}

