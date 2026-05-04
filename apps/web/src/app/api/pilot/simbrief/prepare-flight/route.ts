import { createFlight, getMyBookings, getMyLatestSimbriefOfp } from "@/lib/api/pilot";
import { ApiError } from "@/lib/api/client";
import type {
  BookingResponse,
  PrepareSimbriefFlightPayload,
  PreparedSimbriefFlightResponse,
  SimbriefLatestOfpResponse,
} from "@/lib/api/types";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError } from "@/lib/observability/log";
import {
  buildBookingSimbriefCandidate,
  matchSimbriefCandidate,
} from "@/lib/utils/simbrief-match";

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

async function readPayload(request: Request): Promise<PrepareSimbriefFlightPayload> {
  const rawPayload = await request.text();

  if (rawPayload.trim().length === 0) {
    return {};
  }

  const payload = JSON.parse(rawPayload) as Record<string, unknown>;

  return {
    bookingId: normalizeOptionalString(payload.bookingId),
    detectedRegistration: normalizeOptionalString(payload.detectedRegistration),
    detectedAircraftIcao: normalizeOptionalString(payload.detectedAircraftIcao),
  };
}

function findRequestedBooking(
  bookings: BookingResponse[],
  bookingId: string,
): BookingResponse {
  const booking = bookings.find((candidate) => candidate.id === bookingId);

  if (!booking || booking.status === "CANCELLED" || booking.status === "EXPIRED") {
    throw new ApiError(
      "Cette réservation n'est plus exploitable pour générer un vol SimBrief.",
      400,
    );
  }

  return booking;
}

function findLinkedSimbriefAircraftId(
  latestOfp: SimbriefLatestOfpResponse,
): string | undefined {
  return latestOfp.plan?.aircraft?.matchedAirframe?.linkedAircraft?.id ?? undefined;
}

export async function POST(request: Request) {
  try {
    const payload = await readPayload(request);
    const bookingId = payload.bookingId;

    if (!bookingId) {
      throw new ApiError("La réservation à générer est requise.", 400);
    }

    const result = await executeWithBackendAccess(async (accessToken) => {
      const [bookings, latestOfp] = await Promise.all([
        getMyBookings(accessToken),
        getMyLatestSimbriefOfp(accessToken),
      ]);
      const booking = findRequestedBooking(bookings, bookingId);

      if (booking.flight) {
        return {
          action: "reused",
          message: "Le vol réservé existe déjà.",
          status: "READY",
          flightId: booking.flight.id,
          bookingId: booking.id,
          persistedStatus: booking.flight.status,
          flightNumber: booking.reservedFlightNumber,
          departureIcao: booking.departureAirport.icao,
          arrivalIcao: booking.arrivalAirport.icao,
          route: latestOfp.plan?.route ?? null,
          distanceNm: latestOfp.plan?.distanceNm ?? booking.route?.distanceNm ?? null,
          blockTimeMinutes:
            latestOfp.plan?.blockTimeMinutes ?? booking.route?.blockTimeMinutes ?? null,
          aircraft: {
            id: booking.aircraft.id,
            registration: booking.aircraft.registration,
            label: booking.aircraft.label,
            aircraftType: {
              icaoCode: booking.aircraft.aircraftType.icaoCode,
              name: booking.aircraft.aircraftType.name,
            },
          },
        } satisfies PreparedSimbriefFlightResponse;
      }

      const simbriefMatch = matchSimbriefCandidate(
        latestOfp,
        buildBookingSimbriefCandidate(booking),
      );

      if (simbriefMatch.status !== "MATCHED") {
        throw new ApiError(simbriefMatch.detail, 400, simbriefMatch);
      }

      const linkedAircraftId = findLinkedSimbriefAircraftId(latestOfp);
      const flight = await createFlight(accessToken, {
        bookingId: booking.id,
        ...(linkedAircraftId ? { aircraftId: linkedAircraftId } : {}),
      });

      return {
        action: "created",
        message: "Le vol SimBrief est prêt pour ACARS.",
        status: "READY",
        flightId: flight.id,
        bookingId: flight.booking.id,
        persistedStatus: flight.status,
        flightNumber: flight.flightNumber,
        departureIcao: flight.departureAirport.icao,
        arrivalIcao: flight.arrivalAirport.icao,
        route: latestOfp.plan?.route ?? null,
        distanceNm: latestOfp.plan?.distanceNm ?? booking.route?.distanceNm ?? null,
        blockTimeMinutes:
          latestOfp.plan?.blockTimeMinutes ?? booking.route?.blockTimeMinutes ?? null,
        aircraft: {
          id: flight.aircraft.id,
          registration: flight.aircraft.registration,
          label: flight.aircraft.label,
          aircraftType: {
            icaoCode: flight.aircraft.aircraftType.icaoCode,
            name: flight.aircraft.aircraftType.name,
          },
        },
      } satisfies PreparedSimbriefFlightResponse;
    });

    return createBackendJsonResponse(result.data, result.refreshedSession);
  } catch (error) {
    logWebError("pilot simbrief prepare flight failed", error);
    return createBackendErrorResponse(error);
  }
}
