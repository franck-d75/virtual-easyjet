import type { DesktopConfig, SimulatorSnapshot, TelemetryInput } from "../shared/types.js";

const CONNECT_RETRY_INTERVAL_SECONDS = 5;
const KILOGRAMS_PER_POUND = 0.45359237;
const PAYLOAD_STATION_INDEXES = Array.from({ length: 15 }, (_, index) => index + 1);
const PASSENGER_STATION_NAME_PATTERN =
  /\b(PAX|PASSENGER|PASSENGERS|CABIN|SEAT|SEATS|ROW)\b/iu;

const PAYLOAD_STATION_SIMVARS = PAYLOAD_STATION_INDEXES.flatMap((index) => [
  `PAYLOAD STATION NAME:${index}`,
  `PAYLOAD STATION WEIGHT:${index}`,
  `PAYLOAD STATION NUM SIMOBJECTS:${index}`,
]);

const DEFAULT_SIMULATOR_SNAPSHOT: SimulatorSnapshot = {
  status: "UNAVAILABLE",
  telemetryMode: "simconnect",
  dataSource: "none",
  message: "MSFS2024 n'est pas detecte pour le moment.",
  connected: false,
  aircraftDetected: false,
  aircraft: null,
  lastSampleAt: null,
  telemetry: null,
  indicatedAirspeedKts: null,
  error: null,
};

type SimConnectApiModule = typeof import("msfs-simconnect-api-wrapper");
type SimConnectApiInstance = InstanceType<SimConnectApiModule["MSFS_API"]>;

function normalizeKey(key: string): string {
  return key
    .replaceAll(" ", "_")
    .replaceAll(":", "_")
    .replaceAll("/", "_")
    .toUpperCase();
}

function readRawValue(
  payload: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    const normalizedKey = normalizeKey(key);

    if (normalizedKey in payload) {
      return payload[normalizedKey];
    }
  }

  return undefined;
}

