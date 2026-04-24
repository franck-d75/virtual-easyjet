import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module.js";
import { RanksController } from "./ranks.controller.js";
import { RanksService } from "./ranks.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [RanksController],
  providers: [RanksService],
  exports: [RanksService],
})
export class RanksModule {}

