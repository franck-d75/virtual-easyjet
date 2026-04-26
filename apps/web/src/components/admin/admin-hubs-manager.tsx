"use client";

import type { FormEvent, JSX } from "react";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  AdminHubPayload,
  AdminReferenceDataResponse,
  HubResponse,
} from "@/lib/api/types";

import {
  extractApiMessage,
  handleAdminUnauthorized,
  parseJsonPayload,
  type AdminFeedback,
} from "./admin-feedback";

type AdminHubsManagerProps = {
  initialHubs: HubResponse[];
  referenceData: AdminReferenceDataResponse;
};

type HubFormState = {
  code: string;
  name: string;
  airportId: string;
  isActive: boolean;
};

function normalizeReferenceData(
  referenceData: AdminReferenceDataResponse | null | undefined,
): AdminReferenceDataResponse {
  return {
    airports: Array.isArray(referenceData?.airports) ? referenceData.airports : [],
    hubs: Array.isArray(referenceData?.hubs) ? referenceData.hubs : [],
    aircraftTypes: Array.isArray(referenceData?.aircraftTypes)
      ? referenceData.aircraftTypes
      : [],
    simbriefAirframes: Array.isArray(referenceData?.simbriefAirframes)
      ? referenceData.simbriefAirframes
      : [],
  };
}

function createInitialHubForm(
  referenceData: AdminReferenceDataResponse,
): HubFormState {
  return {
    code: "",
    name: "",
    airportId: referenceData.airports[0]?.id ?? "",
    isActive: true,
  };
}

function sortHubs(items: HubResponse[]): HubResponse[] {
  return [...items].sort((left, right) => left.code.localeCompare(right.code));
}

export function AdminHubsManager({
  initialHubs,
  referenceData,
}: AdminHubsManagerProps): JSX.Element {
  const safeReferenceData = normalizeReferenceData(referenceData);
  const [items, setItems] = useState(() =>
    sortHubs(Array.isArray(initialHubs) ? initialHubs : []),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AdminFeedback | null>(null);
  const [formState, setFormState] = useState<HubFormState>(() =>
    createInitialHubForm(safeReferenceData),
  );
  const [isPending, startTransition] = useTransition();

  function resetForm(): void {
    setEditingId(null);
    setFormState(createInitialHubForm(safeReferenceData));
  }

  function updateFormState<Field extends keyof HubFormState>(
    field: Field,
    value: HubFormState[Field],
  ): void {
    setFormState((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFeedback(null);

    const payload: AdminHubPayload = {
      code: formState.code.trim(),
      name: formState.name.trim(),
      airportId: formState.airportId,
      isActive: formState.isActive,
    };

    const endpoint = editingId ? `/api/admin/hubs/${editingId}` : "/api/admin/hubs";
    const response = await fetch(endpoint, {
      method: editingId ? "PATCH" : "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
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
          "Impossible d'enregistrer ce hub.",
        ),
      });
      return;
    }

    const savedHub = responsePayload as HubResponse;

    startTransition(() => {
      setItems((currentValue) => {
        const nextItems = editingId
          ? currentValue.map((item) => (item.id === editingId ? savedHub : item))
          : [...currentValue, savedHub];

        return sortHubs(nextItems);
      });
      setFeedback({
        tone: "success",
        message: editingId ? "Hub mis a jour." : "Hub cree avec succes.",
      });
      resetForm();
    });
  }

  async function handleDelete(id: string): Promise<void> {
    if (!window.confirm("Supprimer ce hub ?")) {
      return;
    }

    setFeedback(null);
    const response = await fetch(`/api/admin/hubs/${id}`, {
      method: "DELETE",
      credentials: "include",
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
          "Impossible de supprimer ce hub.",
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
        message: "Hub supprime.",
      });
    });
  }

  function handleEdit(item: HubResponse): void {
    setEditingId(item.id);
    setFeedback(null);
    setFormState({
      code: item.code,
      name: item.name,
      airportId: item.airport.id,
      isActive: item.isActive,
    });
  }

  return (
    <div className="admin-panel-stack">
      <Card className="admin-form-card">
        <div className="admin-card-head">
          <div>
            <span className="section-eyebrow">Gestion hubs</span>
            <h2>{editingId ? "Modifier un hub" : "Ajouter un hub"}</h2>
          </div>
          <p>Associez chaque hub a son aeroport de reference et a son etat d'activite.</p>
        </div>

        <form className="auth-form admin-form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="hub-code">Code</label>
            <input
              id="hub-code"
              onChange={(event) => updateFormState("code", event.target.value)}
              placeholder="PAR"
              required
              type="text"
              value={formState.code}
            />
          </div>

          <div className="field">
            <label htmlFor="hub-name">Nom</label>
            <input
              id="hub-name"
              onChange={(event) => updateFormState("name", event.target.value)}
              placeholder="Paris Hub"
              required
              type="text"
              value={formState.name}
            />
          </div>

          <div className="field">
            <label htmlFor="hub-airport">Aeroport</label>
            <select
              id="hub-airport"
              onChange={(event) => updateFormState("airportId", event.target.value)}
              required
              value={formState.airportId}
            >
              {safeReferenceData.airports.map((airport) => (
                <option key={airport.id} value={airport.id}>
                  {airport.icao} · {airport.name}
                </option>
              ))}
            </select>
          </div>

          <label className="admin-checkbox">
            <input
              checked={formState.isActive}
              onChange={(event) => updateFormState("isActive", event.target.checked)}
              type="checkbox"
            />
            Hub actif
          </label>

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
                  ? "Mettre a jour"
                  : "Creer le hub"}
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
            <span className="section-eyebrow">Reseau</span>
            <h2>Hubs enregistres</h2>
          </div>
          <p>{items.length} hub(s) configure(s).</p>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="Aucun hub enregistre"
            description="Créez votre premier hub réel à partir du référentiel aéroportuaire disponible."
          />
        ) : (
          <DataTable
            columns={[
              {
                id: "code",
                header: "Code",
                render: (item) => item.code,
              },
              {
                id: "name",
                header: "Nom",
                render: (item) => item.name,
              },
              {
                id: "airport",
                header: "Aéroport",
                render: (item) => `${item.airport.icao} · ${item.airport.name}`,
              },
              {
                id: "status",
                header: "Statut",
                render: (item) => (
                  <Badge
                    label={item.isActive ? "Actif" : "Inactif"}
                    tone={item.isActive ? "success" : "neutral"}
                  />
                ),
              },
              {
                id: "actions",
                header: "Actions",
                render: (item) => (
                  <div className="table-actions">
                    <Button onClick={() => handleEdit(item)} type="button" variant="ghost">
                      Modifier
                    </Button>
                    <Button
                      onClick={() => {
                        void handleDelete(item.id);
                      }}
                      type="button"
                      variant="ghost"
                    >
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
