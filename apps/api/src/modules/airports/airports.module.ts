import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module.js";
import { AirportsController } from "./airports.controller.js";
import { AirportsService } from "./airports.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [AirportsController],
  providers: [AirportsService],
  exports: [AirportsService],
})
export class AirportsModule {}
