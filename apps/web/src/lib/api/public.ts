import { apiRequest } from "./client";
import type {
  AircraftResponse,
  HubResponse,
  LiveMapAircraft,
  RouteDetailResponse,
  PublicStatsResponse,
  RouteResponse,
} from "./types";

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
