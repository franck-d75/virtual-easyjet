import { Dependencies, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";

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
@Dependencies(PrismaService)
export class UsersService {
  public constructor(private readonly prisma: PrismaService) {}

  public async findById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        pilotProfile: {
          include: {
            hub: true,
            rank: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: getAvatarUrl(user),
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      roles: user.roles.map((item) => ({
        code: item.role.code,
        name: item.role.name,
      })),
      pilotProfile: user.pilotProfile
        ? {
            id: user.pilotProfile.id,
            pilotNumber: user.pilotProfile.pilotNumber,
            firstName: user.pilotProfile.firstName,
            lastName: user.pilotProfile.lastName,
            status: user.pilotProfile.status,
            countryCode: user.pilotProfile.countryCode,
            simbriefPilotId: user.pilotProfile.simbriefPilotId,
            hoursFlownMinutes: user.pilotProfile.hoursFlownMinutes,
            experiencePoints: user.pilotProfile.experiencePoints,
            hub: user.pilotProfile.hub
              ? {
                  code: user.pilotProfile.hub.code,
                  name: user.pilotProfile.hub.name,
                }
              : null,
            rank: user.pilotProfile.rank
              ? {
                  code: user.pilotProfile.rank.code,
                  name: user.pilotProfile.rank.name,
                }
              : null,
          }
        : null,
    };
  }

  public async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        pilotProfile: true,
      },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: getAvatarUrl(user),
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      roles: user.roles.map((item) => item.role.code),
      pilotProfile: user.pilotProfile
        ? {
            id: user.pilotProfile.id,
            pilotNumber: user.pilotProfile.pilotNumber,
            firstName: user.pilotProfile.firstName,
            lastName: user.pilotProfile.lastName,
            status: user.pilotProfile.status,
          }
        : null,
    }));
  }
}

