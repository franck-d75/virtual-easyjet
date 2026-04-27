import type { BackendMode } from "./types.js";

export type PresentationTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export interface Presentation {
  label: string;
  tone: PresentationTone;
}

function prettifyCode(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getBackendModePresentation(mode: BackendMode): Presentation {
  return mode === "live"
    ? { label: "Mode réel", tone: "warning" }
    : { label: "Mode mock", tone: "neutral" };
}

export function getBookingStatusPresentation(status: string): Presentation {
  switch (status) {
    case "RESERVED":
      return { label: "Réservé", tone: "info" };
    case "IN_PROGRESS":
      return { label: "En cours", tone: "warning" };
    case "COMPLETED":
      return { label: "Terminé", tone: "success" };
    case "CANCELLED":
      return { label: "Annulé", tone: "danger" };
    default:
      return { label: prettifyCode(status), tone: "neutral" };
  }
}

export function getFlightStatusPresentation(status: string): Presentation {
  switch (status) {
    case "PLANNED":
      return { label: "Prêt", tone: "info" };
    case "IN_PROGRESS":
      return { label: "En cours", tone: "warning" };
    case "COMPLETED":
      return { label: "Terminé", tone: "success" };
    case "ABORTED":
      return { label: "Abandonné", tone: "danger" };
    default:
      return { label: prettifyCode(status), tone: "neutral" };
  }
}

export function getPirepStatusPresentation(status: string): Presentation {
  switch (status) {
    case "DRAFT":
      return { label: "Brouillon", tone: "neutral" };
    case "SUBMITTED":
      return { label: "Soumis", tone: "info" };
    case "ACCEPTED":
      return { label: "Validé", tone: "success" };
    case "REJECTED":
      return { label: "Rejeté", tone: "danger" };
    default:
      return { label: prettifyCode(status), tone: "neutral" };
  }
}

export function getSessionStatusPresentation(status: string): Presentation {
  switch (status) {
    case "CREATED":
      return { label: "Créée", tone: "info" };
    case "CONNECTED":
      return { label: "Connectée", tone: "info" };
    case "TRACKING":
      return { label: "Suivi actif", tone: "warning" };
    case "COMPLETED":
      return { label: "Terminée", tone: "success" };
    case "ABORTED":
      return { label: "Interrompue", tone: "danger" };
    case "DISCONNECTED":
      return { label: "Déconnectée", tone: "danger" };
    default:
      return { label: prettifyCode(status), tone: "neutral" };
  }
}

export function getPhaseLabel(phase: string): string {
  switch (phase) {
    case "PRE_FLIGHT":
      return "Prévol";
    case "DEPARTURE_PARKING":
      return "Parking départ";
    case "PUSHBACK":
      return "Repoussage";
    case "TAXI_OUT":
      return "Roulage départ";
    case "TAKEOFF":
      return "Décollage";
    case "CLIMB":
      return "Montée";
    case "CRUISE":
      return "Croisière";
    case "DESCENT":
      return "Descente";
    case "APPROACH":
      return "Approche";
    case "LANDING":
      return "Atterrissage";
    case "TAXI_IN":
      return "Roulage arrivée";
    case "ARRIVAL_PARKING":
      return "Parking arrivée";
    case "COMPLETED":
      return "Fin de vol";
    default:
      return prettifyCode(phase);
  }
}
