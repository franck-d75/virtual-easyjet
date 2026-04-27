import {
  buildRequestUrl,
  DEFAULT_DESKTOP_CONFIG,
  normalizeAcarsBaseUrl,
  normalizeBaseUrl,
} from "../shared/defaults.js";
import { createMockTelemetrySequence } from "../shared/mock-telemetry.js";
import { FsuipcBridge } from "./fsuipc-bridge.js";
import { SimConnectBridge } from "./simconnect-bridge.js";
import { loadDesktopRuntimeConfig } from "./runtime-config.js";
import type {
  AircraftSummary,
  AirportSummary,
  AuthSession,
  BookingSummary,
  CurrentPosition,
  DesktopConfig,
  DesktopPilotProfile,
  DesktopSnapshot,
  FlightSummary,
  FuelState,
  LatestTelemetry,
  LatestOfpSummary,
  LoadOperationsResult,
  LoginInput,
  MockProgress,
  MockResetResult,
  MockTelemetryStep,
  SessionSummary,
  SimulatorSnapshot,
  TelemetryInput,
  TelemetryTrackingState,
} from "../shared/types.js";

type LiveTelemetryBridge = {
  connect: () => Promise<SimulatorSnapshot>;
  getSnapshot: () => SimulatorSnapshot;
  sampleTelemetry: () => Promise<TelemetryInput | null>;
};

type SimulatorUpdateListener = (snapshot: SimulatorSnapshot) => void;

type RequestInitWithJson = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
};

type MockSequenceState = {
  nextIndex: number;
  steps: MockTelemetryStep[];
};

type MockDispatchState = {
  bookings: BookingSummary[];
  flights: FlightSummary[];
};

type MockSessionState = {
  session: SessionSummary;
  telemetryCount: number;
};

type TrackingTimer = ReturnType<typeof setInterval>;

type LatestOfpApiResponse = {
  status?: string;
  detail?: string | null;
  source?: {
    url?: string | null;
  } | null;
  plan?: {
    callsign?: string | null;
    flightNumber?: string | null;
    departureIcao?: string | null;
    arrivalIcao?: string | null;
    route?: string | null;
    distanceNm?: number | null;
    blockTimeMinutes?: number | null;
    estimatedTimeEnroute?: string | null;
    aircraft?: {
      icaoCode?: string | null;
      registration?: string | null;
      callsign?: string | null;
    } | null;
  } | null;
};

type SimbriefAirframesApiResponse = {
  airframes?: unknown;
};

type PrepareSimbriefFlightApiResponse = {
  action?: "created" | "updated" | "reused";
  message?: string;
  status?: string;
  flightId?: string;
  bookingId?: string;
};

type DesktopSimbriefAirframeSummary = {
  id: string | null;
  simbriefAirframeId: string | null;
  name: string | null;
  aircraftIcao: string | null;
  registration: string | null;
  linkedAircraftRegistration: string | null;
  linkedAircraftTypeIcao: string | null;
};

type TelemetryResolutionContext = {
  latestOfp: LatestOfpSummary | null;
  simbriefAirframes: DesktopSimbriefAirframeSummary[];
};

const DEFAULT_TRACKING_STATE: TelemetryTrackingState = {
  status: "IDLE",
  activeSessionId: null,
  pollingIntervalSeconds: 5,
  lastSentAt: null,
  lastError: null,
};

const MOCK_PHASE_SEQUENCE = [
  "PRE_FLIGHT",
  "DEPARTURE_PARKING",
  "PUSHBACK",
  "TAXI_OUT",
  "TAKEOFF",
  "CLIMB",
  "CRUISE",
  "DESCENT",
  "APPROACH",
  "LANDING",
  "TAXI_IN",
  "ARRIVAL_PARKING",
  "COMPLETED",
] as const;

const MOCK_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PRE_FLIGHT: ["DEPARTURE_PARKING"],
  DEPARTURE_PARKING: ["PUSHBACK", "TAXI_OUT"],
  PUSHBACK: ["DEPARTURE_PARKING", "TAXI_OUT"],
  TAXI_OUT: ["DEPARTURE_PARKING", "TAKEOFF"],
  TAKEOFF: ["CLIMB"],
  CLIMB: ["CRUISE", "DESCENT"],
  CRUISE: ["DESCENT"],
  DESCENT: ["APPROACH"],
  APPROACH: ["LANDING", "CLIMB"],
  LANDING: ["TAXI_IN", "ARRIVAL_PARKING"],
  TAXI_IN: ["ARRIVAL_PARKING"],
  ARRIVAL_PARKING: ["COMPLETED"],
  COMPLETED: ["COMPLETED"],
};

const POST_ARRIVAL_PHASES = [
  "LANDING",
  "TAXI_IN",
  "ARRIVAL_PARKING",
  "COMPLETED",
];

const AIRBORNE_PHASES = [
  "TAKEOFF",
  "CLIMB",
  "CRUISE",
  "DESCENT",
  "APPROACH",
];

const EMPTY_TELEMETRY_RESOLUTION_CONTEXT: TelemetryResolutionContext = {
  latestOfp: null,
  simbriefAirframes: [],
};

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeAircraftIcaoCode(value: string | null | undefined): string | null {
  const normalizedValue = normalizeOptionalString(value)?.toUpperCase() ?? null;
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null;
}

function looksLikeAircraftRegistration(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalizedValue = value.trim().toUpperCase();
  return (
    /^[A-Z]{1,2}-[A-Z0-9]{2,5}$/.test(normalizedValue) ||
    /^N\d{1,5}[A-Z]{0,2}$/.test(normalizedValue) ||
    /^C-[FGI][A-Z]{3}$/.test(normalizedValue) ||
    /^JA\d{3,4}[A-Z]?$/.test(normalizedValue)
  );
}

function isPlaceholderAtcId(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalizedValue = value.trim().toUpperCase();
  return /^JA32\d{2}$/u.test(normalizedValue) || /^JA320\d$/u.test(normalizedValue);
}

function normalizeRegistration(value: string | null | undefined): string | null {
  if (!looksLikeAircraftRegistration(value)) {
    return null;
  }

  return value!.trim().toUpperCase();
}

function extractRegistrationFromDebugText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.toUpperCase();
  const match = normalizedValue.match(
    /\b([A-Z]{1,2}-[A-Z0-9]{2,5}|N\d{1,5}[A-Z]{0,2}|C-[FGI][A-Z]{3}|JA\d{3,4}[A-Z]?)\b/u,
  );

  if (!match?.[1]) {
    return null;
  }

  return normalizeRegistration(match[1]);
}

function getRegistrationSourceLabel(
  source: string | null | undefined,
): "FSUIPC" | "SimBrief" | "fallback" | null {
  switch (source) {
    case "title":
    case "livery":
    case "aircraft_cfg":
      return "FSUIPC";
    case "latest_ofp":
    case "simbrief_airframe":
      return "SimBrief";
    case "atc_id":
      return "fallback";
    default:
      return null;
  }
}

