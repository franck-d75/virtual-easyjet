"use client";

import type { JSX } from "react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  AdminPirepResponse,
  AdminPirepReviewPayload,
} from "@/lib/api/types";
import {
  formatDateTime,
  formatDurationMinutes,
  formatNullableText,
  formatNumber,
} from "@/lib/utils/format";
import {
  getFlightStatusPresentation,
  getPirepStatusPresentation,
} from "@/lib/utils/status";
import { buildUserDisplayName } from "@/lib/utils/user-display";

import {
  extractApiMessage,
  handleAdminUnauthorized,
  parseJsonPayload,
  type AdminFeedback,
} from "./admin-feedback";

type AdminPirepsManagerProps = {
  initialPireps: AdminPirepResponse[];
};

type PirepStatusFilter = "ALL" | "SUBMITTED" | "ACCEPTED" | "REJECTED";

const PIREP_STATUS_PRIORITY: Record<string, number> = {
  SUBMITTED: 0,
  REJECTED: 1,
  ACCEPTED: 2,
};

function sortPireps(items: AdminPirepResponse[]): AdminPirepResponse[] {
  return [...items].sort((left, right) => {
    const statusDelta =
      (PIREP_STATUS_PRIORITY[left.status] ?? 99) -
      (PIREP_STATUS_PRIORITY[right.status] ?? 99);

    if (statusDelta !== 0) {
      return statusDelta;
    }

    const leftTimestamp = new Date(
      left.submittedAt ?? left.createdAt,
    ).getTime();
    const rightTimestamp = new Date(
      right.submittedAt ?? right.createdAt,
    ).getTime();

    return rightTimestamp - leftTimestamp;
  });
}

