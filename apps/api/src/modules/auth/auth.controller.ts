import { Body, Controller, Dependencies, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedUser } from "@va/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Public } from "../../common/decorators/public.decorator.js";
import { UsersService } from "../users/users.service.js";
import { AuthService } from "./auth.service.js";
import { LoginDto } from "./dto/login.dto.js";
import { RefreshTokenDto } from "./dto/refresh-token.dto.js";
import { RegisterDto } from "./dto/register.dto.js";

@ApiTags("auth")
@Controller("auth")
@Dependencies(AuthService, UsersService)
export class AuthController {
  public constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post("register")
  public register(@Body() payload: RegisterDto) {
    return this.authService.register(payload);
  }

  @Public()
  @Post("login")
  public login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @Public()
  @Post("refresh")
  public refresh(@Body() payload: RefreshTokenDto) {
    return this.authService.refresh(payload);
  }

  @Public()
  @Post("logout")
  public logout(@Body() payload: RefreshTokenDto) {
    return this.authService.logout(payload);
  }

  @ApiBearerAuth()
  @Get("me")
  public me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById(user.id);
  }
}

