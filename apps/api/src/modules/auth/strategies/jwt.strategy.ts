import {
  Dependencies,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

import { UserStatus } from "@va/database";
import type { AccessTokenPayload, AuthenticatedUser, RoleCode } from "@va/shared";

import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
@Dependencies(PrismaService)
export class JwtStrategy extends PassportStrategy(Strategy) {
  public constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_ACCESS_SECRET;

    if (!secret) {
      throw new Error("JWT_ACCESS_SECRET is required to initialize JwtStrategy.");
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  public async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        pilotProfile: true,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Your account is not active.");
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      roles: user.roles.map((item) => item.role.code as RoleCode),
    };

    if (user.pilotProfile) {
      authenticatedUser.pilotProfileId = user.pilotProfile.id;
    }

    return authenticatedUser;
  }
}