function formatFuelKg(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(value)} kg`;
}

export function AdminPirepsManager({
  initialPireps,
}: AdminPirepsManagerProps): JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState(() => sortPireps(initialPireps));
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PirepStatusFilter>("SUBMITTED");
  const [feedback, setFeedback] = useState<AdminFeedback | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [reviewerComments, setReviewerComments] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      initialPireps.map((item) => [item.id, item.reviewerComment ?? ""]),
    ),
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) {
        return false;
      }

      if (normalizedQuery.length === 0) {
        return true;
      }

      const searchableValues = [
        item.flight.flightNumber,
        item.pilotProfile.pilotNumber,
        item.pilotProfile.firstName,
        item.pilotProfile.lastName,
        item.pilotProfile.user.username,
        item.aircraft.registration,
        item.departureAirport.icao,
        item.arrivalAirport.icao,
      ];

      return searchableValues.some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      );
    });
  }, [items, query, statusFilter]);

  const submittedCount = useMemo(
    () => items.filter((item) => item.status === "SUBMITTED").length,
    [items],
  );

  async function handleReview(
    item: AdminPirepResponse,
    status: AdminPirepReviewPayload["status"],
  ): Promise<void> {
    const requestKey = `${item.id}:${status}`;
    setFeedback(null);
    setSavingKey(requestKey);

    try {
      const response = await fetch(`/api/admin/pireps/${item.id}/review`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          reviewerComment: reviewerComments[item.id]?.trim() || null,
        } satisfies AdminPirepReviewPayload),
      });

      const rawPayload = await response.text();
      const responsePayload = rawPayload ? parseJsonPayload(rawPayload) : null;

      if (!response.ok) {
        if (handleAdminUnauthorized(response)) {
          return;
        }

        setFeedback({
          tone: "danger",
          message: extractApiMessage(
            responsePayload,
            "Impossible de mettre à jour ce rapport de vol.",
          ),
        });
        return;
      }

      const updatedItem = responsePayload as AdminPirepResponse;
      setItems((currentValue) =>
        sortPireps(
          currentValue.map((currentItem) =>
            currentItem.id === updatedItem.id ? updatedItem : currentItem,
          ),
        ),
      );
      setReviewerComments((currentValue) => ({
        ...currentValue,
        [item.id]: updatedItem.reviewerComment ?? "",
      }));
      setFeedback({
        tone: "success",
        message:
          status === "ACCEPTED"
            ? "Le rapport de vol a été validé."
            : "Le rapport de vol a été rejeté.",
      });

      startTransition(() => {
        router.refresh();
      });
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="admin-panel-stack">
      <Card>
        <div className="admin-card-head">
          <div>
            <span className="section-eyebrow">Rapports de vol</span>
            <h2>Recherche et filtres</h2>
          </div>
          <p>
            Supervisez les PIREPs soumis par les pilotes et appliquez une décision
            de validation ou de rejet.
          </p>
        </div>

        <div className="admin-form-grid">
          <div className="field">
            <label htmlFor="admin-pirep-query">Recherche</label>
            <input
              id="admin-pirep-query"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="EZY1000, VEZY001, HB-JXB, LSGG..."
              type="search"
              value={query}
            />
          </div>

          <div className="field">
            <label htmlFor="admin-pirep-status-filter">Statut</label>
            <select
              id="admin-pirep-status-filter"
              onChange={(event) =>
                setStatusFilter(event.target.value as PirepStatusFilter)
              }
              value={statusFilter}
            >
              <option value="SUBMITTED">À traiter</option>
              <option value="ALL">Tous les statuts</option>
              <option value="ACCEPTED">Validés</option>
              <option value="REJECTED">Rejetés</option>
            </select>
          </div>
        </div>

        {feedback ? (
          <p
            className={`inline-feedback inline-feedback--${feedback.tone}`}
            role="status"
          >
            {feedback.message}
          </p>
        ) : null}
      </Card>

      <Card>
        <div className="admin-card-head">
          <div>
            <span className="section-eyebrow">Modération</span>
            <h2>PIREPs disponibles</h2>
          </div>
          <p>
            {formatNumber(filteredItems.length)} rapport(s) visible(s), dont{" "}
            {formatNumber(submittedCount)} en attente de décision.
          </p>
        </div>

        {filteredItems.length === 0 ? (
          <EmptyState
            title="Aucun rapport visible"
            description="Aucun PIREP ne correspond aux filtres actifs."
          />
        ) : (
          <DataTable
            columns={[
              {
                id: "pilot",
                header: "Pilote",
                render: (item) => {
                  const displayName = buildUserDisplayName({
                    firstName: item.pilotProfile.firstName,
                    lastName: item.pilotProfile.lastName,
                    username: item.pilotProfile.user.username,
                  });

                  return (
                    <div className="table-primary">
                      <strong>{displayName}</strong>
                      <small>
                        {item.pilotProfile.pilotNumber} ·{" "}
                        {item.pilotProfile.user.username}
                      </small>
                    </div>
                  );
                },
              },
              {
                id: "flight",
                header: "Vol",
                render: (item) => {
                  const flightStatus = getFlightStatusPresentation(
                    item.flight.status,
                  );

                  return (
                    <div className="table-secondary">
                      <strong>{item.flight.flightNumber}</strong>
                      <span>
                        {item.departureAirport.icao} → {item.arrivalAirport.icao}
                      </span>
                      <div className="table-badge-stack">
                        <Badge
                          label={flightStatus.label}
                          tone={flightStatus.tone}
                        />
                      </div>
                    </div>
                  );
                },
              },
              {
                id: "aircraft",
                header: "Appareil",
                render: (item) => (
                  <div className="table-secondary">
                    <strong>{item.aircraft.registration}</strong>
                    <span>
                      {item.aircraft.aircraftType.icaoCode} ·{" "}
                      {item.aircraft.label ?? item.aircraft.aircraftType.name}
                    </span>
                  </div>
                ),
              },
              {
                id: "report",
                header: "Rapport",
                render: (item) => (
                  <div className="table-secondary">
                    <strong>
                      Soumis le {formatDateTime(item.submittedAt ?? item.createdAt)}
                    </strong>
                    <span>
                      Bloc {formatDurationMinutes(item.blockTimeMinutes)} · Vol{" "}
                      {formatDurationMinutes(item.flightTimeMinutes)}
                    </span>
                    <span>
                      Fuel {formatFuelKg(item.fuelUsedKg)} · Score{" "}
                      {item.score !== null ? formatNumber(item.score) : "-"} ·
                      Toucher{" "}
                      {item.landingRateFpm !== null
                        ? `${formatNumber(item.landingRateFpm)} fpm`
                        : "-"}
                    </span>
                    <small>
                      Commentaire pilote : {formatNullableText(item.pilotComment)}
                    </small>
                  </div>
                ),
              },
              {
                id: "status",
                header: "Statut",
                render: (item) => {
                  const status = getPirepStatusPresentation(item.status);

                  return (
                    <div className="table-secondary">
                      <div className="table-badge-stack">
                        <Badge label={status.label} tone={status.tone} />
                      </div>
                      <small>
                        {item.reviewedAt
                          ? `Relu le ${formatDateTime(item.reviewedAt)}`
                          : "Aucune revue encore appliquée"}
                      </small>
                      <small>
                        {item.reviewedBy
                          ? `Par ${item.reviewedBy.username}`
                          : "Aucun relecteur enregistré"}
                      </small>
                    </div>
                  );
                },
              },
              {
                id: "review",
                header: "Décision",
                className: "table-cell-actions",
                render: (item) => {
                  const acceptKey = `${item.id}:ACCEPTED`;
                  const rejectKey = `${item.id}:REJECTED`;
                  const isAcceptPending = savingKey === acceptKey;
                  const isRejectPending = savingKey === rejectKey;
                  const isSaving = isAcceptPending || isRejectPending || isPending;

                  return (
                    <div className="table-secondary">
                      <textarea
                        onChange={(event) =>
                          setReviewerComments((currentValue) => ({
                            ...currentValue,
                            [item.id]: event.target.value,
                          }))
                        }
                        placeholder="Commentaire de revue optionnel"
                        rows={3}
                        value={reviewerComments[item.id] ?? ""}
                      />
                      <div className="admin-table-actions">
                        <Button
                          disabled={isSaving}
                          onClick={() => {
                            void handleReview(item, "ACCEPTED");
                          }}
                        >
                          {isAcceptPending ? "Validation..." : "Valider"}
                        </Button>
                        <Button
                          disabled={isSaving}
                          onClick={() => {
                            void handleReview(item, "REJECTED");
                          }}
                          variant="secondary"
                        >
                          {isRejectPending ? "Rejet..." : "Rejeter"}
                        </Button>
                      </div>
                    </div>
                  );
                },
              },
            ]}
            rowKey={(item) => item.id}
            rows={filteredItems}
          />
        )}
      </Card>
    </div>
  );
}
