"use client";

import type { FormEvent, JSX } from "react";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  AdminReferenceDataResponse,
  AdminRoutePayload,
  RouteResponse,
} from "@/lib/api/types";

import {
  extractApiMessage,
  handleAdminUnauthorized,
  parseJsonPayload,
  type AdminFeedback,
} from "./admin-feedback";

type AdminRoutesManagerProps = {
  initialRoutes: RouteResponse[];
  referenceData: AdminReferenceDataResponse;
};

type RouteFormState = {
  code: string;
  flightNumber: string;
  departureAirportId: string;
  arrivalAirportId: string;
  departureHubId: string;
  arrivalHubId: string;
  aircraftTypeId: string;
  distanceNm: string;
  blockTimeMinutes: string;
  isActive: boolean;
  notes: string;
};

function createInitialRouteForm(
  referenceData: AdminReferenceDataResponse,
): RouteFormState {
  return {
    code: "",
    flightNumber: "",
    departureAirportId: referenceData.airports[0]?.id ?? "",
    arrivalAirportId: referenceData.airports[1]?.id ?? referenceData.airports[0]?.id ?? "",
    departureHubId: "",
    arrivalHubId: "",
    aircraftTypeId: "",
    distanceNm: "",
    blockTimeMinutes: "",
    isActive: true,
    notes: "",
  };
}

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

function sortRoutes(items: RouteResponse[]): RouteResponse[] {
  return [...items].sort((left, right) => left.code.localeCompare(right.code));
}

