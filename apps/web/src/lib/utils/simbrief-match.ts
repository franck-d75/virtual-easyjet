import type {
  BookingResponse,
  FlightResponse,
  SimbriefLatestOfpResponse,
} from "@/lib/api/types";

export type SimbriefVaMatchStatus =
  | "NO_OFP"
  | "MATCHED"
  | "AVAILABLE_NO_MATCH";

export interface SimbriefVaCandidate {
  id: string;
  label: string;
  href: string;
  departureIcao: string;
  arrivalIcao: string;
  identifiers: string[];
  aircraftIcao: string | null;
}

export interface SimbriefVaMatchResult {
  status: SimbriefVaMatchStatus;
  detail: string;
  routeMatches: boolean;
  identifierMatches: boolean;
  aircraftMatches: boolean;
}

export interface SimbriefVaMatchOverview {
  status: SimbriefVaMatchStatus;
  detail: string;
  latestOfpLabel: string | null;
  latestOfpRoute: string | null;
  matchedCandidate: SimbriefVaCandidate | null;
  matchedCount: number;
}

export function buildBookingSimbriefCandidate(
  booking: BookingResponse,
): SimbriefVaCandidate {
  return {
    id: booking.id,
    label: booking.reservedFlightNumber,
    href: booking.flight ? `/vols?flight=${booking.flight.id}` : "/bookings",
    departureIcao: booking.departureAirport.icao,
    arrivalIcao: booking.arrivalAirport.icao,
    identifiers: [
      booking.reservedFlightNumber,
      booking.route?.flightNumber ?? null,
      booking.schedule?.callsign ?? null,
    ].filter((value): value is string => Boolean(value)),
    aircraftIcao: booking.aircraft.aircraftType.icaoCode,
  };
}

export function buildFlightSimbriefCandidate(
  flight: FlightResponse,
): SimbriefVaCandidate {
  return {
    id: flight.id,
    label: flight.flightNumber,
    href: `/vols?flight=${flight.id}`,
    departureIcao: flight.departureAirport.icao,
    arrivalIcao: flight.arrivalAirport.icao,
    identifiers: [flight.flightNumber, flight.route?.flightNumber ?? null].filter(
      (value): value is string => Boolean(value),
    ),
    aircraftIcao: flight.aircraft.aircraftType.icaoCode,
  };
}

export function buildSimbriefMatchMap(
  latestOfp: SimbriefLatestOfpResponse,
  candidates: SimbriefVaCandidate[],
): Record<string, SimbriefVaMatchResult> {
  return Object.fromEntries(
    candidates.map((candidate) => [
      candidate.id,
      matchSimbriefCandidate(latestOfp, candidate),
    ]),
  );
}

export function summarizeSimbriefMatches(
  latestOfp: SimbriefLatestOfpResponse,
  candidates: SimbriefVaCandidate[],
  entityLabel: string,
): SimbriefVaMatchOverview {
  const latestOfpLabel = buildLatestOfpLabel(latestOfp);
  const latestOfpRoute = buildLatestOfpRoute(latestOfp);

  if (latestOfp.status !== "AVAILABLE" || !latestOfp.plan) {
    return {
      status: "NO_OFP",
      detail: describeUnavailableOfp(latestOfp),
      latestOfpLabel,
      latestOfpRoute,
      matchedCandidate: null,
      matchedCount: 0,
    };
  }

  if (candidates.length === 0) {
    return {
      status: "AVAILABLE_NO_MATCH",
      detail: `Un OFP est disponible, mais aucun ${entityLabel} n’est encore à rapprocher.`,
      latestOfpLabel,
      latestOfpRoute,
      matchedCandidate: null,
      matchedCount: 0,
    };
  }

  const matches = candidates
    .map((candidate) => ({
      candidate,
      result: matchSimbriefCandidate(latestOfp, candidate),
    }))
    .filter((entry) => entry.result.status === "MATCHED");

  if (matches.length > 0) {
    return {
      status: "MATCHED",
      detail: `Le dernier OFP correspond à ${matches[0]?.candidate.label ?? "votre rotation actuelle"}.`,
      latestOfpLabel,
      latestOfpRoute,
      matchedCandidate: matches[0]?.candidate ?? null,
      matchedCount: matches.length,
    };
  }

  return {
    status: "AVAILABLE_NO_MATCH",
    detail: `Un OFP est disponible, mais il ne correspond à aucun ${entityLabel}.`,
    latestOfpLabel,
    latestOfpRoute,
    matchedCandidate: null,
    matchedCount: 0,
  };
}

