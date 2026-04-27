import type { DesktopConfig, TelemetryInput } from "./types.js";

export const DEFAULT_DESKTOP_CONFIG: DesktopConfig = {
  apiBaseUrl: "https://api.virtual-easyjet.fr/api",
  acarsBaseUrl: "https://api.virtual-easyjet.fr/acars",
  clientVersion: "0.2.0",
  simulatorProvider: "MSFS2024_FSUIPC7",
  backendMode: "live",
  telemetryMode: "fsuipc",
  telemetryFallbackMode: "simconnect",
};

export const DEFAULT_MANUAL_TELEMETRY: TelemetryInput = {
  latitude: 49.0097,
  longitude: 2.5479,
  altitudeFt: 0,
  groundspeedKts: 0,
  headingDeg: 270,
  verticalSpeedFpm: 0,
  onGround: true,
  fuelTotalKg: 6200,
  gearPercent: 100,
  flapsPercent: 0,
  parkingBrake: true,
};

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function normalizeAcarsBaseUrl(
  value: string,
  apiBaseUrl?: string,
): string {
  const normalizedValue = normalizeBaseUrl(value);
  const normalizedApiBaseUrl = apiBaseUrl ? normalizeBaseUrl(apiBaseUrl) : "";
  const fallbackBaseUrl =
    normalizedApiBaseUrl.length > 0
      ? `${normalizedApiBaseUrl}/acars`
      : DEFAULT_DESKTOP_CONFIG.acarsBaseUrl;
  const candidateBaseUrl =
    normalizedValue.length > 0 ? normalizedValue : fallbackBaseUrl;

  if (
    /\/api\/acars$/iu.test(candidateBaseUrl) ||
    /\/acars$/iu.test(candidateBaseUrl)
  ) {
    return candidateBaseUrl;
  }

  if (/\/api$/iu.test(candidateBaseUrl)) {
    return `${candidateBaseUrl}/acars`;
  }

  return `${candidateBaseUrl}/acars`;
}

export function buildRequestUrl(baseUrl: string, path: string): string {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  let normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (/\/api\/acars$/iu.test(normalizedBaseUrl)) {
    normalizedPath = normalizedPath.replace(/^\/api\/acars(?=\/|$)/iu, "");
  }

  if (/\/acars$/iu.test(normalizedBaseUrl)) {
    normalizedPath = normalizedPath.replace(/^\/acars(?=\/|$)/iu, "");
  }

  if (normalizedPath.length === 0) {
    normalizedPath = "/";
  }

  return `${normalizedBaseUrl}${normalizedPath}`;
}
