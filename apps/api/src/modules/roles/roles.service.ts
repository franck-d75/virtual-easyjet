import { Dependencies, Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
@Dependencies(PrismaService)
export class RolesService {
  public constructor(private readonly prisma: PrismaService) {}

  public async findAll() {
    return this.prisma.role.findMany({
      orderBy: { code: "asc" },
    });
  }
}

