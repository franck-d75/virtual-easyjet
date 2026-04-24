import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module.js";
import { HubsController } from "./hubs.controller.js";
import { HubsService } from "./hubs.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [HubsController],
  providers: [HubsService],
  exports: [HubsService],
})
export class HubsModule {}

