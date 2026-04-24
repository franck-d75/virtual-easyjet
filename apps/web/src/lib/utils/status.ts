export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export interface StatusPresentation {
  label: string;
  tone: BadgeTone;
}

function prettifyStatus(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getBookingStatusPresentation(status: string): StatusPresentation {
  switch (status) {
    case "RESERVED":
      return { label: "Réservé", tone: "info" };
    case "IN_PROGRESS":
      return { label: "En cours", tone: "warning" };
    case "COMPLETED":
      return { label: "Terminé", tone: "success" };
    case "CANCELLED":
      return { label: "Annulé", tone: "danger" };
    case "EXPIRED":
      return { label: "Expiré", tone: "danger" };
    default:
      return { label: prettifyStatus(status), tone: "neutral" };
  }
}

export function getFlightStatusPresentation(status: string): StatusPresentation {
  switch (status) {
    case "PLANNED":
      return { label: "Planifié", tone: "info" };
    case "IN_PROGRESS":
      return { label: "En cours", tone: "warning" };
    case "COMPLETED":
      return { label: "Terminé", tone: "success" };
    case "ABORTED":
      return { label: "Abandonné", tone: "danger" };
    case "CANCELLED":
      return { label: "Annulé", tone: "danger" };
    default:
      return { label: prettifyStatus(status), tone: "neutral" };
  }
}

export function getPirepStatusPresentation(status: string): StatusPresentation {
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
      return { label: prettifyStatus(status), tone: "neutral" };
  }
}

export function getSessionStatusPresentation(status: string): StatusPresentation {
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
      return { label: prettifyStatus(status), tone: "neutral" };
  }
}

export function getUserStatusPresentation(status: string): StatusPresentation {
  switch (status) {
    case "ACTIVE":
      return { label: "Actif", tone: "success" };
    case "PENDING":
      return { label: "En attente", tone: "warning" };
    case "SUSPENDED":
      return { label: "Suspendu", tone: "danger" };
    case "DISABLED":
      return { label: "Désactivé", tone: "danger" };
    default:
      return { label: prettifyStatus(status), tone: "neutral" };
  }
}

export function getUserRolePresentation(role: string): StatusPresentation {
  switch (role) {
    case "ADMIN":
      return { label: "Administrateur", tone: "warning" };
    case "USER":
      return { label: "Utilisateur", tone: "info" };
    default:
      return { label: prettifyStatus(role), tone: "neutral" };
  }
}

export function getSimbriefAvailabilityPresentation(
  status: string,
): StatusPresentation {
  switch (status) {
    case "NOT_CONFIGURED":
      return { label: "Non configuré", tone: "neutral" };
    case "AVAILABLE":
      return { label: "Disponible", tone: "success" };
    case "NOT_FOUND":
      return { label: "Aucun OFP", tone: "warning" };
    case "ERROR":
      return { label: "Indisponible", tone: "danger" };
    default:
      return { label: prettifyStatus(status), tone: "neutral" };
  }
}

export function getSimbriefVaMatchPresentation(
  status: string,
): StatusPresentation {
  switch (status) {
    case "MATCHED":
      return { label: "OFP correspondant", tone: "success" };
    case "AVAILABLE_NO_MATCH":
      return { label: "OFP non concordant", tone: "warning" };
    case "NO_OFP":
      return { label: "Aucun OFP", tone: "neutral" };
    default:
      return { label: prettifyStatus(status), tone: "neutral" };
  }
}
