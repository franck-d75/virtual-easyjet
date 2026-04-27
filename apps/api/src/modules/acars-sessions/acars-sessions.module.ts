import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module.js";
import { AcarsSessionsController } from "./acars-sessions.controller.js";
import { AcarsSessionsService } from "./acars-sessions.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [AcarsSessionsController],
  providers: [AcarsSessionsService],
})
export class AcarsSessionsModule {}
