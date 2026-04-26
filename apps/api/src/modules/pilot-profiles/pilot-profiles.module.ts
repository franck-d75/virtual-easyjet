import { Module } from "@nestjs/common";

import { SimbriefClient } from "../../common/integrations/simbrief/simbrief.client.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { PilotSimbriefController } from "./pilot-simbrief.controller.js";
import { PilotProfilesController } from "./pilot-profiles.controller.js";
import { PilotProfilesService } from "./pilot-profiles.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [PilotProfilesController, PilotSimbriefController],
  providers: [PilotProfilesService, SimbriefClient],
  exports: [PilotProfilesService],
})
export class PilotProfilesModule {}

