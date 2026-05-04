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
  FlightStatus,
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

const pilotProfileForBookingInclude = {
  rank: true,
} satisfies Prisma.PilotProfileInclude;

const scheduleForBookingInclude = {
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
} satisfies Prisma.ScheduleInclude;

const routeForBookingInclude = {
  aircraftType: {
    include: {
      minRank: true,
    },
  },
} satisfies Prisma.RouteInclude;

const aircraftForBookingInclude = {
  aircraftType: {
    include: {
      minRank: true,
    },
  },
} satisfies Prisma.AircraftInclude;

const DIRECT_ROUTE_BOOKING_OFFSET_MS = 60 * 60 * 1_000;

type BookingRecord = Prisma.BookingGetPayload<{
  include: typeof bookingInclude;
}>;

type PilotProfileForBooking = Prisma.PilotProfileGetPayload<{
  include: typeof pilotProfileForBookingInclude;
}>;

type RouteForBooking = Prisma.RouteGetPayload<{
  include: typeof routeForBookingInclude;
}>;

type AircraftForBooking = Prisma.AircraftGetPayload<{
  include: typeof aircraftForBookingInclude;
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
    const scheduleId = payload.scheduleId?.trim() ?? "";
    const routeId = payload.routeId?.trim() ?? "";

    if (!scheduleId && !routeId) {
      throw new BadRequestException(
        "A scheduleId or routeId is required to create a booking.",
      );
    }

    const pilotProfile = await this.prisma.pilotProfile.findUnique({
      where: { id: pilotProfileId },
      include: pilotProfileForBookingInclude,
    });

    if (!pilotProfile) {
      throw new NotFoundException("Pilot profile not found.");
    }

    if (scheduleId) {
      return this.createFromSchedule(pilotProfile, scheduleId, payload);
    }

    return this.createFromRoute(pilotProfile, routeId, payload);
  }

  private async createFromSchedule(
    pilotProfile: PilotProfileForBooking,
    scheduleId: string,
    payload: CreateBookingDto,
  ) {
    if (!payload.bookedFor) {
      throw new BadRequestException("bookedFor is required for schedule booking.");
    }

    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: scheduleForBookingInclude,
    });

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

    this.assertRankAllowsBooking(
      pilotProfile,
      schedule.aircraft.aircraftType.minRank ??
        schedule.route.aircraftType?.minRank ??
        null,
    );
    const bookedFor = this.parseBookedFor(payload.bookedFor);

    const booking = await this.prisma.booking.create({
      data: {
        pilotProfileId: pilotProfile.id,
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

  private async createFromRoute(
    pilotProfile: PilotProfileForBooking,
    routeId: string,
    payload: CreateBookingDto,
  ) {
    const route = await this.prisma.route.findUnique({
      where: { id: routeId },
      include: routeForBookingInclude,
    });

    if (!route || !route.isActive) {
      throw new BadRequestException("The selected route is not available.");
    }

    const aircraft = await this.findAssignableAircraftForRoute(route);

    if (!aircraft) {
      throw new BadRequestException(
        "No active compatible aircraft is available for this route.",
      );
    }

    this.assertRankAllowsBooking(
      pilotProfile,
      aircraft.aircraftType.minRank ?? route.aircraftType?.minRank ?? null,
    );

    const bookedFor = this.parseBookedFor(
      payload.bookedFor ??
        new Date(Date.now() + DIRECT_ROUTE_BOOKING_OFFSET_MS).toISOString(),
    );

    const booking = await this.prisma.booking.create({
      data: {
        pilotProfileId: pilotProfile.id,
        routeId: route.id,
        aircraftId: aircraft.id,
        departureAirportId: route.departureAirportId,
        arrivalAirportId: route.arrivalAirportId,
        reservedFlightNumber: route.flightNumber,
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

    const cancelledAt = new Date();
    const cancelledBooking = await this.prisma.$transaction(async (transaction) => {
      await transaction.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt,
        },
      });

      if (booking.flight?.status === FlightStatus.PLANNED) {
        await transaction.flight.update({
          where: { id: booking.flight.id },
          data: {
            status: FlightStatus.CANCELLED,
          },
        });
      }

      return transaction.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: bookingInclude,
      });
    });

    return this.serializeBooking(cancelledBooking);
  }

  private async findAssignableAircraftForRoute(
    route: RouteForBooking,
  ): Promise<AircraftForBooking | null> {
    const commonWhere: Prisma.AircraftWhereInput = {
      status: AircraftStatus.ACTIVE,
      ...(route.aircraftTypeId ? { aircraftTypeId: route.aircraftTypeId } : {}),
    };

    if (route.departureHubId) {
      const hubAircraft = await this.prisma.aircraft.findFirst({
        where: {
          ...commonWhere,
          hubId: route.departureHubId,
        },
        include: aircraftForBookingInclude,
        orderBy: {
          registration: "asc",
        },
      });

      if (hubAircraft) {
        return hubAircraft;
      }
    }

    return this.prisma.aircraft.findFirst({
      where: commonWhere,
      include: aircraftForBookingInclude,
      orderBy: {
        registration: "asc",
      },
    });
  }

  private assertRankAllowsBooking(
    pilotProfile: Pick<PilotProfileForBooking, "rank">,
    requiredRank: { sortOrder: number } | null,
  ): void {
    if (
      requiredRank &&
      (!pilotProfile.rank || pilotProfile.rank.sortOrder < requiredRank.sortOrder)
    ) {
      throw new ForbiddenException(
        "Your current rank does not allow booking this aircraft.",
      );
    }
  }

  private parseBookedFor(value: string): Date {
    const bookedFor = new Date(value);

    if (Number.isNaN(bookedFor.getTime()) || bookedFor.getTime() <= Date.now()) {
      throw new BadRequestException("bookedFor must be a future UTC datetime.");
    }

    return bookedFor;
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
    if (
      booking.flight &&
      booking.flight.status !== FlightStatus.PLANNED
    ) {
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

