import { Controller, Dependencies, Get, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedUser } from "@va/shared";
import { ROLE_CODES } from "@va/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { UsersService } from "./users.service.js";

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
@Dependencies(UsersService)
export class UsersController {
  public constructor(private readonly usersService: UsersService) {}

  @Get("me")
  public me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById(user.id);
  }

  @Roles(ROLE_CODES.ADMIN, ROLE_CODES.STAFF)
  @Get(":id")
  public getUser(@Param("id") id: string) {
    return this.usersService.findById(id);
  }

  @Roles(ROLE_CODES.ADMIN, ROLE_CODES.STAFF)
  @Get()
  public listUsers() {
    return this.usersService.listUsers();
  }
}
