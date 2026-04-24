import { Dependencies, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
@Dependencies(PrismaService)
export class RanksService {
  public constructor(private readonly prisma: PrismaService) {}

  public async findAll() {
    const ranks = await this.prisma.rank.findMany({
      orderBy: { sortOrder: "asc" },
    });

    return ranks.map((rank) => this.serializeRank(rank));
  }

  public async findByCode(code: string) {
    const rank = await this.prisma.rank.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!rank) {
      throw new NotFoundException("Rank not found.");
    }

    return this.serializeRank(rank);
  }

  private serializeRank(rank: {
    id: string;
    code: string;
    name: string;
    sortOrder: number;
    minFlights: number;
    minHoursMinutes: number;
    minScore: number;
    description: string | null;
    isActive: boolean;
  }) {
    return {
      id: rank.id,
      code: rank.code,
      name: rank.name,
      sortOrder: rank.sortOrder,
      minFlights: rank.minFlights,
      minHoursMinutes: rank.minHoursMinutes,
      minScore: rank.minScore,
      description: rank.description,
      isActive: rank.isActive,
    };
  }
}
