import { Dependencies, Injectable } from "@nestjs/common";
import {
  FlightStatus,
  PilotStatus,
  PirepStatus,
  Prisma,
} from "@va/database";

import { decimalToNumber } from "../../common/utils/decimal.utils.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  normalizeRulesContent,
  PUBLIC_RULES_SETTING_KEY,
} from "../rules/rules-content.js";

const aircraftInclude = {
  aircraftType: {
    include: {
      minRank: true,
    },
  },
  hub: true,
} satisfies Prisma.AircraftInclude;

const hubInclude = {
  airport: true,
} satisfies Prisma.HubInclude;

const routeInclude = {
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

type AircraftRecord = Prisma.AircraftGetPayload<{
  include: typeof aircraftInclude;
}>;

type HubRecord = Prisma.HubGetPayload<{
  include: typeof hubInclude;
}>;

type RouteRecord = Prisma.RouteGetPayload<{
  include: typeof routeInclude;
}>;

@Injectable()
@Dependencies(PrismaService)
export class PublicService {
  public constructor(private readonly prisma: PrismaService) {}

  public async getHome() {
    const [stats, aircraft, hubs, routes] = await Promise.all([
      this.getStats(),
      this.getAircraft(),
      this.getHubs(),
      this.getRoutes(),
    ]);

    return {
      stats,
      aircraft,
      hubs,
      routes,
    };
  }

  public async getStats() {
    const [
      activePilots,
      completedFlights,
      completedFlightAggregate,
      validatedPireps,
    ] = await Promise.all([
      this.prisma.pilotProfile.count({
        where: {
          status: PilotStatus.ACTIVE,
          OR: [
            {
              flights: {
                some: {
                  status: FlightStatus.COMPLETED,
                },
              },
            },
            {
              pireps: {
                some: {
                  status: PirepStatus.ACCEPTED,
                },
              },
            },
          ],
        },
      }),
      this.prisma.flight.count({
        where: {
          status: FlightStatus.COMPLETED,
        },
      }),
      this.prisma.flight.aggregate({
        where: {
          status: FlightStatus.COMPLETED,
        },
        _sum: {
          durationMinutes: true,
        },
      }),
      this.prisma.pirep.count({
        where: {
          status: PirepStatus.ACCEPTED,
        },
      }),
    ]);

    const totalFlightMinutes = completedFlightAggregate._sum.durationMinutes ?? 0;

    return {
      activePilots,
      completedFlights,
      totalFlightHours: Math.round(totalFlightMinutes / 60),
      validatedPireps,
    };
  }

  public async getAircraft() {
    const aircraft = await this.prisma.aircraft.findMany({
      orderBy: { registration: "asc" },
      include: aircraftInclude,
    });

    return aircraft.map((airframe) => this.serializeAircraft(airframe));
  }

  public async getHubs() {
    const hubs = await this.prisma.hub.findMany({
      orderBy: { code: "asc" },
      include: hubInclude,
    });

    return hubs.map((hub) => this.serializeHub(hub));
  }

  public async getRoutes() {
    const routes = await this.prisma.route.findMany({
      orderBy: { code: "asc" },
      include: routeInclude,
    });

    return routes.map((route) => this.serializeRoute(route));
  }

  public async getRules() {
    const setting = await this.prisma.setting.findUnique({
      where: {
        key: PUBLIC_RULES_SETTING_KEY,
      },
      include: {
        updatedBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    const content = normalizeRulesContent(setting?.value);

    return {
      sections: content.sections,
      updatedAt: setting?.updatedAt.toISOString() ?? null,
      updatedBy: setting?.updatedBy ?? null,
    };
  }

  private serializeAircraft(aircraft: AircraftRecord) {
    return {
      id: aircraft.id,
      registration: aircraft.registration,
      label: aircraft.label,
      status: aircraft.status,
      notes: aircraft.notes,
      aircraftType: {
        id: aircraft.aircraftType.id,
        icaoCode: aircraft.aircraftType.icaoCode,
        name: aircraft.aircraftType.name,
        manufacturer: aircraft.aircraftType.manufacturer,
        category: aircraft.aircraftType.category,
        cruiseSpeedKts: aircraft.aircraftType.cruiseSpeedKts,
        minRank: aircraft.aircraftType.minRank
          ? {
              id: aircraft.aircraftType.minRank.id,
              code: aircraft.aircraftType.minRank.code,
              name: aircraft.aircraftType.minRank.name,
              sortOrder: aircraft.aircraftType.minRank.sortOrder,
            }
          : null,
      },
      hub: aircraft.hub
        ? {
            id: aircraft.hub.id,
            code: aircraft.hub.code,
            name: aircraft.hub.name,
          }
        : null,
    };
  }

  private serializeHub(hub: HubRecord) {
    return {
      id: hub.id,
      code: hub.code,
      name: hub.name,
      isActive: hub.isActive,
      airport: {
        id: hub.airport.id,
        icao: hub.airport.icao,
        iata: hub.airport.iata,
        name: hub.airport.name,
        city: hub.airport.city,
        countryCode: hub.airport.countryCode,
        latitude: decimalToNumber(hub.airport.latitude),
        longitude: decimalToNumber(hub.airport.longitude),
      },
    };
  }

  private serializeRoute(route: RouteRecord) {
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

