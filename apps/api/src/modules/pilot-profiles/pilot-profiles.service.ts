import {
  BadRequestException,
  ConflictException,
  Dependencies,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
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
import type { CreateMySimbriefAirframeDto } from "./dto/create-my-simbrief-airframe.dto.js";
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

const importedRouteInclude = {
  departureAirport: true,
  arrivalAirport: true,
  departureHub: true,
  arrivalHub: true,
  aircraftType: {
    include: {
      minRank: true,
    },
  },
} satisfies Prisma.RouteInclude;

type ImportedRouteRecord = Prisma.RouteGetPayload<{
  include: typeof importedRouteInclude;
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

type SimbriefAirframeSource = "MANUAL" | "SIMBRIEF";

type SimbriefAirframeMetadata = {
  source: SimbriefAirframeSource;
  externalAirframeId: string | null;
  notes: string | null;
};

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readSimbriefAirframeMetadata(rawJson: unknown): SimbriefAirframeMetadata {
  if (!isJsonRecord(rawJson)) {
    return {
      source: "SIMBRIEF",
      externalAirframeId: null,
      notes: null,
    };
  }

  const source = rawJson.source === "MANUAL" ? "MANUAL" : "SIMBRIEF";

  return {
    source,
    externalAirframeId: readOptionalString(rawJson.externalAirframeId),
    notes: readOptionalString(rawJson.notes),
  };
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

    const persistedAirframes = await this.listPersistedSimbriefAirframes(
      profile.userId,
    );

    if (persistedAirframes.length > 0) {
      return {
        status: "AVAILABLE" as const,
        pilotId: profile.simbriefPilotId,
        detail:
          "Vos airframes SimBrief enregistrees sont disponibles. L'ajout manuel reste la methode fiable pour preparer la flotte reelle.",
        fetchStatus: null,
        fetchedAt: new Date().toISOString(),
        source: profile.simbriefPilotId
          ? buildSimbriefFlightPlanLookup(profile.simbriefPilotId!)
          : null,
        airframes: persistedAirframes.map((airframe) =>
          this.serializePersistedSimbriefAirframe(airframe),
        ),
      };
    }

    if (!profile.simbriefPilotId) {
      return {
        status: "NOT_CONFIGURED" as const,
        pilotId: null,
        detail:
          "Renseignez votre SimBrief Pilot ID pour l'import OFP. Les airframes peuvent etre ajoutees manuellement ci-dessous.",
        fetchStatus: null,
        fetchedAt: new Date().toISOString(),
        source: null,
        airframes: [],
      };
    }

    return {
      status: "NOT_FOUND" as const,
      pilotId: profile.simbriefPilotId,
      detail:
        "SimBrief ne fournit pas de liste airframes via cet endpoint; utilisez l'ajout manuel.",
      fetchStatus: null,
      fetchedAt: new Date().toISOString(),
      source: buildSimbriefFlightPlanLookup(profile.simbriefPilotId!),
      airframes: [],
    };
  }

  public async syncMySimbriefAirframes(user: AuthenticatedUser) {
    const profile = await this.getMySimbriefContext(user);

    if (!profile) {
      throw new NotFoundException("Pilot profile not found.");
    }

    const currentAirframes = await this.listPersistedSimbriefAirframes(
      profile.userId,
    );

    return {
      status: currentAirframes.length > 0 ? ("AVAILABLE" as const) : ("NOT_FOUND" as const),
      pilotId: profile.simbriefPilotId,
      detail:
        "SimBrief ne fournit pas de liste airframes via cet endpoint; utilisez l'ajout manuel.",
      fetchStatus: null,
      fetchedAt: new Date().toISOString(),
      source: profile.simbriefPilotId
        ? buildSimbriefFlightPlanLookup(profile.simbriefPilotId!)
        : null,
      airframes: currentAirframes.map((airframe) =>
        this.serializePersistedSimbriefAirframe(airframe),
      ),
    };
  }

  public async createMySimbriefAirframe(
    user: AuthenticatedUser,
    dto: CreateMySimbriefAirframeDto,
  ) {
    const profile = await this.getMySimbriefContext(user);

    if (!profile) {
      throw new NotFoundException("Pilot profile not found.");
    }

    console.log("payload:", dto);

    try {
      const normalizedName = dto.name?.trim();
      const normalizedRegistration = dto.registration?.trim().toUpperCase();
      const normalizedIcao =
        dto.icao?.trim().toUpperCase() ??
        dto.aircraftIcao?.trim().toUpperCase() ??
        "A320";
      const normalizedEngineType = dto.engineType?.trim() || "CFM56";
      const normalizedNotes = dto.notes?.trim() || null;
      const normalizedSimbriefAirframeId =
        dto.simbriefAirframeId?.trim() || null;

      if (!normalizedName || !normalizedRegistration || !normalizedIcao) {
        throw new BadRequestException("Invalid airframe data");
      }

      const mappedTypeCode =
        this.simbriefClient.inferAircraftTypeCode(normalizedIcao);

      if (!mappedTypeCode) {
        throw new BadRequestException("Invalid airframe data");
      }

      const linkedAircraftType = await this.prisma.aircraftType.findUnique({
        where: {
          icaoCode: mappedTypeCode,
        },
        select: {
          id: true,
        },
      });

      const persistedAirframeId =
        normalizedSimbriefAirframeId ?? `manual-${randomUUID()}`;

      const airframe = await this.prisma.simbriefAirframe.create({
        data: {
          simbriefAirframeId: persistedAirframeId,
          name: normalizedName,
          aircraftIcao: normalizedIcao,
          registration: normalizedRegistration,
          selcal: null,
          equipment: null,
          engineType: normalizedEngineType,
          wakeCategory: null,
          rawJson: {
            source: "MANUAL",
            externalAirframeId: normalizedSimbriefAirframeId,
            notes: normalizedNotes,
          } satisfies Prisma.InputJsonValue,
          linkedAircraftTypeId: linkedAircraftType?.id ?? null,
          ownerUserId: profile.userId,
          pilotProfileId: profile.id,
        },
        include: simbriefAirframeInclude,
      });

      return this.serializePersistedSimbriefAirframe(airframe);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Cette airframe SimBrief existe deja pour un autre profil ou utilise deja cet identifiant.",
        );
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error("[api][simbrief] create airframe failed", {
        userId: profile.userId,
        pilotProfileId: profile.id,
        payload: dto,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new BadRequestException("Invalid airframe data");
    }
  }

  public async importMySimbriefRoute(user: AuthenticatedUser) {
    const profile = await this.getMySimbriefContext(user);

    if (!profile) {
      throw new NotFoundException("Pilot profile not found.");
    }

    if (!profile.simbriefPilotId) {
      throw new BadRequestException(
        "Configurez d'abord votre SimBrief Pilot ID dans votre profil.",
      );
    }

    const latestOfp = await this.simbriefClient.getLatestOfp(
      profile.simbriefPilotId,
    );

    if (
      latestOfp.status !== "AVAILABLE" ||
      !latestOfp.plan ||
      !latestOfp.plan.departureIcao ||
      !latestOfp.plan.arrivalIcao
    ) {
      throw new BadRequestException(
        latestOfp.detail ??
          "Aucun OFP SimBrief exploitable n'est disponible pour l'import de route.",
      );
    }

    const departureIcao = latestOfp.plan.departureIcao.trim().toUpperCase();
    const arrivalIcao = latestOfp.plan.arrivalIcao.trim().toUpperCase();
    const normalizedFlightNumber =
      latestOfp.plan.flightNumber?.trim().toUpperCase() ||
      latestOfp.plan.callsign?.trim().toUpperCase() ||
      `${departureIcao}${arrivalIcao}`;

    const [departureAirport, arrivalAirport] = await Promise.all([
      this.prisma.airport.findUnique({
        where: { icao: departureIcao },
        select: { id: true, icao: true },
      }),
      this.prisma.airport.findUnique({
        where: { icao: arrivalIcao },
        select: { id: true, icao: true },
      }),
    ]);

    if (!departureAirport || !arrivalAirport) {
      throw new BadRequestException(
        "Le référentiel aéroports doit contenir les aéroports de départ et d'arrivée avant l'import SimBrief.",
      );
    }

    const mappedTypeCode = this.simbriefClient.inferAircraftTypeCode(
      latestOfp.plan.aircraft?.icaoCode,
    );
    const [aircraftType, departureHub, arrivalHub] = await Promise.all([
      mappedTypeCode
        ? this.prisma.aircraftType.findUnique({
            where: { icaoCode: mappedTypeCode },
            select: { id: true },
          })
        : Promise.resolve(null),
      this.prisma.hub.findFirst({
        where: { airportId: departureAirport.id, isActive: true },
        select: { id: true },
      }),
      this.prisma.hub.findFirst({
        where: { airportId: arrivalAirport.id, isActive: true },
        select: { id: true },
      }),
    ]);

    const existingRoute = await this.prisma.route.findFirst({
      where: {
        flightNumber: normalizedFlightNumber,
        departureAirportId: departureAirport.id,
        arrivalAirportId: arrivalAirport.id,
      },
      include: importedRouteInclude,
    });

    const routeNotes = this.buildImportedRouteNotes(latestOfp.plan.route);
    const routeData = {
      flightNumber: normalizedFlightNumber,
      departureAirportId: departureAirport.id,
      arrivalAirportId: arrivalAirport.id,
      departureHubId: departureHub?.id ?? null,
      arrivalHubId: arrivalHub?.id ?? null,
      aircraftTypeId: aircraftType?.id ?? null,
      distanceNm: latestOfp.plan.distanceNm ?? null,
      blockTimeMinutes: latestOfp.plan.blockTimeMinutes ?? null,
      isActive: true,
      notes: routeNotes,
    } satisfies Omit<Prisma.RouteUncheckedCreateInput, "code">;

    const route = existingRoute
      ? await this.prisma.route.update({
          where: { id: existingRoute.id },
          data: routeData,
          include: importedRouteInclude,
        })
      : await this.prisma.route.create({
          data: {
            code: await this.generateImportedRouteCode(
              normalizedFlightNumber,
              departureIcao,
              arrivalIcao,
            ),
            ...routeData,
          },
          include: importedRouteInclude,
        });

    return {
      action: existingRoute ? "updated" : "created",
      message: existingRoute
        ? "La route SimBrief existante a été mise à jour."
        : "La route SimBrief a été créée avec succès.",
      route: this.serializeImportedRoute(route),
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

  private async listPersistedSimbriefAirframes(userId: string) {
    return this.prisma.simbriefAirframe.findMany({
      where: {
        ownerUserId: userId,
      },
      orderBy: [{ registration: "asc" }, { name: "asc" }],
      include: simbriefAirframeInclude,
    });
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
    const metadata = persistedAirframe
      ? readSimbriefAirframeMetadata(persistedAirframe.rawJson)
      : {
          source: "SIMBRIEF" as const,
          externalAirframeId: liveAirframe.simbriefAirframeId,
          notes: null,
        };

    return {
      id: persistedAirframe?.id ?? null,
      simbriefAirframeId: liveAirframe.simbriefAirframeId,
      externalAirframeId:
        metadata.externalAirframeId ?? liveAirframe.simbriefAirframeId,
      source: metadata.source,
      name: liveAirframe.name,
      aircraftIcao: liveAirframe.aircraftIcao,
      registration: liveAirframe.registration,
      selcal: liveAirframe.selcal,
      equipment: liveAirframe.equipment,
      engineType: liveAirframe.engineType,
      wakeCategory: liveAirframe.wakeCategory,
      notes: metadata.notes,
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

  private async generateImportedRouteCode(
    flightNumber: string,
    departureIcao: string,
    arrivalIcao: string,
  ): Promise<string> {
    const normalizedFlightNumber = flightNumber.replace(/[^A-Z0-9]/g, "");
    const baseCode =
      normalizedFlightNumber.length > 0
        ? normalizedFlightNumber.slice(0, 12)
        : `${departureIcao}${arrivalIcao}`.slice(0, 12);

    let candidateCode = baseCode;
    let suffix = 1;

    for (;;) {
      const existingRoute = await this.prisma.route.findUnique({
        where: {
          code: candidateCode,
        },
        select: {
          id: true,
        },
      });

      if (!existingRoute) {
        return candidateCode;
      }

      candidateCode = `${baseCode.slice(0, 12)}-${String(suffix)}`.slice(0, 16);
      suffix += 1;
    }
  }

  private buildImportedRouteNotes(route: string | null): string | null {
    const normalizedRoute = route?.trim();

    if (!normalizedRoute) {
      return "Importée depuis le dernier OFP SimBrief.";
    }

    return `Importée depuis le dernier OFP SimBrief. Route : ${normalizedRoute}`;
  }

  private serializeImportedRoute(route: ImportedRouteRecord) {
    return {
      id: route.id,
      code: route.code,
      flightNumber: route.flightNumber,
      distanceNm: route.distanceNm,
      blockTimeMinutes: route.blockTimeMinutes,
      isActive: route.isActive,
      notes: route.notes,
      departureAirport: {
        id: route.departureAirport.id,
        icao: route.departureAirport.icao,
        iata: route.departureAirport.iata,
        name: route.departureAirport.name,
        city: route.departureAirport.city,
        countryCode: route.departureAirport.countryCode,
      },
      arrivalAirport: {
        id: route.arrivalAirport.id,
        icao: route.arrivalAirport.icao,
        iata: route.arrivalAirport.iata,
        name: route.arrivalAirport.name,
        city: route.arrivalAirport.city,
        countryCode: route.arrivalAirport.countryCode,
      },
      departureHub: route.departureHub
        ? {
            id: route.departureHub.id,
            code: route.departureHub.code,
            name: route.departureHub.name,
          }
        : null,
      arrivalHub: route.arrivalHub
        ? {
            id: route.arrivalHub.id,
            code: route.arrivalHub.code,
            name: route.arrivalHub.name,
          }
        : null,
      aircraftType: route.aircraftType
        ? {
            id: route.aircraftType.id,
            icaoCode: route.aircraftType.icaoCode,
            name: route.aircraftType.name,
            manufacturer: route.aircraftType.manufacturer,
            category: route.aircraftType.category,
            minRank: route.aircraftType.minRank
              ? {
                  id: route.aircraftType.minRank.id,
                  code: route.aircraftType.minRank.code,
                  name: route.aircraftType.minRank.name,
                  sortOrder: route.aircraftType.minRank.sortOrder,
                }
              : null,
          }
        : null,
    };
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
        ? buildSimbriefFlightPlanLookup(profile.simbriefPilotId!)
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

