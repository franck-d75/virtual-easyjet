"use client";

import type { FormEvent, JSX } from "react";
import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  AdminAircraftPayload,
  AdminReferenceDataResponse,
  AircraftResponse,
} from "@/lib/api/types";
import type { BadgeTone } from "@/lib/utils/status";

import {
  extractApiMessage,
  parseJsonPayload,
  type AdminFeedback,
} from "./admin-feedback";

const AIRCRAFT_STATUSES = [
  "ACTIVE",
  "MAINTENANCE",
  "RETIRED",
] as const;

type AdminAircraftManagerProps = {
  initialAircraft: AircraftResponse[];
  referenceData: AdminReferenceDataResponse;
};

type AircraftFormState = {
  registration: string;
  label: string;
  aircraftTypeId: string;
  hubId: string;
  status: (typeof AIRCRAFT_STATUSES)[number];
  notes: string;
};

function createInitialAircraftForm(
  referenceData: AdminReferenceDataResponse,
): AircraftFormState {
  return {
    registration: "",
    label: "",
    aircraftTypeId: referenceData.aircraftTypes[0]?.id ?? "",
    hubId: "",
    status: "ACTIVE",
    notes: "",
  };
}

function sortAircraft(items: AircraftResponse[]): AircraftResponse[] {
  return [...items].sort((left, right) =>
    left.registration.localeCompare(right.registration),
  );
}

function getAircraftStatusTone(status: string): BadgeTone {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "MAINTENANCE":
      return "warning";
    case "RETIRED":
      return "danger";
    default:
      return "neutral";
  }
}

