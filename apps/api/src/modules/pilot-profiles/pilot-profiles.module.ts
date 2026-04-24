import { Module } from "@nestjs/common";

import { SimbriefClient } from "../../common/integrations/simbrief/simbrief.client.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { PilotProfilesController } from "./pilot-profiles.controller.js";
import { PilotProfilesService } from "./pilot-profiles.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [PilotProfilesController],
  providers: [PilotProfilesService, SimbriefClient],
  exports: [PilotProfilesService],
})
export class PilotProfilesModule {}
