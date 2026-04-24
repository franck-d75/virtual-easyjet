import { Injectable } from "@nestjs/common";

import {
  buildSimbriefFlightPlanLookup,
  type SimbriefFlightPlanLookup,
} from "./simbrief.utils.js";

const SIMBRIEF_FETCH_TIMEOUT_MS = 8_000;
const SIMBRIEF_USER_AGENT = "VirtualEasyjet/0.1.0";

type JsonRecord = Record<string, unknown>;

export type SimbriefLatestOfpStatus =
  | "NOT_CONFIGURED"
  | "AVAILABLE"
  | "NOT_FOUND"
  | "ERROR";

export interface SimbriefLatestOfpAircraftSummary {
  icaoCode: string | null;
  name: string | null;
  registration: string | null;
}

export type SimbriefLatestOfpRoutePointSource =
  | "ORIGIN"
  | "NAVLOG"
  | "DESTINATION";

export interface SimbriefLatestOfpRoutePointSummary {
  ident: string | null;
  lat: number;
  lon: number;
  source: SimbriefLatestOfpRoutePointSource;
}

export interface SimbriefLatestOfpPlanSummary {
  callsign: string | null;
  flightNumber: string | null;
  departureIcao: string | null;
  arrivalIcao: string | null;
  route: string | null;
  cruiseAltitudeFt: number | null;
  estimatedTimeEnroute: string | null;
  generatedAt: string | null;
  aircraft: SimbriefLatestOfpAircraftSummary | null;
  routePoints: SimbriefLatestOfpRoutePointSummary[];
}

export interface SimbriefLatestOfpResult {
  status: SimbriefLatestOfpStatus;
  pilotId: string | null;
  detail: string | null;
  fetchStatus: string | null;
  fetchedAt: string;
  source: SimbriefFlightPlanLookup | null;
  plan: SimbriefLatestOfpPlanSummary | null;
}

@Injectable()
export class SimbriefClient {
  public async getLatestOfp(
    pilotId: string | null | undefined,
  ): Promise<SimbriefLatestOfpResult> {
    const normalizedPilotId = pilotId?.trim() ?? "";
    const fetchedAt = new Date().toISOString();

    if (normalizedPilotId.length === 0) {
      return {
        status: "NOT_CONFIGURED",
        pilotId: null,
        detail: null,
        fetchStatus: null,
        fetchedAt,
        source: null,
        plan: null,
      };
    }

    const source = buildSimbriefFlightPlanLookup(normalizedPilotId);

    try {
      const response = await fetch(source.latestOfpJsonUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": SIMBRIEF_USER_AGENT,
        },
        signal: AbortSignal.timeout(SIMBRIEF_FETCH_TIMEOUT_MS),
      });

      const rawPayload = await response.text();
      const payload = tryParseJson(rawPayload);
      const fetchStatus = readString(payload, ["fetch", "status"]);

      if (!response.ok) {
        return {
          status: response.status === 400 ? "NOT_FOUND" : "ERROR",
          pilotId: normalizedPilotId,
          detail:
            fetchStatus ??
            `SimBrief returned HTTP ${String(response.status)}.`,
          fetchStatus,
          fetchedAt,
          source,
          plan: null,
        };
      }

      const plan = this.normalizeLatestOfp(payload);

      if (!plan) {
        console.warn("[api][simbrief] latest OFP payload could not be mapped", {
          pilotId: normalizedPilotId,
          source: source.latestOfpJsonUrl,
        });

        return {
          status: "ERROR",
          pilotId: normalizedPilotId,
          detail: "SimBrief returned an unsupported OFP payload.",
          fetchStatus: fetchStatus ?? "Success",
          fetchedAt,
          source,
          plan: null,
        };
      }

