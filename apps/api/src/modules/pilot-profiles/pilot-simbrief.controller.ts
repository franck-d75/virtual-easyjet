import { Controller, Dependencies, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedUser } from "@va/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { PilotProfilesService } from "./pilot-profiles.service.js";

@ApiTags("pilot-simbrief")
@ApiBearerAuth()
@Controller("pilot/simbrief")
@Dependencies(PilotProfilesService)
export class PilotSimbriefController {
  public constructor(
    private readonly pilotProfilesService: PilotProfilesService,
  ) {}

  @Get("airframes")
  public airframes(@CurrentUser() user: AuthenticatedUser) {
    return this.pilotProfilesService.getMySimbriefAirframes(user);
  }

  @Post("airframes/sync")
  public syncAirframes(@CurrentUser() user: AuthenticatedUser) {
    return this.pilotProfilesService.syncMySimbriefAirframes(user);
  }
}
