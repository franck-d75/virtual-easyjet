import {
  BadRequestException,
  ConflictException,
  Dependencies,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@va/database";
import type { AuthenticatedUser } from "@va/shared";

import { SimbriefClient } from "../../common/integrations/simbrief/simbrief.client.js";
import { buildSimbriefFlightPlanLookup } from "../../common/integrations/simbrief/simbrief.utils.js";
import {
  getRequiredPilotProfileId,
  isPrivilegedUser,
} from "../../common/utils/authenticated-user.utils.js";
import { decimalToNumber } from "../../common/utils/decimal.utils.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { UpdateMyPilotProfileDto } from "./dto/update-my-pilot-profile.dto.js";

const pilotProfileInclude = {
  user: true,
  hub: true,
  rank: true,
} satisfies Prisma.PilotProfileInclude;

type PilotProfileRecord = Prisma.PilotProfileGetPayload<{
  include: typeof pilotProfileInclude;
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
@Dependencies(PrismaService, SimbriefClient)
export class PilotProfilesService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly simbriefClient: SimbriefClient,
  ) {}

  public async findMe(user: AuthenticatedUser) {
    const pilotProfileId = getRequiredPilotProfileId(user);
    return this.findById(pilotProfileId, user);
  }

  public async getMyLatestSimbriefOfp(user: AuthenticatedUser) {
    const pilotProfileId = getRequiredPilotProfileId(user);
    const profile = await this.prisma.pilotProfile.findUnique({
      where: { id: pilotProfileId },
      select: {
        simbriefPilotId: true,
      },
    });

    if (!profile) {
      throw new NotFoundException("Pilot profile not found.");
    }

    const latestOfp = await this.simbriefClient.getLatestOfp(
      profile.simbriefPilotId,
    );

    if (latestOfp.status !== "AVAILABLE" || !latestOfp.plan) {
      return latestOfp;
    }

    if (latestOfp.plan.routePoints.length >= 2) {
      return latestOfp;
    }

    const fallbackRoutePoints = await this.buildAirportFallbackRoutePoints(
      latestOfp.plan.departureIcao,
      latestOfp.plan.arrivalIcao,
    );

    return {
      ...latestOfp,
      plan: {
        ...latestOfp.plan,
        routePoints:
          fallbackRoutePoints.length >= 2
            ? fallbackRoutePoints
            : latestOfp.plan.routePoints,
      },
    };
  }

  public async updateMe(
    user: AuthenticatedUser,
    payload: UpdateMyPilotProfileDto,
  ) {
    const pilotProfileId = getRequiredPilotProfileId(user);
    const username = payload.username?.trim().toLowerCase() ?? undefined;
    const firstName = payload.firstName?.trim() ?? undefined;
    const lastName = payload.lastName?.trim() ?? undefined;
    const pilotNumber = payload.pilotNumber?.trim().toUpperCase() ?? undefined;
    const callsign =
      payload.callsign !== undefined
        ? payload.callsign?.trim().toUpperCase() || null
        : undefined;
    const countryCode =
      payload.countryCode !== undefined
        ? payload.countryCode?.trim().toUpperCase() || null
        : undefined;
    const simbriefPilotId =
      payload.simbriefPilotId !== undefined
        ? payload.simbriefPilotId?.trim() || null
        : undefined;
    const preferredHubId =
      payload.preferredHubId !== undefined
        ? payload.preferredHubId?.trim() || null
        : undefined;

    try {
      const profile = await this.prisma.$transaction(async (transaction) => {
        const existingProfile = await transaction.pilotProfile.findUnique({
          where: { id: pilotProfileId },
          include: {
            user: true,
          },
        });

        if (!existingProfile) {
          throw new NotFoundException("Pilot profile not found.");
        }

        if (preferredHubId) {
          const hub = await transaction.hub.findUnique({
            where: { id: preferredHubId },
            select: { id: true },
          });

          if (!hub) {
            throw new BadRequestException("Le hub préféré sélectionné est introuvable.");
          }
        }

        const userUpdateData: Prisma.UserUpdateInput = {};
        const profileUpdateData: Prisma.PilotProfileUpdateInput = {};

        if (username !== undefined) {
          userUpdateData.username = username;
        }

        if (firstName !== undefined) {
          profileUpdateData.firstName = firstName;
        }

        if (lastName !== undefined) {
          profileUpdateData.lastName = lastName;
        }

        if (pilotNumber !== undefined) {
          profileUpdateData.pilotNumber = pilotNumber;
        }

        if (callsign !== undefined) {
          profileUpdateData.callsign = callsign;
        }

        if (countryCode !== undefined) {
          profileUpdateData.countryCode = countryCode;
        }

        if (simbriefPilotId !== undefined) {
          profileUpdateData.simbriefPilotId = simbriefPilotId;
        }

        if (preferredHubId !== undefined) {
          profileUpdateData.hub = preferredHubId
            ? {
                connect: {
                  id: preferredHubId,
                },
              }
            : {
                disconnect: true,
              };
        }

        if (Object.keys(userUpdateData).length > 0) {
          await transaction.user.update({
            where: { id: existingProfile.userId },
            data: userUpdateData,
          });
        }

        if (Object.keys(profileUpdateData).length > 0) {
          await transaction.pilotProfile.update({
            where: { id: pilotProfileId },
            data: profileUpdateData,
          });
        }

        return transaction.pilotProfile.findUniqueOrThrow({
          where: { id: pilotProfileId },
          include: pilotProfileInclude,
        });
      });

      return this.serializeProfile(profile);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(",")
          : "";

        if (target.includes("username")) {
          throw new ConflictException(
            "Ce nom d'utilisateur est déjà utilisé par un autre compte.",
          );
        }

        if (target.includes("pilotNumber")) {
          throw new ConflictException(
            "Ce numéro pilote est déjà attribué à un autre pilote.",
          );
        }

        if (target.includes("callsign")) {
          throw new ConflictException(
            "Cet indicatif est déjà attribué à un autre pilote.",
          );
        }

        throw new ConflictException(
          "Ce SimBrief Pilot ID est déjà associé à un autre pilote.",
        );
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Pilot profile not found.");
      }

      throw error;
    }
  }

  public async listProfiles() {
    const profiles = await this.prisma.pilotProfile.findMany({
      orderBy: { joinedAt: "desc" },
      include: pilotProfileInclude,
    });

    return profiles.map((profile) => this.serializeProfile(profile));
  }

  public async findById(id: string, requester: AuthenticatedUser) {
    if (!isPrivilegedUser(requester) && requester.pilotProfileId !== id) {
      throw new ForbiddenException("You cannot access this pilot profile.");
    }

    const profile = await this.prisma.pilotProfile.findUnique({
      where: { id },
      include: pilotProfileInclude,
    });

    if (!profile) {
      throw new NotFoundException("Pilot profile not found.");
    }

    return this.serializeProfile(profile);
  }

  private async buildAirportFallbackRoutePoints(
    departureIcao: string | null,
    arrivalIcao: string | null,
  ) {
    const requestedIcaos = [departureIcao, arrivalIcao].filter(
      (icao): icao is string => typeof icao === "string" && icao.length > 0,
    );

    if (requestedIcaos.length < 2) {
      return [];
    }

    const airports = await this.prisma.airport.findMany({
      where: {
        icao: {
          in: requestedIcaos.map((icao) => icao.toUpperCase()),
        },
      },
      select: {
        icao: true,
        latitude: true,
        longitude: true,
      },
    });

    const airportMap = new Map(
      airports.map((airport) => [
        airport.icao.toUpperCase(),
        {
          lat: decimalToNumber(airport.latitude),
          lon: decimalToNumber(airport.longitude),
        },
      ]),
    );

    const departure = airportMap.get(departureIcao?.toUpperCase() ?? "");
    const arrival = airportMap.get(arrivalIcao?.toUpperCase() ?? "");

    if (
      departure?.lat === null ||
      departure?.lat === undefined ||
      departure?.lon === null ||
      departure?.lon === undefined ||
      arrival?.lat === null ||
      arrival?.lat === undefined ||
      arrival?.lon === null ||
      arrival?.lon === undefined
    ) {
      return [];
    }

    return [
      {
        ident: departureIcao,
        lat: departure.lat,
        lon: departure.lon,
        source: "ORIGIN" as const,
      },
      {
        ident: arrivalIcao,
        lat: arrival.lat,
        lon: arrival.lon,
        source: "DESTINATION" as const,
      },
    ];
  }

  private serializeProfile(profile: PilotProfileRecord) {
    return {
      id: profile.id,
      pilotNumber: profile.pilotNumber,
      callsign: profile.callsign,
      firstName: profile.firstName,
      lastName: profile.lastName,
      countryCode: profile.countryCode,
      simbriefPilotId: profile.simbriefPilotId,
      status: profile.status,
      experiencePoints: profile.experiencePoints,
      hoursFlownMinutes: profile.hoursFlownMinutes,
      joinedAt: profile.joinedAt,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      simbrief: profile.simbriefPilotId
        ? buildSimbriefFlightPlanLookup(profile.simbriefPilotId)
        : null,
      user: {
        id: profile.user.id,
        email: profile.user.email,
        username: profile.user.username,
        avatarUrl: getAvatarUrl(profile.user),
        status: profile.user.status,
      },
      hub: profile.hub
        ? {
            id: profile.hub.id,
            code: profile.hub.code,
            name: profile.hub.name,
          }
        : null,
      rank: profile.rank
        ? {
            id: profile.rank.id,
            code: profile.rank.code,
            name: profile.rank.name,
            sortOrder: profile.rank.sortOrder,
          }
        : null,
    };
  }
}

