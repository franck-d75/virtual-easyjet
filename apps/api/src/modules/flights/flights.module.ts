import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module.js";
import { FlightsController } from "./flights.controller.js";
import { FlightsService } from "./flights.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [FlightsController],
  providers: [FlightsService],
  exports: [FlightsService],
})
export class FlightsModule {}
