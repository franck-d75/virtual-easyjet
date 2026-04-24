import type { DesktopConfig, TelemetryInput } from "./types.js";

export const DEFAULT_DESKTOP_CONFIG: DesktopConfig = {
  apiBaseUrl: "http://localhost:3001/api",
  acarsBaseUrl: "http://localhost:3002/acars",
  clientVersion: "0.1.0-desktop-mvp",
  simulatorProvider: "MSFS_MOCK",
  backendMode: "mock",
  telemetryMode: "mock",
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
