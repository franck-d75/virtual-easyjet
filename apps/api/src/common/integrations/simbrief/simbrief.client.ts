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
  simbriefAirframeId: string | null;
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
  distanceNm: number | null;
  cruiseAltitudeFt: number | null;
  estimatedTimeEnroute: string | null;
  blockTimeMinutes: number | null;
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

export interface SimbriefAirframeSummary {
  simbriefAirframeId: string;
  name: string;
  aircraftIcao: string;
  registration: string | null;
  selcal: string | null;
  equipment: string | null;
  engineType: string | null;
  wakeCategory: string | null;
  rawJson: unknown;
}

export interface SimbriefAirframesResult {
  status: SimbriefLatestOfpStatus;
  pilotId: string | null;
  detail: string | null;
  fetchStatus: string | null;
  fetchedAt: string;
  source: SimbriefFlightPlanLookup | null;
  airframes: SimbriefAirframeSummary[];
}

type SimbriefHttpResult = {
  ok: boolean;
  statusCode: number;
  fetchStatus: string | null;
  payload: unknown;
  detail: string | null;
};

type SimbriefPayloadResult = SimbriefHttpResult & {
  source: SimbriefFlightPlanLookup;
  fetchedAt: string;
  pilotId: string;
};

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
      const response = await this.fetchSimbriefJson(source.latestOfpJsonUrl);

      if (!response.ok) {
        return {
          status: response.statusCode === 400 ? "NOT_FOUND" : "ERROR",
          pilotId: normalizedPilotId,
          detail: response.detail,
          fetchStatus: response.fetchStatus,
          fetchedAt,
          source,
          plan: null,
        };
      }

      const plan = this.normalizeLatestOfp(response.payload);

      if (!plan) {
        console.warn("[api][simbrief] latest OFP payload could not be mapped", {
          pilotId: normalizedPilotId,
          source: source.latestOfpJsonUrl,
        });

        return {
          status: "ERROR",
          pilotId: normalizedPilotId,
          detail: "SimBrief returned an unsupported OFP payload.",
          fetchStatus: response.fetchStatus ?? "Success",
          fetchedAt,
          source,
          plan: null,
        };
      }

      return {
        status: "AVAILABLE",
        pilotId: normalizedPilotId,
        detail: null,
        fetchStatus: response.fetchStatus ?? "Success",
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

  public async getAirframes(
    pilotId: string | null | undefined,
  ): Promise<SimbriefAirframesResult> {
    const normalizedPilotId = pilotId?.trim() ?? "";
    const fetchedAt = new Date().toISOString();

    if (normalizedPilotId.length === 0) {
      return {
        status: "NOT_CONFIGURED",
        pilotId: null,
        detail: "Configurez d'abord un SimBrief Pilot ID dans votre profil.",
        fetchStatus: null,
        fetchedAt,
        source: null,
        airframes: [],
      };
    }

    const source = buildSimbriefFlightPlanLookup(normalizedPilotId);

    return {
      status: "NOT_FOUND",
      pilotId: normalizedPilotId,
      detail:
        "SimBrief ne fournit pas de liste airframes via cet endpoint; utilisez l'ajout manuel.",
      fetchStatus: null,
      fetchedAt,
      source,
      airframes: [],
    };

    try {
      const liveListResult = await this.fetchSimbriefJson(source.airframesJsonUrl);
      const listAirframes = liveListResult.ok
        ? normalizeAirframes(liveListResult.payload)
        : [];

      if (listAirframes.length > 0) {
        return {
          status: "AVAILABLE",
          pilotId: normalizedPilotId,
          detail: null,
          fetchStatus: liveListResult.fetchStatus ?? "Success",
          fetchedAt,
          source,
          airframes: listAirframes,
        };
      }

      const latestOfpPayloadResult = await this.fetchLatestOfpPayload(
        normalizedPilotId,
      );

      const inferredAirframeId = latestOfpPayloadResult.ok
        ? inferLatestOfpAirframeId(latestOfpPayloadResult.payload)
        : null;

      if (inferredAirframeId) {
        const detailedAirframeResult = await this.fetchSimbriefJson(
          source.airframeJsonUrl(inferredAirframeId!),
        );

        const detailedAirframes = detailedAirframeResult.ok
          ? normalizeAirframes(detailedAirframeResult.payload, inferredAirframeId!)
          : [];

        if (detailedAirframes.length > 0) {
          return {
            status: "AVAILABLE",
            pilotId: normalizedPilotId,
            detail:
              "Airframe SimBrief identifiée à partir du dernier OFP disponible.",
            fetchStatus:
              detailedAirframeResult.fetchStatus ??
              latestOfpPayloadResult.fetchStatus ??
              "Success",
            fetchedAt,
            source,
            airframes: detailedAirframes,
          };
        }

        const fallbackAirframes = buildFallbackAirframesFromLatestOfp(
          latestOfpPayloadResult.payload,
          inferredAirframeId!,
        );

        if (fallbackAirframes.length > 0) {
          return {
            status: "AVAILABLE",
            pilotId: normalizedPilotId,
            detail:
              "Airframe SimBrief préparée à partir du dernier OFP disponible.",
            fetchStatus:
              latestOfpPayloadResult.fetchStatus ??
              detailedAirframeResult.fetchStatus ??
              "Success",
            fetchedAt,
            source,
            airframes: fallbackAirframes,
          };
        }
      }

      const detail =
        latestOfpPayloadResult.detail ??
        liveListResult.detail ??
        "Aucune airframe SimBrief exploitable n'a été trouvée pour ce pilote.";

      return {
        status:
          latestOfpPayloadResult.ok || liveListResult.ok ? "NOT_FOUND" : "ERROR",
        pilotId: normalizedPilotId,
        detail,
        fetchStatus:
          liveListResult.fetchStatus ?? latestOfpPayloadResult.fetchStatus ?? null,
        fetchedAt,
        source,
        airframes: [],
      };
    } catch (error) {
      const detail = formatFetchError(error);

      console.warn("[api][simbrief] airframes fetch failed", {
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
        airframes: [],
      };
    }
  }

  public inferAircraftTypeCode(
    value: string | null | undefined,
  ): string | null {
    const normalizedValue = normalizeAircraftIcao(value);

    if (!normalizedValue) {
      return null;
    }

    switch (normalizedValue) {
      case "A319":
      case "A320":
      case "A20N":
      case "A21N":
        return normalizedValue;
      default:
        return null;
    }
  }

  private async fetchLatestOfpPayload(
    pilotId: string,
  ): Promise<SimbriefPayloadResult> {
    const source = buildSimbriefFlightPlanLookup(pilotId);
    const fetchedAt = new Date().toISOString();
    const result = await this.fetchSimbriefJson(source.latestOfpJsonUrl);

    return {
      ...result,
      source,
      fetchedAt,
      pilotId,
    };
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
      distanceNm: readRoundedNumber(payload, [
        ["general", "route_distance"],
        ["general", "distance"],
        ["general", "air_distance"],
        ["navlog", "distance"],
      ]),
      cruiseAltitudeFt: readInteger(payload, [
        ["general", "initial_altitude"],
        ["api_params", "fl"],
      ]),
      estimatedTimeEnroute: readFirstString(payload, [
        ["times", "est_time_enroute"],
        ["times", "sched_time_enroute"],
      ]),
      blockTimeMinutes: readDurationMinutes(payload, [
        ["times", "est_block"],
        ["times", "sched_block"],
        ["times", "est_time_block"],
        ["times", "sched_time_block"],
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

  private async fetchSimbriefJson(url: string): Promise<SimbriefHttpResult> {
    const response = (await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": SIMBRIEF_USER_AGENT,
      },
      signal: AbortSignal.timeout(SIMBRIEF_FETCH_TIMEOUT_MS),
    })) as globalThis.Response;

    const rawPayload = await response.text();
    const payload = tryParseJson(rawPayload);
    const fetchStatus = readString(payload, ["fetch", "status"]);

    if (!response.ok) {
      return {
        ok: false,
        statusCode: response.status,
        fetchStatus,
        payload,
        detail:
          fetchStatus ?? `SimBrief returned HTTP ${String(response.status)}.`,
      };
    }

    return {
      ok: true,
      statusCode: response.status,
      fetchStatus,
      payload,
      detail: null,
    };
  }
}

function buildAircraftSummary(
  payload: unknown,
): SimbriefLatestOfpAircraftSummary | null {
  const icaoCode = normalizeAircraftIcao(
    readFirstString(payload, [
      ["aircraft", "icao_code"],
      ["aircraft", "icaocode"],
      ["api_params", "type"],
    ]),
  );
  const rawAirframeId = readFirstString(payload, [
    ["aircraft", "airframe_id"],
    ["aircraft", "internal_id"],
    ["api_params", "airframe"],
    ["api_params", "type"],
  ]);

  const aircraft: SimbriefLatestOfpAircraftSummary = {
    icaoCode,
    name: readString(payload, ["aircraft", "name"]),
    registration: readFirstString(payload, [
      ["aircraft", "reg"],
      ["api_params", "reg"],
    ]),
    simbriefAirframeId: inferSimbriefAirframeId(rawAirframeId, icaoCode),
  };

  return Object.values(aircraft).some((value) => value !== null)
    ? aircraft
    : null;
}

function normalizeAirframes(
  payload: unknown,
  fallbackAirframeId?: string | null,
): SimbriefAirframeSummary[] {
  const seenIds = new Set<string>();
  const airframes: SimbriefAirframeSummary[] = [];

  for (const candidate of collectAirframeCandidates(payload)) {
    const normalizedAirframe = normalizeAirframeCandidate(
      candidate,
      fallbackAirframeId ?? null,
    );

    if (!normalizedAirframe || seenIds.has(normalizedAirframe.simbriefAirframeId)) {
      continue;
    }

    seenIds.add(normalizedAirframe.simbriefAirframeId);
    airframes.push(normalizedAirframe);
  }

  return airframes;
}

function buildFallbackAirframesFromLatestOfp(
  payload: unknown,
  fallbackAirframeId: string,
): SimbriefAirframeSummary[] {
  const aircraft = buildAircraftSummary(payload);

  if (!aircraft?.icaoCode) {
    return [];
  }

  const name =
    aircraft.name ??
    [aircraft.icaoCode, aircraft.registration].filter(Boolean).join(" ");

  return [
    {
      simbriefAirframeId: fallbackAirframeId,
      name: name || aircraft.icaoCode,
      aircraftIcao: aircraft.icaoCode,
      registration: aircraft.registration,
      selcal: readFirstString(payload, [["aircraft", "selcal"]]),
      equipment: readFirstString(payload, [
        ["aircraft", "equipment"],
        ["aircraft", "equip"],
      ]),
      engineType: readFirstString(payload, [
        ["aircraft", "engine_type"],
        ["aircraft", "engines"],
      ]),
      wakeCategory: readFirstString(payload, [
        ["aircraft", "wake_category"],
        ["aircraft", "wtc"],
      ]),
      rawJson: payload,
    },
  ];
}

function inferLatestOfpAirframeId(payload: unknown): string | null {
  const aircraft = buildAircraftSummary(payload);
  return aircraft?.simbriefAirframeId ?? null;
}

function collectAirframeCandidates(
  value: unknown,
  depth = 0,
  candidates: JsonRecord[] = [],
): JsonRecord[] {
  if (depth > 5) {
    return candidates;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectAirframeCandidates(item, depth + 1, candidates);
    }

    return candidates;
  }

  if (!isJsonRecord(value)) {
    return candidates;
  }

  if (looksLikeAirframeCandidate(value)) {
    candidates.push(value);
  }

  for (const nestedValue of Object.values(value)) {
    collectAirframeCandidates(nestedValue, depth + 1, candidates);
  }

  return candidates;
}

