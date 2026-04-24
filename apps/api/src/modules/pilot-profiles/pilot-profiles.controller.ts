import { Body, Controller, Dependencies, Get, Param, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedUser } from "@va/shared";
import { ROLE_CODES } from "@va/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { UpdateMyPilotProfileDto } from "./dto/update-my-pilot-profile.dto.js";
import { PilotProfilesService } from "./pilot-profiles.service.js";

@ApiTags("pilot-profiles")
@ApiBearerAuth()
@Controller("pilot-profiles")
@Dependencies(PilotProfilesService)
export class PilotProfilesController {
  public constructor(
    private readonly pilotProfilesService: PilotProfilesService,
  ) {}

  @Get("me")
  public me(@CurrentUser() user: AuthenticatedUser) {
    return this.pilotProfilesService.findMe(user);
  }

  @Get("me/simbrief/latest-ofp")
  public latestSimbriefOfp(@CurrentUser() user: AuthenticatedUser) {
    return this.pilotProfilesService.getMyLatestSimbriefOfp(user);
  }

  @Patch("me")
  public updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: UpdateMyPilotProfileDto,
  ) {
    return this.pilotProfilesService.updateMe(user, payload);
  }

  @Roles(ROLE_CODES.ADMIN, ROLE_CODES.STAFF)
  @Get()
  public listProfiles() {
    return this.pilotProfilesService.listProfiles();
  }

  @Get(":id")
  public getProfile(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pilotProfilesService.findById(id, user);
  }
}

