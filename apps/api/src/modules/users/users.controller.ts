import {
  Controller,
  Dependencies,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";

import type { AuthenticatedUser } from "@va/shared";
import { ROLE_CODES } from "@va/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import {
  assertValidAvatarFile,
  type UploadedAvatarFile,
} from "../../common/storage/avatar-upload.constants.js";
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

  @Post("me/avatar")
  @UseInterceptors(FileInterceptor("file"))
  public uploadMyAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedAvatarFile | undefined,
  ) {
    assertValidAvatarFile(file);
    return this.usersService.updateMyAvatar(user.id, file);
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

