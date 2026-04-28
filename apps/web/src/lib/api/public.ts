import { apiRequest } from "./client";
import { getApiBaseUrl } from "../config/env";
import type {
  AircraftResponse,
  HubResponse,
  LiveMapAircraft,
  PublicHomeResponse,
  RankResponse,
  RulesContentResponse,
  RouteDetailResponse,
  PublicStatsResponse,
  RouteResponse,
} from "./types";
import { logWebWarning } from "../observability/log";

const EMPTY_PUBLIC_STATS: PublicStatsResponse = {
  activePilots: 0,
  completedFlights: 0,
  totalFlightHours: 0,
  validatedPireps: 0,
};

const EMPTY_PUBLIC_HOME: PublicHomeResponse = {
  stats: EMPTY_PUBLIC_STATS,
  aircraft: [],
  hubs: [],
  routes: [],
};

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

function getApiRootBaseUrl(): string {
  return getApiBaseUrl().replace(/\/api$/iu, "");
}

async function fetchLiveMapTrafficFromAbsoluteUrl(
  url: string,
  source: string,
): Promise<LiveMapAircraft[] | null> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, 8_000);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      next: { revalidate: 0 },
      signal: abortController.signal,
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
          : `Live traffic request failed for ${source}.`,
      );
    }

    const normalizedTraffic = normalizeLiveMapTraffic(responsePayload);
    console.info("[web] live map payload count", {
      source,
      count: normalizedTraffic.length,
    });
    return normalizedTraffic;
  } catch (error) {
    logWebWarning(`live map ${source} failed`, error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
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

function createEmptyRouteDetail(code: string): RouteDetailResponse {
  return {
    id: `missing-${code}`,
    code,
    flightNumber: code,
    distanceNm: null,
    blockTimeMinutes: null,
    isActive: false,
    notes: null,
    departureAirport: {
      id: "missing-departure",
      icao: "-",
      iata: null,
      name: "Aéroport indisponible",
      city: null,
      countryCode: "",
    },
    arrivalAirport: {
      id: "missing-arrival",
      icao: "-",
      iata: null,
      name: "Aéroport indisponible",
      city: null,
      countryCode: "",
    },
    departureHub: null,
    arrivalHub: null,
    aircraftType: null,
    schedules: [],
  };
}

async function safePublicRequest<TResponse>(
  label: string,
  request: () => Promise<TResponse>,
  fallback: TResponse,
): Promise<TResponse> {
  try {
    return await request();
  } catch (error) {
    logWebWarning(`${label} failed`, error);
    return fallback;
  }
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
  const payload = await safePublicRequest("public home", () =>
    apiRequest<unknown>("/public/home", {
      cache: "no-store",
      next: { revalidate: 0 },
      retryCount: 1,
      timeoutMs: 8_000,
    }),
  undefined);

  if (payload === undefined) {
    return EMPTY_PUBLIC_HOME;
  }

  return normalizePublicHomeResponse(payload);
}

export async function getPublicStats(): Promise<PublicStatsResponse> {
  return safePublicRequest("public stats", () =>
    apiRequest<PublicStatsResponse>("/public/stats", {
      cache: "no-store",
      next: { revalidate: 0 },
      retryCount: 1,
      timeoutMs: 8_000,
    }),
  EMPTY_PUBLIC_STATS);
}

export async function getPublicRules(): Promise<RulesContentResponse> {
  return safePublicRequest("public rules", () =>
    apiRequest<RulesContentResponse>("/public/rules", {
      cache: "no-store",
      next: { revalidate: 0 },
      retryCount: 1,
      timeoutMs: 8_000,
    }),
  {
    sections: [],
    updatedAt: null,
    updatedBy: null,
  });
}

export async function getPublicRanks(): Promise<RankResponse[]> {
  return safePublicRequest("public ranks", () =>
    apiRequest<RankResponse[]>("/ranks", {
      cache: "no-store",
      next: { revalidate: 0 },
      retryCount: 1,
      timeoutMs: 8_000,
    }),
  []);
}

export async function getPublicAircraft(): Promise<AircraftResponse[]> {
  return safePublicRequest("public aircraft", () =>
    apiRequest<AircraftResponse[]>("/aircraft", {
      cache: "no-store",
      next: { revalidate: 0 },
      retryCount: 1,
      timeoutMs: 8_000,
    }),
  []);
}

export async function getPublicHubs(): Promise<HubResponse[]> {
  return safePublicRequest("public hubs", () =>
    apiRequest<HubResponse[]>("/hubs", {
      cache: "no-store",
      next: { revalidate: 0 },
      retryCount: 1,
      timeoutMs: 8_000,
    }),
  []);
}

export async function getPublicRoutes(): Promise<RouteResponse[]> {
  return safePublicRequest("public routes", () =>
    apiRequest<RouteResponse[]>("/routes", {
      cache: "no-store",
      next: { revalidate: 0 },
      retryCount: 1,
      timeoutMs: 8_000,
    }),
  []);
}

export async function getPublicRouteDetails(
  code: string,
): Promise<RouteDetailResponse> {
  return safePublicRequest(
    `public route details (${code})`,
    () =>
      apiRequest<RouteDetailResponse>(`/routes/${encodeURIComponent(code)}`, {
        cache: "no-store",
        next: { revalidate: 0 },
        retryCount: 1,
        timeoutMs: 8_000,
      }),
    createEmptyRouteDetail(code),
  );
}

export async function getPublicRouteCatalog(): Promise<RouteDetailResponse[]> {
  const routes = await getPublicRoutes();
  const activeRoutes = routes.filter((route) => route.isActive);

  if (activeRoutes.length === 0) {
    return [];
  }

  const routeResults = await Promise.allSettled(
    activeRoutes.map((route) => getPublicRouteDetails(route.code)),
  );

  return routeResults.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
}

export async function getBackendAcarsLiveTraffic(): Promise<LiveMapAircraft[]> {
  const apiTraffic = await fetchLiveMapTrafficFromAbsoluteUrl(
    `${getApiRootBaseUrl()}/acars/live`,
    "api-root-acars",
  );

  return apiTraffic ?? [];
}

export async function getAcarsLiveTraffic(): Promise<LiveMapAircraft[]> {
  if (typeof window === "undefined") {
    return getBackendAcarsLiveTraffic();
  }

  const response = await fetch("/api/public/acars/live", {
    method: "GET",
    cache: "no-store",
    next: { revalidate: 0 },
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
