import type { AuthSessionUser, UserPlatformRole } from "@va/shared";

export type { LiveMapAircraft, LiveMapPhase } from "@va/shared";

export interface PublicStatsResponse {
  activePilots: number;
  completedFlights: number;
  totalFlightHours: number;
  validatedPireps: number;
}

export interface RankResponse {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  minFlights: number;
  minHoursMinutes: number;
  minScore: number;
  description: string | null;
  isActive: boolean;
}

export interface PublicHomeResponse {
  stats: PublicStatsResponse;
  aircraft: AircraftResponse[];
  hubs: HubResponse[];
  routes: RouteResponse[];
}

export interface UserRoleSummary {
  code: string;
  name: string;
}

export interface UserMeResponse {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  role: UserPlatformRole;
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
  simbriefAirframeId: string | null;
  matchedAirframe?: SimbriefAirframeResponse | null;
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
  distanceNm: number | null;
  cruiseAltitudeFt: number | null;
  estimatedTimeEnroute: string | null;
  blockTimeMinutes: number | null;
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

export interface SimbriefAirframeResponse {
  id: string | null;
  simbriefAirframeId: string;
  externalAirframeId?: string | null;
  source?: "MANUAL" | "SIMBRIEF";
  name: string;
  aircraftIcao: string;
  registration: string | null;
  selcal: string | null;
  equipment: string | null;
  engineType: string | null;
  wakeCategory: string | null;
  notes?: string | null;
  rawJson: unknown;
  linkedAircraftType: {
    id: string;
    icaoCode: string;
    name: string;
    manufacturer: string | null;
  } | null;
  linkedAircraft: {
    id: string;
    registration: string;
    label: string | null;
    status: string;
    aircraftType: {
      id: string;
      icaoCode: string;
      name: string;
    };
    hub: {
      id: string;
      code: string;
      name: string;
    } | null;
  } | null;
  ownerUser?: {
    id: string;
    username: string;
    email: string;
  } | null;
  pilotProfile?: {
    id: string;
    pilotNumber: string;
    firstName: string;
    lastName: string;
  } | null;
  syncedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SimbriefAirframesResponse {
  status: SimbriefLatestOfpStatus;
  pilotId: string | null;
  detail: string | null;
  fetchStatus: string | null;
  fetchedAt: string;
  source: SimbriefLookupResponse | null;
  airframes: SimbriefAirframeResponse[];
}

export interface CreateSimbriefAirframePayload {
  name: string;
  registration: string;
  icao: string;
  engineType?: string | null;
}

export interface SimbriefImportedRouteResponse {
  action: "created" | "updated";
  message: string;
  route: RouteResponse;
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
    avatarUrl: string | null;
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
  simbriefAirframe?: {
    id: string;
    simbriefAirframeId: string;
    name: string;
    aircraftIcao: string;
    registration: string | null;
    linkedAircraftType: {
      id: string;
      icaoCode: string;
      name: string;
    } | null;
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

export interface AdminStatsResponse {
  totalUsers: number;
  totalPilots: number;
  totalAircraft: number;
  totalHubs: number;
  totalRoutes: number;
  activeBookings: number;
  inProgressFlights: number;
}

export interface AdminAcarsCleanupMatchResponse {
  bookingId: string;
  flightId: string | null;
  sessionId: string | null;
  pirepId: string | null;
  pilotNumber: string;
  flightNumber: string;
  bookingNotes: string | null;
}

export interface AdminAcarsCleanupCountsResponse {
  bookings: number;
  flights: number;
  sessions: number;
  pireps: number;
  telemetryPoints: number;
  flightEvents: number;
  violations: number;
}

export interface AdminAcarsCleanupResponse {
  dryRun: boolean;
  criteria: {
    flightNumbers: string[];
    pilotNumbers: string[];
    bookingNotesPrefix: string;
    createdAfter: string;
  };
  counts: AdminAcarsCleanupCountsResponse;
  matches: AdminAcarsCleanupMatchResponse[];
  deleted?: AdminAcarsCleanupCountsResponse;
}

export interface AdminUserSummaryResponse {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  role: UserPlatformRole;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  pilotProfile: {
    id: string;
    pilotNumber: string;
    callsign: string | null;
    firstName: string;
    lastName: string;
    countryCode: string | null;
    status: string;
    hoursFlownMinutes: number;
    experiencePoints: number;
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
  } | null;
  stats: {
    hoursFlownMinutes: number;
    bookingsCount: number;
    pirepsCount: number;
    flightsCount: number;
  };
}

export interface AdminRecentBookingResponse {
  id: string;
  status: string;
  reservedFlightNumber: string;
  bookedFor: string;
  reservedAt: string;
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
  flight: {
    id: string;
    status: string;
  } | null;
}

export interface AdminRecentPirepResponse {
  id: string;
  status: string;
  source: string;
  submittedAt: string | null;
  createdAt: string;
  blockTimeMinutes: number | null;
  flightTimeMinutes: number | null;
  score: number | null;
  landingRateFpm: number | null;
  flight: {
    id: string;
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
}

export interface AdminUserDetailResponse {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  role: UserPlatformRole;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  pilotProfile: {
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
  } | null;
  stats: {
    hoursFlownMinutes: number;
    bookingsCount: number;
    activeBookingsCount: number;
    pirepsCount: number;
    flightsCount: number;
    completedFlightsCount: number;
  };
  recentBookings: AdminRecentBookingResponse[];
  recentPireps: AdminRecentPirepResponse[];
}

export interface AdminAirportOptionResponse {
  id: string;
  icao: string;
  iata: string | null;
  name: string;
  city: string | null;
  countryCode: string;
}

export interface AdminHubOptionResponse {
  id: string;
  code: string;
  name: string;
}

export interface AdminAircraftTypeOptionResponse {
  id: string;
  icaoCode: string;
  name: string;
  manufacturer: string | null;
}

export interface AdminReferenceDataResponse {
  airports: AdminAirportOptionResponse[];
  hubs: AdminHubOptionResponse[];
  aircraftTypes: AdminAircraftTypeOptionResponse[];
  simbriefAirframes: SimbriefAirframeResponse[];
}

export interface AdminAircraftPayload {
  registration: string;
  label?: string | null;
  aircraftTypeId: string;
  hubId?: string | null;
  status: string;
  notes?: string | null;
  simbriefAirframeId?: string | null;
}

export interface AdminAircraftImportFromSimbriefAirframePayload {
  simbriefAirframeId: string;
  hubId?: string | null;
  status?: string;
  notes?: string | null;
}

export interface AdminAircraftLinkSimbriefAirframePayload {
  simbriefAirframeId: string;
}

export interface AdminHubPayload {
  code: string;
  name: string;
  airportId: string;
  isActive?: boolean;
}

export interface AdminRoutePayload {
  code: string;
  flightNumber: string;
  departureAirportId: string;
  arrivalAirportId: string;
  departureHubId?: string | null;
  arrivalHubId?: string | null;
  aircraftTypeId?: string | null;
  distanceNm?: number | null;
  blockTimeMinutes?: number | null;
  isActive?: boolean;
  notes?: string | null;
}

export interface AdminUserPayload {
  role?: UserPlatformRole;
  status?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  pilotNumber?: string;
  callsign?: string | null;
  countryCode?: string | null;
}
