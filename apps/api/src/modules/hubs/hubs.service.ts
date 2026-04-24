import { Dependencies, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@va/database";

import { decimalToNumber } from "../../common/utils/decimal.utils.js";
import { PrismaService } from "../prisma/prisma.service.js";

const hubInclude = {
  airport: true,
} satisfies Prisma.HubInclude;

type HubRecord = Prisma.HubGetPayload<{
  include: typeof hubInclude;
}>;

@Injectable()
@Dependencies(PrismaService)
export class HubsService {
  public constructor(private readonly prisma: PrismaService) {}

  public async findAll() {
    const hubs = await this.prisma.hub.findMany({
      orderBy: { code: "asc" },
      include: hubInclude,
    });

    return hubs.map((hub) => this.serializeHub(hub));
  }

  public async findByCode(code: string) {
    const hub = await this.prisma.hub.findUnique({
      where: { code: code.toUpperCase() },
      include: hubInclude,
    });

    if (!hub) {
      throw new NotFoundException("Hub not found.");
    }

    return this.serializeHub(hub);
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
}
