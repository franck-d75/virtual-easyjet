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

import {
  SimbriefClient,
  type SimbriefAirframeSummary,
  type SimbriefLatestOfpResult,
} from "../../common/integrations/simbrief/simbrief.client.js";
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

const simbriefAirframeInclude = {
  linkedAircraftType: true,
  linkedAircraft: {
    include: {
      aircraftType: true,
      hub: true,
    },
  },
} satisfies Prisma.SimbriefAirframeInclude;

type SimbriefAirframeRecord = Prisma.SimbriefAirframeGetPayload<{
  include: typeof simbriefAirframeInclude;
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
    const profile = await this.getMySimbriefContext(user);

    if (!profile) {
      throw new NotFoundException("Pilot profile not found.");
    }

    const latestOfp = await this.simbriefClient.getLatestOfp(
      profile.simbriefPilotId,
    );

    if (latestOfp.status !== "AVAILABLE" || !latestOfp.plan) {
      return latestOfp;
    }

    const matchedAirframe = await this.findMatchingAirframeForLatestOfp(
      profile.userId,
      latestOfp.plan.aircraft?.simbriefAirframeId ?? null,
      latestOfp.plan.aircraft?.registration ?? null,
      latestOfp.plan.aircraft?.icaoCode ?? null,
    );

    if (latestOfp.plan.routePoints.length >= 2) {
      return this.attachLatestOfpAirframeMatch(latestOfp, matchedAirframe);
    }

    const fallbackRoutePoints = await this.buildAirportFallbackRoutePoints(
      latestOfp.plan.departureIcao,
      latestOfp.plan.arrivalIcao,
    );

    const enrichedLatestOfp = {
      ...latestOfp,
      plan: {
        ...latestOfp.plan,
        routePoints:
          fallbackRoutePoints.length >= 2
            ? fallbackRoutePoints
            : latestOfp.plan.routePoints,
      },
    };

    return this.attachLatestOfpAirframeMatch(enrichedLatestOfp, matchedAirframe);
  }

  public async getMySimbriefAirframes(user: AuthenticatedUser) {
    const profile = await this.getMySimbriefContext(user);

    if (!profile) {
      throw new NotFoundException("Pilot profile not found.");
    }

    const liveAirframes = await this.simbriefClient.getAirframes(
      profile.simbriefPilotId,
    );

    const existingAirframes = await this.prisma.simbriefAirframe.findMany({
      where: {
        ownerUserId: profile.userId,
      },
      orderBy: [{ registration: "asc" }, { name: "asc" }],
      include: simbriefAirframeInclude,
    });

    const existingAirframesBySimbriefId = new Map(
      existingAirframes.map((airframe) => [airframe.simbriefAirframeId, airframe]),
    );

    return {
      ...liveAirframes,
      airframes: liveAirframes.airframes.map((airframe) =>
        this.serializeSimbriefAirframeLive(
          airframe,
          existingAirframesBySimbriefId.get(airframe.simbriefAirframeId) ?? null,
        ),
      ),
    };
  }

  public async syncMySimbriefAirframes(user: AuthenticatedUser) {
    const profile = await this.getMySimbriefContext(user);

    if (!profile) {
      throw new NotFoundException("Pilot profile not found.");
    }

    const liveAirframes = await this.simbriefClient.getAirframes(
      profile.simbriefPilotId,
    );

    if (liveAirframes.status !== "AVAILABLE" || liveAirframes.airframes.length === 0) {
      return {
        ...liveAirframes,
        airframes: [],
      };
    }

    const mappedTypeCodes = [
      ...new Set(
        liveAirframes.airframes
          .map((airframe) =>
            this.simbriefClient.inferAircraftTypeCode(airframe.aircraftIcao),
          )
          .filter((value): value is string => value !== null),
      ),
    ];

    const aircraftTypes = mappedTypeCodes.length
      ? await this.prisma.aircraftType.findMany({
          where: {
            icaoCode: {
              in: mappedTypeCodes,
            },
          },
          select: {
            id: true,
            icaoCode: true,
          },
        })
      : [];

    const aircraftTypeIdByCode = new Map(
      aircraftTypes.map((aircraftType) => [aircraftType.icaoCode, aircraftType.id]),
    );

    await this.prisma.$transaction(
      liveAirframes.airframes.map((airframe) => {
        const mappedTypeCode = this.simbriefClient.inferAircraftTypeCode(
          airframe.aircraftIcao,
        );

        return this.prisma.simbriefAirframe.upsert({
          where: {
            simbriefAirframeId: airframe.simbriefAirframeId,
          },
          update: {
            name: airframe.name,
            aircraftIcao: airframe.aircraftIcao,
            registration: airframe.registration,
            selcal: airframe.selcal,
            equipment: airframe.equipment,
            engineType: airframe.engineType,
            wakeCategory: airframe.wakeCategory,
            rawJson: airframe.rawJson as Prisma.InputJsonValue,
            linkedAircraftTypeId: mappedTypeCode
              ? aircraftTypeIdByCode.get(mappedTypeCode) ?? null
              : null,
            ownerUserId: profile.userId,
            pilotProfileId: profile.id,
          },
          create: {
            simbriefAirframeId: airframe.simbriefAirframeId,
            name: airframe.name,
            aircraftIcao: airframe.aircraftIcao,
            registration: airframe.registration,
            selcal: airframe.selcal,
            equipment: airframe.equipment,
            engineType: airframe.engineType,
            wakeCategory: airframe.wakeCategory,
            rawJson: airframe.rawJson as Prisma.InputJsonValue,
            linkedAircraftTypeId: mappedTypeCode
              ? aircraftTypeIdByCode.get(mappedTypeCode) ?? null
              : null,
            ownerUserId: profile.userId,
            pilotProfileId: profile.id,
          },
        });
      }),
    );

    const persistedAirframes = await this.prisma.simbriefAirframe.findMany({
      where: {
        ownerUserId: profile.userId,
      },
      orderBy: [{ registration: "asc" }, { name: "asc" }],
      include: simbriefAirframeInclude,
    });

    return {
      ...liveAirframes,
      airframes: persistedAirframes.map((airframe) =>
        this.serializePersistedSimbriefAirframe(airframe),
      ),
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

  private async getMySimbriefContext(user: AuthenticatedUser) {
    const pilotProfileId = getRequiredPilotProfileId(user);

    return this.prisma.pilotProfile.findUnique({
      where: { id: pilotProfileId },
      select: {
        id: true,
        userId: true,
        simbriefPilotId: true,
      },
    });
  }

  private async findMatchingAirframeForLatestOfp(
    userId: string,
    simbriefAirframeId: string | null,
    registration: string | null,
    aircraftIcao: string | null,
  ): Promise<SimbriefAirframeRecord | null> {
    if (simbriefAirframeId) {
      const directMatch = await this.prisma.simbriefAirframe.findUnique({
        where: {
          simbriefAirframeId,
        },
        include: simbriefAirframeInclude,
      });

      if (directMatch) {
        return directMatch;
      }
    }

    if (!registration && !aircraftIcao) {
      return null;
    }

    return this.prisma.simbriefAirframe.findFirst({
      where: {
        ownerUserId: userId,
        ...(registration
          ? {
              registration: registration.toUpperCase(),
            }
          : {}),
        ...(aircraftIcao
          ? {
              aircraftIcao: aircraftIcao.toUpperCase(),
            }
          : {}),
      },
      include: simbriefAirframeInclude,
    });
  }

  private attachLatestOfpAirframeMatch(
    latestOfp: SimbriefLatestOfpResult,
    airframe: SimbriefAirframeRecord | null,
  ) {
    if (
      latestOfp.status !== "AVAILABLE" ||
      !latestOfp.plan ||
      !latestOfp.plan.aircraft
    ) {
      return latestOfp;
    }

    return {
      ...latestOfp,
      plan: {
        ...latestOfp.plan,
        aircraft: {
          ...latestOfp.plan.aircraft,
          matchedAirframe: airframe
            ? this.serializePersistedSimbriefAirframe(airframe)
            : null,
        },
      },
    };
  }

  private serializeSimbriefAirframeLive(
    liveAirframe: SimbriefAirframeSummary,
    persistedAirframe: SimbriefAirframeRecord | null,
  ) {
    return {
      id: persistedAirframe?.id ?? null,
      simbriefAirframeId: liveAirframe.simbriefAirframeId,
      name: liveAirframe.name,
      aircraftIcao: liveAirframe.aircraftIcao,
      registration: liveAirframe.registration,
      selcal: liveAirframe.selcal,
      equipment: liveAirframe.equipment,
      engineType: liveAirframe.engineType,
      wakeCategory: liveAirframe.wakeCategory,
      rawJson: liveAirframe.rawJson,
      linkedAircraftType: persistedAirframe?.linkedAircraftType
        ? {
            id: persistedAirframe.linkedAircraftType.id,
            icaoCode: persistedAirframe.linkedAircraftType.icaoCode,
            name: persistedAirframe.linkedAircraftType.name,
            manufacturer: persistedAirframe.linkedAircraftType.manufacturer,
          }
        : null,
      linkedAircraft: persistedAirframe?.linkedAircraft
        ? {
            id: persistedAirframe.linkedAircraft.id,
            registration: persistedAirframe.linkedAircraft.registration,
            label: persistedAirframe.linkedAircraft.label,
            status: persistedAirframe.linkedAircraft.status,
            aircraftType: {
              id: persistedAirframe.linkedAircraft.aircraftType.id,
              icaoCode: persistedAirframe.linkedAircraft.aircraftType.icaoCode,
              name: persistedAirframe.linkedAircraft.aircraftType.name,
            },
            hub: persistedAirframe.linkedAircraft.hub
              ? {
                  id: persistedAirframe.linkedAircraft.hub.id,
                  code: persistedAirframe.linkedAircraft.hub.code,
                  name: persistedAirframe.linkedAircraft.hub.name,
                }
              : null,
          }
        : null,
      syncedAt: persistedAirframe?.updatedAt ?? null,
    };
  }

  private serializePersistedSimbriefAirframe(airframe: SimbriefAirframeRecord) {
    return this.serializeSimbriefAirframeLive(
      {
        simbriefAirframeId: airframe.simbriefAirframeId,
        name: airframe.name,
        aircraftIcao: airframe.aircraftIcao,
        registration: airframe.registration,
        selcal: airframe.selcal,
        equipment: airframe.equipment,
        engineType: airframe.engineType,
        wakeCategory: airframe.wakeCategory,
        rawJson: airframe.rawJson,
      },
      airframe,
    );
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

