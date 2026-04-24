import { Dependencies, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@va/database";

import { PrismaService } from "../prisma/prisma.service.js";

const aircraftInclude = {
  aircraftType: {
    include: {
      minRank: true,
    },
  },
  hub: true,
} satisfies Prisma.AircraftInclude;

type AircraftRecord = Prisma.AircraftGetPayload<{
  include: typeof aircraftInclude;
}>;

@Injectable()
@Dependencies(PrismaService)
export class AircraftService {
  public constructor(private readonly prisma: PrismaService) {}

  public async findAll() {
    const aircraft = await this.prisma.aircraft.findMany({
      orderBy: { registration: "asc" },
      include: aircraftInclude,
    });

    return aircraft.map((airframe) => this.serializeAircraft(airframe));
  }

  public async findByRegistration(registration: string) {
    const aircraft = await this.prisma.aircraft.findUnique({
      where: { registration: registration.toUpperCase() },
      include: aircraftInclude,
    });

    if (!aircraft) {
      throw new NotFoundException("Aircraft not found.");
    }

    return this.serializeAircraft(aircraft);
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
}
