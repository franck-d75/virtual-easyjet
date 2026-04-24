import { Dependencies, Injectable } from "@nestjs/common";
import {
  FlightStatus,
  PilotStatus,
  PirepStatus,
} from "@va/database";

import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
@Dependencies(PrismaService)
export class PublicService {
  public constructor(private readonly prisma: PrismaService) {}

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
}
