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

export interface LiveMapAircraft {
  callsign: string;
  flightNumber?: string;
  registration?: string | null;
  lat: number;
  lon: number;
  altitude: number;
  speed: number;
  phase: LiveMapPhase;
  heading: number;
  onGround?: boolean | null;
  track?: LiveMapTrackPoint[];
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
