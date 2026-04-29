import type { SimbriefLatestOfpPlanSummary } from "./simbrief.client.js";

export const PRIVATE_SIMBRIEF_ROUTE_OVERLAY_SETTING_KEY_PREFIX =
  "private_simbrief_route_overlay";

export type SimbriefRouteOverlayMode = "DIRECT" | "WAYPOINTS";

export interface SimbriefRouteOverlayPoint {
  ident: string | null;
  lat: number;
  lon: number;
  source: "ORIGIN" | "NAVLOG" | "DESTINATION";
}

export interface PersistedSimbriefRouteOverlay {
  routeId: string;
  callsign: string | null;
  flightNumber: string | null;
  departureIcao: string;
  arrivalIcao: string;
  route: string | null;
  mode: SimbriefRouteOverlayMode;
  points: SimbriefRouteOverlayPoint[];
  importedAt: string;
}

export interface SimbriefRouteOverlayResponse {
  routeId: string | null;
  callsign: string | null;
  flightNumber: string | null;
  departureIcao: string;
  arrivalIcao: string;
  route: string | null;
  mode: SimbriefRouteOverlayMode;
  points: SimbriefRouteOverlayPoint[];
}

type BuildOverlayPlan = Pick<
  SimbriefLatestOfpPlanSummary,
  | "callsign"
  | "flightNumber"
  | "departureIcao"
  | "arrivalIcao"
  | "route"
  | "routePoints"
>;

export function buildSimbriefRouteOverlaySettingKey(routeId: string) {
  return `${PRIVATE_SIMBRIEF_ROUTE_OVERLAY_SETTING_KEY_PREFIX}:${routeId}`;
}

export function buildSimbriefRouteOverlayFromPlan(
  routeId: string | null,
  plan: BuildOverlayPlan | null | undefined,
): SimbriefRouteOverlayResponse | null {
  if (!plan?.departureIcao || !plan.arrivalIcao) {
    return null;
  }

  const points = dedupeOverlayPoints(
    plan.routePoints.filter(
      (point): point is SimbriefRouteOverlayPoint =>
        Number.isFinite(point.lat) && Number.isFinite(point.lon),
    ),
  );

  if (points.length < 2) {
    return null;
  }

  return {
    routeId,
    callsign: plan.callsign,
    flightNumber: plan.flightNumber,
    departureIcao: plan.departureIcao,
    arrivalIcao: plan.arrivalIcao,
    route: plan.route,
    mode: points.some((point) => point.source === "NAVLOG")
      ? "WAYPOINTS"
      : "DIRECT",
    points,
  };
}

export function persistableSimbriefRouteOverlay(
  routeId: string,
  plan: BuildOverlayPlan | null | undefined,
): PersistedSimbriefRouteOverlay | null {
  const overlay = buildSimbriefRouteOverlayFromPlan(routeId, plan);

  if (!overlay) {
    return null;
  }

  return {
    ...overlay,
    routeId,
    importedAt: new Date().toISOString(),
  };
}

export function normalizePersistedSimbriefRouteOverlay(
  rawValue: unknown,
): PersistedSimbriefRouteOverlay | null {
  if (!isJsonRecord(rawValue)) {
    return null;
  }

  const routeId = normalizeRequiredString(rawValue.routeId);
  const departureIcao = normalizeRequiredString(rawValue.departureIcao);
  const arrivalIcao = normalizeRequiredString(rawValue.arrivalIcao);
  const mode = rawValue.mode === "WAYPOINTS" ? "WAYPOINTS" : rawValue.mode === "DIRECT" ? "DIRECT" : null;
  const importedAt = normalizeRequiredString(rawValue.importedAt);
  const points = normalizeRouteOverlayPoints(rawValue.points);

  if (!routeId || !departureIcao || !arrivalIcao || !mode || !importedAt || points.length < 2) {
    return null;
  }

  return {
    routeId,
    callsign: normalizeOptionalString(rawValue.callsign),
    flightNumber: normalizeOptionalString(rawValue.flightNumber),
    departureIcao,
    arrivalIcao,
    route: normalizeOptionalString(rawValue.route),
    mode,
    points,
    importedAt,
  };
}

export function serializeSimbriefRouteOverlay(
  overlay: PersistedSimbriefRouteOverlay,
): SimbriefRouteOverlayResponse {
  return {
    routeId: overlay.routeId,
    callsign: overlay.callsign,
    flightNumber: overlay.flightNumber,
    departureIcao: overlay.departureIcao,
    arrivalIcao: overlay.arrivalIcao,
    route: overlay.route,
    mode: overlay.mode,
    points: overlay.points,
  };
}

function normalizeRouteOverlayPoints(
  rawValue: unknown,
): SimbriefRouteOverlayPoint[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue.flatMap((point) => {
    if (!isJsonRecord(point)) {
      return [];
    }

    const lat = typeof point.lat === "number" ? point.lat : Number.NaN;
    const lon = typeof point.lon === "number" ? point.lon : Number.NaN;
    const source =
      point.source === "NAVLOG" || point.source === "DESTINATION"
        ? point.source
        : point.source === "ORIGIN"
          ? "ORIGIN"
          : null;

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !source) {
      return [];
    }

    return [
      {
        ident: normalizeOptionalString(point.ident),
        lat,
        lon,
        source,
      },
    ];
  });
}

function dedupeOverlayPoints(
  points: SimbriefRouteOverlayPoint[],
): SimbriefRouteOverlayPoint[] {
  return points.filter((point, index) => {
    const previousPoint = points[index - 1];

    if (!previousPoint) {
      return true;
    }

    return (
      Math.abs(previousPoint.lat - point.lat) >= 0.0001 ||
      Math.abs(previousPoint.lon - point.lon) >= 0.0001
    );
  });
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeRequiredString(value: unknown): string | null {
  return normalizeOptionalString(value);
}
