import {
  BadRequestException,
  Dependencies,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";

import {
  PilotStatus,
  Prisma,
  UserPlatformRole,
  UserStatus,
  type RefreshToken,
} from "@va/database";
import type {
  AccessTokenPayload,
  AuthSession,
  AuthSessionUser,
  AuthTokens,
  RefreshTokenPayload,
  RoleCode,
} from "@va/shared";
import { ROLE_CODES } from "@va/shared";

import type { ApiEnvironment } from "../../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  INVALID_AUTH_SESSION_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  PASSWORD_HASH_ROUNDS,
  REGISTRATION_FAILED_MESSAGE,
} from "./auth.constants.js";
import type { LoginDto } from "./dto/login.dto.js";
import type { RefreshTokenDto } from "./dto/refresh-token.dto.js";
import type { RegisterDto } from "./dto/register.dto.js";

const authUserInclude = {
  roles: {
    include: {
      role: true,
    },
  },
  pilotProfile: true,
} satisfies Prisma.UserInclude;

type AuthUserRecord = Prisma.UserGetPayload<{
  include: typeof authUserInclude;
}>;

function getAvatarUrl(value: unknown): string | null {
  if (
    value &&
    typeof value === "object" &&
    "avatarUrl" in value &&
    (typeof value.avatarUrl === "string" || value.avatarUrl === null)
  ) {
    return value.avatarUrl;
  }

  return null;
}

