import { Body, Controller, Dependencies, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedUser } from "@va/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { CreateMySimbriefAirframeDto } from "./dto/create-my-simbrief-airframe.dto.js";
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
  @ApiOperation({
    summary:
      "Recupere les airframes SimBrief reelles du pilote connecte a partir de son SimBrief Pilot ID.",
  })
  public airframes(@CurrentUser() user: AuthenticatedUser) {
    return this.pilotProfilesService.getMySimbriefAirframes(user);
  }

  @Post("airframes")
  @ApiOperation({
    summary:
      "Ajoute une airframe SimBrief manuelle pour preparer la flotte reelle du pilote connecte.",
  })
  public createAirframe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: CreateMySimbriefAirframeDto,
  ) {
    return this.pilotProfilesService.createMySimbriefAirframe(user, payload);
  }

  @Post("airframes/sync")
  @ApiOperation({
    summary:
      "Synchronise les airframes SimBrief du pilote connecte dans la base de donnees locale.",
  })
  public syncAirframes(@CurrentUser() user: AuthenticatedUser) {
    return this.pilotProfilesService.syncMySimbriefAirframes(user);
  }
}