function buildMockAuthSession(input: LoginInput): AuthSession {
  const identifier = input.identifier.trim();
  const username =
    identifier.length > 0
      ? (identifier.includes("@")
          ? (identifier.split("@")[0] ?? "mockpilot")
          : identifier)
      : "mockpilot";
  const email =
    identifier.length > 0 && identifier.includes("@")
      ? identifier
      : "mock.pilot@desktop.local";
  const issuedAt = Date.now().toString(36);

  return {
    user: {
      id: "mock-user-1",
      email,
      username,
      roles: ["pilot"],
      pilotProfileId: "mock-pilot-profile-1",
      pilotProfile: {
        id: "mock-pilot-profile-1",
        pilotNumber: "MOCK001",
        firstName: "Mock",
        lastName: "Pilot",
        status: "ACTIVE",
        rankId: "mock-rank-cpt",
        hubId: "mock-hub-par",
      },
    },
    tokens: {
      accessToken: `mock-access-${issuedAt}`,
      refreshToken: `mock-refresh-${issuedAt}`,
      accessTokenExpiresIn: "15m",
      refreshTokenExpiresIn: "30d",
    },
  };
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function buildAirport(
  id: string,
  icao: string,
  name: string,
): AirportSummary {
  return {
    id,
    icao,
    name,
  };
}

function buildAircraft(
  id: string,
  registration: string,
  label: string,
  icaoCode: string,
  name: string,
): AircraftSummary {
  return {
    id,
    registration,
    label,
    aircraftType: {
      id: `${id}-type`,
      icaoCode,
      name,
    },
  };
}

function buildEmptyPosition(): CurrentPosition {
  return {
    latitude: null,
    longitude: null,
    altitudeFt: null,
    groundspeedKts: null,
    headingDeg: null,
    verticalSpeedFpm: null,
    onGround: null,
  };
}

function buildEmptyFuelState(): FuelState {
  return {
    departureFuelKg: null,
    arrivalFuelKg: null,
  };
}

function buildLatestTelemetry(
  telemetryId: string,
  payload: TelemetryInput,
  capturedAt: string,
): LatestTelemetry {
  return {
    id: telemetryId,
    capturedAt,
    latitude: payload.latitude,
    longitude: payload.longitude,
    altitudeFt: payload.altitudeFt,
    groundspeedKts: payload.groundspeedKts,
    headingDeg: payload.headingDeg,
    verticalSpeedFpm: payload.verticalSpeedFpm,
    onGround: payload.onGround,
    fuelTotalKg: payload.fuelTotalKg ?? null,
    gearPercent: payload.gearPercent ?? null,
    flapsPercent: payload.flapsPercent ?? null,
    parkingBrake: payload.parkingBrake ?? null,
  };
}

function buildMockDispatchState(referenceTime: Date): MockDispatchState {
  const reservedBookedFor = new Date(
    referenceTime.getTime() + 2 * 60 * 60_000,
  ).toISOString();
  const inProgressBookedFor = new Date(
    referenceTime.getTime() - 45 * 60_000,
  ).toISOString();

  const reservedDepartureAirport = buildAirport(
    "mock-airport-lfpo",
    "LFPO",
    "Paris Orly",
  );
  const reservedArrivalAirport = buildAirport(
    "mock-airport-eham",
    "EHAM",
    "Amsterdam Schiphol",
  );
  const flightDepartureAirport = buildAirport(
    "mock-airport-lfpg",
    "LFPG",
    "Paris Charles de Gaulle",
  );
  const flightArrivalAirport = buildAirport(
    "mock-airport-egll",
    "EGLL",
    "London Heathrow",
  );

  const reservedAircraft = buildAircraft(
    "mock-aircraft-atr72",
    "F-MOCK",
    "ATR 72 Demo",
    "AT76",
    "ATR 72-600",
  );
  const inProgressAircraft = buildAircraft(
    "mock-aircraft-a320",
    "F-HMVP",
    "A320neo MVP",
    "A20N",
    "Airbus A320neo",
  );

  const flights: FlightSummary[] = [
    {
      id: "mock-flight-1",
      status: "IN_PROGRESS",
      flightNumber: "VA1401",
      booking: {
        id: "mock-booking-in-progress-1",
        status: "IN_PROGRESS",
        bookedFor: inProgressBookedFor,
      },
      departureAirport: flightDepartureAirport,
      arrivalAirport: flightArrivalAirport,
      aircraft: inProgressAircraft,
      acarsSession: null,
      pirep: null,
    },
  ];

  const bookings: BookingSummary[] = [
    {
      id: "mock-booking-reserved-1",
      status: "RESERVED",
      reservedFlightNumber: "VA2402",
      bookedFor: reservedBookedFor,
      departureAirport: reservedDepartureAirport,
      arrivalAirport: reservedArrivalAirport,
      aircraft: reservedAircraft,
      flight: null,
    },
    {
      id: "mock-booking-in-progress-1",
      status: "IN_PROGRESS",
      reservedFlightNumber: "VA1401",
      bookedFor: inProgressBookedFor,
      departureAirport: flightDepartureAirport,
      arrivalAirport: flightArrivalAirport,
      aircraft: inProgressAircraft,
      flight: {
        id: "mock-flight-1",
        status: "IN_PROGRESS",
      },
    },
  ];

  return {
    bookings,
    flights,
  };
}

function buildLoadOperationsResult(
  dispatch: MockDispatchState,
): LoadOperationsResult {
  const bookings = cloneValue(dispatch.bookings);
  const flights = cloneValue(dispatch.flights);

  return {
    bookings,
    usableBookings: bookings.filter(
      (booking) => booking.status === "RESERVED" && booking.flight === null,
    ),
    flights,
    usableFlights: flights.filter(
      (flight) =>
        flight.status === "IN_PROGRESS" && flight.acarsSession === null,
    ),
    pilotProfile: null,
    latestOfp: null,
  };
}

function buildMockSessionSummary(
  config: DesktopConfig,
  flight: FlightSummary,
  sessionId: string,
  startedAt: string,
): SessionSummary {
  return {
    id: sessionId,
    flightId: flight.id,
    simulatorProvider: config.simulatorProvider,
    clientVersion: config.clientVersion,
    status: "CONNECTED",
    startedAt,
    endedAt: null,
    disconnectedAt: null,
    connectCount: 1,
    lastTelemetryAt: null,
    lastHeartbeatAt: startedAt,
    detectedPhase: "PRE_FLIGHT",
    currentPosition: buildEmptyPosition(),
    fuel: buildEmptyFuelState(),
    latestTelemetry: null,
    eventSummary: null,
    flight: {
      id: flight.id,
      status: flight.status,
      flightNumber: flight.flightNumber,
      bookingId: flight.booking.id,
      departureAirport: cloneValue(flight.departureAirport),
      arrivalAirport: cloneValue(flight.arrivalAirport),
      aircraft: {
        registration: flight.aircraft.registration,
        label: flight.aircraft.label,
        aircraftType: {
          icaoCode: flight.aircraft.aircraftType.icaoCode,
          name: flight.aircraft.aircraftType.name,
        },
      },
    },
    pirep: null,
  };
}

function isPostArrivalPhase(phase: string): boolean {
  return POST_ARRIVAL_PHASES.includes(phase);
}

function resolveMockCandidatePhase(
  previousPhase: string,
  payload: TelemetryInput,
): string {
  if (previousPhase === "COMPLETED") {
    return "COMPLETED";
  }

  if (payload.onGround) {
    if (
      payload.parkingBrake === true &&
      payload.groundspeedKts <= 1
    ) {
      return isPostArrivalPhase(previousPhase)
        ? "ARRIVAL_PARKING"
        : "DEPARTURE_PARKING";
    }

    if (isPostArrivalPhase(previousPhase)) {
      return payload.groundspeedKts >= 5 ? "TAXI_IN" : "ARRIVAL_PARKING";
    }

    if (
      (previousPhase === "PRE_FLIGHT" ||
        previousPhase === "DEPARTURE_PARKING") &&
      payload.parkingBrake === false &&
      payload.groundspeedKts <= 5
    ) {
      return "PUSHBACK";
    }

    if (payload.groundspeedKts >= 5) {
      return "TAXI_OUT";
    }

    return previousPhase === "PRE_FLIGHT"
      ? "DEPARTURE_PARKING"
      : previousPhase;
  }

  if (previousPhase === "PRE_FLIGHT" || previousPhase === "DEPARTURE_PARKING") {
    return "TAKEOFF";
  }

  if (payload.altitudeFt <= 3_000 && payload.verticalSpeedFpm <= -500) {
    return "APPROACH";
  }

  if (payload.verticalSpeedFpm <= -500) {
    return payload.altitudeFt >= 10_000 ? "DESCENT" : "APPROACH";
  }

  if (payload.altitudeFt <= 1_500 && payload.verticalSpeedFpm >= 300) {
    return "TAKEOFF";
  }

  if (payload.verticalSpeedFpm >= 500) {
    return "CLIMB";
  }

  if (
    Math.abs(payload.verticalSpeedFpm) <= 300 &&
    payload.altitudeFt >= 10_000
  ) {
    return "CRUISE";
  }

  return AIRBORNE_PHASES.includes(previousPhase) ? previousPhase : "CLIMB";
}

function resolveAllowedMockPhase(
  previousPhase: string,
  candidatePhase: string,
): string {
  if (previousPhase === candidatePhase) {
    return previousPhase;
  }

  const allowedTransitions = MOCK_ALLOWED_TRANSITIONS[previousPhase] ?? [];

  if (allowedTransitions.includes(candidatePhase)) {
    return candidatePhase;
  }

  const previousIndex = MOCK_PHASE_SEQUENCE.indexOf(
    previousPhase as (typeof MOCK_PHASE_SEQUENCE)[number],
  );
  const candidateIndex = MOCK_PHASE_SEQUENCE.indexOf(
    candidatePhase as (typeof MOCK_PHASE_SEQUENCE)[number],
  );

  if (previousIndex === -1 || candidateIndex === -1) {
    return previousPhase;
  }

  if (candidateIndex > previousIndex) {
    return allowedTransitions[0] ?? previousPhase;
  }

  return previousPhase;
}

function detectMockPhase(
  previousPhase: string,
  payload: TelemetryInput,
): string {
  return resolveAllowedMockPhase(
    previousPhase,
    resolveMockCandidatePhase(previousPhase, payload),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }

  if (!isRecord(payload)) {
    return null;
  }

  const message = payload.message;

  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }

  if (
    Array.isArray(message) &&
    message.every((item) => typeof item === "string")
  ) {
    return message.join(" ");
  }

  const error = payload.error;

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return null;
}

