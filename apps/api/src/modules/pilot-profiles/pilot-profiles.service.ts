import {
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
    const simbriefPilotId = payload.simbriefPilotId?.trim() ?? null;

    try {
      const profile = await this.prisma.pilotProfile.update({
        where: { id: pilotProfileId },
        data: {
          simbriefPilotId,
        },
        include: pilotProfileInclude,
      });

      return this.serializeProfile(profile);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "This SimBrief Pilot ID is already linked to another pilot.",
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

