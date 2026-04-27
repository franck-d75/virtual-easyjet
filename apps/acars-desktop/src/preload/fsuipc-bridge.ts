import { createRequire } from "node:module";

import type { DesktopConfig, SimulatorSnapshot, TelemetryInput } from "../shared/types.js";

const require = createRequire(import.meta.url);

type FsuipcModule = typeof import("fsuipc");
type FsuipcClient = InstanceType<FsuipcModule["FSUIPC"]>;

const CONNECT_RETRY_INTERVAL_MS = 5_000;
const FEET_PER_METER = 3.280839895;
const KNOTS_PER_MPS = 1.943844492;
const FEET_PER_MINUTE_PER_MPS = 196.8503937;
const RADIANS_TO_DEGREES = 180 / Math.PI;

const DEFAULT_SIMULATOR_SNAPSHOT: SimulatorSnapshot = {
  status: "UNAVAILABLE",
  telemetryMode: "fsuipc",
  dataSource: "none",
  message: "FSUIPC7 n'est pas detecte pour le moment. Lancez FSUIPC7 avant ACARS.",
  connected: false,
  aircraftDetected: false,
  aircraft: null,
  lastSampleAt: null,
  telemetry: null,
  indicatedAirspeedKts: null,
  error: null,
};

function readNumber(payload: Record<string, unknown>, key: string): number | null {
  const rawValue = payload[key];

  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === "bigint") {
    return Number(rawValue);
  }

  if (typeof rawValue === "string" && rawValue.trim().length > 0) {
    const parsedValue = Number(rawValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

function readString(payload: Record<string, unknown>, key: string): string | null {
  const rawValue = payload[key];

  if (typeof rawValue !== "string") {
    return null;
  }

  const normalizedValue = rawValue.replace(/\0+/gu, "").trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function roundInteger(value: number | null): number | null {
  return typeof value === "number" ? Math.round(value) : null;
}

function normalizeHeadingDegrees(radians: number | null): number | null {
  if (typeof radians !== "number" || !Number.isFinite(radians)) {
    return null;
  }

  const degrees = (radians * RADIANS_TO_DEGREES) % 360;
  const normalizedDegrees = degrees < 0 ? degrees + 360 : degrees;

  return Math.round(normalizedDegrees);
}

function buildTelemetrySample(payload: Record<string, unknown>): {
  telemetry: TelemetryInput | null;
  indicatedAirspeedKts: number | null;
} {
  const latitude = readNumber(payload, "latitudeDeg");
  const longitude = readNumber(payload, "longitudeDeg");
  const altitudeMeters = readNumber(payload, "altitudeMeters");
  const groundspeedMps = readNumber(payload, "groundspeedMps");
  const headingRadians = readNumber(payload, "headingRadians");
  const verticalSpeedRaw = readNumber(payload, "verticalSpeedRaw");
  const onGroundFlag = readNumber(payload, "onGroundFlag");
  const indicatedAirspeedRaw = readNumber(payload, "indicatedAirspeedRaw");

  const altitudeFt = roundInteger(
    typeof altitudeMeters === "number" ? altitudeMeters * FEET_PER_METER : null,
  );
  const groundspeedKts = roundInteger(
    typeof groundspeedMps === "number" ? groundspeedMps * KNOTS_PER_MPS : null,
  );
  const headingDeg = normalizeHeadingDegrees(headingRadians);
  const verticalSpeedFpm = roundInteger(
    typeof verticalSpeedRaw === "number"
      ? (verticalSpeedRaw / 256) * FEET_PER_MINUTE_PER_MPS
      : null,
  );
  const indicatedAirspeedKts = roundInteger(
    typeof indicatedAirspeedRaw === "number"
      ? indicatedAirspeedRaw / 128
      : null,
  );
  const onGround =
    typeof onGroundFlag === "number" ? onGroundFlag >= 1 : null;

  if (
    latitude === null ||
    longitude === null ||
    altitudeFt === null ||
    groundspeedKts === null ||
    headingDeg === null ||
    verticalSpeedFpm === null ||
    onGround === null
  ) {
    return {
      telemetry: null,
      indicatedAirspeedKts,
    };
  }

  return {
    telemetry: {
      capturedAt: new Date().toISOString(),
      latitude,
      longitude,
      altitudeFt,
      groundspeedKts,
      headingDeg,
      verticalSpeedFpm,
      onGround,
    },
    indicatedAirspeedKts,
  };
}

export class FsuipcBridge {
  private client: FsuipcClient | null = null;
  private connectPromise: Promise<void> | null = null;
  private lastConnectAttemptAt = 0;
  private snapshot: SimulatorSnapshot = structuredClone(DEFAULT_SIMULATOR_SNAPSHOT);

  public constructor(
    private readonly getConfig: () => DesktopConfig,
    private readonly log: (message: string, details?: Record<string, unknown>) => void,
  ) {}

  public getSnapshot(): SimulatorSnapshot {
    return structuredClone({
      ...this.snapshot,
      telemetryMode: this.getConfig().telemetryMode,
    });
  }

  public async connect(): Promise<SimulatorSnapshot> {
    if (this.client) {
      return this.getSnapshot();
    }

    if (this.connectPromise) {
      await this.connectPromise;
      return this.getSnapshot();
    }

    if (
      Date.now() - this.lastConnectAttemptAt < CONNECT_RETRY_INTERVAL_MS &&
      this.snapshot.status === "UNAVAILABLE"
    ) {
      return this.getSnapshot();
    }

    this.lastConnectAttemptAt = Date.now();
    this.snapshot = {
      ...this.snapshot,
      status: "CONNECTING",
      telemetryMode: this.getConfig().telemetryMode,
      dataSource: "none",
      message: "Connexion a FSUIPC7 en cours...",
      connected: false,
      aircraftDetected: false,
      error: null,
    };

    this.connectPromise = this.openClient();

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }

    return this.getSnapshot();
  }

  public async sampleTelemetry(): Promise<TelemetryInput | null> {
    await this.connect();

    if (!this.client) {
      return null;
    }

    try {
      const payload = (await this.client.process()) as Record<string, unknown>;
      const { telemetry, indicatedAirspeedKts } = buildTelemetrySample(payload);
      const aircraftTitle = readString(payload, "aircraftTitle");
      const aircraftRegistration = readString(payload, "aircraftRegistration");
      const aircraftType = readString(payload, "aircraftType");
      const aircraftDetected = Boolean(
        aircraftTitle || aircraftRegistration || aircraftType || telemetry,
      );

      this.snapshot = {
        status: aircraftDetected ? "AIRCRAFT_DETECTED" : "CONNECTED",
        telemetryMode: this.getConfig().telemetryMode,
        dataSource: "fsuipc",
        message: aircraftDetected
          ? "FSUIPC7 connecte a MSFS2024. Telemetrie live recue."
          : "FSUIPC7 connecte a MSFS2024. En attente d'un appareil exploitable.",
        connected: true,
        aircraftDetected,
        aircraft: {
          title: aircraftTitle,
          registration: aircraftRegistration,
          transponder: null,
          model: aircraftType ?? aircraftTitle,
        },
        lastSampleAt: new Date().toISOString(),
        telemetry,
        indicatedAirspeedKts,
        error: null,
      };

      return telemetry;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lecture FSUIPC7 impossible.";

      this.snapshot = {
        ...this.snapshot,
        status: "ERROR",
        telemetryMode: this.getConfig().telemetryMode,
        dataSource: "none",
        message: "La lecture de la telemetrie FSUIPC7 a echoue.",
        connected: false,
        aircraftDetected: false,
        error: message,
      };
      this.log("fsuipc sample failed", {
        error: message,
      });
      await this.resetClient();

      return null;
    }
  }

  private async openClient(): Promise<void> {
    try {
      const { FSUIPC, Simulator, Type } = require("fsuipc") as FsuipcModule;
      const client = new FSUIPC();

      await client.open(Simulator.MSFS);
      client.add("aircraftTitle", 0x3d00, Type.String, 256);
      client.add("aircraftRegistration", 0x313c, Type.String, 24);
      client.add("aircraftType", 0x3160, Type.String, 24);
      client.add("latitudeDeg", 0x6010, Type.Double);
      client.add("longitudeDeg", 0x6018, Type.Double);
      client.add("altitudeMeters", 0x6020, Type.Double);
      client.add("groundspeedMps", 0x6030, Type.Double);
      client.add("headingRadians", 0x6038, Type.Double);
      client.add("onGroundFlag", 0x0366, Type.Int16);
      client.add("verticalSpeedRaw", 0x030c, Type.Int32);
      client.add("indicatedAirspeedRaw", 0x02bc, Type.Int32);

      this.client = client;
      this.snapshot = {
        ...this.snapshot,
        status: "CONNECTED",
        telemetryMode: this.getConfig().telemetryMode,
        dataSource: "fsuipc",
        message: "Connexion FSUIPC7 etablie avec MSFS2024.",
        connected: true,
        aircraftDetected: false,
        error: null,
      };
      this.log("fsuipc connected");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Chargement du module FSUIPC7 impossible.";

      this.snapshot = {
        ...this.snapshot,
        status: "UNAVAILABLE",
        telemetryMode: this.getConfig().telemetryMode,
        dataSource: "none",
        message: "FSUIPC7 est indisponible. Lancez FSUIPC7 avant ACARS.",
        connected: false,
        aircraftDetected: false,
        error: message,
      };
      this.log("fsuipc initialization failed", {
        error: message,
      });
      await this.resetClient();
    }
  }

  private async resetClient(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.close();
    } catch {
      // Best effort cleanup for the next connection attempt.
    }

    this.client = null;
  }
}
