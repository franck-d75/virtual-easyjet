import {
  BadRequestException,
  ConflictException,
  Dependencies,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BookingStatus,
  FlightStatus,
  Prisma,
} from "@va/database";
import type { AuthenticatedUser } from "@va/shared";

import {
  getRequiredPilotProfileId,
} from "../../common/utils/authenticated-user.utils.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CompleteFlightDto } from "./dto/complete-flight.dto.js";
import type { CreateFlightDto } from "./dto/create-flight.dto.js";

const flightInclude = {
  booking: true,
  pilotProfile: {
    include: {
      user: true,
      rank: true,
    },
  },
  route: {
    include: {
      departureAirport: true,
      arrivalAirport: true,
    },
  },
  aircraft: {
    include: {
      aircraftType: true,
      hub: true,
    },
  },
  departureAirport: true,
  arrivalAirport: true,
  acarsSession: true,
  pirep: true,
} satisfies Prisma.FlightInclude;

type FlightRecord = Prisma.FlightGetPayload<{
  include: typeof flightInclude;
}>;

const ACTIVE_FLIGHT_STATUSES: FlightStatus[] = [
  FlightStatus.PLANNED,
  FlightStatus.IN_PROGRESS,
];

@Injectable()
@Dependencies(PrismaService)
export class FlightsService {
  public constructor(private readonly prisma: PrismaService) {}

  public async listMine(user: AuthenticatedUser) {
    const pilotProfileId = getRequiredPilotProfileId(user);

    const flights = await this.prisma.flight.findMany({
      where: { pilotProfileId },
      orderBy: { createdAt: "desc" },
      include: flightInclude,
    });

    return flights.map((flight) => this.serializeFlight(flight));
  }

  public async listAll() {
    const flights = await this.prisma.flight.findMany({
      orderBy: { createdAt: "desc" },
      include: flightInclude,
    });

    return flights.map((flight) => this.serializeFlight(flight));
  }

  public async findById(id: string, requester: AuthenticatedUser) {
    const flight = await this.prisma.flight.findUnique({
      where: { id },
      include: flightInclude,
    });

    if (!flight) {
      throw new NotFoundException("Flight not found.");
    }

    this.assertFlightOwnership(flight, requester);

    return this.serializeFlight(flight);
  }

  public async create(user: AuthenticatedUser, payload: CreateFlightDto) {
    const pilotProfileId = getRequiredPilotProfileId(user);

    const flight = await this.prisma.$transaction(async (transaction) => {
      const booking = await transaction.booking.findUnique({
        where: { id: payload.bookingId },
        include: {
          flight: true,
        },
      });

      if (!booking) {
        throw new NotFoundException("Booking not found.");
      }

      this.assertBookingOwnershipForFlightCreation(booking, pilotProfileId);
      this.assertBookingIsUsableForFlightCreation(booking);

      const createdFlight = await transaction.flight.create({
        data: {
          bookingId: booking.id,
          pilotProfileId: booking.pilotProfileId,
          routeId: booking.routeId,
          aircraftId: booking.aircraftId,
          departureAirportId: booking.departureAirportId,
          arrivalAirportId: booking.arrivalAirportId,
          flightNumber: booking.reservedFlightNumber,
          status: FlightStatus.IN_PROGRESS,
          plannedOffBlockAt: booking.bookedFor,
        },
      });

      await transaction.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.IN_PROGRESS,
        },
      });

