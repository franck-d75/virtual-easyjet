import {
  ConflictException,
  Dependencies,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  type AircraftStatus,
} from "@va/database";

import { decimalToNumber } from "../../common/utils/decimal.utils.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type {
  CreateAdminAircraftDto,
  CreateAdminHubDto,
  CreateAdminRouteDto,
  UpdateAdminAircraftDto,
  UpdateAdminHubDto,
  UpdateAdminRouteDto,
} from "./dto/admin.dto.js";

const adminAircraftInclude = {
  aircraftType: {
    include: {
      minRank: true,
    },
  },
  hub: true,
} satisfies Prisma.AircraftInclude;

const adminHubInclude = {
  airport: true,
} satisfies Prisma.HubInclude;

const adminRouteInclude = {
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

type AdminAircraftRecord = Prisma.AircraftGetPayload<{
  include: typeof adminAircraftInclude;
}>;

type AdminHubRecord = Prisma.HubGetPayload<{
  include: typeof adminHubInclude;
}>;

type AdminRouteRecord = Prisma.RouteGetPayload<{
  include: typeof adminRouteInclude;
}>;

function normalizeOptionalString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeOptionalInt(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

@Injectable()
@Dependencies(PrismaService)
export class AdminService {
  public constructor(private readonly prisma: PrismaService) {}

  public async getStats() {
    const [
      totalUsers,
      totalPilots,
      totalAircraft,
      totalHubs,
      totalRoutes,
      activeBookings,
      inProgressFlights,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.pilotProfile.count(),
      this.prisma.aircraft.count(),
      this.prisma.hub.count(),
      this.prisma.route.count(),
      this.prisma.booking.count({
        where: {
          status: {
            in: ["RESERVED", "IN_PROGRESS"],
          },
        },
      }),
      this.prisma.flight.count({
        where: {
          status: "IN_PROGRESS",
        },
      }),
    ]);

    return {
      totalUsers,
      totalPilots,
      totalAircraft,
      totalHubs,
      totalRoutes,
      activeBookings,
      inProgressFlights,
    };
  }

  public async getReferenceData() {
    const [airports, hubs, aircraftTypes] = await Promise.all([
      this.prisma.airport.findMany({
        orderBy: { icao: "asc" },
        select: {
          id: true,
          icao: true,
          iata: true,
          name: true,
          city: true,
          countryCode: true,
        },
      }),
      this.prisma.hub.findMany({
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
        },
      }),
      this.prisma.aircraftType.findMany({
        orderBy: { icaoCode: "asc" },
        select: {
          id: true,
          icaoCode: true,
          name: true,
          manufacturer: true,
        },
      }),
    ]);

    return {
      airports,
      hubs,
      aircraftTypes,
    };
  }

  public async listAircraft() {
    const aircraft = await this.prisma.aircraft.findMany({
      orderBy: { registration: "asc" },
      include: adminAircraftInclude,
    });

    return aircraft.map((item) => this.serializeAircraft(item));
  }

  public async getAircraft(id: string) {
    const aircraft = await this.prisma.aircraft.findUnique({
      where: { id },
      include: adminAircraftInclude,
    });

    if (!aircraft) {
      throw new NotFoundException("Aircraft not found.");
    }

    return this.serializeAircraft(aircraft);
  }

  public async createAircraft(payload: CreateAdminAircraftDto) {
    try {
      const aircraft = await this.prisma.aircraft.create({
        data: {
          registration: payload.registration.trim().toUpperCase(),
          label: normalizeOptionalString(payload.label),
          aircraftTypeId: payload.aircraftTypeId,
          hubId: normalizeOptionalString(payload.hubId),
          status: payload.status as AircraftStatus,
          notes: normalizeOptionalString(payload.notes),
        },
        include: adminAircraftInclude,
      });

      return this.serializeAircraft(aircraft);
    } catch (error) {
      throw this.normalizePrismaError(error, "Aircraft");
    }
  }

  public async updateAircraft(id: string, payload: UpdateAdminAircraftDto) {
    try {
      const aircraft = await this.prisma.aircraft.update({
        where: { id },
        data: {
          ...(payload.registration !== undefined
            ? { registration: payload.registration.trim().toUpperCase() }
            : {}),
          ...(payload.label !== undefined
            ? { label: normalizeOptionalString(payload.label) }
            : {}),
          ...(payload.aircraftTypeId !== undefined
            ? { aircraftTypeId: payload.aircraftTypeId }
            : {}),
          ...(payload.hubId !== undefined
            ? { hubId: normalizeOptionalString(payload.hubId) }
            : {}),
          ...(payload.status !== undefined ? { status: payload.status } : {}),
          ...(payload.notes !== undefined
            ? { notes: normalizeOptionalString(payload.notes) }
            : {}),
        },
        include: adminAircraftInclude,
      });

      return this.serializeAircraft(aircraft);
    } catch (error) {
      throw this.normalizePrismaError(error, "Aircraft");
    }
  }

  public async deleteAircraft(id: string) {
    try {
      await this.prisma.aircraft.delete({
        where: { id },
      });
    } catch (error) {
      throw this.normalizePrismaError(error, "Aircraft");
    }

    return { success: true };
  }

  public async listHubs() {
    const hubs = await this.prisma.hub.findMany({
      orderBy: { code: "asc" },
      include: adminHubInclude,
    });

    return hubs.map((item) => this.serializeHub(item));
  }

  public async getHub(id: string) {
    const hub = await this.prisma.hub.findUnique({
      where: { id },
      include: adminHubInclude,
    });

    if (!hub) {
      throw new NotFoundException("Hub not found.");
    }

    return this.serializeHub(hub);
  }

  public async createHub(payload: CreateAdminHubDto) {
    try {
      const hub = await this.prisma.hub.create({
        data: {
          code: payload.code.trim().toUpperCase(),
          name: payload.name.trim(),
          airportId: payload.airportId,
          isActive: payload.isActive ?? true,
        },
        include: adminHubInclude,
      });

      return this.serializeHub(hub);
    } catch (error) {
      throw this.normalizePrismaError(error, "Hub");
    }
  }

  public async updateHub(id: string, payload: UpdateAdminHubDto) {
    try {
      const hub = await this.prisma.hub.update({
        where: { id },
        data: {
          ...(payload.code !== undefined
            ? { code: payload.code.trim().toUpperCase() }
            : {}),
          ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
          ...(payload.airportId !== undefined ? { airportId: payload.airportId } : {}),
          ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        },
        include: adminHubInclude,
      });

      return this.serializeHub(hub);
    } catch (error) {
      throw this.normalizePrismaError(error, "Hub");
    }
  }

  public async deleteHub(id: string) {
    try {
      await this.prisma.hub.delete({
        where: { id },
      });
    } catch (error) {
      throw this.normalizePrismaError(error, "Hub");
    }

    return { success: true };
  }

  public async listRoutes() {
    const routes = await this.prisma.route.findMany({
      orderBy: { code: "asc" },
      include: adminRouteInclude,
    });

    return routes.map((item) => this.serializeRoute(item));
  }

  public async getRoute(id: string) {
    const route = await this.prisma.route.findUnique({
      where: { id },
      include: adminRouteInclude,
    });

    if (!route) {
      throw new NotFoundException("Route not found.");
    }

    return this.serializeRoute(route);
  }

  public async createRoute(payload: CreateAdminRouteDto) {
    try {
      const route = await this.prisma.route.create({
        data: {
          code: payload.code.trim().toUpperCase(),
          flightNumber: payload.flightNumber.trim().toUpperCase(),
          departureAirportId: payload.departureAirportId,
          arrivalAirportId: payload.arrivalAirportId,
          departureHubId: normalizeOptionalString(payload.departureHubId),
          arrivalHubId: normalizeOptionalString(payload.arrivalHubId),
          aircraftTypeId: normalizeOptionalString(payload.aircraftTypeId),
          distanceNm: normalizeOptionalInt(payload.distanceNm),
          blockTimeMinutes: normalizeOptionalInt(payload.blockTimeMinutes),
          isActive: payload.isActive ?? true,
          notes: normalizeOptionalString(payload.notes),
        },
        include: adminRouteInclude,
      });

      return this.serializeRoute(route);
    } catch (error) {
      throw this.normalizePrismaError(error, "Route");
    }
  }

  public async updateRoute(id: string, payload: UpdateAdminRouteDto) {
    try {
      const route = await this.prisma.route.update({
        where: { id },
        data: {
          ...(payload.code !== undefined
            ? { code: payload.code.trim().toUpperCase() }
            : {}),
          ...(payload.flightNumber !== undefined
            ? { flightNumber: payload.flightNumber.trim().toUpperCase() }
            : {}),
          ...(payload.departureAirportId !== undefined
            ? { departureAirportId: payload.departureAirportId }
            : {}),
          ...(payload.arrivalAirportId !== undefined
            ? { arrivalAirportId: payload.arrivalAirportId }
            : {}),
          ...(payload.departureHubId !== undefined
            ? { departureHubId: normalizeOptionalString(payload.departureHubId) }
            : {}),
          ...(payload.arrivalHubId !== undefined
            ? { arrivalHubId: normalizeOptionalString(payload.arrivalHubId) }
            : {}),
          ...(payload.aircraftTypeId !== undefined
            ? { aircraftTypeId: normalizeOptionalString(payload.aircraftTypeId) }
            : {}),
          ...(payload.distanceNm !== undefined
            ? { distanceNm: normalizeOptionalInt(payload.distanceNm) }
            : {}),
          ...(payload.blockTimeMinutes !== undefined
            ? { blockTimeMinutes: normalizeOptionalInt(payload.blockTimeMinutes) }
            : {}),
          ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
          ...(payload.notes !== undefined
            ? { notes: normalizeOptionalString(payload.notes) }
            : {}),
        },
        include: adminRouteInclude,
      });

      return this.serializeRoute(route);
    } catch (error) {
      throw this.normalizePrismaError(error, "Route");
    }
  }

  public async deleteRoute(id: string) {
    try {
      await this.prisma.route.delete({
        where: { id },
      });
    } catch (error) {
      throw this.normalizePrismaError(error, "Route");
    }

    return { success: true };
  }

  private serializeAircraft(aircraft: AdminAircraftRecord) {
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

  private serializeHub(hub: AdminHubRecord) {
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

  private serializeRoute(route: AdminRouteRecord) {
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

  private normalizePrismaError(error: unknown, entityName: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return new NotFoundException(`${entityName} not found.`);
      }

      if (error.code === "P2002") {
        return new ConflictException(`${entityName} already exists.`);
      }

      if (error.code === "P2003") {
        return new ConflictException(
          `${entityName} cannot be deleted or updated because it is referenced by other records.`,
        );
      }
    }

    return error as Error;
  }
}