@Injectable()
@Dependencies(PrismaService, JwtService, ConfigService)
export class AuthService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<ApiEnvironment, true>,
  ) {}

  public async register(payload: RegisterDto): Promise<AuthSession> {
    this.assertRegisterPayload(payload);

    const pilotRole = await this.prisma.role.findUnique({
      where: { code: ROLE_CODES.PILOT },
    });

    if (!pilotRole) {
      throw new ServiceUnavailableException(
        "Pilot role is missing. Seed the database before registering users.",
      );
    }

    try {
      const passwordHash = await hash(payload.password, PASSWORD_HASH_ROUNDS);

      const user = await this.prisma.$transaction(async (transaction) => {
        const defaultRank = await transaction.rank.findFirst({
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        });
        const defaultHub = await transaction.hub.findFirst({
          where: { isActive: true },
          orderBy: { code: "asc" },
        });

        const createdUser = await transaction.user.create({
          data: {
            email: payload.email,
            username: payload.username,
            passwordHash,
            role: UserPlatformRole.USER,
            status: UserStatus.ACTIVE,
            roles: {
              create: {
                roleId: pilotRole.id,
              },
            },
          },
        });

        await transaction.pilotProfile.create({
          data: {
            userId: createdUser.id,
            pilotNumber: this.buildPilotNumber(createdUser.id),
            firstName: payload.firstName,
            lastName: payload.lastName,
            countryCode: payload.countryCode ?? null,
            hubId: defaultHub?.id ?? null,
            rankId: defaultRank?.id ?? null,
            status: PilotStatus.ACTIVE,
          },
        });

        return transaction.user.findUniqueOrThrow({
          where: { id: createdUser.id },
          include: authUserInclude,
        });
      });

      return this.buildSession(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(REGISTRATION_FAILED_MESSAGE);
      }

      throw error;
    }
  }

  public async login(payload: LoginDto): Promise<AuthSession> {
    this.assertLoginPayload(payload);

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: payload.identifier },
          { username: payload.identifier },
        ],
      },
      include: authUserInclude,
    });

    if (!user) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordMatches = await compare(payload.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.buildSession(user);
  }

  public async refresh(payload: RefreshTokenDto): Promise<AuthSession> {
    const refreshToken = payload?.refreshToken?.trim();

    if (!refreshToken) {
      throw new UnauthorizedException(INVALID_AUTH_SESSION_MESSAGE);
    }

    const decoded = await this.verifyRefreshToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(refreshToken) },
    });

    if (!storedToken || storedToken.userId !== decoded.sub) {
      throw new UnauthorizedException(INVALID_AUTH_SESSION_MESSAGE);
    }

    this.ensureRefreshTokenIsUsable(storedToken);

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: decoded.sub },
      include: authUserInclude,
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(INVALID_AUTH_SESSION_MESSAGE);
    }

    return this.buildSession(user);
  }

  public async logout(payload: RefreshTokenDto): Promise<{ success: true }> {
    const refreshToken = payload?.refreshToken?.trim();

    if (!refreshToken) {
      throw new BadRequestException("A refresh token is required.");
    }

    const tokenHash = this.hashToken(refreshToken);

    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { success: true };
  }

  private async buildSession(user: AuthUserRecord): Promise<AuthSession> {
    const tokens = await this.issueTokens(user);

    return {
      user: this.serializeUser(user),
      tokens,
    };
  }

  private async issueTokens(user: AuthUserRecord): Promise<AuthTokens> {
    const accessTtl = this.configService.get("JWT_ACCESS_TTL", { infer: true });
    const refreshTtl = this.configService.get("JWT_REFRESH_TTL", { infer: true });
    const roles = user.roles.map((item) => item.role.code as RoleCode);

    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      roles,
      type: "access",
      ...(user.pilotProfile ? { pilotProfileId: user.pilotProfile.id } : {}),
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      tokenFamily: randomUUID(),
      type: "refresh",
    };

    const accessExpiresInSeconds = Math.floor(this.durationToMs(accessTtl) / 1_000);
    const refreshExpiresInSeconds = Math.floor(this.durationToMs(refreshTtl) / 1_000);

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.configService.get("JWT_ACCESS_SECRET", { infer: true }),
        expiresIn: accessExpiresInSeconds,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.get("JWT_REFRESH_SECRET", { infer: true }),
        expiresIn: refreshExpiresInSeconds,
      }),
    ]);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        // Refresh tokens are persisted as SHA-256 hashes only.
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.durationToMs(refreshTtl)),
      },
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: accessTtl,
      refreshTokenExpiresIn: refreshTtl,
    };
  }

  private async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.configService.get("JWT_REFRESH_SECRET", { infer: true }),
      });
    } catch {
      throw new UnauthorizedException(INVALID_AUTH_SESSION_MESSAGE);
    }
  }

  private ensureRefreshTokenIsUsable(token: RefreshToken): void {
    if (token.revokedAt) {
      throw new UnauthorizedException(INVALID_AUTH_SESSION_MESSAGE);
    }

    if (token.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(INVALID_AUTH_SESSION_MESSAGE);
    }
  }

  private serializeUser(user: AuthUserRecord): AuthSessionUser {
    const serializedUser: AuthSessionUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: getAvatarUrl(user),
      role: user.role,
      roles: user.roles.map((item) => item.role.code as RoleCode),
      pilotProfile: user.pilotProfile
        ? {
            id: user.pilotProfile.id,
            pilotNumber: user.pilotProfile.pilotNumber,
            firstName: user.pilotProfile.firstName,
            lastName: user.pilotProfile.lastName,
            status: user.pilotProfile.status,
            simbriefPilotId: user.pilotProfile.simbriefPilotId,
            rankId: user.pilotProfile.rankId,
            hubId: user.pilotProfile.hubId,
          }
        : null,
    };

    if (user.pilotProfile) {
      serializedUser.pilotProfileId = user.pilotProfile.id;
    }

    return serializedUser;
  }

  private buildPilotNumber(userId: string): string {
    return `VA${userId.slice(-6).toUpperCase()}`;
  }

  private assertRegisterPayload(payload: RegisterDto | undefined): void {
    if (
      !payload ||
      typeof payload.email !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.password !== "string" ||
      typeof payload.firstName !== "string" ||
      typeof payload.lastName !== "string"
    ) {
      throw new BadRequestException("A complete registration payload is required.");
    }
  }

  private assertLoginPayload(payload: LoginDto | undefined): void {
    if (
      !payload ||
      typeof payload.identifier !== "string" ||
      typeof payload.password !== "string"
    ) {
      throw new BadRequestException("A complete login payload is required.");
    }
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private durationToMs(value: string): number {
    const match = /^(\d+)([smhd])$/i.exec(value.trim());

    if (!match) {
      throw new Error(`Unsupported duration format: ${value}`);
    }

    const amountLiteral = match[1];
    const unitLiteral = match[2];

    if (!amountLiteral || !unitLiteral) {
      throw new Error(`Unsupported duration format: ${value}`);
    }

    const amount = Number.parseInt(amountLiteral, 10);
    const unit = unitLiteral.toLowerCase();

    switch (unit) {
      case "s":
        return amount * 1_000;
      case "m":
        return amount * 60_000;
      case "h":
        return amount * 3_600_000;
      case "d":
        return amount * 86_400_000;
      default:
        throw new Error(`Unsupported duration unit: ${unit}`);
    }
  }
}

