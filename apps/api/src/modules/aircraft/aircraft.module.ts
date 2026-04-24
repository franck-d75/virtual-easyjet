import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module.js";
import { AircraftController } from "./aircraft.controller.js";
import { AircraftService } from "./aircraft.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [AircraftController],
  providers: [AircraftService],
  exports: [AircraftService],
})
export class AircraftModule {}