class HttpError extends Error {
  public constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const INVALID_DESKTOP_AUTH_SESSION_MESSAGE =
  "Invalid authentication session. Log in again to continue.";

export class DesktopService {
  private readonly initialConfig = loadDesktopRuntimeConfig();
  private config = this.initialConfig;
  private authSession: AuthSession | null = null;
  private readonly mockSequences = new Map<string, MockSequenceState>();
  private readonly mockSessionStates = new Map<string, MockSessionState>();
  private mockDispatchState: MockDispatchState | null = null;
  private mockSessionCounter = 1;
  private readonly simulatorUpdateListeners = new Set<SimulatorUpdateListener>();
  private telemetryResolutionContext: TelemetryResolutionContext = structuredClone(
    EMPTY_TELEMETRY_RESOLUTION_CONTEXT,
  );
  private lastAircraftResolutionSignature: string | null = null;
  private readonly fsuipcBridge = new FsuipcBridge(
    () => this.config,
    (message, details) => this.log(message, details),
    (snapshot) => this.handleSimulatorUpdate(snapshot),
  );
  private readonly simConnectBridge = new SimConnectBridge(
    () => this.config,
    (message, details) => this.log(message, details),
  );
  private trackingState: TelemetryTrackingState = structuredClone(
    DEFAULT_TRACKING_STATE,
  );
  private trackingTimer: TrackingTimer | null = null;
  private telemetryWarmupPromise: Promise<void> | null = null;

  public constructor() {
    this.log("desktop runtime config loaded", {
      backendMode: this.config.backendMode,
      apiBaseUrl: this.config.apiBaseUrl,
      acarsBaseUrl: this.config.acarsBaseUrl,
      clientVersion: this.config.clientVersion,
      simulatorProvider: this.config.simulatorProvider,
      telemetryMode: this.config.telemetryMode,
      telemetryFallbackMode: this.config.telemetryFallbackMode ?? null,
    });
  }

  public async getSnapshot(): Promise<DesktopSnapshot> {
    this.startTelemetryWarmup();
    return cloneValue(this.buildSnapshot());
  }

  public subscribeSimulatorUpdates(listener: SimulatorUpdateListener): () => void {
    this.simulatorUpdateListeners.add(listener);

    return () => {
      this.simulatorUpdateListeners.delete(listener);
    };
  }

  public async getSimulatorSnapshot(): Promise<SimulatorSnapshot> {
    this.startTelemetryWarmup();
    const snapshot = this.getCurrentSimulatorSnapshot();

    if (snapshot.telemetry) {
      this.log("Telemetry forwarded to renderer", {
        dataSource: snapshot.dataSource,
        capturedAt: snapshot.telemetry.capturedAt ?? null,
        altitudeFt: snapshot.telemetry.altitudeFt,
        groundspeedKts: snapshot.telemetry.groundspeedKts,
        headingDeg: snapshot.telemetry.headingDeg,
      });
    }

    return snapshot;
  }

  public async login(input: LoginInput): Promise<DesktopSnapshot> {
    const normalizedApiBaseUrl =
      normalizeBaseUrl(input.apiBaseUrl) ||
      this.initialConfig.apiBaseUrl;

    this.config = {
      ...this.initialConfig,
      apiBaseUrl: normalizedApiBaseUrl,
      acarsBaseUrl: normalizeAcarsBaseUrl(
        input.acarsBaseUrl || this.initialConfig.acarsBaseUrl,
        normalizedApiBaseUrl,
      ),
      backendMode: input.backendMode,
    };

    this.resetMockState();
    this.telemetryResolutionContext = structuredClone(
      EMPTY_TELEMETRY_RESOLUTION_CONTEXT,
    );
    this.stopTracking();

    if (this.isMockBackend()) {
      this.log("mock desktop login requested", {
        identifier: input.identifier.trim() || "mockpilot",
      });
      this.authSession = buildMockAuthSession(input);
    } else {
      this.log("live desktop login requested", {
        apiBaseUrl: this.config.apiBaseUrl,
        identifier: input.identifier.trim(),
      });
      this.authSession = await this.requestJson<AuthSession>(
        this.config.apiBaseUrl,
        "/auth/login",
        {
          method: "POST",
          body: {
            identifier: input.identifier,
            password: input.password,
          },
        },
      );
      this.log("live desktop login succeeded", {
        userId: this.authSession.user.id,
        pilotProfileId: this.authSession.user.pilotProfileId ?? null,
      });
      this.startTelemetryWarmup();
    }

    return cloneValue(this.buildSnapshot());
  }

  public async logout(): Promise<DesktopSnapshot> {
    if (this.authSession && !this.isMockBackend()) {
      try {
        await this.requestJson(
          this.config.apiBaseUrl,
          "/auth/logout",
          {
            method: "POST",
            body: {
              refreshToken: this.authSession.tokens.refreshToken,
            },
          },
        );
      } catch {
        // Best effort for MVP. We still clear the local desktop state.
      }
    }

    this.authSession = null;
    this.resetMockState();
    this.telemetryResolutionContext = structuredClone(
      EMPTY_TELEMETRY_RESOLUTION_CONTEXT,
    );
    this.stopTracking();

    return cloneValue(this.buildSnapshot());
  }

  public async loadDispatchData(): Promise<LoadOperationsResult> {
    if (this.isMockBackend()) {
      this.telemetryResolutionContext = structuredClone(
        EMPTY_TELEMETRY_RESOLUTION_CONTEXT,
      );
      return {
        ...buildLoadOperationsResult(this.ensureMockDispatchState()),
        pilotProfile: this.serializePilotProfile(this.authSession?.user.pilotProfile),
        latestOfp: null,
      };
    }

    return this.loadLiveDispatchData(true);
  }

