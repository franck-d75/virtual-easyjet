import type { AuthSessionUser } from "@va/shared";

export type { LiveMapAircraft, LiveMapPhase } from "@va/shared";

export interface PublicStatsResponse {
  activePilots: number;
  completedFlights: number;
  totalFlightHours: number;
  validatedPireps: number;
}

export interface UserRoleSummary {
  code: string;
  name: string;
}

export interface UserMeResponse {
  id: string;
  email: string;
  username: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  roles: UserRoleSummary[];
  pilotProfile: {
    id: string;
    pilotNumber: string;
    firstName: string;
    lastName: string;
    status: string;
    countryCode: string | null;
    simbriefPilotId: string | null;
    hoursFlownMinutes: number;
    experiencePoints: number;
    hub: {
      code: string;
      name: string;
    } | null;
    rank: {
      code: string;
      name: string;
    } | null;
  } | null;
}

export interface SimbriefLookupResponse {
  pilotId: string;
  latestOfpJsonUrl: string;
  latestOfpXmlUrl: string;
}

export type SimbriefLatestOfpStatus =
  | "NOT_CONFIGURED"
  | "AVAILABLE"
  | "NOT_FOUND"
  | "ERROR";

export interface SimbriefLatestOfpAircraftResponse {
  icaoCode: string | null;
  name: string | null;
  registration: string | null;
}

export type SimbriefLatestOfpRoutePointSource =
  | "ORIGIN"
  | "NAVLOG"
  | "DESTINATION";

export interface SimbriefLatestOfpRoutePointResponse {
  ident: string | null;
  lat: number;
  lon: number;
  source: SimbriefLatestOfpRoutePointSource;
}

export interface SimbriefLatestOfpPlanResponse {
  callsign: string | null;
  flightNumber: string | null;
  departureIcao: string | null;
  arrivalIcao: string | null;
  route: string | null;
  cruiseAltitudeFt: number | null;
  estimatedTimeEnroute: string | null;
  generatedAt: string | null;
  aircraft: SimbriefLatestOfpAircraftResponse | null;
  routePoints: SimbriefLatestOfpRoutePointResponse[];
}

export interface SimbriefLatestOfpResponse {
  status: SimbriefLatestOfpStatus;
  pilotId: string | null;
  detail: string | null;
  fetchStatus: string | null;
  fetchedAt: string;
  source: SimbriefLookupResponse | null;
  plan: SimbriefLatestOfpPlanResponse | null;
}

export interface PilotProfileResponse {
  id: string;
  pilotNumber: string;
  callsign: string | null;
  firstName: string;
  lastName: string;
  countryCode: string | null;
  simbriefPilotId: string | null;
  status: string;
  experiencePoints: number;
  hoursFlownMinutes: number;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
  simbrief: SimbriefLookupResponse | null;
  user: {
    id: string;
    email: string;
    username: string;
    status: string;
  };
  hub: {
    id: string;
    code: string;
    name: string;
  } | null;
  rank: {
    id: string;
    code: string;
    name: string;
    sortOrder: number;
  } | null;
}

export interface AircraftResponse {
  id: string;
  registration: string;
  label: string | null;
  status: string;
  notes: string | null;
  aircraftType: {
    id: string;
    icaoCode: string;
    name: string;
    manufacturer: string | null;
    category: string | null;
    cruiseSpeedKts: number | null;
    minRank: {
      id: string;
      code: string;
      name: string;
      sortOrder: number;
    } | null;
  };
  hub: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export interface HubResponse {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  airport: {
    id: string;
    icao: string;
    iata: string | null;
    name: string;
    city: string | null;
    countryCode: string;
    latitude: number;
    longitude: number;
  };
}

export interface RouteResponse {
  id: string;
  code: string;
  flightNumber: string;
  distanceNm: number | null;
  blockTimeMinutes: number | null;
  isActive: boolean;
  notes: string | null;
  departureAirport: {
    id: string;
    icao: string;
    iata: string | null;
    name: string;
    city: string | null;
    countryCode: string;
  };
  arrivalAirport: {
    id: string;
    icao: string;
    iata: string | null;
    name: string;
    city: string | null;
    countryCode: string;
  };
  departureHub: {
    id: string;
    code: string;
    name: string;
  } | null;
  arrivalHub: {
    id: string;
    code: string;
    name: string;
  } | null;
  aircraftType: {
    id: string;
    icaoCode: string;
    name: string;
    manufacturer: string | null;
    category: string | null;
    minRank: {
      id: string;
      code: string;
      name: string;
      sortOrder: number;
    } | null;
  } | null;
}

export interface RouteScheduleResponse {
  id: string;
  callsign: string;
  daysOfWeek: number[];
  departureTimeUtc: string;
  arrivalTimeUtc: string;
  isActive: boolean;
  aircraft: {
    id: string;
    registration: string;
    label: string | null;
    aircraftType: {
      id: string;
      icaoCode: string;
      name: string;
    };
  } | null;
  departureAirport: {
    id: string;
    icao: string;
    name: string;
  };
  arrivalAirport: {
    id: string;
    icao: string;
    name: string;
  };
}

export interface RouteDetailResponse extends RouteResponse {
  schedules: RouteScheduleResponse[];
}

export interface BookingResponse {
  id: string;
  status: string;
  reservedFlightNumber: string;
  bookedFor: string;
  reservedAt: string;
  expiresAt: string | null;
  cancelledAt: string | null;
  notes: string | null;
  pilotProfile: {
    id: string;
    pilotNumber: string;
    firstName: string;
    lastName: string;
    rank: {
      code: string;
      name: string;
      sortOrder: number;
    } | null;
  };
  schedule: {
    id: string;
    callsign: string;
    daysOfWeek: number[];
    departureTimeUtc: string;
    arrivalTimeUtc: string;
  } | null;
  route: {
    id: string;
    code: string;
    flightNumber: string;
    distanceNm: number | null;
    blockTimeMinutes: number | null;
  } | null;
  aircraft: {
    id: string;
    registration: string;
    label: string | null;
    status: string;
    aircraftType: {
      id: string;
      icaoCode: string;
      name: string;
    };
  };
  departureAirport: {
    id: string;
    icao: string;
    name: string;
  };
  arrivalAirport: {
    id: string;
    icao: string;
    name: string;
  };
  flight: {
    id: string;
    status: string;
  } | null;
}

export interface FlightResponse {
  id: string;
  status: string;
  flightNumber: string;
  plannedOffBlockAt: string | null;
  actualOffBlockAt: string | null;
  actualTakeoffAt: string | null;
  actualLandingAt: string | null;
  actualOnBlockAt: string | null;
  distanceFlownNm: number | null;
  durationMinutes: number | null;
  booking: {
    id: string;
    status: string;
    bookedFor: string;
  };
  pilotProfile: {
    id: string;
    pilotNumber: string;
    firstName: string;
    lastName: string;
    rank: {
      code: string;
      name: string;
    } | null;
  };
  route: {
    id: string;
    code: string;
    flightNumber: string;
  } | null;
  aircraft: {
    id: string;
    registration: string;
    label: string | null;
    aircraftType: {
      id: string;
      icaoCode: string;
      name: string;
    };
  };
  departureAirport: {
    id: string;
    icao: string;
    name: string;
  };
  arrivalAirport: {
    id: string;
    icao: string;
    name: string;
  };
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

export interface SessionEnvelope {
  authenticated: boolean;
  user: AuthSessionUser | UserMeResponse;
}
