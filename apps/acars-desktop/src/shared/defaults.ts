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