  public async createFlightFromBooking(bookingId: string): Promise<FlightSummary> {
    if (this.isMockBackend()) {
      throw new Error(
        "La creation de vol depuis une reservation n'est disponible qu'en mode reel.",
      );
    }

    return this.authorizedRequestJson<FlightSummary>(
      this.config.apiBaseUrl,
      "/flights",
      {
        method: "POST",
        body: {
          bookingId,
        },
      },
    );
  }

  public async createSession(flightId: string): Promise<SessionSummary> {
    if (this.isMockBackend()) {
      return this.createMockSession(flightId);
    }

    const session = await this.authorizedAcarsRequestJson<SessionSummary>(
      "/sessions",
      {
        method: "POST",
        body: {
          flightId,
          clientVersion: this.config.clientVersion,
          simulatorProvider: this.getCurrentSimulatorProvider(),
        },
      },
    );

    if (this.config.telemetryMode !== "mock") {
      await this.startSessionTracking(session.id);
    }

    return session;
  }

  public async getSession(sessionId: string): Promise<SessionSummary> {
    if (this.isMockBackend()) {
      return cloneValue(this.ensureMockSessionState(sessionId).session);
    }

    return this.authorizedAcarsRequestJson<SessionSummary>(
      `/sessions/${encodeURIComponent(sessionId)}`,
    );
  }

