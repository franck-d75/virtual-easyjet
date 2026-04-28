import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module.js";
import { AcarsLiveController } from "./acars-live.controller.js";
import { AcarsLiveService } from "./acars-live.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [AcarsLiveController],
  providers: [AcarsLiveService],
  exports: [AcarsLiveService],
})
export class AcarsLiveModule {}