export function AdminRoutesManager({
  initialRoutes,
  referenceData,
}: AdminRoutesManagerProps): JSX.Element {
  const safeReferenceData = normalizeReferenceData(referenceData);
  const [items, setItems] = useState(() =>
    sortRoutes(Array.isArray(initialRoutes) ? initialRoutes : []),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AdminFeedback | null>(null);
  const [formState, setFormState] = useState<RouteFormState>(() =>
    createInitialRouteForm(safeReferenceData),
  );
  const [isPending, startTransition] = useTransition();

  function resetForm(): void {
    setEditingId(null);
    setFormState(createInitialRouteForm(safeReferenceData));
  }

  function updateFormState<Field extends keyof RouteFormState>(
    field: Field,
    value: RouteFormState[Field],
  ): void {
    setFormState((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFeedback(null);

    const payload: AdminRoutePayload = {
      code: formState.code.trim(),
      flightNumber: formState.flightNumber.trim(),
      departureAirportId: formState.departureAirportId,
      arrivalAirportId: formState.arrivalAirportId,
      departureHubId: formState.departureHubId || null,
      arrivalHubId: formState.arrivalHubId || null,
      aircraftTypeId: formState.aircraftTypeId || null,
      distanceNm: formState.distanceNm ? Number(formState.distanceNm) : null,
      blockTimeMinutes: formState.blockTimeMinutes
        ? Number(formState.blockTimeMinutes)
        : null,
      isActive: formState.isActive,
      notes: formState.notes.trim() || null,
    };

    const endpoint = editingId ? `/api/admin/routes/${editingId}` : "/api/admin/routes";
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
        message: extractApiMessage(responsePayload, "Impossible d’enregistrer cette route."),
      });
      return;
    }

    const savedRoute = responsePayload as RouteResponse;

    startTransition(() => {
      setItems((currentValue) => {
        const nextItems = editingId
          ? currentValue.map((item) => (item.id === editingId ? savedRoute : item))
          : [...currentValue, savedRoute];

        return sortRoutes(nextItems);
      });
      setFeedback({
        tone: "success",
        message: editingId ? "Route mise à jour." : "Route créée avec succès.",
      });
      resetForm();
    });
  }

  async function handleDelete(id: string): Promise<void> {
    if (!window.confirm("Supprimer cette route ?")) {
      return;
    }

    setFeedback(null);
    const response = await fetch(`/api/admin/routes/${id}`, {
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
        message: extractApiMessage(responsePayload, "Impossible de supprimer cette route."),
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
        message: "Route supprimée.",
      });
    });
  }

  function handleEdit(item: RouteResponse): void {
    setEditingId(item.id);
    setFeedback(null);
    setFormState({
      code: item.code,
      flightNumber: item.flightNumber,
      departureAirportId: item.departureAirport.id,
      arrivalAirportId: item.arrivalAirport.id,
      departureHubId: item.departureHub?.id ?? "",
      arrivalHubId: item.arrivalHub?.id ?? "",
      aircraftTypeId: item.aircraftType?.id ?? "",
      distanceNm: item.distanceNm?.toString() ?? "",
      blockTimeMinutes: item.blockTimeMinutes?.toString() ?? "",
      isActive: item.isActive,
      notes: item.notes ?? "",
    });
  }

  return (
    <div className="admin-panel-stack">
      <Card className="admin-form-card">
        <div className="admin-card-head">
          <div>
            <span className="section-eyebrow">Gestion routes</span>
            <h2>{editingId ? "Modifier une route" : "Ajouter une route"}</h2>
          </div>
          <p>Définissez le couple départ/arrivée, le vol et les contraintes d’exploitation.</p>
        </div>

        <form className="auth-form admin-form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="route-code">Code</label>
            <input
              id="route-code"
              onChange={(event) => updateFormState("code", event.target.value)}
              placeholder="AFR100"
              required
              type="text"
              value={formState.code}
            />
          </div>

          <div className="field">
            <label htmlFor="route-flight-number">Numéro de vol</label>
            <input
              id="route-flight-number"
              onChange={(event) => updateFormState("flightNumber", event.target.value)}
              placeholder="AFR100"
              required
              type="text"
              value={formState.flightNumber}
            />
          </div>

          <div className="field">
            <label htmlFor="route-departure-airport">Départ</label>
            <select
              id="route-departure-airport"
              onChange={(event) => updateFormState("departureAirportId", event.target.value)}
              required
              value={formState.departureAirportId}
            >
              {safeReferenceData.airports.map((airport) => (
                <option key={airport.id} value={airport.id}>
                  {airport.icao} · {airport.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="route-arrival-airport">Arrivée</label>
            <select
              id="route-arrival-airport"
              onChange={(event) => updateFormState("arrivalAirportId", event.target.value)}
              required
              value={formState.arrivalAirportId}
            >
              {safeReferenceData.airports.map((airport) => (
                <option key={airport.id} value={airport.id}>
                  {airport.icao} · {airport.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="route-departure-hub">Hub départ</label>
            <select
              id="route-departure-hub"
              onChange={(event) => updateFormState("departureHubId", event.target.value)}
              value={formState.departureHubId}
            >
              <option value="">Aucun hub</option>
              {safeReferenceData.hubs.map((hub) => (
                <option key={hub.id} value={hub.id}>
                  {hub.code} · {hub.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="route-arrival-hub">Hub arrivée</label>
            <select
              id="route-arrival-hub"
              onChange={(event) => updateFormState("arrivalHubId", event.target.value)}
              value={formState.arrivalHubId}
            >
              <option value="">Aucun hub</option>
              {safeReferenceData.hubs.map((hub) => (
                <option key={hub.id} value={hub.id}>
                  {hub.code} · {hub.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="route-aircraft-type">Type appareil</label>
            <select
              id="route-aircraft-type"
              onChange={(event) => updateFormState("aircraftTypeId", event.target.value)}
              value={formState.aircraftTypeId}
            >
              <option value="">Aucun type imposé</option>
              {safeReferenceData.aircraftTypes.map((aircraftType) => (
                <option key={aircraftType.id} value={aircraftType.id}>
                  {aircraftType.icaoCode} · {aircraftType.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="route-distance">Distance (NM)</label>
            <input
              id="route-distance"
              min={0}
              onChange={(event) => updateFormState("distanceNm", event.target.value)}
              type="number"
              value={formState.distanceNm}
            />
          </div>

          <div className="field">
            <label htmlFor="route-block-time">Temps bloc (min)</label>
            <input
              id="route-block-time"
              min={0}
              onChange={(event) => updateFormState("blockTimeMinutes", event.target.value)}
              type="number"
              value={formState.blockTimeMinutes}
            />
          </div>

          <label className="admin-checkbox">
            <input
              checked={formState.isActive}
              onChange={(event) => updateFormState("isActive", event.target.checked)}
              type="checkbox"
            />
            Route active
          </label>

          <div className="field field--full">
            <label htmlFor="route-notes">Notes</label>
            <textarea
              id="route-notes"
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
                  : "Créer la route"}
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
            <span className="section-eyebrow">Catalogue</span>
            <h2>Routes publiées</h2>
          </div>
          <p>{items.length} route(s) configurée(s).</p>
        </div>

        {items.length === 0 ? (
          <EmptyState
            description="Créez votre première rotation pour alimenter l’exploitation."
            title="Aucune route enregistrée"
          />
        ) : (
          <DataTable
            columns={[
              {
                id: "route",
                header: "Route",
                render: (item) => (
                  <div className="table-primary">
                    <strong>{item.code}</strong>
                    <small>{item.flightNumber}</small>
                  </div>
                ),
              },
              {
                id: "airports",
                header: "Trajet",
                render: (item) => (
                  <div className="table-secondary">
                    {item.departureAirport.icao} → {item.arrivalAirport.icao}
                  </div>
                ),
              },
              {
                id: "aircraft",
                header: "Type",
                render: (item) => (
                  <span className="table-muted">
                    {item.aircraftType
                      ? `${item.aircraftType.icaoCode} · ${item.aircraftType.name}`
                      : "Libre"}
                  </span>
                ),
              },
              {
                id: "status",
                header: "État",
                render: (item) => (
                  <Badge
                    label={item.isActive ? "Active" : "Inactive"}
                    tone={item.isActive ? "success" : "danger"}
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
