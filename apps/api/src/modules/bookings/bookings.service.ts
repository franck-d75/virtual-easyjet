import {
  BadRequestException,
  ConflictException,
  Dependencies,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AircraftStatus,
  BookingStatus,
  Prisma,
} from "@va/database";
import type { AuthenticatedUser } from "@va/shared";

import {
  getRequiredPilotProfileId,
} from "../../common/utils/authenticated-user.utils.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CreateBookingDto } from "./dto/create-booking.dto.js";

const bookingInclude = {
  pilotProfile: {
    include: {
      user: true,
      rank: true,
      hub: true,
    },
  },
  schedule: true,
  route: {
    include: {
      departureAirport: true,
      arrivalAirport: true,
      aircraftType: {
        include: {
          minRank: true,
        },
      },
    },
  },
  aircraft: {
    include: {
      aircraftType: {
        include: {
          minRank: true,
        },
      },
      hub: true,
    },
  },
  departureAirport: true,
  arrivalAirport: true,
  flight: true,
} satisfies Prisma.BookingInclude;

type BookingRecord = Prisma.BookingGetPayload<{
  include: typeof bookingInclude;
}>;

@Injectable()
@Dependencies(PrismaService)
export class BookingsService {
  public constructor(private readonly prisma: PrismaService) {}

  public async listMine(user: AuthenticatedUser) {
    const pilotProfileId = getRequiredPilotProfileId(user);

    const bookings = await this.prisma.booking.findMany({
      where: { pilotProfileId },
      orderBy: { reservedAt: "desc" },
      include: bookingInclude,
    });

    return bookings.map((booking) => this.serializeBooking(booking));
  }

  public async listAll() {
    const bookings = await this.prisma.booking.findMany({
      orderBy: { reservedAt: "desc" },
      include: bookingInclude,
    });

    return bookings.map((booking) => this.serializeBooking(booking));
  }