function readNumber(payload: Record<string, unknown>, ...keys: string[]): number | null {
  const rawValue = readRawValue(payload, ...keys);

  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === "string" && rawValue.trim().length > 0) {
    const parsedValue = Number(rawValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

function readString(payload: Record<string, unknown>, ...keys: string[]): string | null {
  const rawValue = readRawValue(payload, ...keys);

  if (typeof rawValue !== "string") {
    return null;
  }

  const normalizedValue = rawValue.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function readBoolean(payload: Record<string, unknown>, ...keys: string[]): boolean | null {
  const rawValue = readRawValue(payload, ...keys);

  if (typeof rawValue === "boolean") {
    return rawValue;
  }

  if (typeof rawValue === "number") {
    return rawValue !== 0;
  }

  if (typeof rawValue === "string") {
    const normalizedValue = rawValue.trim().toLowerCase();

    if (normalizedValue === "true" || normalizedValue === "1") {
      return true;
    }

    if (normalizedValue === "false" || normalizedValue === "0") {
      return false;
    }
  }

  return null;
}

function roundInteger(value: number | null): number | null {
  return typeof value === "number" ? Math.round(value) : null;
}

function roundKilograms(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value * 100) / 100)
    : null;
}

function looksLikeRegistration(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const normalizedValue = value.trim().toUpperCase();

  return /^[A-Z]{1,2}-[A-Z0-9]{2,5}$/.test(normalizedValue) || /^JA\d{3,4}$/.test(normalizedValue);
}

function isPlaceholderAtcId(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const normalizedValue = value.trim().toUpperCase();
  return /^JA32\d{2}$/u.test(normalizedValue) || /^JA320\d$/u.test(normalizedValue);
}

function extractRegistrationFromText(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value
    .toUpperCase()
    .match(/\b([A-Z]{1,2}-[A-Z0-9]{2,5}|N\d{1,5}[A-Z]{0,2}|C-[FGI][A-Z]{3}|JA\d{3,4}[A-Z]?)\b/u);

  if (!match?.[1] || !looksLikeRegistration(match[1])) {
    return null;
  }

  return match[1];
}

function detectAircraftIcao(title: string | null, model: string | null): string | null {
  const haystack = `${title ?? ""} ${model ?? ""}`.toUpperCase();

  if (haystack.includes("A321NEO") || haystack.includes("A21N") || haystack.includes("A321 NEO")) {
    return "A21N";
  }

  if (haystack.includes("A320NEO") || haystack.includes("A20N") || haystack.includes("A320 NEO")) {
    return "A20N";
  }

  if (haystack.includes("A319")) {
    return "A319";
  }

  if (haystack.includes("FENIX") && haystack.includes("A320")) {
    return "A320";
  }

  if (haystack.includes("A320")) {
    return "A320";
  }

  return null;
}

function detectAircraftDisplayName(
  title: string | null,
  model: string | null,
  icaoCode: string | null,
): string | null {
  const normalizedTitle = title?.trim() ?? null;
  const normalizedModel = model?.trim() ?? null;
  const haystack = `${normalizedTitle ?? ""} ${normalizedModel ?? ""}`.toUpperCase();

  if (haystack.includes("FENIX") && haystack.includes("A320")) {
    return "Fenix A320";
  }

  if (normalizedTitle && !looksLikeRegistration(normalizedTitle)) {
    return normalizedTitle;
  }

  if (normalizedModel && !looksLikeRegistration(normalizedModel)) {
    return normalizedModel;
  }

  return icaoCode;
}

function isPassengerPayloadStation(name: string | null): boolean {
  return Boolean(name && PASSENGER_STATION_NAME_PATTERN.test(name));
}

function buildPayloadSummary(payload: Record<string, unknown>): {
  passengerObjectCount: number | null;
  passengerStationWeightKg: number | null;
  totalPayloadWeightKg: number | null;
} {
  const rawStationCount = readNumber(payload, "PAYLOAD STATION COUNT");
  const stationCount =
    typeof rawStationCount === "number"
      ? Math.min(Math.max(Math.round(rawStationCount), 0), PAYLOAD_STATION_INDEXES.length)
      : PAYLOAD_STATION_INDEXES.length;
  let totalPayloadWeightKg = 0;
  let passengerStationWeightKg = 0;
  let passengerObjectCount = 0;

  for (const index of PAYLOAD_STATION_INDEXES.slice(0, stationCount)) {
    const stationName = readString(payload, `PAYLOAD STATION NAME:${index}`);
    const stationWeightPounds = readNumber(payload, `PAYLOAD STATION WEIGHT:${index}`);
    const stationObjectCount = readNumber(
      payload,
      `PAYLOAD STATION NUM SIMOBJECTS:${index}`,
    );
    const stationWeightKg =
      typeof stationWeightPounds === "number"
        ? stationWeightPounds * KILOGRAMS_PER_POUND
        : 0;

    totalPayloadWeightKg += Math.max(stationWeightKg, 0);

    if (isPassengerPayloadStation(stationName)) {
      passengerStationWeightKg += Math.max(stationWeightKg, 0);

      if (typeof stationObjectCount === "number" && stationObjectCount > 0) {
        passengerObjectCount += Math.round(stationObjectCount);
      }
    }
  }

  return {
    passengerObjectCount: passengerObjectCount > 0 ? passengerObjectCount : null,
    passengerStationWeightKg: roundKilograms(passengerStationWeightKg),
    totalPayloadWeightKg: roundKilograms(totalPayloadWeightKg),
  };
}

function buildTelemetrySample(payload: Record<string, unknown>): TelemetryInput | null {
  const latitude = readNumber(payload, "PLANE LATITUDE", "GPS POSITION LAT");
  const longitude = readNumber(payload, "PLANE LONGITUDE", "GPS POSITION LON");
  const altitudeFt = roundInteger(
    readNumber(payload, "PLANE ALTITUDE", "PLANE ALT ABOVE GROUND"),
  );
  const groundspeedKts = roundInteger(readNumber(payload, "GROUND VELOCITY"));
  const headingDeg = roundInteger(
    readNumber(
      payload,
      "PLANE HEADING DEGREES TRUE",
      "PLANE HEADING DEGREES GYRO",
    ),
  );
  const verticalSpeedFpm = roundInteger(readNumber(payload, "VERTICAL SPEED"));
  const onGround = readBoolean(payload, "SIM ON GROUND");

  if (
    latitude === null ||
    longitude === null ||
    altitudeFt === null ||
    groundspeedKts === null ||
    headingDeg === null ||
    verticalSpeedFpm === null ||
    onGround === null
  ) {
    return null;
  }

  const telemetry: TelemetryInput = {
    capturedAt: new Date().toISOString(),
    latitude,
    longitude,
    altitudeFt,
    groundspeedKts,
    headingDeg,
    verticalSpeedFpm,
    onGround,
  };

  const fuelTotalPounds = readNumber(payload, "FUEL TOTAL QUANTITY WEIGHT");
  const parkingBrake = readBoolean(payload, "BRAKE PARKING POSITION");
  const payloadSummary = buildPayloadSummary(payload);

  if (typeof fuelTotalPounds === "number") {
    const roundedFuelTotalKg = roundKilograms(
      fuelTotalPounds * KILOGRAMS_PER_POUND,
    );

    if (roundedFuelTotalKg !== null) {
      telemetry.fuelTotalKg = roundedFuelTotalKg;
    }
  }

  if (typeof parkingBrake === "boolean") {
    telemetry.parkingBrake = parkingBrake;
  }

  if (payloadSummary.passengerObjectCount !== null) {
    telemetry.passengersLive = payloadSummary.passengerObjectCount;
    telemetry.passengerSource = "simconnect_payload_objects";
  }

  if (payloadSummary.passengerStationWeightKg !== null) {
    telemetry.payloadPassengerWeightKg = payloadSummary.passengerStationWeightKg;
  }

  if (payloadSummary.totalPayloadWeightKg !== null) {
    telemetry.payloadTotalWeightKg = payloadSummary.totalPayloadWeightKg;
  }

  return telemetry;
}

export class SimConnectBridge {
  private api: SimConnectApiInstance | null = null;
  private connectStarted = false;
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
    await this.ensureApiInitialized();
    return this.getSnapshot();
  }

  public async sampleTelemetry(): Promise<TelemetryInput | null> {
    await this.ensureApiInitialized();

    if (!this.api?.connected) {
      return null;
    }

    try {
      const payload = await this.api.get(
        "PLANE LATITUDE",
        "PLANE LONGITUDE",
        "PLANE ALTITUDE",
        "GROUND VELOCITY",
        "AIRSPEED INDICATED",
        "PLANE HEADING DEGREES TRUE",
        "VERTICAL SPEED",
        "SIM ON GROUND",
        "BRAKE PARKING POSITION",
        "FUEL TOTAL QUANTITY WEIGHT",
        "PAYLOAD STATION COUNT",
        ...PAYLOAD_STATION_SIMVARS,
        "ATC ID",
        "ATC MODEL",
        "TITLE",
        "TRANSPONDER CODE:1",
      );
      const telemetry = buildTelemetrySample(payload);
      const aircraftTitle = readString(payload, "TITLE");
      const registration = readString(payload, "ATC ID");
      const transponder = readString(payload, "TRANSPONDER CODE:1");
      const model = readString(payload, "ATC MODEL");
      const icaoCode = detectAircraftIcao(aircraftTitle, model);
      const displayName = detectAircraftDisplayName(aircraftTitle, model, icaoCode);
      const resolvedRegistration =
        extractRegistrationFromText(aircraftTitle) ??
        (!isPlaceholderAtcId(registration) && looksLikeRegistration(registration)
          ? registration?.trim().toUpperCase() ?? null
          : null);
      const registrationSource = extractRegistrationFromText(aircraftTitle)
        ? "title"
        : resolvedRegistration
          ? "atc_id"
          : null;
      const indicatedAirspeedKts = roundInteger(
        readNumber(payload, "AIRSPEED INDICATED"),
      );
      const aircraftDetected = Boolean(displayName || aircraftTitle || model || icaoCode);

      this.snapshot = {
        status: aircraftDetected ? "AIRCRAFT_DETECTED" : "CONNECTED",
        telemetryMode: this.getConfig().telemetryMode,
        dataSource: "simconnect",
        message: aircraftDetected
          ? "MSFS2024 connecte, appareil detecte."
          : "MSFS2024 connecte. En attente d'un appareil exploitable.",
        connected: true,
        aircraftDetected,
        aircraft: {
          displayName,
          title: aircraftTitle,
          icaoCode,
          registration: resolvedRegistration,
          registrationSource,
          atcId: resolvedRegistration,
          rawAtcId: registration,
          liveryName: null,
          airlineIcao: null,
          atcAirline: null,
          selcal: null,
          liveryId: null,
          versionId: null,
          transponder,
          model,
        },
        lastSampleAt: new Date().toISOString(),
        telemetry,
        indicatedAirspeedKts,
        error: null,
      };
      return telemetry;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Lecture SimConnect impossible.";

      this.snapshot = {
        ...this.snapshot,
        status: "ERROR",
        telemetryMode: this.getConfig().telemetryMode,
        dataSource: "none",
        message: "La lecture de la telemetrie SimConnect a echoue.",
        connected: Boolean(this.api?.connected),
        aircraftDetected: false,
        error: message,
      };
      this.log("simconnect sample failed", {
        error: message,
      });
      return null;
    }
  }

  private async ensureApiInitialized(): Promise<void> {
    if (this.connectStarted) {
      return;
    }

    this.connectStarted = true;
    this.snapshot = {
      ...this.snapshot,
      status: "CONNECTING",
      telemetryMode: this.getConfig().telemetryMode,
      dataSource: "none",
      message: "Connexion SimConnect en cours...",
      connected: false,
      error: null,
    };

    try {
      const { MSFS_API } =
        (await import("msfs-simconnect-api-wrapper")) as SimConnectApiModule;
      const api = new MSFS_API();

      api.connect({
        autoReconnect: true,
        retries: Number.POSITIVE_INFINITY,
        retryInterval: CONNECT_RETRY_INTERVAL_SECONDS,
        onConnect: () => {
          this.api = api;
          this.snapshot = {
            ...this.snapshot,
            status: "CONNECTED",
            telemetryMode: this.getConfig().telemetryMode,
            dataSource: "simconnect",
            message: "Connexion SimConnect etablie avec MSFS2024.",
            connected: true,
            error: null,
          };
          this.log("simconnect connected");
        },
        onRetry: (_retriesLeft, retryInterval) => {
          this.snapshot = {
            ...this.snapshot,
            status: "UNAVAILABLE",
            telemetryMode: this.getConfig().telemetryMode,
            dataSource: "none",
            message: `MSFS2024 non detecte. Nouvelle tentative dans ${retryInterval} seconde(s).`,
            connected: false,
          };
        },
        onException: (exceptionName) => {
          this.snapshot = {
            ...this.snapshot,
            status: "ERROR",
            telemetryMode: this.getConfig().telemetryMode,
            dataSource: "none",
            message: "SimConnect a signale une exception.",
            connected: false,
            error: exceptionName,
          };
          this.log("simconnect exception", {
            exceptionName,
          });
        },
      });

      this.api = api;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Chargement du module SimConnect impossible.";

      this.snapshot = {
        ...this.snapshot,
        status: "ERROR",
        telemetryMode: this.getConfig().telemetryMode,
        dataSource: "none",
        message: "Le module SimConnect n'a pas pu etre initialise.",
        connected: false,
        error: message,
      };
      this.log("simconnect initialization failed", {
        error: message,
      });
    }
  }
}
