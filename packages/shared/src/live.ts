export const FLIGHT_PHASES = [
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

export type LiveFlightPhase = (typeof FLIGHT_PHASES)[number];

export const LIVE_MAP_PHASES = [
  "PARKED",
  "PUSHBACK",
  "TAXI",
  "AIRBORNE",
] as const;

export type LiveMapPhase = (typeof LIVE_MAP_PHASES)[number];

export interface LiveMapTrackPoint {
  lat: number;
  lon: number;
  capturedAt: string;
}

export type LiveMapSimbriefRoutePointSource =
  | "ORIGIN"
  | "NAVLOG"
  | "DESTINATION";

export interface LiveMapSimbriefRoutePoint {
  ident: string | null;
  lat: number;
  lon: number;
  source: LiveMapSimbriefRoutePointSource;
}

export interface LiveMapSimbriefRoute {
  routeId: string | null;
  callsign: string | null;
  flightNumber: string | null;
  departureIcao: string;
  arrivalIcao: string;
  route: string | null;
  mode: "DIRECT" | "WAYPOINTS";
  points: LiveMapSimbriefRoutePoint[];
}

export interface LiveMapAircraft {
  callsign: string;
  flightNumber?: string;
  registration?: string | null;
  pilotDisplayName?: string | null;
  lat: number;
  lon: number;
  altitude: number;
  speed: number;
  fuelTotalKg?: number | null;
  passengersLive?: number | null;
  phase: LiveMapPhase;
  heading: number;
  onGround?: boolean | null;
  track?: LiveMapTrackPoint[];
  simbriefRoute?: LiveMapSimbriefRoute | null;
}

export interface LiveFlightSnapshot {
  sessionId: string;
  flightId: string;
  flightNumber: string;
  pilotNumber: string;
  phase: LiveFlightPhase;
  latitude: number;
  longitude: number;
  altitudeFt: number;
  groundspeedKts: number;
  headingDeg: number;
  updatedAt: string;
}