  public async findById(id: string, requester: AuthenticatedUser) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: bookingInclude,
    });

    if (!booking) {
      throw new NotFoundException("Booking not found.");
    }

    this.assertBookingOwnership(booking, requester);

    return this.serializeBooking(booking);
  }

  public async create(user: AuthenticatedUser, payload: CreateBookingDto) {
    const pilotProfileId = getRequiredPilotProfileId(user);

    const [pilotProfile, schedule] = await Promise.all([
      this.prisma.pilotProfile.findUnique({
        where: { id: pilotProfileId },
        include: {
          rank: true,
        },
      }),
      this.prisma.schedule.findUnique({
        where: { id: payload.scheduleId },
        include: {
          route: {
            include: {
              aircraftType: {
                include: {
                  minRank: true,
                },
              },
            },
          },
          aircraft: {
            include: {
              aircraftType: {
                include: {
                  minRank: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (!pilotProfile) {
      throw new NotFoundException("Pilot profile not found.");
    }

    if (!schedule || !schedule.isActive) {
      throw new BadRequestException("The selected schedule is not available.");
    }

    if (!schedule.route.isActive) {
      throw new BadRequestException("The selected route is not active.");
    }

    if (!schedule.aircraft) {
      throw new BadRequestException(
        "The selected schedule is missing an assigned aircraft.",
      );
    }

    if (schedule.aircraft.status !== AircraftStatus.ACTIVE) {
      throw new BadRequestException("The selected aircraft is not available.");
    }

    if (
      schedule.route.aircraftTypeId &&
      schedule.route.aircraftTypeId !== schedule.aircraft.aircraftTypeId
    ) {
      throw new BadRequestException(
        "The assigned aircraft does not match the selected route.",
      );
    }

    const requiredRank =
      schedule.aircraft.aircraftType.minRank ??
      schedule.route.aircraftType?.minRank ??
      null;

    if (
      requiredRank &&
      (!pilotProfile.rank || pilotProfile.rank.sortOrder < requiredRank.sortOrder)
    ) {
      throw new ForbiddenException(
        "Your current rank does not allow booking this aircraft.",
      );
    }

    const bookedFor = new Date(payload.bookedFor);

    if (Number.isNaN(bookedFor.getTime()) || bookedFor.getTime() <= Date.now()) {
      throw new BadRequestException("bookedFor must be a future UTC datetime.");
    }

    const booking = await this.prisma.booking.create({
      data: {
        pilotProfileId,
        scheduleId: schedule.id,
        routeId: schedule.routeId,
        aircraftId: schedule.aircraftId ?? schedule.aircraft.id,
        departureAirportId: schedule.departureAirportId,
        arrivalAirportId: schedule.arrivalAirportId,
        reservedFlightNumber: schedule.callsign,
        bookedFor,
        status: BookingStatus.RESERVED,
        notes: payload.notes ?? null,
      },
      include: bookingInclude,
    });

    return this.serializeBooking(booking);
  }

  public async cancel(id: string, requester: AuthenticatedUser) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: bookingInclude,
    });

    if (!booking) {
      throw new NotFoundException("Booking not found.");
    }

    this.assertBookingOwnership(booking, requester);
    this.assertBookingIsCancellable(booking);

    const cancelledBooking = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
      },
      include: bookingInclude,
    });

    return this.serializeBooking(cancelledBooking);
  }

  private assertBookingOwnership(
    booking: BookingRecord,
    requester: AuthenticatedUser,
  ): void {
    const pilotProfileId = getRequiredPilotProfileId(requester);

    if (booking.pilotProfileId !== pilotProfileId) {
      throw new ForbiddenException("You cannot access this booking.");
    }
  }

  private assertBookingIsCancellable(booking: BookingRecord): void {
    if (booking.flight) {
      throw new ConflictException(
        "This booking already has a canonical flight and cannot be cancelled.",
      );
    }

    if (booking.status !== BookingStatus.RESERVED) {
      throw new BadRequestException("Only reserved bookings can be cancelled.");
    }

    if (booking.cancelledAt) {
      throw new BadRequestException("This booking is already cancelled.");
    }

    if (booking.expiresAt && booking.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("This booking has expired and is no longer usable.");
    }
  }

  private serializeBooking(booking: BookingRecord) {
    return {
      id: booking.id,
      status: booking.status,
      reservedFlightNumber: booking.reservedFlightNumber,
      bookedFor: booking.bookedFor,
      reservedAt: booking.reservedAt,
      expiresAt: booking.expiresAt,
      cancelledAt: booking.cancelledAt,
      notes: booking.notes,
      pilotProfile: {
        id: booking.pilotProfile.id,
        pilotNumber: booking.pilotProfile.pilotNumber,
        firstName: booking.pilotProfile.firstName,
        lastName: booking.pilotProfile.lastName,
        rank: booking.pilotProfile.rank
          ? {
              code: booking.pilotProfile.rank.code,
              name: booking.pilotProfile.rank.name,
              sortOrder: booking.pilotProfile.rank.sortOrder,
            }
          : null,
      },
      schedule: booking.schedule
        ? {
            id: booking.schedule.id,
            callsign: booking.schedule.callsign,
            daysOfWeek: booking.schedule.daysOfWeek,
            departureTimeUtc: booking.schedule.departureTimeUtc,
            arrivalTimeUtc: booking.schedule.arrivalTimeUtc,
          }
        : null,
      route: booking.route
        ? {
            id: booking.route.id,
            code: booking.route.code,
            flightNumber: booking.route.flightNumber,
            distanceNm: booking.route.distanceNm,
            blockTimeMinutes: booking.route.blockTimeMinutes,
          }
        : null,
      aircraft: {
        id: booking.aircraft.id,
        registration: booking.aircraft.registration,
        label: booking.aircraft.label,
        status: booking.aircraft.status,
        aircraftType: {
          id: booking.aircraft.aircraftType.id,
          icaoCode: booking.aircraft.aircraftType.icaoCode,
          name: booking.aircraft.aircraftType.name,
        },
      },
      departureAirport: {
        id: booking.departureAirport.id,
        icao: booking.departureAirport.icao,
        name: booking.departureAirport.name,
      },
      arrivalAirport: {
        id: booking.arrivalAirport.id,
        icao: booking.arrivalAirport.icao,
        name: booking.arrivalAirport.name,
      },
      flight: booking.flight
        ? {
            id: booking.flight.id,
            status: booking.flight.status,
          }
        : null,
    };
  }
}
