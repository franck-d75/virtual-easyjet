import {
  Body,
  Controller,
  Dependencies,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedUser } from "@va/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Public } from "../../common/decorators/public.decorator.js";
import { UsersService } from "../users/users.service.js";
import { getRequestClientIp } from "../../common/security/request-client.utils.js";
import { AuthBruteforceService } from "./auth-bruteforce.service.js";
import {
  applyAuthCookies,
  clearAuthCookies,
  API_REFRESH_COOKIE_NAME,
  readRequestCookie,
} from "./auth-cookie.utils.js";
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

type ResponseLike = {
  setHeader: (name: string, value: string | string[]) => void;
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
  public async login(
    @Body() payload: LoginDto,
    @Req() request: RequestLike,
    @Res({ passthrough: true }) response: ResponseLike,
  ) {
    const clientIp = getRequestClientIp(request);

    this.authBruteforceService.assertCanAttemptLogin(clientIp, payload.identifier);

    try {
      const session = await this.authService.login(payload);
      applyAuthCookies(response, session);
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
  public async refresh(
    @Body() payload: Partial<RefreshTokenDto>,
    @Req() request: RequestLike,
    @Res({ passthrough: true }) response: ResponseLike,
  ) {
    const refreshToken =
      payload?.refreshToken?.trim() ||
      readRequestCookie(request, API_REFRESH_COOKIE_NAME);

    if (!refreshToken) {
      clearAuthCookies(response);
      throw new UnauthorizedException("A refresh token is required.");
    }

    const session = await this.authService.refresh({ refreshToken });
    applyAuthCookies(response, session);
    return session;
  }

  @Public()
  @Post("logout")
  public async logout(
    @Body() payload: Partial<RefreshTokenDto>,
    @Req() request: RequestLike,
    @Res({ passthrough: true }) response: ResponseLike,
  ) {
    const refreshToken =
      payload?.refreshToken?.trim() ||
      readRequestCookie(request, API_REFRESH_COOKIE_NAME);

    clearAuthCookies(response);

    if (!refreshToken) {
      return { success: true };
    }

    return this.authService.logout({ refreshToken });
  }

  @ApiBearerAuth()
  @Get("me")
  public me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById(user.id);
  }
}