      return {
        status: "AVAILABLE",
        pilotId: normalizedPilotId,
        detail: null,
        fetchStatus: fetchStatus ?? "Success",
        fetchedAt,
        source,
        plan,
      };
    } catch (error) {
      const detail = formatFetchError(error);

      console.warn("[api][simbrief] latest OFP fetch failed", {
        pilotId: normalizedPilotId,
        detail,
      });

      return {
        status: "ERROR",
        pilotId: normalizedPilotId,
        detail,
        fetchStatus: null,
        fetchedAt,
        source,
        plan: null,
      };
    }
  }

  private normalizeLatestOfp(
    payload: unknown,
  ): SimbriefLatestOfpPlanSummary | null {
    const airlineCode = readFirstString(payload, [
      ["general", "icao_airline"],
      ["api_params", "airline"],
    ]);
    const flightNumberLiteral = readFirstString(payload, [
      ["general", "flight_number"],
      ["api_params", "fltnum"],
    ]);

    const aircraft = buildAircraftSummary(payload);
    const routePoints = buildRoutePoints(payload);
    const plan: SimbriefLatestOfpPlanSummary = {
      callsign: readFirstString(payload, [
        ["atc", "callsign"],
        ["api_params", "callsign"],
      ]),
      flightNumber: buildFlightNumber(airlineCode, flightNumberLiteral),
      departureIcao: readFirstString(payload, [
        ["origin", "icao_code"],
        ["api_params", "orig"],
      ]),
      arrivalIcao: readFirstString(payload, [
        ["destination", "icao_code"],
        ["api_params", "dest"],
      ]),
      route: readFirstString(payload, [
        ["general", "route"],
        ["atc", "route"],
        ["api_params", "route"],
      ]),
      cruiseAltitudeFt: readInteger(payload, [
        ["general", "initial_altitude"],
        ["api_params", "fl"],
      ]),
      estimatedTimeEnroute: readFirstString(payload, [
        ["times", "est_time_enroute"],
        ["times", "sched_time_enroute"],
      ]),
      generatedAt: readString(payload, ["params", "time_generated"]),
      aircraft,
      routePoints,
    };

    if (!hasMinimumPlanContent(plan)) {
      return null;
    }

    return plan;
  }
}

function buildAircraftSummary(
  payload: unknown,
): SimbriefLatestOfpAircraftSummary | null {
  const aircraft: SimbriefLatestOfpAircraftSummary = {
    icaoCode: readFirstString(payload, [
      ["aircraft", "icao_code"],
      ["aircraft", "icaocode"],
    ]),
    name: readString(payload, ["aircraft", "name"]),
    registration: readFirstString(payload, [
      ["aircraft", "reg"],
      ["api_params", "reg"],
    ]),
  };

  return Object.values(aircraft).some((value) => value !== null)
    ? aircraft
    : null;
}

function buildRoutePoints(
  payload: unknown,
): SimbriefLatestOfpRoutePointSummary[] {
  const originPoint = buildAirportRoutePoint(payload, "origin", "ORIGIN");
  const destinationPoint = buildAirportRoutePoint(
    payload,
    "destination",
    "DESTINATION",
  );
  const navlogPoints = buildNavlogRoutePoints(payload);

  return dedupeRoutePoints(
    [originPoint, ...navlogPoints, destinationPoint].filter(
      (
        point,
      ): point is SimbriefLatestOfpRoutePointSummary => point !== null,
    ),
  );
}

function buildAirportRoutePoint(
  payload: unknown,
  scope: "origin" | "destination",
  source: SimbriefLatestOfpRoutePointSource,
): SimbriefLatestOfpRoutePointSummary | null {
  const lat = readCoordinate(payload, [
    [scope, "pos_lat"],
    [scope, "lat"],
    [scope, "latitude"],
    [scope, "pos_lat_float"],
    [scope, "plan_lat"],
  ]);
  const lon = readCoordinate(payload, [
    [scope, "pos_lon"],
    [scope, "pos_long"],
    [scope, "lon"],
    [scope, "longitude"],
    [scope, "pos_lon_float"],
    [scope, "pos_long_float"],
    [scope, "plan_lon"],
    [scope, "plan_long"],
  ]);

  if (lat === null || lon === null) {
    return null;
  }

  return {
    ident: readFirstString(payload, [
      [scope, "icao_code"],
      [scope, "icao"],
      [scope, "iata_code"],
    ]),
    lat,
    lon,
    source,
  };
}

