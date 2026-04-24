import { Dependencies, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@va/database";

import { PrismaService } from "../prisma/prisma.service.js";

const routeListInclude = {
  departureAirport: true,
  arrivalAirport: true,
  departureHub: true,
  arrivalHub: true,
  aircraftType: {
    include: {
      minRank: true,
    },
  },
} satisfies Prisma.RouteInclude;

const routeDetailInclude = {
  ...routeListInclude,
  schedules: {
    where: {
      isActive: true,
    },
    include: {
      aircraft: {
        include: {
          aircraftType: true,
        },
      },
      departureAirport: true,
      arrivalAirport: true,
    },
    orderBy: {
      departureTimeUtc: "asc",
    },
  },
} satisfies Prisma.RouteInclude;

type RouteListRecord = Prisma.RouteGetPayload<{
  include: typeof routeListInclude;
}>;

type RouteDetailRecord = Prisma.RouteGetPayload<{
  include: typeof routeDetailInclude;
}>;

@Injectable()
@Dependencies(PrismaService)
export class RoutesService {
  public constructor(private readonly prisma: PrismaService) {}

  public async findAll() {
    const routes = await this.prisma.route.findMany({
      orderBy: { code: "asc" },
      include: routeListInclude,
    });

    return routes.map((route) => this.serializeRoute(route));
  }

  public async findByCode(code: string) {
    const route = await this.prisma.route.findUnique({
      where: { code: code.toUpperCase() },
      include: routeDetailInclude,
    });

    if (!route) {
      throw new NotFoundException("Route not found.");
    }

    return {
      ...this.serializeRoute(route),
      schedules: route.schedules.map((schedule) => ({
        id: schedule.id,
        callsign: schedule.callsign,
        daysOfWeek: schedule.daysOfWeek,
        departureTimeUtc: schedule.departureTimeUtc,
        arrivalTimeUtc: schedule.arrivalTimeUtc,
        isActive: schedule.isActive,
        aircraft: schedule.aircraft
          ? {
              id: schedule.aircraft.id,
              registration: schedule.aircraft.registration,
              label: schedule.aircraft.label,
              aircraftType: {
                id: schedule.aircraft.aircraftType.id,
                icaoCode: schedule.aircraft.aircraftType.icaoCode,
                name: schedule.aircraft.aircraftType.name,
              },
            }
          : null,
        departureAirport: {
          id: schedule.departureAirport.id,
          icao: schedule.departureAirport.icao,
          name: schedule.departureAirport.name,
        },
        arrivalAirport: {
          id: schedule.arrivalAirport.id,
          icao: schedule.arrivalAirport.icao,
          name: schedule.arrivalAirport.name,
        },
      })),
    };
  }

  private serializeRoute(route: RouteListRecord | RouteDetailRecord) {
    return {
      id: route.id,
      code: route.code,
      flightNumber: route.flightNumber,
      distanceNm: route.distanceNm,
      blockTimeMinutes: route.blockTimeMinutes,
      isActive: route.isActive,
      notes: route.notes,
      departureAirport: {
        id: route.departureAirport.id,
        icao: route.departureAirport.icao,
        iata: route.departureAirport.iata,
        name: route.departureAirport.name,
        city: route.departureAirport.city,
        countryCode: route.departureAirport.countryCode,
      },
      arrivalAirport: {
        id: route.arrivalAirport.id,
        icao: route.arrivalAirport.icao,
        iata: route.arrivalAirport.iata,
        name: route.arrivalAirport.name,
        city: route.arrivalAirport.city,
        countryCode: route.arrivalAirport.countryCode,
      },
      departureHub: route.departureHub
        ? {
            id: route.departureHub.id,
            code: route.departureHub.code,
            name: route.departureHub.name,
          }
        : null,
      arrivalHub: route.arrivalHub
        ? {
            id: route.arrivalHub.id,
            code: route.arrivalHub.code,
            name: route.arrivalHub.name,
          }
        : null,
      aircraftType: route.aircraftType
        ? {
            id: route.aircraftType.id,
            icaoCode: route.aircraftType.icaoCode,
            name: route.aircraftType.name,
            manufacturer: route.aircraftType.manufacturer,
            category: route.aircraftType.category,
            minRank: route.aircraftType.minRank
              ? {
                  id: route.aircraftType.minRank.id,
                  code: route.aircraftType.minRank.code,
                  name: route.aircraftType.minRank.name,
                  sortOrder: route.aircraftType.minRank.sortOrder,
                }
              : null,
          }
        : null,
    };
  }
}

