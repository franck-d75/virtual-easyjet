import type {
  BookingResponse,
  FlightResponse,
  PilotProfileResponse,
  SimbriefLatestOfpResponse,
} from "./types";
import { apiRequest } from "./client";

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
  payload: {
    simbriefPilotId?: string | null;
  },
): Promise<PilotProfileResponse> {
  return apiRequest<PilotProfileResponse>("/pilot-profiles/me", {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(payload),
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