  private async loadLiveDispatchData(
    allowSimbriefBootstrap: boolean,
  ): Promise<LoadOperationsResult> {
    const [
      bookingsResult,
      flightsResult,
      pilotProfileResult,
      latestOfpResult,
      simbriefAirframesResult,
    ] =
      await Promise.allSettled([
        this.authorizedRequestJson<BookingSummary[]>(
          this.config.apiBaseUrl,
          "/bookings/me",
        ),
        this.authorizedRequestJson<FlightSummary[]>(
          this.config.apiBaseUrl,
          "/flights/me",
        ),
        this.authorizedRequestJson<Record<string, unknown>>(
          this.config.apiBaseUrl,
          "/pilot-profiles/me",
        ),
        this.authorizedRequestJson<LatestOfpApiResponse>(
          this.config.apiBaseUrl,
          "/pilot-profiles/me/simbrief/latest-ofp",
        ),
        this.authorizedRequestJson<SimbriefAirframesApiResponse>(
          this.config.apiBaseUrl,
          "/pilot/simbrief/airframes",
        ),
      ]);

    const bookings =
      bookingsResult.status === "fulfilled" ? bookingsResult.value : [];
    const flights = flightsResult.status === "fulfilled" ? flightsResult.value : [];

    if (bookingsResult.status !== "fulfilled") {
      throw bookingsResult.reason;
    }

    if (flightsResult.status !== "fulfilled") {
      throw flightsResult.reason;
    }

    const normalizedLatestOfp =
      latestOfpResult.status === "fulfilled"
        ? this.normalizeLatestOfp(latestOfpResult.value)
        : null;
    const normalizedSimbriefAirframes =
      simbriefAirframesResult.status === "fulfilled"
        ? this.normalizeSimbriefAirframes(simbriefAirframesResult.value)
        : [];

    this.telemetryResolutionContext = {
      latestOfp: normalizedLatestOfp,
      simbriefAirframes: normalizedSimbriefAirframes,
    };

    const usableBookings = bookings.filter(
      (booking) => booking.status === "RESERVED" && booking.flight === null,
    );
    const usableFlights = flights.filter(
      (flight) =>
        (flight.status === "PLANNED" || flight.status === "IN_PROGRESS") &&
        flight.acarsSession === null,
    );

    if (
      allowSimbriefBootstrap &&
      normalizedLatestOfp?.status === "AVAILABLE" &&
      usableBookings.length === 0 &&
      usableFlights.length === 0
    ) {
      const simulatorSnapshot = this.getCurrentSimulatorSnapshot();

      try {
        const preparedFlight = await this.prepareFlightFromLatestOfp({
          detectedRegistration:
            simulatorSnapshot.aircraft?.registration ?? null,
          detectedAircraftIcao:
            simulatorSnapshot.aircraft?.icaoCode ??
            normalizedLatestOfp.aircraft?.icaoCode ??
            null,
        });

        this.log("simbrief OFP prepared an ACARS-ready flight", {
          action: preparedFlight.action ?? null,
          flightId: preparedFlight.flightId ?? null,
          status: preparedFlight.status ?? null,
        });

        return this.loadLiveDispatchData(false);
      } catch (error) {
        this.log("simbrief OFP bootstrap skipped", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      bookings,
      usableBookings,
      flights,
      usableFlights,
      pilotProfile:
        pilotProfileResult.status === "fulfilled"
          ? this.extractPilotProfileFromApi(pilotProfileResult.value)
          : this.serializePilotProfile(this.authSession?.user.pilotProfile),
      latestOfp: normalizedLatestOfp,
    };
  }

  public async startSessionTracking(
    sessionId: string,
  ): Promise<TelemetryTrackingState> {
    if (this.isMockBackend()) {
      throw new Error(
        "Le suivi automatique ACARS n'est pas disponible en mode mock.",
      );
    }

    await this.refreshTelemetrySnapshot();
    this.stopTracking(false);

    this.trackingState = {
      ...this.trackingState,
      status: "RUNNING",
      activeSessionId: sessionId,
      lastError: null,
    };

    await this.pushLiveTelemetryTick();
    this.trackingTimer = setInterval(() => {
      void this.pushLiveTelemetryTick();
    }, this.trackingState.pollingIntervalSeconds * 1000);

    return cloneValue(this.trackingState);
  }

  public async pauseSessionTracking(): Promise<TelemetryTrackingState> {
    if (this.trackingTimer) {
      clearInterval(this.trackingTimer);
      this.trackingTimer = null;
    }

    this.trackingState = {
      ...this.trackingState,
      status: this.trackingState.activeSessionId ? "PAUSED" : "IDLE",
    };

    return cloneValue(this.trackingState);
  }

  public async resumeSessionTracking(): Promise<TelemetryTrackingState> {
    const sessionId = this.trackingState.activeSessionId;

    if (!sessionId) {
      return cloneValue(this.trackingState);
    }

    return this.startSessionTracking(sessionId);
  }

  public async getTrackingState(): Promise<TelemetryTrackingState> {
    return cloneValue(this.trackingState);
  }

  public async sendManualTelemetry(
    sessionId: string,
    payload: TelemetryInput,
  ): Promise<SessionSummary> {
    if (this.isMockBackend()) {
      return this.sendMockTelemetry(sessionId, payload);
    }

    const session = await this.authorizedAcarsRequestJson<SessionSummary>(
      `/sessions/${encodeURIComponent(sessionId)}/telemetry`,
      {
        method: "POST",
        body: payload,
      },
    );

    this.trackingState = {
      ...this.trackingState,
      lastSentAt: payload.capturedAt ?? new Date().toISOString(),
      lastError: null,
    };

    return session;
  }

  public async sendNextMockTelemetry(
    sessionId: string,
  ): Promise<MockProgress> {
    if (!this.isMockBackend()) {
      throw new Error(
        "Mock telemetry automation is available only when the desktop backend mode is set to mock.",
      );
    }

    const mockState = this.getOrCreateMockSequence(sessionId);
    const step = mockState.steps[mockState.nextIndex] ?? null;

    if (!step) {
      const session = await this.getSession(sessionId);

      return {
        session,
        step: null,
        sentSteps: mockState.nextIndex,
        totalSteps: mockState.steps.length,
        remainingSteps: 0,
      };
    }

    const session = this.sendMockTelemetry(
      sessionId,
      step.telemetry,
      step.expectedPhase,
    );
    mockState.nextIndex += 1;

    return {
      session,
      step,
      sentSteps: mockState.nextIndex,
      totalSteps: mockState.steps.length,
      remainingSteps: Math.max(0, mockState.steps.length - mockState.nextIndex),
    };
  }

  public async resetMockSequence(
    sessionId: string,
  ): Promise<MockResetResult> {
    if (!this.isMockBackend()) {
      throw new Error(
        "Mock telemetry sequence reset is available only in desktop mock backend mode.",
      );
    }

    const steps = createMockTelemetrySequence(new Date());

    this.mockSequences.set(sessionId, {
      nextIndex: 0,
      steps,
    });

    return {
      totalSteps: steps.length,
      remainingSteps: steps.length,
    };
  }

  public async completeSession(
    sessionId: string,
    pilotComment: string,
  ): Promise<SessionSummary> {
    if (this.isMockBackend()) {
      return this.completeMockSession(sessionId, pilotComment);
    }

    const session = await this.authorizedAcarsRequestJson<SessionSummary>(
      `/sessions/${encodeURIComponent(sessionId)}/complete`,
      {
        method: "POST",
        body: {
          pilotComment: pilotComment.trim() || undefined,
        },
      },
    );

    this.stopTracking();
    return session;
  }

  private async pushLiveTelemetryTick(): Promise<void> {
    const sessionId = this.trackingState.activeSessionId;

    if (!sessionId || this.trackingState.status !== "RUNNING") {
      return;
    }

    const telemetry = await this.samplePreferredTelemetry();

    if (!telemetry) {
      this.trackingState = {
        ...this.trackingState,
        lastError: this.getCurrentSimulatorSnapshot().message,
      };
      return;
    }

    try {
      await this.authorizedAcarsRequestJson<SessionSummary>(
        `/sessions/${encodeURIComponent(sessionId)}/telemetry`,
        {
          method: "POST",
          body: telemetry,
        },
      );

      this.trackingState = {
        ...this.trackingState,
        lastSentAt: telemetry.capturedAt ?? new Date().toISOString(),
        lastError: null,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Envoi telemetrie impossible.";

      this.trackingState = {
        ...this.trackingState,
        status: "ERROR",
        lastError: message,
      };
      this.log("live telemetry tick failed", {
        sessionId,
        error: message,
      });
    }
  }

  private getMockSimulatorSnapshot(): SimulatorSnapshot {
    return {
      status: "UNAVAILABLE",
      telemetryMode: this.config.telemetryMode,
      dataSource: "mock",
      message: "Le client ACARS est en mode mock. Activez le mode reel pour suivre MSFS2024.",
      connected: false,
      aircraftDetected: false,
      aircraft: null,
      lastSampleAt: null,
      telemetry: null,
      indicatedAirspeedKts: null,
      error: null,
    };
  }

  private getTelemetryBridge(
    mode: "fsuipc" | "simconnect",
  ): LiveTelemetryBridge {
    return mode === "fsuipc" ? this.fsuipcBridge : this.simConnectBridge;
  }

  private getPrimaryTelemetryBridge(): LiveTelemetryBridge | null {
    if (this.config.telemetryMode === "mock") {
      return null;
    }

    return this.getTelemetryBridge(this.config.telemetryMode);
  }

  private getFallbackTelemetryBridge(): LiveTelemetryBridge | null {
    const fallbackMode = this.config.telemetryFallbackMode;

    if (!fallbackMode || fallbackMode === this.config.telemetryMode) {
      return null;
    }

    return this.getTelemetryBridge(fallbackMode);
  }

  private isUsableTelemetrySnapshot(snapshot: SimulatorSnapshot | null): boolean {
    return Boolean(
      snapshot &&
        (snapshot.telemetry !== null ||
          snapshot.aircraftDetected ||
          snapshot.connected),
    );
  }

  private selectTelemetrySnapshot(
    primarySnapshot: SimulatorSnapshot | null,
    fallbackSnapshot: SimulatorSnapshot | null,
  ): SimulatorSnapshot {
    if (this.isMockBackend() || this.config.telemetryMode === "mock") {
      return this.getMockSimulatorSnapshot();
    }

    if (this.isUsableTelemetrySnapshot(primarySnapshot)) {
      return cloneValue(primarySnapshot as SimulatorSnapshot);
    }

    if (this.isUsableTelemetrySnapshot(fallbackSnapshot)) {
      return cloneValue(fallbackSnapshot as SimulatorSnapshot);
    }

    if (primarySnapshot?.status === "CONNECTING") {
      return cloneValue(primarySnapshot);
    }

    if (fallbackSnapshot?.status === "CONNECTING") {
      return cloneValue(fallbackSnapshot);
    }

    return cloneValue(primarySnapshot ?? fallbackSnapshot ?? this.getMockSimulatorSnapshot());
  }

  private getCurrentSimulatorSnapshot(): SimulatorSnapshot {
    const primarySnapshot = this.getPrimaryTelemetryBridge()?.getSnapshot() ?? null;
    const fallbackSnapshot = this.getFallbackTelemetryBridge()?.getSnapshot() ?? null;

    return this.enrichSimulatorSnapshot(
      this.selectTelemetrySnapshot(primarySnapshot, fallbackSnapshot),
    );
  }

  private handleSimulatorUpdate(snapshot: SimulatorSnapshot): void {
    const enrichedSnapshot = this.enrichSimulatorSnapshot(snapshot);

    this.log("Telemetry forwarded to renderer", {
      dataSource: enrichedSnapshot.dataSource,
      connected: enrichedSnapshot.connected,
      aircraftDetected: enrichedSnapshot.aircraftDetected,
      lastSampleAt: enrichedSnapshot.lastSampleAt,
      altitudeFt: enrichedSnapshot.telemetry?.altitudeFt ?? null,
      groundspeedKts: enrichedSnapshot.telemetry?.groundspeedKts ?? null,
      headingDeg: enrichedSnapshot.telemetry?.headingDeg ?? null,
    });

    for (const listener of [...this.simulatorUpdateListeners]) {
      try {
        listener(cloneValue(enrichedSnapshot));
      } catch (error) {
        this.log("simulator update listener failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private getCurrentSimulatorProvider(): string {
    const snapshot = this.getCurrentSimulatorSnapshot();

    switch (snapshot.dataSource) {
      case "fsuipc":
        return "MSFS2024_FSUIPC7";
      case "simconnect":
        return "MSFS2024_SIMCONNECT";
      default:
        return this.config.simulatorProvider;
    }
  }

  private async refreshTelemetrySnapshot(): Promise<void> {
    if (this.isMockBackend() || this.config.telemetryMode === "mock") {
      return;
    }

    const telemetry = await this.samplePreferredTelemetry();

    if (telemetry) {
      return;
    }

    await this.refreshTelemetryConnections();
  }

  private startTelemetryWarmup(): void {
    if (this.isMockBackend() || this.config.telemetryMode === "mock") {
      return;
    }

    if (
      this.config.telemetryMode === "fsuipc" ||
      this.config.telemetryFallbackMode === "fsuipc"
    ) {
      this.fsuipcBridge.start();
    }

    if (this.telemetryWarmupPromise) {
      return;
    }

    this.telemetryWarmupPromise = this.refreshTelemetrySnapshot()
      .catch((error) => {
        this.log("telemetry warmup failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        this.telemetryWarmupPromise = null;
      });
  }

  private async refreshTelemetryConnections(): Promise<void> {
    const primaryBridge = this.getPrimaryTelemetryBridge();
    const fallbackBridge = this.getFallbackTelemetryBridge();

    if (!primaryBridge) {
      return;
    }

    await primaryBridge.connect();

    if (
      fallbackBridge &&
      !this.isUsableTelemetrySnapshot(primaryBridge.getSnapshot())
    ) {
      await fallbackBridge.connect();
    }
  }

  private async samplePreferredTelemetry(): Promise<TelemetryInput | null> {
    const primaryBridge = this.getPrimaryTelemetryBridge();
    const fallbackBridge = this.getFallbackTelemetryBridge();

    if (!primaryBridge) {
      return null;
    }

    await primaryBridge.connect();
    const primaryTelemetry = await primaryBridge.sampleTelemetry();

    if (primaryTelemetry) {
      return primaryTelemetry;
    }

    if (!fallbackBridge) {
      return null;
    }

    await fallbackBridge.connect();
    return fallbackBridge.sampleTelemetry();
  }

  private async prepareFlightFromLatestOfp(payload: {
    detectedRegistration: string | null;
    detectedAircraftIcao: string | null;
  }): Promise<PrepareSimbriefFlightApiResponse> {
    return this.authorizedRequestJson<PrepareSimbriefFlightApiResponse>(
      this.config.apiBaseUrl,
      "/pilot/simbrief/prepare-flight",
      {
        method: "POST",
        body: payload,
      },
    );
  }

  private stopTracking(clearSessionId = true): void {
    if (this.trackingTimer) {
      clearInterval(this.trackingTimer);
      this.trackingTimer = null;
    }

    this.trackingState = {
      ...this.trackingState,
      status: clearSessionId ? "IDLE" : this.trackingState.status,
      activeSessionId: clearSessionId ? null : this.trackingState.activeSessionId,
      lastError: clearSessionId ? null : this.trackingState.lastError,
    };
  }

  private isMockBackend(): boolean {
    return this.config.backendMode === "mock";
  }

  private extractPilotProfileFromApi(
    payload: Record<string, unknown>,
  ): DesktopPilotProfile | null {
    const simbrief = payload.simbriefPilotId;

    if (
      typeof payload.id !== "string" ||
      typeof payload.pilotNumber !== "string" ||
      typeof payload.firstName !== "string" ||
      typeof payload.lastName !== "string" ||
      typeof payload.status !== "string"
    ) {
      return null;
    }

    return {
      id: payload.id,
      pilotNumber: payload.pilotNumber,
      firstName: payload.firstName,
      lastName: payload.lastName,
      callsign: typeof payload.callsign === "string" ? payload.callsign : null,
      simbriefPilotId: typeof simbrief === "string" ? simbrief : null,
      countryCode:
        typeof payload.countryCode === "string" ? payload.countryCode : null,
      status: payload.status,
      rankId: typeof payload.rankId === "string" ? payload.rankId : null,
      hubId: typeof payload.hubId === "string" ? payload.hubId : null,
    };
  }

  private serializePilotProfile(
    profile: AuthSession["user"]["pilotProfile"] | null | undefined,
  ): DesktopPilotProfile | null {
    if (!profile) {
      return null;
    }

    return {
      id: profile.id,
      pilotNumber: profile.pilotNumber,
      firstName: profile.firstName,
      lastName: profile.lastName,
      callsign: profile.callsign ?? null,
      simbriefPilotId: profile.simbriefPilotId ?? null,
      countryCode: profile.countryCode ?? null,
      status: profile.status,
      rankId: profile.rankId,
      hubId: profile.hubId,
    };
  }

  private normalizeLatestOfp(payload: LatestOfpApiResponse): LatestOfpSummary | null {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    return {
      status: payload.status ?? "UNKNOWN",
      detail: payload.detail ?? null,
      sourceUrl: payload.source?.url ?? null,
      flightNumber: payload.plan?.flightNumber ?? null,
      callsign: payload.plan?.callsign ?? null,
      departureIcao: payload.plan?.departureIcao ?? null,
      arrivalIcao: payload.plan?.arrivalIcao ?? null,
      route: payload.plan?.route ?? null,
      distanceNm: payload.plan?.distanceNm ?? null,
      blockTimeMinutes: payload.plan?.blockTimeMinutes ?? null,
      estimatedTimeEnroute: payload.plan?.estimatedTimeEnroute ?? null,
      aircraft: payload.plan?.aircraft
        ? {
            icaoCode: payload.plan.aircraft.icaoCode ?? null,
            registration: payload.plan.aircraft.registration ?? null,
            callsign: payload.plan.aircraft.callsign ?? null,
          }
        : null,
    };
  }

  private normalizeSimbriefAirframes(
    payload: SimbriefAirframesApiResponse,
  ): DesktopSimbriefAirframeSummary[] {
    if (!payload || !Array.isArray(payload.airframes)) {
      return [];
    }

    return payload.airframes.flatMap((rawAirframe) => {
      if (!isRecord(rawAirframe)) {
        return [];
      }

      const linkedAircraft = isRecord(rawAirframe.linkedAircraft)
        ? rawAirframe.linkedAircraft
        : null;
      const linkedAircraftType = linkedAircraft && isRecord(linkedAircraft.aircraftType)
        ? linkedAircraft.aircraftType
        : null;

      return [
        {
          id: normalizeOptionalString(rawAirframe.id),
          simbriefAirframeId: normalizeOptionalString(rawAirframe.simbriefAirframeId),
          name: normalizeOptionalString(rawAirframe.name),
          aircraftIcao:
            normalizeAircraftIcaoCode(normalizeOptionalString(rawAirframe.aircraftIcao)) ??
            normalizeAircraftIcaoCode(
              normalizeOptionalString(linkedAircraftType?.icaoCode),
            ),
          registration:
            normalizeRegistration(normalizeOptionalString(rawAirframe.registration)) ??
            normalizeRegistration(
              normalizeOptionalString(linkedAircraft?.registration),
            ),
          linkedAircraftRegistration: normalizeRegistration(
            normalizeOptionalString(linkedAircraft?.registration),
          ),
          linkedAircraftTypeIcao: normalizeAircraftIcaoCode(
            normalizeOptionalString(linkedAircraftType?.icaoCode),
          ),
        },
      ];
    });
  }

  private resolveRegistrationFromSimbriefAirframes(
    icaoCode: string | null,
    latestOfpRegistration: string | null,
  ): DesktopSimbriefAirframeSummary | null {
    const normalizedIcao = normalizeAircraftIcaoCode(icaoCode);
    const candidates = this.telemetryResolutionContext.simbriefAirframes.filter(
      (airframe) =>
        airframe.registration &&
        (!normalizedIcao ||
          airframe.aircraftIcao === normalizedIcao ||
          airframe.linkedAircraftTypeIcao === normalizedIcao),
    );

    if (candidates.length === 0) {
      return null;
    }

    if (latestOfpRegistration) {
      const exactLatestOfpMatch =
        candidates.find((airframe) => airframe.registration === latestOfpRegistration) ??
        candidates.find(
          (airframe) => airframe.linkedAircraftRegistration === latestOfpRegistration,
        );

      if (exactLatestOfpMatch) {
        return exactLatestOfpMatch;
      }
    }

    if (candidates.length === 1) {
      return candidates[0] ?? null;
    }

    const linkedCandidates = candidates.filter(
      (airframe) => airframe.linkedAircraftRegistration !== null,
    );

    if (linkedCandidates.length === 1) {
      return linkedCandidates[0] ?? null;
    }

    return null;
  }

  private findSimbriefAirframeByRegistration(
    registration: string | null,
    icaoCode: string | null,
  ): DesktopSimbriefAirframeSummary | null {
    if (!registration) {
      return null;
    }

    const normalizedRegistration = normalizeRegistration(registration);
    const normalizedIcao = normalizeAircraftIcaoCode(icaoCode);

    if (!normalizedRegistration) {
      return null;
    }

    return (
      this.telemetryResolutionContext.simbriefAirframes.find((airframe) => {
        const sameRegistration =
          airframe.registration === normalizedRegistration ||
          airframe.linkedAircraftRegistration === normalizedRegistration;

        if (!sameRegistration) {
          return false;
        }

        if (!normalizedIcao) {
          return true;
        }

        return (
          airframe.aircraftIcao === normalizedIcao ||
          airframe.linkedAircraftTypeIcao === normalizedIcao
        );
      }) ?? null
    );
  }

  private logAircraftResolutionIfChanged(snapshot: SimulatorSnapshot): void {
    const aircraft = snapshot.aircraft;

    if (!aircraft) {
      this.lastAircraftResolutionSignature = null;
      return;
    }

    const signature = JSON.stringify({
      title: aircraft.title ?? null,
      rawAtcId: aircraft.rawAtcId ?? null,
      liveryName: aircraft.liveryName ?? null,
      registration: aircraft.registration ?? null,
      registrationSource: aircraft.registrationSource ?? null,
      icaoCode: aircraft.icaoCode ?? null,
    });

    if (signature === this.lastAircraftResolutionSignature) {
      return;
    }

    this.lastAircraftResolutionSignature = signature;
    const parsedRegistration =
      extractRegistrationFromDebugText(aircraft.title) ??
      extractRegistrationFromDebugText(aircraft.liveryName) ??
      null;
    this.log("aircraft resolution updated", {
      aircraftTitleRaw: aircraft.title ?? null,
      liveryRaw: aircraft.liveryName ?? null,
      parsedRegistration,
      resolvedRegistration: aircraft.registration ?? aircraft.atcId ?? null,
      registrationSource:
        getRegistrationSourceLabel(aircraft.registrationSource) ??
        aircraft.registrationSource ??
        null,
      aircraftIcao: aircraft.icaoCode ?? null,
    });
  }

  private enrichSimulatorSnapshot(snapshot: SimulatorSnapshot): SimulatorSnapshot {
    if (!snapshot.aircraft) {
      return cloneValue(snapshot);
    }

    const latestOfp = this.telemetryResolutionContext.latestOfp;
    const rawAircraft = snapshot.aircraft;
    let icaoCode =
      normalizeAircraftIcaoCode(rawAircraft.icaoCode) ??
      normalizeAircraftIcaoCode(latestOfp?.aircraft?.icaoCode) ??
      null;
    const latestOfpRegistration = normalizeRegistration(
      latestOfp?.aircraft?.registration ?? null,
    );

    let resolvedRegistration = normalizeRegistration(rawAircraft.registration);
    let registrationSource = rawAircraft.registrationSource ?? null;
    let liveryName = normalizeOptionalString(rawAircraft.liveryName);
    let matchedAirframe = this.findSimbriefAirframeByRegistration(
      resolvedRegistration,
      icaoCode,
    );

    if (matchedAirframe) {
      icaoCode =
        icaoCode ??
        matchedAirframe.aircraftIcao ??
        matchedAirframe.linkedAircraftTypeIcao ??
        null;
      liveryName = liveryName ?? matchedAirframe.name ?? null;
    }

    if (!resolvedRegistration && latestOfpRegistration) {
      resolvedRegistration = latestOfpRegistration;
      registrationSource = "latest_ofp";
    }

    if (!resolvedRegistration) {
      matchedAirframe = this.resolveRegistrationFromSimbriefAirframes(
        icaoCode,
        latestOfpRegistration,
      );

      if (matchedAirframe?.registration) {
        resolvedRegistration = matchedAirframe.registration;
        registrationSource = "simbrief_airframe";
        liveryName = liveryName ?? matchedAirframe.name ?? null;
        icaoCode =
          icaoCode ??
          matchedAirframe.aircraftIcao ??
          matchedAirframe.linkedAircraftTypeIcao ??
          null;
      }
    }

    const trustedAtcId = normalizeRegistration(rawAircraft.rawAtcId);

    if (
      !resolvedRegistration &&
      trustedAtcId &&
      !isPlaceholderAtcId(trustedAtcId)
    ) {
      resolvedRegistration = trustedAtcId;
      registrationSource = "atc_id";
    }

    const enrichedSnapshot: SimulatorSnapshot = {
      ...snapshot,
      aircraft: {
        ...rawAircraft,
        displayName:
          rawAircraft.displayName ??
          rawAircraft.title ??
          rawAircraft.model ??
          icaoCode,
        icaoCode,
        registration: resolvedRegistration,
        registrationSource,
        atcId: resolvedRegistration,
        rawAtcId: normalizeOptionalString(rawAircraft.rawAtcId),
        liveryName,
      },
    };

    this.logAircraftResolutionIfChanged(enrichedSnapshot);
    return cloneValue(enrichedSnapshot);
  }

  private buildSnapshot(): DesktopSnapshot {
    return {
      config: this.config,
      isAuthenticated: this.authSession !== null,
      user: this.authSession?.user ?? null,
      simulator: this.getCurrentSimulatorSnapshot(),
      tracking: cloneValue(this.trackingState),
    };
  }

  private resetMockState(): void {
    this.mockSequences.clear();
    this.mockSessionStates.clear();
    this.mockDispatchState = null;
    this.mockSessionCounter = 1;
    this.lastAircraftResolutionSignature = null;
  }

  private ensureMockDispatchState(): MockDispatchState {
    this.ensureAuthenticated();

    if (!this.mockDispatchState) {
      this.mockDispatchState = buildMockDispatchState(new Date());
    }

    return this.mockDispatchState;
  }

  private getOrCreateMockSequence(sessionId: string): MockSequenceState {
    const existingState = this.mockSequences.get(sessionId);

    if (existingState) {
      return existingState;
    }

    const state = {
      nextIndex: 0,
      steps: createMockTelemetrySequence(new Date()),
    };

    this.mockSequences.set(sessionId, state);

    return state;
  }

  private ensureMockSessionState(sessionId: string): MockSessionState {
    const state = this.mockSessionStates.get(sessionId);

    if (!state) {
      throw new Error(`Mock ACARS session not found: ${sessionId}.`);
    }

    return state;
  }

  private createMockSession(flightId: string): SessionSummary {
    const dispatch = this.ensureMockDispatchState();
    const flight = dispatch.flights.find((item) => item.id === flightId);

    if (!flight) {
      throw new Error(`Mock flight not found: ${flightId}.`);
    }

    if (flight.status !== "IN_PROGRESS") {
      throw new Error("Only in-progress mock flights can start an ACARS session.");
    }

    if (flight.acarsSession) {
      throw new Error("A mock ACARS session already exists for this flight.");
    }

    const startedAt = new Date().toISOString();
    const sessionId = `mock-session-${String(this.mockSessionCounter).padStart(4, "0")}`;
    this.mockSessionCounter += 1;

    const session = buildMockSessionSummary(
      this.config,
      flight,
      sessionId,
      startedAt,
    );

    this.mockSessionStates.set(session.id, {
      session,
      telemetryCount: 0,
    });

    this.mockSequences.set(session.id, {
      nextIndex: 0,
      steps: createMockTelemetrySequence(new Date(startedAt)),
    });

    flight.acarsSession = {
      id: session.id,
      status: session.status,
      detectedPhase: session.detectedPhase,
    };

    return cloneValue(session);
  }

  private sendMockTelemetry(
    sessionId: string,
    payload: TelemetryInput,
    expectedPhase?: string,
  ): SessionSummary {
    const state = this.ensureMockSessionState(sessionId);

    if (state.session.status === "COMPLETED") {
      throw new Error("This mock ACARS session is already completed.");
    }

    if (state.session.status === "ABORTED") {
      throw new Error("This mock ACARS session is already aborted.");
    }

    const capturedAtDate = payload.capturedAt
      ? new Date(payload.capturedAt)
      : new Date();

    if (Number.isNaN(capturedAtDate.getTime())) {
      throw new Error("capturedAt must be a valid ISO-8601 datetime.");
    }

    const capturedAt = capturedAtDate.toISOString();
    state.telemetryCount += 1;

    const latestTelemetry = buildLatestTelemetry(
      `mock-telemetry-${sessionId}-${state.telemetryCount}`,
      payload,
      capturedAt,
    );
    const nextPhase =
      expectedPhase ??
      detectMockPhase(state.session.detectedPhase, payload);

    state.session = {
      ...state.session,
      status: "TRACKING",
      lastTelemetryAt: capturedAt,
      lastHeartbeatAt: capturedAt,
      detectedPhase: nextPhase,
      currentPosition: {
        latitude: payload.latitude,
        longitude: payload.longitude,
        altitudeFt: payload.altitudeFt,
        groundspeedKts: payload.groundspeedKts,
        headingDeg: payload.headingDeg,
        verticalSpeedFpm: payload.verticalSpeedFpm,
        onGround: payload.onGround,
      },
      fuel: {
        departureFuelKg:
          state.session.fuel.departureFuelKg ??
          payload.fuelTotalKg ??
          null,
        arrivalFuelKg: payload.fuelTotalKg ?? state.session.fuel.arrivalFuelKg,
      },
      latestTelemetry,
    };

    this.syncMockFlightState(state.session);

    return cloneValue(state.session);
  }

  private completeMockSession(
    sessionId: string,
    pilotComment: string,
  ): SessionSummary {
    const state = this.ensureMockSessionState(sessionId);

    if (state.session.status === "COMPLETED") {
      throw new Error("This mock ACARS session is already completed.");
    }

    if (state.session.status === "ABORTED") {
      throw new Error("This mock ACARS session is already aborted.");
    }

    const completedAt = state.session.lastTelemetryAt ?? new Date().toISOString();
    const previousPhase = state.session.detectedPhase;
    const normalizedComment = pilotComment.trim() || null;
    const finalParkingDetected =
      previousPhase === "ARRIVAL_PARKING" ||
      (state.session.latestTelemetry?.onGround === true &&
        state.session.latestTelemetry.parkingBrake === true);

    state.session = {
      ...state.session,
      status: "COMPLETED",
      endedAt: completedAt,
      lastHeartbeatAt: completedAt,
      detectedPhase: "COMPLETED",
      flight: {
        ...state.session.flight,
        status: "COMPLETED",
      },
      pirep: {
        id: `mock-pirep-${sessionId}`,
        status: "SUBMITTED",
        source: "AUTO",
        submittedAt: completedAt,
      },
      eventSummary: {
        source: "desktop-mock",
        telemetryPointCount: state.telemetryCount,
        finalParkingDetected,
        completionPhase: previousPhase,
        sessionCompletedAt: completedAt,
        pilotComment: normalizedComment,
      },
    };

    this.syncMockFlightState(state.session);

    return cloneValue(state.session);
  }

  private syncMockFlightState(session: SessionSummary): void {
    const dispatch = this.ensureMockDispatchState();
    const flight = dispatch.flights.find((item) => item.id === session.flightId);

    if (!flight) {
      return;
    }

    flight.status = session.flight.status;
    flight.acarsSession = {
      id: session.id,
      status: session.status,
      detectedPhase: session.detectedPhase,
    };
    flight.pirep = session.pirep
      ? {
          id: session.pirep.id,
          status: session.pirep.status,
          source: session.pirep.source,
        }
      : null;

    const booking = dispatch.bookings.find(
      (item) => item.id === session.flight.bookingId,
    );

    if (booking) {
      if (session.flight.status === "COMPLETED") {
        booking.status = "COMPLETED";
        flight.booking.status = "COMPLETED";
      }

      booking.flight = {
        id: flight.id,
        status: flight.status,
      };
    }
  }

  private ensureAuthenticated(): AuthSession {
    if (!this.authSession) {
      throw new Error("Log in to the desktop client before using ACARS actions.");
    }

    return this.authSession;
  }

  private async refreshAuthSession(): Promise<void> {
    if (this.isMockBackend()) {
      return;
    }

    const currentSession = this.ensureAuthenticated();

    try {
      this.authSession = await this.requestJson<AuthSession>(
        this.config.apiBaseUrl,
        "/auth/refresh",
        {
          method: "POST",
          body: {
            refreshToken: currentSession.tokens.refreshToken,
          },
        },
      );
      this.log("desktop auth session refreshed");
    } catch {
      this.authSession = null;
      throw new Error(INVALID_DESKTOP_AUTH_SESSION_MESSAGE);
    }
  }

  private async authorizedRequestJson<T>(
    baseUrl: string,
    path: string,
    init: RequestInitWithJson = {},
  ): Promise<T> {
    const execute = async () => {
      const currentSession = this.ensureAuthenticated();

      return this.requestJson<T>(baseUrl, path, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          Authorization: `Bearer ${currentSession.tokens.accessToken}`,
        },
      });
    };

    try {
      return await execute();
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 401) {
        throw error;
      }

      await this.refreshAuthSession();

      try {
        return await execute();
      } catch (secondError) {
        if (secondError instanceof HttpError && secondError.status === 401) {
          this.authSession = null;
          throw new Error(INVALID_DESKTOP_AUTH_SESSION_MESSAGE);
        }

        throw secondError;
      }
    }
  }

  private async authorizedAcarsRequestJson<T>(
    path: string,
    init: RequestInitWithJson = {},
  ): Promise<T> {
    const primaryBaseUrl = normalizeAcarsBaseUrl(
      this.config.acarsBaseUrl,
      this.config.apiBaseUrl,
    );

    try {
      return await this.authorizedRequestJson<T>(primaryBaseUrl, path, init);
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 404) {
        throw error;
      }

      const fallbackBaseUrl = normalizeAcarsBaseUrl(
        this.config.apiBaseUrl,
        this.config.apiBaseUrl,
      );

      if (fallbackBaseUrl === primaryBaseUrl) {
        throw error;
      }

      this.log("acars request fallback to api base", {
        from: primaryBaseUrl,
        to: fallbackBaseUrl,
        path,
      });

      const payload = await this.authorizedRequestJson<T>(
        fallbackBaseUrl,
        path,
        init,
      );

      this.config = {
        ...this.config,
        acarsBaseUrl: fallbackBaseUrl,
      };

      return payload;
    }
  }

  private async requestJson<T>(
    baseUrl: string,
    path: string,
    init: RequestInitWithJson = {},
  ): Promise<T> {
    let response: Response;
    const fullUrl = buildRequestUrl(baseUrl, path);

    try {
      const headers = {
        ...(init.body !== undefined
          ? {
              "content-type": "application/json",
            }
          : {}),
        ...(init.headers ?? {}),
      };
      const requestInit: RequestInit = {
        method: init.method ?? "GET",
        headers,
      };

      if (init.body !== undefined) {
        requestInit.body = JSON.stringify(init.body);
      }

      this.log("request started", {
        method: requestInit.method ?? "GET",
        url: fullUrl,
      });
      if (/\/acars(\/|$)/iu.test(fullUrl)) {
        console.log("ACARS request URL:", fullUrl);
      }

      response = await fetch(fullUrl, {
        ...requestInit,
      });
      this.log("request completed", {
        method: requestInit.method ?? "GET",
        url: fullUrl,
        status: response.status,
      });
    } catch {
      throw new Error(
        `Unable to reach ${baseUrl}. Check that the backend is running.`,
      );
    }

    const payload = await this.readPayload(response);

    if (!response.ok) {
      throw new HttpError(
        response.status,
        extractErrorMessage(payload) ??
          `Request failed with status ${response.status}.`,
      );
    }

    return payload as T;
  }

  private async readPayload(response: Response): Promise<unknown> {
    const rawPayload = await response.text();

    if (!rawPayload) {
      return null;
    }

    try {
      return JSON.parse(rawPayload);
    } catch {
      return rawPayload;
    }
  }

  private log(
    message: string,
    details?: Record<string, unknown>,
  ): void {
    if (details) {
      console.info("[desktop-service]", message, details);
      return;
    }

    console.info("[desktop-service]", message);
  }
}
