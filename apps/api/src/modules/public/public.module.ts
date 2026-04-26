import { Module } from "@nestjs/common";

import { AcarsLiveModule } from "../acars-live/acars-live.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { PublicAcarsController } from "./public-acars.controller.js";
import { PublicController } from "./public.controller.js";
import { PublicService } from "./public.service.js";

@Module({
  imports: [PrismaModule, AcarsLiveModule],
  controllers: [PublicController, PublicAcarsController],
  providers: [PublicService],
})
export class PublicModule {}