function looksLikeAirframeCandidate(value: JsonRecord): boolean {
  const keys = new Set(Object.keys(value));

  if (
    keys.has("airframe_id") ||
    keys.has("internal_id") ||
    keys.has("registration") ||
    keys.has("reg")
  ) {
    return true;
  }

  return (
    (keys.has("aircraft_icao") || keys.has("icao") || keys.has("icao_code")) &&
    (keys.has("name") || keys.has("aircraft_name") || keys.has("label"))
  );
}

function normalizeAirframeCandidate(
  candidate: JsonRecord,
  fallbackAirframeId: string | null,
): SimbriefAirframeSummary | null {
  const aircraftIcao = normalizeAircraftIcao(
    readFirstString(candidate, [
      ["aircraft_icao"],
      ["icao"],
      ["icao_code"],
      ["aircraft"],
      ["type"],
    ]),
  );

  const simbriefAirframeId =
    readFirstString(candidate, [
      ["airframe_id"],
      ["internal_id"],
      ["id"],
      ["airframe"],
    ]) ?? fallbackAirframeId;

  if (!simbriefAirframeId || !aircraftIcao) {
    return null;
  }

  const registration = readFirstString(candidate, [
    ["registration"],
    ["reg"],
    ["tail"],
    ["tail_number"],
  ]);
  const name =
    readFirstString(candidate, [
      ["name"],
      ["airframe_name"],
      ["label"],
      ["aircraft_name"],
      ["profile"],
    ]) ??
    [aircraftIcao, registration].filter(Boolean).join(" ");

  return {
    simbriefAirframeId,
    name: name || aircraftIcao,
    aircraftIcao,
    registration,
    selcal: readFirstString(candidate, [["selcal"]]),
    equipment: readFirstString(candidate, [
      ["equipment"],
      ["equip"],
      ["equipment_code"],
    ]),
    engineType: readFirstString(candidate, [
      ["engine_type"],
      ["engine"],
      ["engines"],
    ]),
    wakeCategory: readFirstString(candidate, [
      ["wake_category"],
      ["wake"],
      ["wtc"],
    ]),
    rawJson: candidate,
  };
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

function inferSimbriefAirframeId(
  value: string | null,
  aircraftIcao: string | null,
): string | null {
  const normalizedValue = value?.trim() ?? "";

  if (normalizedValue.length === 0) {
    return null;
  }

  const normalizedAircraftIcao = normalizeAircraftIcao(aircraftIcao);

  if (
    normalizedAircraftIcao &&
    normalizedValue.toUpperCase() === normalizedAircraftIcao
  ) {
    return null;
  }

  if (/^[A-Z0-9]{3,5}$/i.test(normalizedValue)) {
    return null;
  }

  return normalizedValue;
}

function normalizeAircraftIcao(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalizedValue.length > 0 ? normalizedValue : null;
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

function readRoundedNumber(root: unknown, paths: string[][]): number | null {
  for (const path of paths) {
    const value = readPath(root, path);
    const parsed = parseNumericValue(value);

    if (parsed !== null) {
      return Math.round(parsed);
    }
  }

  return null;
}

function readDurationMinutes(root: unknown, paths: string[][]): number | null {
  for (const path of paths) {
    const value = readPath(root, path);
    const parsed = parseDurationMinutes(value);

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
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

  if (!isScalar(value)) {
    return null;
  }

  const normalizedValue = String(value).trim();
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

function isScalar(value: unknown): value is string | number | boolean {
  const valueType = typeof value;
  return (
    valueType === "string" || valueType === "number" || valueType === "boolean"
  );
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

  const [
    ,
    leadingDirection,
    degreesLiteral,
    minutesLiteral,
    secondsLiteral,
    trailingDirection,
  ] = dmsMatch;
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

function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().replace(",", ".");

  if (normalizedValue.length === 0) {
    return null;
  }

  const parsed = Number(normalizedValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDurationMinutes(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 0 ? Math.round(value) : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    return null;
  }

  if (/^\d{1,2}:\d{2}$/.test(normalizedValue)) {
    const [hoursLiteral, minutesLiteral] = normalizedValue.split(":");
    const hours = Number.parseInt(hoursLiteral ?? "", 10);
    const minutes = Number.parseInt(minutesLiteral ?? "", 10);

    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      return hours * 60 + minutes;
    }
  }

  const compactMatch = normalizedValue.match(/^(\d{1,2})(\d{2})$/);

  if (compactMatch) {
    const hours = Number.parseInt(compactMatch[1] ?? "", 10);
    const minutes = Number.parseInt(compactMatch[2] ?? "", 10);

    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      return hours * 60 + minutes;
    }
  }

  const numericValue = parseNumericValue(normalizedValue);
  return numericValue !== null ? Math.round(numericValue) : null;
}
