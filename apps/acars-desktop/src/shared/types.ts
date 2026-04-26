export type BackendMode = "mock" | "live";
export type TelemetryMode = "mock" | "simconnect";

export interface DesktopConfig {
  apiBaseUrl: string;
  acarsBaseUrl: string;
  clientVersion: string;
  simulatorProvider: string;
  backendMode: BackendMode;
  telemetryMode: TelemetryMode;
}

export interface LoginInput {
  backendMode: BackendMode;
  apiBaseUrl: string;
  acarsBaseUrl: string;
  identifier: string;
  password: string;
}

export interface DesktopPilotProfile {
  id: string;
  pilotNumber: string;
  firstName: string;
  lastName: string;
  status: string;
  rankId: string | null;
  hubId: string | null;
}

export interface DesktopUser {
  id: string;
  email: string;
  username: string;
  roles: string[];
  pilotProfileId?: string;
  pilotProfile: DesktopPilotProfile | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
}

export interface AuthSession {
  user: DesktopUser;
  tokens: AuthTokens;
}

export interface DesktopSnapshot {
  config: DesktopConfig;
  isAuthenticated: boolean;
  user: DesktopUser | null;
}

export interface AirportSummary {
  id?: string;
  icao: string;
  name: string;
}

export interface AircraftSummary {
  id: string;
  registration: string;
  label: string | null;
  aircraftType: {
    id?: string;
    icaoCode: string;
    name: string;
  };
}

export interface BookingSummary {
  id: string;
  status: string;
  reservedFlightNumber: string;
  bookedFor: string;
  departureAirport: AirportSummary;
  arrivalAirport: AirportSummary;
  aircraft: AircraftSummary;
  flight: {
    id: string;
    status: string;
  } | null;
}

export interface FlightSummary {
  id: string;
  status: string;
  flightNumber: string;
  booking: {
    id: string;
    status: string;
    bookedFor: string;
  };
  departureAirport: AirportSummary;
  arrivalAirport: AirportSummary;
  aircraft: AircraftSummary;
  acarsSession: {
    id: string;
    status: string;
    detectedPhase: string;
  } | null;
  pirep: {
    id: string;
    status: string;
    source: string;
  } | null;
}

export interface LoadOperationsResult {
  bookings: BookingSummary[];
  usableBookings: BookingSummary[];
  flights: FlightSummary[];
  usableFlights: FlightSummary[];
}

export interface TelemetryInput {
  capturedAt?: string;
  latitude: number;
  longitude: number;
  altitudeFt: number;
  groundspeedKts: number;
  headingDeg: number;
  verticalSpeedFpm: number;
  onGround: boolean;
  fuelTotalKg?: number;
  gearPercent?: number;
  flapsPercent?: number;
  parkingBrake?: boolean;
}

export interface MockTelemetryStep {
  label: string;
  expectedPhase?: string;
  telemetry: TelemetryInput;
}

export interface CurrentPosition {
  latitude: number | null;
  longitude: number | null;
  altitudeFt: number | null;
  groundspeedKts: number | null;
  headingDeg: number | null;
  verticalSpeedFpm: number | null;
  onGround: boolean | null;
}

export interface FuelState {
  departureFuelKg: number | null;
  arrivalFuelKg: number | null;
}

export interface LatestTelemetry {
  id: string;
  capturedAt: string;
  latitude: number | null;
  longitude: number | null;
  altitudeFt: number | null;
  groundspeedKts: number | null;
  headingDeg: number | null;
  verticalSpeedFpm: number | null;
  onGround: boolean | null;
  fuelTotalKg: number | null;
  gearPercent: number | null;
  flapsPercent: number | null;
  parkingBrake: boolean | null;
}

export interface SessionSummary {
  id: string;
  flightId: string;
  simulatorProvider: string;
  clientVersion: string | null;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  disconnectedAt: string | null;
  connectCount: number;
  lastTelemetryAt: string | null;
  lastHeartbeatAt: string | null;
  detectedPhase: string;
  currentPosition: CurrentPosition;
  fuel: FuelState;
  latestTelemetry: LatestTelemetry | null;
  eventSummary: Record<string, unknown> | null;
  flight: {
    id: string;
    status: string;
    flightNumber: string;
    bookingId: string;
    departureAirport: AirportSummary;
    arrivalAirport: AirportSummary;
    aircraft: {
      registration: string;
      label: string | null;
      aircraftType: {
        icaoCode: string;
        name: string;
      };
    };
  };
  pirep: {
    id: string;
    status: string;
    source: string;
    submittedAt: string | null;
  } | null;
}

export interface MockProgress {
  session: SessionSummary;
  step: MockTelemetryStep | null;
  sentSteps: number;
  totalSteps: number;
  remainingSteps: number;
}

export interface MockResetResult {
  totalSteps: number;
  remainingSteps: number;
}

export interface DesktopBridge {
  getSnapshot: () => Promise<DesktopSnapshot>;
  login: (input: LoginInput) => Promise<DesktopSnapshot>;
  logout: () => Promise<DesktopSnapshot>;
  loadDispatchData: () => Promise<LoadOperationsResult>;
  createSession: (flightId: string) => Promise<SessionSummary>;
  getSession: (sessionId: string) => Promise<SessionSummary>;
  sendManualTelemetry: (
    sessionId: string,
    payload: TelemetryInput,
  ) => Promise<SessionSummary>;
  sendNextMockTelemetry: (sessionId: string) => Promise<MockProgress>;
  resetMockSequence: (sessionId: string) => Promise<MockResetResult>;
  completeSession: (
    sessionId: string,
    pilotComment: string,
  ) => Promise<SessionSummary>;
}
