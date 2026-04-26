"use client";

import type { FormEvent, JSX } from "react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  AdminAircraftImportFromSimbriefAirframePayload,
  AdminAircraftPayload,
  AdminReferenceDataResponse,
  AircraftResponse,
  SimbriefAirframeResponse,
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
  simbriefAirframeId: string;
};

type ImportState = {
  simbriefAirframeId: string;
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
    simbriefAirframeId: "",
  };
}

function createInitialImportState(): ImportState {
  return {
    simbriefAirframeId: "",
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

function sortAirframes(items: SimbriefAirframeResponse[]): SimbriefAirframeResponse[] {
  return [...items].sort((left, right) => {
    const leftKey = left.registration ?? left.name;
    const rightKey = right.registration ?? right.name;
    return leftKey.localeCompare(rightKey);
  });
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

function buildAirframeOptionLabel(airframe: SimbriefAirframeResponse): string {
  return [
    airframe.registration,
    airframe.name,
    airframe.aircraftIcao,
    airframe.linkedAircraftType?.icaoCode ?? null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

function updateAirframesAfterAircraftChange(
  airframes: SimbriefAirframeResponse[],
  aircraft: AircraftResponse,
): SimbriefAirframeResponse[] {
  return airframes.map((airframe) => {
    if (airframe.id === aircraft.simbriefAirframe?.id) {
      return {
        ...airframe,
        linkedAircraft: {
          id: aircraft.id,
          registration: aircraft.registration,
          label: aircraft.label,
          status: aircraft.status,
          aircraftType: {
            id: aircraft.aircraftType.id,
            icaoCode: aircraft.aircraftType.icaoCode,
            name: aircraft.aircraftType.name,
          },
          hub: aircraft.hub,
        },
      };
    }

    if (airframe.linkedAircraft?.id === aircraft.id) {
      return {
        ...airframe,
        linkedAircraft: null,
      };
    }

    return airframe;
  });
}

export function AdminAircraftManager({
  initialAircraft,
  referenceData,
}: AdminAircraftManagerProps): JSX.Element {
  const [items, setItems] = useState(() => sortAircraft(initialAircraft));
  const [referenceDataState, setReferenceDataState] = useState({
    ...referenceData,
    simbriefAirframes: sortAirframes(referenceData.simbriefAirframes),
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AdminFeedback | null>(null);
  const [formState, setFormState] = useState<AircraftFormState>(() =>
    createInitialAircraftForm(referenceData),
  );
  const [importState, setImportState] = useState<ImportState>(() =>
    createInitialImportState(),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isInitializingTypes, setIsInitializingTypes] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const aircraftTypeLabelById = useMemo(
    () =>
      new Map(
        referenceDataState.aircraftTypes.map((item) => [
          item.id,
          `${item.icaoCode} · ${item.name}`,
        ]),
      ),
    [referenceDataState.aircraftTypes],
  );

  const hasAircraftTypeReference = referenceDataState.aircraftTypes.length > 0;
  const availableAirframes = useMemo(
    () => referenceDataState.simbriefAirframes,
    [referenceDataState.simbriefAirframes],
  );

  function resetForm(nextReferenceData = referenceDataState): void {
    setEditingId(null);
    setFormState(createInitialAircraftForm(nextReferenceData));
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

  function updateImportState<Field extends keyof ImportState>(
    field: Field,
    value: ImportState[Field],
  ): void {
    setImportState((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  }

  async function handleInitializeAircraftTypes(): Promise<void> {
    setFeedback(null);
    setIsInitializingTypes(true);

    try {
      const response = await fetch("/api/admin/reference-data/aircraft-types/init", {
        method: "POST",
      });

      const rawPayload = await response.text();
      const responsePayload = rawPayload ? parseJsonPayload(rawPayload) : null;

      if (!response.ok) {
        setFeedback({
          tone: "danger",
          message: extractApiMessage(
            responsePayload,
            "Impossible d'initialiser les types appareil de référence.",
          ),
        });
        return;
      }

      const nextReferenceData = responsePayload as AdminReferenceDataResponse;
      setReferenceDataState({
        ...nextReferenceData,
        simbriefAirframes: sortAirframes(nextReferenceData.simbriefAirframes),
      });
      resetForm(nextReferenceData);
      setFeedback({
        tone: "success",
        message:
          "Les types appareil A319, A320, A20N et A21N sont prêts pour votre flotte réelle.",
      });
    } finally {
      setIsInitializingTypes(false);
    }
  }

  async function handleImportFromAirframe(): Promise<void> {
    if (!importState.simbriefAirframeId) {
      setFeedback({
        tone: "danger",
        message: "Sélectionnez d'abord une airframe SimBrief à importer.",
      });
      return;
    }

    setFeedback(null);
    setIsImporting(true);

    try {
      const payload: AdminAircraftImportFromSimbriefAirframePayload = {
        simbriefAirframeId: importState.simbriefAirframeId,
        hubId: importState.hubId || null,
        status: importState.status,
        notes: importState.notes.trim() || null,
      };

      const response = await fetch(
        "/api/admin/aircraft/import-from-simbrief-airframe",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const rawPayload = await response.text();
      const responsePayload = rawPayload ? parseJsonPayload(rawPayload) : null;

      if (!response.ok) {
        setFeedback({
          tone: "danger",
          message: extractApiMessage(
            responsePayload,
            "Impossible d'importer cet appareil depuis SimBrief.",
          ),
        });
        return;
      }

      const savedAircraft = responsePayload as AircraftResponse;
      setItems((currentValue) => sortAircraft([...currentValue, savedAircraft]));
      setReferenceDataState((currentValue) => ({
        ...currentValue,
        simbriefAirframes: updateAirframesAfterAircraftChange(
          currentValue.simbriefAirframes,
          savedAircraft,
        ),
      }));
      setImportState(createInitialImportState());
      setFeedback({
        tone: "success",
        message: "Appareil importé depuis l'airframe SimBrief.",
      });
    } finally {
      setIsImporting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!hasAircraftTypeReference) {
      setFeedback({
        tone: "danger",
        message:
          "Initialisez d'abord les types appareil de référence avant de créer un avion.",
      });
      return;
    }

    setFeedback(null);
    setIsSaving(true);

    try {
      const payload: AdminAircraftPayload = {
        registration: formState.registration.trim(),
        label: formState.label.trim() || null,
        aircraftTypeId: formState.aircraftTypeId,
        hubId: formState.hubId || null,
        status: formState.status,
        notes: formState.notes.trim() || null,
      };

      if (formState.simbriefAirframeId.trim().length > 0) {
        payload.simbriefAirframeId = formState.simbriefAirframeId;
      } else if (editingId) {
        payload.simbriefAirframeId = null;
      }

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
            "Impossible d'enregistrer cet appareil.",
          ),
        });
        return;
      }

      const savedAircraft = responsePayload as AircraftResponse;

      setItems((currentValue) => {
        const nextItems = editingId
          ? currentValue.map((item) =>
              item.id === editingId ? savedAircraft : item,
            )
          : [...currentValue, savedAircraft];

        return sortAircraft(nextItems);
      });
      setReferenceDataState((currentValue) => ({
        ...currentValue,
        simbriefAirframes: updateAirframesAfterAircraftChange(
          currentValue.simbriefAirframes,
          savedAircraft,
        ),
      }));
      setFeedback({
        tone: "success",
        message: editingId
          ? "Appareil mis à jour."
          : "Appareil créé avec succès.",
      });
      resetForm();
    } finally {
      setIsSaving(false);
    }
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

    const deletedAircraft = items.find((item) => item.id === id) ?? null;
    setItems((currentValue) => currentValue.filter((item) => item.id !== id));
    if (deletedAircraft?.simbriefAirframe?.id) {
      setReferenceDataState((currentValue) => ({
        ...currentValue,
        simbriefAirframes: currentValue.simbriefAirframes.map((airframe) =>
          airframe.id === deletedAircraft.simbriefAirframe?.id
            ? {
                ...airframe,
                linkedAircraft: null,
              }
            : airframe,
        ),
      }));
    }
    if (editingId === id) {
      resetForm();
    }
    setFeedback({
      tone: "success",
      message: "Appareil supprimé.",
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
      simbriefAirframeId: item.simbriefAirframe?.id ?? "",
    });
  }

  return (
    <div className="admin-panel-stack">
      <Card className="admin-form-card">
        <div className="admin-card-head">
          <div>
            <span className="section-eyebrow">Import SimBrief</span>
            <h2>Importer depuis une airframe SimBrief</h2>
          </div>
          <p>
            Créez un appareil réel de la flotte à partir d’une airframe SimBrief
            déjà synchronisée sur le profil pilote.
          </p>
        </div>

        {availableAirframes.length === 0 ? (
          <EmptyState
            description="Aucune airframe SimBrief n’est encore synchronisée. Rendez-vous dans le profil pilote pour lancer une synchronisation réelle depuis SimBrief."
            title="Aucune airframe SimBrief"
          />
        ) : (
          <div className="auth-form admin-form-grid">
            <div className="field field--full">
              <label htmlFor="aircraft-import-airframe">Airframe SimBrief</label>
              <select
                id="aircraft-import-airframe"
                onChange={(event) =>
                  updateImportState("simbriefAirframeId", event.target.value)
                }
                value={importState.simbriefAirframeId}
              >
                <option value="">Sélectionner une airframe</option>
                {availableAirframes.map((airframe) => (
                  <option key={airframe.id ?? airframe.simbriefAirframeId} value={airframe.id ?? ""}>
                    {buildAirframeOptionLabel(airframe)}
                    {airframe.linkedAircraft ? " · déjà liée" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="aircraft-import-hub">Hub</label>
              <select
                id="aircraft-import-hub"
                onChange={(event) => updateImportState("hubId", event.target.value)}
                value={importState.hubId}
              >
                <option value="">Aucun hub</option>
                {referenceDataState.hubs.map((hub) => (
                  <option key={hub.id} value={hub.id}>
                    {hub.code} · {hub.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="aircraft-import-status">Statut</label>
              <select
                id="aircraft-import-status"
                onChange={(event) =>
                  updateImportState(
                    "status",
                    event.target.value as (typeof AIRCRAFT_STATUSES)[number],
                  )
                }
                value={importState.status}
              >
                {AIRCRAFT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="field field--full">
              <label htmlFor="aircraft-import-notes">Notes</label>
              <textarea
                id="aircraft-import-notes"
                onChange={(event) => updateImportState("notes", event.target.value)}
                placeholder="Importé depuis SimBrief Airframe"
                rows={2}
                value={importState.notes}
              />
            </div>

            <div className="admin-form-actions">
              <Button disabled={isImporting} onClick={() => void handleImportFromAirframe()} type="button">
                {isImporting ? "Import en cours..." : "Importer dans la flotte"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="admin-form-card">
        <div className="admin-card-head">
          <div>
            <span className="section-eyebrow">Gestion flotte</span>
            <h2>{editingId ? "Modifier un appareil" : "Ajouter un appareil"}</h2>
          </div>
          <p>
            Gérez les immatriculations réelles, leur type, leur hub optionnel,
            leur statut d’exploitation et leur liaison SimBrief Airframe.
          </p>
        </div>

        {!hasAircraftTypeReference ? (
          <EmptyState
            action={
              <Button
                disabled={isInitializingTypes}
                onClick={() => {
                  void handleInitializeAircraftTypes();
                }}
                type="button"
              >
                {isInitializingTypes
                  ? "Initialisation..."
                  : "Initialiser les types de référence"}
              </Button>
            }
            description="Initialisez les types appareil A319, A320, A20N et A21N pour pouvoir enregistrer votre flotte réelle."
            title="Aucun type appareil disponible"
          />
        ) : (
          <form className="auth-form admin-form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="aircraft-registration">Immatriculation</label>
              <input
                id="aircraft-registration"
                onChange={(event) =>
                  updateFormState("registration", event.target.value)
                }
                placeholder="HB-JXA"
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
                placeholder="Fenix A320 easyJet Switzerland 01"
                type="text"
                value={formState.label}
              />
            </div>

            <div className="field">
              <label htmlFor="aircraft-type">Type appareil</label>
              <select
                id="aircraft-type"
                onChange={(event) =>
                  updateFormState("aircraftTypeId", event.target.value)
                }
                required
                value={formState.aircraftTypeId}
              >
                {referenceDataState.aircraftTypes.map((aircraftType) => (
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
                {referenceDataState.hubs.map((hub) => (
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
              <label htmlFor="aircraft-simbrief-airframe">Airframe SimBrief liée</label>
              <select
                id="aircraft-simbrief-airframe"
                onChange={(event) =>
                  updateFormState("simbriefAirframeId", event.target.value)
                }
                value={formState.simbriefAirframeId}
              >
                <option value="">Aucune airframe liée</option>
                {availableAirframes.map((airframe) => (
                  <option key={airframe.id ?? airframe.simbriefAirframeId} value={airframe.id ?? ""}>
                    {buildAirframeOptionLabel(airframe)}
                    {airframe.linkedAircraft &&
                    airframe.linkedAircraft.id !== editingId
                      ? " · déjà liée"
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="field field--full">
              <label htmlFor="aircraft-notes">Notes</label>
              <textarea
                id="aircraft-notes"
                onChange={(event) => updateFormState("notes", event.target.value)}
                placeholder="Commentaires internes sur la livrée, l’affectation ou le simulateur."
                rows={3}
                value={formState.notes}
              />
            </div>

            {feedback ? (
              <p
                className={`inline-feedback inline-feedback--${feedback.tone}`}
                role="status"
              >
                {feedback.message}
              </p>
            ) : null}

            <div className="admin-form-actions">
              <Button disabled={isSaving} type="submit">
                {isSaving
                  ? "Enregistrement..."
                  : editingId
                    ? "Mettre à jour"
                    : "Créer l'appareil"}
              </Button>
              {editingId ? (
                <Button onClick={() => resetForm()} type="button" variant="ghost">
                  Annuler
                </Button>
              ) : null}
            </div>
          </form>
        )}

        {feedback && !hasAircraftTypeReference ? (
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
            <span className="section-eyebrow">Inventaire</span>
            <h2>Flotte actuelle</h2>
          </div>
          <p>{items.length} appareil(s) enregistré(s).</p>
        </div>

        {items.length === 0 ? (
          <EmptyState
            description="Enregistrez votre premier appareil pour exploiter votre flotte réelle."
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
                    {aircraftTypeLabelById.get(item.aircraftType.id) ??
                      item.aircraftType.name}
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
                id: "airframe",
                header: "Airframe SimBrief",
                render: (item) => (
                  <span className="table-muted">
                    {item.simbriefAirframe
                      ? `${item.simbriefAirframe.name}${item.simbriefAirframe.registration ? ` · ${item.simbriefAirframe.registration}` : ""}`
                      : "Aucune liaison"}
                  </span>
                ),
              },
              {
                id: "status",
                header: "Statut",
                render: (item) => (
                  <Badge label={item.status} tone={getAircraftStatusTone(item.status)} />
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
