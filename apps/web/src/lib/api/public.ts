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

export async function getAcarsLiveTraffic(): Promise<LiveMapAircraft[]> {
  return apiRequest<LiveMapAircraft[]>("/acars/live", {
    cache: "no-store",
  });
}
