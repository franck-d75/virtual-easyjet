import { Dependencies, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@va/database";

import { decimalToNumber } from "../../common/utils/decimal.utils.js";
import { PrismaService } from "../prisma/prisma.service.js";

const airportInclude = {
  hubs: true,
} satisfies Prisma.AirportInclude;

type AirportRecord = Prisma.AirportGetPayload<{
  include: typeof airportInclude;
}>;

@Injectable()
@Dependencies(PrismaService)
export class AirportsService {
  public constructor(private readonly prisma: PrismaService) {}

  public async findAll() {
    const airports = await this.prisma.airport.findMany({
      orderBy: { icao: "asc" },
      include: airportInclude,
    });

    return airports.map((airport) => this.serializeAirport(airport));
  }

  public async findByIcao(icao: string) {
    const airport = await this.prisma.airport.findUnique({
      where: { icao: icao.toUpperCase() },
      include: airportInclude,
    });

    if (!airport) {
      throw new NotFoundException("Airport not found.");
    }

    return this.serializeAirport(airport);
  }

  private serializeAirport(airport: AirportRecord) {
    return {
      id: airport.id,
      icao: airport.icao,
      iata: airport.iata,
      name: airport.name,
      city: airport.city,
      countryCode: airport.countryCode,
      latitude: decimalToNumber(airport.latitude),
      longitude: decimalToNumber(airport.longitude),
      elevationFt: airport.elevationFt,
      isActive: airport.isActive,
      hubs: airport.hubs.map((hub) => ({
        id: hub.id,
        code: hub.code,
        name: hub.name,
        isActive: hub.isActive,
      })),
    };
  }
}
