export declare const FLIGHT_PHASES: readonly ["PRE_FLIGHT", "DEPARTURE_PARKING", "PUSHBACK", "TAXI_OUT", "TAKEOFF", "CLIMB", "CRUISE", "DESCENT", "APPROACH", "LANDING", "TAXI_IN", "ARRIVAL_PARKING", "COMPLETED"];
export type LiveFlightPhase = (typeof FLIGHT_PHASES)[number];
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
