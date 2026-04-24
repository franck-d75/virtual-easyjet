import { Controller, Dependencies, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { ROLE_CODES } from "@va/shared";

import { Roles } from "../../common/decorators/roles.decorator.js";
import { RolesService } from "./roles.service.js";

@ApiTags("roles")
@ApiBearerAuth()
@Controller("roles")
@Dependencies(RolesService)
export class RolesController {
  public constructor(private readonly rolesService: RolesService) {}

  @Roles(ROLE_CODES.ADMIN, ROLE_CODES.STAFF)
  @Get()
  public listRoles() {
    return this.rolesService.findAll();
  }
}

