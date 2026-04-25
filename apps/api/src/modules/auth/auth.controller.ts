import {
  Body,
  Controller,
  Dependencies,
  Get,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedUser } from "@va/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Public } from "../../common/decorators/public.decorator.js";
import { UsersService } from "../users/users.service.js";
import { getRequestClientIp } from "../../common/security/request-client.utils.js";
import { AuthBruteforceService } from "./auth-bruteforce.service.js";
import { AuthService } from "./auth.service.js";
import { LoginDto } from "./dto/login.dto.js";
import { RefreshTokenDto } from "./dto/refresh-token.dto.js";
import { RegisterDto } from "./dto/register.dto.js";

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: {
    remoteAddress?: string | null;
  };
};

@ApiTags("auth")
@Controller("auth")
@Dependencies(AuthService, UsersService, AuthBruteforceService)
export class AuthController {
  public constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly authBruteforceService: AuthBruteforceService,
  ) {}

  @Public()
  @Post("register")
  public register(@Body() payload: RegisterDto) {
    return this.authService.register(payload);
  }

  @Public()
  @Post("login")
  public async login(@Body() payload: LoginDto, @Req() request: RequestLike) {
    const clientIp = getRequestClientIp(request);

    this.authBruteforceService.assertCanAttemptLogin(clientIp, payload.identifier);

    try {
      const session = await this.authService.login(payload);
      this.authBruteforceService.registerSuccess(clientIp, payload.identifier);
      return session;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.authBruteforceService.registerFailure(clientIp, payload.identifier);
      }

      throw error;
    }
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