      return transaction.flight.findUniqueOrThrow({
        where: { id: createdFlight.id },
        include: flightInclude,
      });
    });

    return this.serializeFlight(flight);
  }

  public async abort(id: string, requester: AuthenticatedUser) {
    const pilotProfileId = getRequiredPilotProfileId(requester);

    const abortedFlight = await this.prisma.$transaction(async (transaction) => {
      const flight = await transaction.flight.findUnique({
        where: { id },
        include: flightInclude,
      });

      if (!flight) {
        throw new NotFoundException("Flight not found.");
      }

      this.assertFlightOwnershipByPilotProfileId(flight, pilotProfileId);
      this.assertFlightIsAbortable(flight);
      this.assertBookingStateForFlightMutation(flight.booking.status);

      await transaction.booking.update({
        where: { id: flight.bookingId },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      return transaction.flight.update({
        where: { id: flight.id },
        data: {
          status: FlightStatus.ABORTED,
        },
        include: flightInclude,
      });
    });

    return this.serializeFlight(abortedFlight);
  }

  public async complete(
    id: string,
    requester: AuthenticatedUser,
    payload: CompleteFlightDto,
  ) {
    const pilotProfileId = getRequiredPilotProfileId(requester);

    const completedFlight = await this.prisma.$transaction(async (transaction) => {
      const flight = await transaction.flight.findUnique({
        where: { id },
        include: flightInclude,
      });

      if (!flight) {
        throw new NotFoundException("Flight not found.");
      }

      this.assertFlightOwnershipByPilotProfileId(flight, pilotProfileId);
      this.assertFlightIsCompletable(flight);
      this.assertBookingStateForFlightMutation(flight.booking.status);

      const actualOffBlockAt = payload.actualOffBlockAt
        ? new Date(payload.actualOffBlockAt)
        : flight.actualOffBlockAt;
      const actualTakeoffAt = payload.actualTakeoffAt
        ? new Date(payload.actualTakeoffAt)
        : flight.actualTakeoffAt;
      const actualLandingAt = payload.actualLandingAt
        ? new Date(payload.actualLandingAt)
        : flight.actualLandingAt;
      const actualOnBlockAt = payload.actualOnBlockAt
        ? new Date(payload.actualOnBlockAt)
        : new Date();

      if (actualOffBlockAt && actualOffBlockAt > actualOnBlockAt) {
        throw new BadRequestException(
          "actualOffBlockAt cannot be later than actualOnBlockAt.",
        );
      }

      if (
        actualTakeoffAt &&
        actualLandingAt &&
        actualTakeoffAt > actualLandingAt
      ) {
        throw new BadRequestException(
          "actualTakeoffAt cannot be later than actualLandingAt.",
        );
      }

      const computedDurationMinutes =
        payload.durationMinutes ??
        (actualOffBlockAt
          ? Math.max(
              0,
              Math.round(
                (actualOnBlockAt.getTime() - actualOffBlockAt.getTime()) / 60_000,
              ),
            )
          : flight.durationMinutes);

      await transaction.booking.update({
        where: { id: flight.bookingId },
        data: {
          status: BookingStatus.COMPLETED,
        },
      });

      return transaction.flight.update({
        where: { id: flight.id },
        data: {
          status: FlightStatus.COMPLETED,
          actualOffBlockAt,
          actualTakeoffAt,
          actualLandingAt,
          actualOnBlockAt,
          durationMinutes: computedDurationMinutes ?? null,
          distanceFlownNm: payload.distanceFlownNm ?? flight.distanceFlownNm,
        },
        include: flightInclude,
      });
    });

    return this.serializeFlight(completedFlight);
  }

  private assertBookingOwnershipForFlightCreation(
    booking: {
      pilotProfileId: string;
    },
    pilotProfileId: string,
  ): void {
    if (booking.pilotProfileId !== pilotProfileId) {
      throw new ForbiddenException("You cannot create a flight from this booking.");
    }
  }

  private assertBookingIsUsableForFlightCreation(booking: {
    status: BookingStatus;
    flight: { id: string } | null;
    cancelledAt: Date | null;
    expiresAt: Date | null;
  }): void {
    if (booking.flight) {
      throw new ConflictException(
        "This booking already has a canonical flight.",
      );
    }

    if (booking.status !== BookingStatus.RESERVED) {
      throw new BadRequestException(
        "Only reserved bookings can start a canonical flight.",
      );
    }

    if (booking.cancelledAt) {
      throw new BadRequestException("This booking is no longer valid.");
    }

    if (booking.expiresAt && booking.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("This booking has expired and cannot be used.");
    }
  }

  private assertFlightOwnership(
    flight: FlightRecord,
    requester: AuthenticatedUser,
  ): void {
    const pilotProfileId = getRequiredPilotProfileId(requester);
    this.assertFlightOwnershipByPilotProfileId(flight, pilotProfileId);
  }

  private assertFlightOwnershipByPilotProfileId(
    flight: {
      pilotProfileId: string;
    },
    pilotProfileId: string,
  ): void {
    if (flight.pilotProfileId !== pilotProfileId) {
      throw new ForbiddenException("You cannot access this flight.");
    }
  }

  private assertFlightIsAbortable(flight: {
    status: FlightStatus;
  }): void {
    if (flight.status === FlightStatus.ABORTED) {
      throw new ConflictException("This flight is already aborted.");
    }

    if (flight.status === FlightStatus.COMPLETED) {
      throw new ConflictException("This flight is already completed.");
    }

    if (!ACTIVE_FLIGHT_STATUSES.includes(flight.status)) {
      throw new BadRequestException("Only active flights can be aborted.");
    }
  }

  private assertFlightIsCompletable(flight: {
    status: FlightStatus;
  }): void {
    if (flight.status === FlightStatus.COMPLETED) {
      throw new ConflictException("This flight is already completed.");
    }

    if (flight.status === FlightStatus.ABORTED) {
      throw new ConflictException("This flight is already aborted.");
    }

    if (!ACTIVE_FLIGHT_STATUSES.includes(flight.status)) {
      throw new BadRequestException("Only active flights can be completed.");
    }
  }

  private assertBookingStateForFlightMutation(status: BookingStatus): void {
    if (status !== BookingStatus.IN_PROGRESS) {
      throw new BadRequestException(
        "The linked booking is not in a valid in-progress state.",
      );
    }
  }

  private serializeFlight(flight: FlightRecord) {
    return {
      id: flight.id,
      status: flight.status,
      flightNumber: flight.flightNumber,
      plannedOffBlockAt: flight.plannedOffBlockAt,
      actualOffBlockAt: flight.actualOffBlockAt,
      actualTakeoffAt: flight.actualTakeoffAt,
      actualLandingAt: flight.actualLandingAt,
      actualOnBlockAt: flight.actualOnBlockAt,
      distanceFlownNm: flight.distanceFlownNm,
      durationMinutes: flight.durationMinutes,
      booking: {
        id: flight.booking.id,
        status: flight.booking.status,
        bookedFor: flight.booking.bookedFor,
      },
      pilotProfile: {
        id: flight.pilotProfile.id,
        pilotNumber: flight.pilotProfile.pilotNumber,
        firstName: flight.pilotProfile.firstName,
        lastName: flight.pilotProfile.lastName,
        rank: flight.pilotProfile.rank
          ? {
              code: flight.pilotProfile.rank.code,
              name: flight.pilotProfile.rank.name,
            }
          : null,
      },
      route: flight.route
        ? {
            id: flight.route.id,
            code: flight.route.code,
            flightNumber: flight.route.flightNumber,
          }
        : null,
      aircraft: {
        id: flight.aircraft.id,
        registration: flight.aircraft.registration,
        label: flight.aircraft.label,
        aircraftType: {
          id: flight.aircraft.aircraftType.id,
          icaoCode: flight.aircraft.aircraftType.icaoCode,
          name: flight.aircraft.aircraftType.name,
        },
      },
      departureAirport: {
        id: flight.departureAirport.id,
        icao: flight.departureAirport.icao,
        name: flight.departureAirport.name,
      },
      arrivalAirport: {
        id: flight.arrivalAirport.id,
        icao: flight.arrivalAirport.icao,
        name: flight.arrivalAirport.name,
      },
      acarsSession: flight.acarsSession
        ? {
            id: flight.acarsSession.id,
            status: flight.acarsSession.status,
            detectedPhase: flight.acarsSession.detectedPhase,
          }
        : null,
      pirep: flight.pirep
        ? {
            id: flight.pirep.id,
            status: flight.pirep.status,
            source: flight.pirep.source,
          }
        : null,
    };
  }
}