export function AdminAircraftManager({
  initialAircraft,
  referenceData,
}: AdminAircraftManagerProps): JSX.Element {
  const [items, setItems] = useState(() => sortAircraft(initialAircraft));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AdminFeedback | null>(null);
  const [formState, setFormState] = useState<AircraftFormState>(() =>
    createInitialAircraftForm(referenceData),
  );
  const [isPending, startTransition] = useTransition();

  const aircraftTypeLabelById = useMemo(
    () =>
      new Map(referenceData.aircraftTypes.map((item) => [item.id, item.name])),
    [referenceData.aircraftTypes],
  );

  function resetForm(): void {
    setEditingId(null);
    setFormState(createInitialAircraftForm(referenceData));
  }

  function updateFormState<Field extends keyof AircraftFormState>(
    field: Field,
    value: AircraftFormState[Field],
  ): void {
    setFormState((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFeedback(null);

    const payload: AdminAircraftPayload = {
      registration: formState.registration.trim(),
      label: formState.label.trim() || null,
      aircraftTypeId: formState.aircraftTypeId,
      hubId: formState.hubId || null,
      status: formState.status,
      notes: formState.notes.trim() || null,
    };

    const endpoint = editingId
      ? `/api/admin/aircraft/${editingId}`
      : "/api/admin/aircraft";

    const response = await fetch(endpoint, {
      method: editingId ? "PATCH" : "POST",
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
          "Impossible d’enregistrer cet appareil.",
        ),
      });
      return;
    }

    const savedAircraft = responsePayload as AircraftResponse;

    startTransition(() => {
      setItems((currentValue) => {
        const nextItems = editingId
          ? currentValue.map((item) =>
              item.id === editingId ? savedAircraft : item,
            )
          : [...currentValue, savedAircraft];

        return sortAircraft(nextItems);
      });
      setFeedback({
        tone: "success",
        message: editingId
          ? "Appareil mis à jour."
          : "Appareil créé avec succès.",
      });
      resetForm();
    });
  }

  async function handleDelete(id: string): Promise<void> {
    if (!window.confirm("Supprimer cet appareil de la flotte ?")) {
      return;
    }

    setFeedback(null);
    const response = await fetch(`/api/admin/aircraft/${id}`, {
      method: "DELETE",
    });

    const rawPayload = await response.text();
    const responsePayload = rawPayload ? parseJsonPayload(rawPayload) : null;

    if (!response.ok) {
      setFeedback({
        tone: "danger",
        message: extractApiMessage(
          responsePayload,
          "Impossible de supprimer cet appareil.",
        ),
      });
      return;
    }

    startTransition(() => {
      setItems((currentValue) => currentValue.filter((item) => item.id !== id));
      if (editingId === id) {
        resetForm();
      }
      setFeedback({
        tone: "success",
        message: "Appareil supprimé.",
      });
    });
  }

  function handleEdit(item: AircraftResponse): void {
    setEditingId(item.id);
    setFeedback(null);
    setFormState({
      registration: item.registration,
      label: item.label ?? "",
      aircraftTypeId: item.aircraftType.id,
      hubId: item.hub?.id ?? "",
      status: item.status as (typeof AIRCRAFT_STATUSES)[number],
      notes: item.notes ?? "",
    });
  }

  return (
    <div className="admin-panel-stack">
      <Card className="admin-form-card">
        <div className="admin-card-head">
          <div>
            <span className="section-eyebrow">Gestion flotte</span>
            <h2>{editingId ? "Modifier un appareil" : "Ajouter un appareil"}</h2>
          </div>
          <p>
            Gérez les immatriculations, leur type et leur hub d’affectation.
          </p>
        </div>

        <form className="auth-form admin-form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="aircraft-registration">Immatriculation</label>
            <input
              id="aircraft-registration"
              onChange={(event) => updateFormState("registration", event.target.value)}
              placeholder="F-HVAA"
              required
              type="text"
              value={formState.registration}
            />
          </div>

          <div className="field">
            <label htmlFor="aircraft-label">Libellé</label>
            <input
              id="aircraft-label"
              onChange={(event) => updateFormState("label", event.target.value)}
              placeholder="A320neo Paris 01"
              type="text"
              value={formState.label}
            />
          </div>

          <div className="field">
            <label htmlFor="aircraft-type">Type appareil</label>
            <select
              id="aircraft-type"
              onChange={(event) => updateFormState("aircraftTypeId", event.target.value)}
              required
              value={formState.aircraftTypeId}
            >
              {referenceData.aircraftTypes.map((aircraftType) => (
                <option key={aircraftType.id} value={aircraftType.id}>
                  {aircraftType.icaoCode} · {aircraftType.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="aircraft-hub">Hub</label>
            <select
              id="aircraft-hub"
              onChange={(event) => updateFormState("hubId", event.target.value)}
              value={formState.hubId}
            >
              <option value="">Aucun hub</option>
              {referenceData.hubs.map((hub) => (
                <option key={hub.id} value={hub.id}>
                  {hub.code} · {hub.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="aircraft-status">Statut</label>
            <select
              id="aircraft-status"
              onChange={(event) =>
                updateFormState(
                  "status",
                  event.target.value as (typeof AIRCRAFT_STATUSES)[number],
                )
              }
              value={formState.status}
            >
              {AIRCRAFT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="field field--full">
            <label htmlFor="aircraft-notes">Notes</label>
            <textarea
              id="aircraft-notes"
              onChange={(event) => updateFormState("notes", event.target.value)}
              rows={3}
              value={formState.notes}
            />
          </div>

          {feedback ? (
            <p className={`inline-feedback inline-feedback--${feedback.tone}`} role="status">
              {feedback.message}
            </p>
          ) : null}

          <div className="admin-form-actions">
            <Button disabled={isPending} type="submit">
              {isPending
                ? "Enregistrement..."
                : editingId
                  ? "Mettre à jour"
                  : "Créer l’appareil"}
            </Button>
            {editingId ? (
              <Button onClick={resetForm} type="button" variant="ghost">
                Annuler
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      <Card>
        <div className="admin-card-head">
          <div>
            <span className="section-eyebrow">Inventaire</span>
            <h2>Flotte actuelle</h2>
          </div>
          <p>{items.length} appareil(s) enregistré(s).</p>
        </div>

        {items.length === 0 ? (
          <EmptyState
            description="Ajoutez votre premier appareil pour démarrer la flotte administrative."
            title="Aucun appareil enregistré"
          />
        ) : (
          <DataTable
            columns={[
              {
                id: "registration",
                header: "Appareil",
                render: (item) => (
                  <div className="table-primary">
                    <strong>{item.registration}</strong>
                    <small>{item.label ?? "Sans libellé"}</small>
                  </div>
                ),
              },
              {
                id: "type",
                header: "Type",
                render: (item) => (
                  <div className="table-secondary">
                    {aircraftTypeLabelById.get(item.aircraftType.id) ?? item.aircraftType.name}
                  </div>
                ),
              },
              {
                id: "hub",
                header: "Hub",
                render: (item) => (
                  <span className="table-muted">
                    {item.hub ? `${item.hub.code} · ${item.hub.name}` : "Non affecté"}
                  </span>
                ),
              },
              {
                id: "status",
                header: "Statut",
                render: (item) => (
                  <Badge
                    label={item.status}
                    tone={getAircraftStatusTone(item.status)}
                  />
                ),
              },
              {
                id: "actions",
                header: "Actions",
                className: "table-cell-actions",
                render: (item) => (
                  <div className="admin-table-actions">
                    <Button onClick={() => handleEdit(item)} variant="ghost">
                      Modifier
                    </Button>
                    <Button onClick={() => handleDelete(item.id)} variant="secondary">
                      Supprimer
                    </Button>
                  </div>
                ),
              },
            ]}
            rowKey={(item) => item.id}
            rows={items}
          />
        )}
      </Card>
    </div>
  );
}