export function matchSimbriefCandidate(
  latestOfp: SimbriefLatestOfpResponse,
  candidate: SimbriefVaCandidate,
): SimbriefVaMatchResult {
  if (latestOfp.status !== "AVAILABLE" || !latestOfp.plan) {
    return {
      status: "NO_OFP",
      detail: describeUnavailableOfp(latestOfp),
      routeMatches: false,
      identifierMatches: false,
      aircraftMatches: false,
    };
  }

  const routeMatches =
    normalizeToken(candidate.departureIcao) ===
      normalizeToken(latestOfp.plan.departureIcao) &&
    normalizeToken(candidate.arrivalIcao) ===
      normalizeToken(latestOfp.plan.arrivalIcao);
  const identifierMatches = matchIdentifiers(candidate.identifiers, [
    latestOfp.plan.callsign,
    latestOfp.plan.flightNumber,
  ]);
  const aircraftMatches =
    normalizeToken(candidate.aircraftIcao) !== "" &&
    normalizeToken(candidate.aircraftIcao) ===
      normalizeToken(latestOfp.plan.aircraft?.icaoCode);

  if (routeMatches && identifierMatches) {
    return {
      status: "MATCHED",
      detail: aircraftMatches
        ? "Route, indicatif ou numéro de vol, et appareil concordent."
        : "Route et indicatif ou numéro de vol concordent.",
      routeMatches,
      identifierMatches,
      aircraftMatches,
    };
  }

  if (routeMatches && aircraftMatches) {
    return {
      status: "AVAILABLE_NO_MATCH",
      detail:
        "La route et l’appareil correspondent, mais pas l’indicatif ou le numéro de vol.",
      routeMatches,
      identifierMatches,
      aircraftMatches,
    };
  }

  if (routeMatches) {
    return {
      status: "AVAILABLE_NO_MATCH",
      detail:
        "La route correspond, mais pas l’indicatif ou le numéro de vol.",
      routeMatches,
      identifierMatches,
      aircraftMatches,
    };
  }

  if (identifierMatches) {
    return {
      status: "AVAILABLE_NO_MATCH",
      detail:
        "L’indicatif ou le numéro de vol correspond, mais pas la rotation.",
      routeMatches,
      identifierMatches,
      aircraftMatches,
    };
  }

  return {
    status: "AVAILABLE_NO_MATCH",
    detail: "Le dernier OFP disponible ne correspond pas à cette rotation.",
    routeMatches,
    identifierMatches,
    aircraftMatches,
  };
}

function buildLatestOfpLabel(
  latestOfp: SimbriefLatestOfpResponse,
): string | null {
  if (!latestOfp.plan) {
    return latestOfp.pilotId;
  }

  return latestOfp.plan.callsign ?? latestOfp.plan.flightNumber ?? latestOfp.pilotId;
}

function buildLatestOfpRoute(
  latestOfp: SimbriefLatestOfpResponse,
): string | null {
  if (!latestOfp.plan?.departureIcao || !latestOfp.plan.arrivalIcao) {
    return null;
  }

  return `${latestOfp.plan.departureIcao} → ${latestOfp.plan.arrivalIcao}`;
}

function describeUnavailableOfp(latestOfp: SimbriefLatestOfpResponse): string {
  switch (latestOfp.status) {
    case "NOT_CONFIGURED":
      return "Aucun OFP disponible : configurez d’abord votre SimBrief Pilot ID.";
    case "NOT_FOUND":
      return "Aucun OFP disponible : aucun dernier plan de vol SimBrief n’a été trouvé.";
    case "ERROR":
      return "Aucun OFP disponible : la récupération SimBrief a échoué pour le moment.";
    default:
      return "Aucun OFP disponible pour le rapprochement.";
  }
}

function matchIdentifiers(
  candidateIdentifiers: string[],
  ofpIdentifiers: Array<string | null | undefined>,
): boolean {
  const candidateTokens = candidateIdentifiers
    .map((identifier) => normalizeToken(identifier))
    .filter((value) => value.length > 0);
  const ofpTokens = ofpIdentifiers
    .map((identifier) => normalizeToken(identifier))
    .filter((value) => value.length > 0);

  if (
    candidateTokens.some((candidateToken) =>
      ofpTokens.includes(candidateToken),
    )
  ) {
    return true;
  }

  const candidateDigitTokens = candidateTokens
    .map((token) => extractDigits(token))
    .filter((value) => value.length >= 3);
  const ofpDigitTokens = ofpTokens
    .map((token) => extractDigits(token))
    .filter((value) => value.length >= 3);

  return candidateDigitTokens.some((candidateDigits) =>
    ofpDigitTokens.includes(candidateDigits),
  );
}

function extractDigits(value: string): string {
  return value.replace(/\D+/g, "");
}

function normalizeToken(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