function buildNavlogRoutePoints(
  payload: unknown,
): SimbriefLatestOfpRoutePointSummary[] {
  const fixes = readPath(payload, ["navlog", "fix"]);

  if (!Array.isArray(fixes)) {
    return [];
  }

  return fixes.flatMap((fix) => {
    const lat = readCoordinate(fix, [
      ["pos_lat"],
      ["lat"],
      ["latitude"],
      ["pos_lat_float"],
      ["plan_lat"],
    ]);
    const lon = readCoordinate(fix, [
      ["pos_lon"],
      ["pos_long"],
      ["lon"],
      ["longitude"],
      ["pos_lon_float"],
      ["pos_long_float"],
      ["plan_lon"],
      ["plan_long"],
    ]);

    if (lat === null || lon === null) {
      return [];
    }

    return [
      {
        ident: readFirstString(fix, [
          ["ident"],
          ["name"],
          ["fix"],
          ["via_airway"],
        ]),
        lat,
        lon,
        source: "NAVLOG" as const,
      },
    ];
  });
}

function dedupeRoutePoints(
  points: SimbriefLatestOfpRoutePointSummary[],
): SimbriefLatestOfpRoutePointSummary[] {
  return points.filter((point, index) => {
    const previousPoint = points[index - 1];

    if (!previousPoint) {
      return true;
    }

    return !areRoutePointsEquivalent(previousPoint, point);
  });
}

function areRoutePointsEquivalent(
  left: SimbriefLatestOfpRoutePointSummary,
  right: SimbriefLatestOfpRoutePointSummary,
): boolean {
  return (
    Math.abs(left.lat - right.lat) < 0.0001 &&
    Math.abs(left.lon - right.lon) < 0.0001
  );
}

function buildFlightNumber(
  airlineCode: string | null,
  flightNumber: string | null,
): string | null {
  if (airlineCode && flightNumber) {
    return `${airlineCode}${flightNumber}`;
  }

  return flightNumber ?? airlineCode;
}

function hasMinimumPlanContent(plan: SimbriefLatestOfpPlanSummary): boolean {
  return Boolean(
    plan.departureIcao &&
      plan.arrivalIcao &&
      (plan.callsign || plan.flightNumber || plan.route),
  );
}

function formatFetchError(error: unknown): string {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "SimBrief request timed out.";
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unexpected SimBrief request failure.";
}

function readInteger(root: unknown, paths: string[][]): number | null {
  const value = readFirstString(root, paths);

  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function readCoordinate(root: unknown, paths: string[][]): number | null {
  for (const path of paths) {
    const value = readPath(root, path);
    const parsed = parseCoordinateValue(value);

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function readFirstString(root: unknown, paths: string[][]): string | null {
  for (const path of paths) {
    const value = readString(root, path);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function readString(root: unknown, path: string[]): string | null {
  const value = readPath(root, path);

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function readPath(root: unknown, path: string[]): unknown {
  let currentValue: unknown = root;

  for (const segment of path) {
    if (!isJsonRecord(currentValue)) {
      return undefined;
    }

    currentValue = currentValue[segment];
  }

  return currentValue;
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function parseCoordinateValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    return null;
  }

  const decimalValue = Number(normalizedValue.replace(",", "."));

  if (Number.isFinite(decimalValue)) {
    return decimalValue;
  }

  const dmsMatch = normalizedValue
    .toUpperCase()
    .match(
      /^([NSEW])?\s*(\d{1,3})[^\d]+(\d{1,2}(?:\.\d+)?)(?:[^\d]+(\d{1,2}(?:\.\d+)?))?\s*([NSEW])?$/,
    );

  if (!dmsMatch) {
    return null;
  }

  const [, leadingDirection, degreesLiteral, minutesLiteral, secondsLiteral, trailingDirection] =
    dmsMatch;
  const direction = trailingDirection ?? leadingDirection ?? null;
  const degrees = Number.parseFloat(degreesLiteral ?? "");
  const minutes = Number.parseFloat(minutesLiteral ?? "");
  const seconds = Number.parseFloat(secondsLiteral ?? "0");

  if (
    !Number.isFinite(degrees) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds)
  ) {
    return null;
  }

  const absoluteValue = degrees + minutes / 60 + seconds / 3600;

  if (direction === "S" || direction === "W") {
    return -absoluteValue;
  }

  return absoluteValue;
}
