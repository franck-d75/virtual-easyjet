import type {
  BookingResponse,
  CreateSimbriefAirframePayload,
  FlightResponse,
  HubResponse,
  PilotProfileResponse,
  SimbriefAirframeResponse,
  SimbriefAirframesResponse,
  SimbriefImportedRouteResponse,
  SimbriefLatestOfpResponse,
  UserMeResponse,
} from "./types";
import { apiRequest } from "./client";

export interface UpdateMyPilotProfilePayload {
  username?: string;
  firstName?: string;
  lastName?: string;
  pilotNumber?: string | null;
  countryCode?: string | null;
  callsign?: string | null;
  simbriefPilotId?: string | null;
  preferredHubId?: HubResponse["id"] | null;
}

export async function getMyPilotProfile(
  accessToken: string,
): Promise<PilotProfileResponse> {
  return apiRequest<PilotProfileResponse>("/pilot-profiles/me", {
    accessToken,
    cache: "no-store",
  });
}

export async function updateMyPilotProfile(
  accessToken: string,
  payload: UpdateMyPilotProfilePayload,
): Promise<PilotProfileResponse> {
  return apiRequest<PilotProfileResponse>("/pilot-profiles/me", {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

export async function resyncMyPilotProgress(
  accessToken: string,
): Promise<{
  message: string;
  progress: {
    completedFlightsCount: number;
    totalHoursFlownMinutes: number;
    totalExperiencePoints: number;
    promotedRankCode: string | null;
  };
  profile: PilotProfileResponse;
}> {
  return apiRequest<{
    message: string;
    progress: {
      completedFlightsCount: number;
      totalHoursFlownMinutes: number;
      totalExperiencePoints: number;
      promotedRankCode: string | null;
    };
    profile: PilotProfileResponse;
  }>("/pilot-profiles/me/resync-progress", {
    method: "POST",
    accessToken,
    cache: "no-store",
  });
}

export async function getMyLatestSimbriefOfp(
  accessToken: string,
): Promise<SimbriefLatestOfpResponse> {
  return apiRequest<SimbriefLatestOfpResponse>(
    "/pilot-profiles/me/simbrief/latest-ofp",
    {
      accessToken,
      cache: "no-store",
    },
  );
}

export async function getMySimbriefAirframes(
  accessToken: string,
): Promise<SimbriefAirframesResponse> {
  return apiRequest<SimbriefAirframesResponse>("/pilot/simbrief/airframes", {
    accessToken,
    cache: "no-store",
  });
}

export async function createMySimbriefAirframe(
  accessToken: string,
  payload: CreateSimbriefAirframePayload,
): Promise<SimbriefAirframeResponse> {
  return apiRequest<SimbriefAirframeResponse>("/pilot/simbrief/airframes", {
    accessToken,
    method: "POST",
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

export async function syncMySimbriefAirframes(
  accessToken: string,
): Promise<SimbriefAirframesResponse> {
  return apiRequest<SimbriefAirframesResponse>("/pilot/simbrief/airframes/sync", {
    accessToken,
    method: "POST",
    cache: "no-store",
  });
}

export async function importMySimbriefRoute(
  accessToken: string,
): Promise<SimbriefImportedRouteResponse> {
  return apiRequest<SimbriefImportedRouteResponse>("/pilot/simbrief/import-route", {
    accessToken,
    method: "POST",
    cache: "no-store",
  });
}

export async function uploadMyAvatar(
  accessToken: string,
  payload: FormData,
): Promise<UserMeResponse> {
  return apiRequest<UserMeResponse>("/users/me/avatar", {
    method: "POST",
    accessToken,
    body: payload,
    cache: "no-store",
  });
}

export async function getMyBookings(
  accessToken: string,
): Promise<BookingResponse[]> {
  return apiRequest<BookingResponse[]>("/bookings/me", {
    accessToken,
    cache: "no-store",
  });
}

export async function getMyFlights(
  accessToken: string,
): Promise<FlightResponse[]> {
  return apiRequest<FlightResponse[]>("/flights/me", {
    accessToken,
    cache: "no-store",
  });
}

export async function createBooking(
  accessToken: string,
  payload: {
    scheduleId: string;
    bookedFor: string;
    notes?: string;
  },
): Promise<BookingResponse> {
  return apiRequest<BookingResponse>("/bookings", {
    method: "POST",
    accessToken,
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

export async function cancelBooking(
  accessToken: string,
  bookingId: string,
): Promise<BookingResponse> {
  return apiRequest<BookingResponse>(
    `/bookings/${encodeURIComponent(bookingId)}/cancel`,
    {
      method: "POST",
      accessToken,
      cache: "no-store",
    },
  );
}

export async function createFlight(
  accessToken: string,
  payload: {
    bookingId: string;
  },
): Promise<FlightResponse> {
  return apiRequest<FlightResponse>("/flights", {
    method: "POST",
    accessToken,
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

export async function abortFlight(
  accessToken: string,
  flightId: string,
): Promise<FlightResponse> {
  return apiRequest<FlightResponse>(
    `/flights/${encodeURIComponent(flightId)}/abort`,
    {
      method: "POST",
      accessToken,
      cache: "no-store",
    },
  );
}

export async function completeFlight(
  accessToken: string,
  flightId: string,
  payload: {
    distanceFlownNm?: number;
    durationMinutes?: number;
  } = {},
): Promise<FlightResponse> {
  return apiRequest<FlightResponse>(
    `/flights/${encodeURIComponent(flightId)}/complete`,
    {
      method: "POST",
      accessToken,
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );
}
