import { apiRequest } from "./client";
import type {
  AircraftResponse,
  HubResponse,
  LiveMapAircraft,
  PublicHomeResponse,
  RouteDetailResponse,
  PublicStatsResponse,
  RouteResponse,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeLiveMapTraffic(payload: unknown): LiveMapAircraft[] {
  const root = isRecord(payload) ? payload : {};

  if (Array.isArray(payload)) {
    return payload as LiveMapAircraft[];
  }

  if ("data" in root && Array.isArray(root.data)) {
    return root.data as LiveMapAircraft[];
  }

  return [];
}

function normalizePublicStats(payload: unknown): PublicStatsResponse {
  const source = isRecord(payload) ? payload : {};

  return {
    activePilots: toNumber(source.activePilots),
    completedFlights: toNumber(source.completedFlights),
    totalFlightHours: toNumber(source.totalFlightHours),
    validatedPireps: toNumber(source.validatedPireps),
  };
}

function normalizePublicHomeResponse(payload: unknown): PublicHomeResponse {
  const root = isRecord(payload) ? payload : {};
  const source =
    "data" in root && isRecord(root.data)
      ? (root.data as Record<string, unknown>)
      : root;

  return {
    stats: normalizePublicStats(source.stats),
    aircraft: toArray<AircraftResponse>(source.aircraft),
    hubs: toArray<HubResponse>(source.hubs),
    routes: toArray<RouteResponse>(source.routes),
  };
}

export async function getPublicHome(): Promise<PublicHomeResponse> {
  const payload = await apiRequest<unknown>("/public/home", {
    cache: "no-store",
  });

  return normalizePublicHomeResponse(payload);
}

export async function getPublicStats(): Promise<PublicStatsResponse> {
  return apiRequest<PublicStatsResponse>("/public/stats", {
    cache: "no-store",
  });
}

export async function getPublicAircraft(): Promise<AircraftResponse[]> {
  return apiRequest<AircraftResponse[]>("/aircraft", {
    cache: "no-store",
  });
}

export async function getPublicHubs(): Promise<HubResponse[]> {
  return apiRequest<HubResponse[]>("/hubs", {
    cache: "no-store",
  });
}

export async function getPublicRoutes(): Promise<RouteResponse[]> {
  return apiRequest<RouteResponse[]>("/routes", {
    cache: "no-store",
  });
}

export async function getPublicRouteDetails(
  code: string,
): Promise<RouteDetailResponse> {
  return apiRequest<RouteDetailResponse>(`/routes/${encodeURIComponent(code)}`, {
    cache: "no-store",
  });
}

export async function getPublicRouteCatalog(): Promise<RouteDetailResponse[]> {
  const routes = await getPublicRoutes();
  const activeRoutes = routes.filter((route) => route.isActive);

  return Promise.all(
    activeRoutes.map((route) => getPublicRouteDetails(route.code)),
  );
}

export async function getBackendAcarsLiveTraffic(): Promise<LiveMapAircraft[]> {
  const payload = await apiRequest<unknown>("/acars/live", {
    cache: "no-store",
  });

  return normalizeLiveMapTraffic(payload);
}

export async function getAcarsLiveTraffic(): Promise<LiveMapAircraft[]> {
  if (typeof window === "undefined") {
    return getBackendAcarsLiveTraffic();
  }

  const response = await fetch("/api/public/acars/live", {
    method: "GET",
    cache: "no-store",
  });

  const responseText = await response.text();
  const responsePayload =
    responseText.length > 0 ? tryParseJson(responseText) : undefined;

  if (!response.ok) {
    throw new Error(
      typeof responsePayload === "object" &&
        responsePayload !== null &&
        "message" in responsePayload &&
        typeof responsePayload.message === "string"
        ? responsePayload.message
        : "Le flux ACARS live n'a pas pu être chargé.",
    );
  }

  return normalizeLiveMapTraffic(responsePayload);
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}
