import {
  BadRequestException,
  ConflictException,
  Dependencies,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BookingStatus,
  FlightStatus,
  PilotStatus,
  PirepStatus,
  Prisma,
  type AircraftStatus,
  UserPlatformRole,
  UserStatus,
} from "@va/database";
import type { AuthenticatedUser } from "@va/shared";

import { AvatarStorageService } from "../../common/storage/avatar-storage.service.js";
import type { UploadedAvatarFile } from "../../common/storage/avatar-upload.constants.js";
import {
  maskSecret,
  normalizePrivateSimbriefConfig,
  PRIVATE_SIMBRIEF_CONFIG_SETTING_KEY,
} from "../../common/integrations/simbrief/simbrief-admin-config.js";
import { decimalToNumber } from "../../common/utils/decimal.utils.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  normalizeRulesContent,
  PUBLIC_RULES_SETTING_KEY,
} from "../rules/rules-content.js";
import type {
  CleanupAdminAcarsTestDataDto,
  CreateAdminAircraftDto,
  CreateAdminHubDto,
  CreateAdminRouteDto,
  ImportAdminAircraftFromSimbriefAirframeDto,
  LinkAdminAircraftSimbriefAirframeDto,
  ReviewAdminPirepDto,
  UpdateAdminSimbriefConfigDto,
  UpdateAdminRulesDto,
  UpdateAdminUserDto,
  UpdateAdminAircraftDto,
  UpdateAdminHubDto,
  UpdateAdminRouteDto,
} from "./dto/admin.dto.js";

const ACARS_TEST_FLIGHT_NUMBERS = ["EZY1000"] as const;
const ACARS_TEST_PILOT_NUMBERS = ["VEZY001"] as const;
const ACARS_TEST_BOOKING_NOTE_PREFIX = "AUTO_SIMBRIEF_OFP";
const ACARS_TEST_LOOKBACK_DAYS = 30;

const adminAircraftInclude = {
  aircraftType: {
    include: {
      minRank: true,
    },
  },
  hub: true,
  simbriefAirframe: {
    include: {
      linkedAircraftType: true,
    },
  },
} satisfies Prisma.AircraftInclude;

const simbriefAirframeInclude = {
  linkedAircraftType: true,
  linkedAircraft: {
    include: {
      aircraftType: true,
      hub: true,
    },
  },
  pilotProfile: {
    select: {
      id: true,
      pilotNumber: true,
      firstName: true,
      lastName: true,
    },
  },
  ownerUser: {
    select: {
      id: true,
      username: true,
      email: true,
    },
  },
} satisfies Prisma.SimbriefAirframeInclude;

const adminHubInclude = {
  airport: true,
} satisfies Prisma.HubInclude;

const adminRouteInclude = {
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

const adminPirepInclude = {
  flight: true,
  pilotProfile: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
      rank: true,
      hub: true,
    },
  },
  reviewedBy: {
    select: {
      id: true,
      username: true,
      email: true,
    },
  },
  departureAirport: true,
  arrivalAirport: true,
  aircraft: {
    include: {
      aircraftType: true,
      hub: true,
    },
  },
} satisfies Prisma.PirepInclude;

type AdminAircraftRecord = Prisma.AircraftGetPayload<{
  include: typeof adminAircraftInclude;
}>;

type AdminSimbriefAirframeRecord = Prisma.SimbriefAirframeGetPayload<{
  include: typeof simbriefAirframeInclude;
}>;

type AdminHubRecord = Prisma.HubGetPayload<{
  include: typeof adminHubInclude;
}>;

type AdminRouteRecord = Prisma.RouteGetPayload<{
  include: typeof adminRouteInclude;
}>;

type AdminPirepRecord = Prisma.PirepGetPayload<{
  include: typeof adminPirepInclude;
}>;

const REFERENCE_AIRCRAFT_TYPES = [
  {
    icaoCode: "A319",
    name: "Airbus A319",
    manufacturer: "Airbus",
    category: "Narrow-body",
    cruiseSpeedKts: 450,
  },
  {
    icaoCode: "A320",
    name: "Airbus A320",
    manufacturer: "Airbus",
    category: "Narrow-body",
    cruiseSpeedKts: 450,
  },
  {
    icaoCode: "A20N",
    name: "Airbus A320neo",
    manufacturer: "Airbus",
    category: "Narrow-body",
    cruiseSpeedKts: 447,
  },
  {
    icaoCode: "A21N",
    name: "Airbus A321neo",
    manufacturer: "Airbus",
    category: "Narrow-body",
    cruiseSpeedKts: 450,
  },
] as const;

const adminUserListInclude = {
  pilotProfile: {
    include: {
      hub: true,
      rank: true,
      _count: {
        select: {
          bookings: true,
          pireps: true,
          flights: true,
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

const adminUserDetailInclude = {
  pilotProfile: {
    include: {
      hub: true,
      rank: true,
      bookings: {
        orderBy: {
          reservedAt: "desc",
        },
        take: 5,
        include: {
          aircraft: {
            include: {
              aircraftType: true,
            },
          },
          departureAirport: true,
          arrivalAirport: true,
          flight: true,
        },
      },
      pireps: {
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
        include: {
          flight: true,
          departureAirport: true,
          arrivalAirport: true,
          aircraft: {
            include: {
              aircraftType: true,
            },
          },
        },
      },
      _count: {
        select: {
          bookings: true,
          pireps: true,
          flights: true,
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

type AdminUserListRecord = Prisma.UserGetPayload<{
  include: typeof adminUserListInclude;
}>;

type AdminUserDetailRecord = Prisma.UserGetPayload<{
  include: typeof adminUserDetailInclude;
}>;

type AdminUserDetailCounts = {
  activeBookingsCount: number;
  completedFlightsCount: number;
};

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

function normalizeOptionalString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeOptionalInt(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function logAdminAction(
  action: string,
  actorId: string,
  targetId: string,
  metadata?: Record<string, unknown>,
): void {
  console.info("[admin-audit]", {
    action,
    actorId,
    targetId,
    ...metadata,
  });
}

@Injectable()
@Dependencies(PrismaService, AvatarStorageService)
export class AdminService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly avatarStorageService: AvatarStorageService,
  ) {}

  public async getStats() {
    const [
      totalUsers,
      totalPilots,
      totalAircraft,
      totalHubs,
      totalRoutes,
      activeBookings,
      inProgressFlights,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.pilotProfile.count(),
      this.prisma.aircraft.count(),
      this.prisma.hub.count(),
      this.prisma.route.count(),
      this.prisma.booking.count({
        where: {
          status: {
            in: ["RESERVED", "IN_PROGRESS"],
          },
        },
      }),
      this.prisma.flight.count({
        where: {
          status: "IN_PROGRESS",
        },
      }),
    ]);

    return {
      totalUsers,
      totalPilots,
      totalAircraft,
      totalHubs,
      totalRoutes,
      activeBookings,
      inProgressFlights,
    };
  }

  public async cleanupAcarsTestData(
    payload: CleanupAdminAcarsTestDataDto,
    currentUser: AuthenticatedUser,
  ) {
    const lookbackStart = new Date(
      Date.now() - ACARS_TEST_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    );
    const cleanupWhere: Prisma.BookingWhereInput = {
      OR: [
        {
          reservedFlightNumber: {
            in: [...ACARS_TEST_FLIGHT_NUMBERS],
          },
        },
        {
          notes: {
            startsWith: ACARS_TEST_BOOKING_NOTE_PREFIX,
          },
        },
        {
          AND: [
            {
              createdAt: {
                gte: lookbackStart,
              },
            },
            {
              pilotProfile: {
                is: {
                  pilotNumber: {
                    in: [...ACARS_TEST_PILOT_NUMBERS],
                  },
                },
              },
            },
          ],
        },
      ],
    };

    const matchedBookings = await this.prisma.booking.findMany({
      where: cleanupWhere,
      select: {
        id: true,
        reservedFlightNumber: true,
        notes: true,
        flight: {
          select: {
            id: true,
            flightNumber: true,
            acarsSession: {
              select: {
                id: true,
              },
            },
            pirep: {
              select: {
                id: true,
              },
            },
          },
        },
        pilotProfile: {
          select: {
            pilotNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const bookingIds = matchedBookings.map((booking) => booking.id);
    const flightIds = Array.from(
      new Set(
        matchedBookings
          .map((booking) => booking.flight?.id ?? null)
          .filter((value): value is string => value !== null),
      ),
    );
    const sessionIds = Array.from(
      new Set(
        matchedBookings
          .map((booking) => booking.flight?.acarsSession?.id ?? null)
          .filter((value): value is string => value !== null),
      ),
    );
    const pirepIds = Array.from(
      new Set(
        matchedBookings
          .map((booking) => booking.flight?.pirep?.id ?? null)
          .filter((value): value is string => value !== null),
      ),
    );

    const [telemetryPointsCount, violationsCount, flightEventsCount] =
      await Promise.all([
        sessionIds.length > 0
          ? this.prisma.telemetryPoint.count({
              where: {
                sessionId: {
                  in: sessionIds,
                },
              },
            })
          : Promise.resolve(0),
        flightIds.length > 0 || sessionIds.length > 0 || pirepIds.length > 0
          ? this.prisma.violation.count({
              where: {
                OR: [
                  ...(flightIds.length > 0
                    ? [
                        {
                          flightId: {
                            in: flightIds,
                          },
                        },
                      ]
                    : []),
                  ...(sessionIds.length > 0
                    ? [
                        {
                          sessionId: {
                            in: sessionIds,
                          },
                        },
                      ]
                    : []),
                  ...(pirepIds.length > 0
                    ? [
                        {
                          pirepId: {
                            in: pirepIds,
                          },
                        },
                      ]
                    : []),
                ],
              },
            })
          : Promise.resolve(0),
        flightIds.length > 0 || sessionIds.length > 0
          ? this.prisma.flightEvent.count({
              where: {
                OR: [
                  ...(flightIds.length > 0
                    ? [
                        {
                          flightId: {
                            in: flightIds,
                          },
                        },
                      ]
                    : []),
                  ...(sessionIds.length > 0
                    ? [
                        {
                          sessionId: {
                            in: sessionIds,
                          },
                        },
                      ]
                    : []),
                ],
              },
            })
          : Promise.resolve(0),
      ]);

    const summary = {
      dryRun: payload.dryRun ?? false,
      criteria: {
        flightNumbers: [...ACARS_TEST_FLIGHT_NUMBERS],
        pilotNumbers: [...ACARS_TEST_PILOT_NUMBERS],
        bookingNotesPrefix: ACARS_TEST_BOOKING_NOTE_PREFIX,
        createdAfter: lookbackStart.toISOString(),
      },
      counts: {
        bookings: bookingIds.length,
        flights: flightIds.length,
        sessions: sessionIds.length,
        pireps: pirepIds.length,
        telemetryPoints: telemetryPointsCount,
        flightEvents: flightEventsCount,
        violations: violationsCount,
      },
      matches: matchedBookings.map((booking) => ({
        bookingId: booking.id,
        flightId: booking.flight?.id ?? null,
        sessionId: booking.flight?.acarsSession?.id ?? null,
        pirepId: booking.flight?.pirep?.id ?? null,
        pilotNumber: booking.pilotProfile.pilotNumber,
        flightNumber:
          booking.flight?.flightNumber ?? booking.reservedFlightNumber,
        bookingNotes: booking.notes,
      })),
    };

    if (payload.dryRun || bookingIds.length === 0) {
      logAdminAction("acars.cleanup.preview", currentUser.id, currentUser.id, {
        ...summary.counts,
        dryRun: summary.dryRun,
      });
      return summary;
    }

    const deleted = await this.prisma.$transaction(async (transaction) => {
      const deletedViolations =
        flightIds.length > 0 || sessionIds.length > 0 || pirepIds.length > 0
          ? await transaction.violation.deleteMany({
              where: {
                OR: [
                  ...(flightIds.length > 0
                    ? [
                        {
                          flightId: {
                            in: flightIds,
                          },
                        },
                      ]
                    : []),
                  ...(sessionIds.length > 0
                    ? [
                        {
                          sessionId: {
                            in: sessionIds,
                          },
                        },
                      ]
                    : []),
                  ...(pirepIds.length > 0
                    ? [
                        {
                          pirepId: {
                            in: pirepIds,
                          },
                        },
                      ]
                    : []),
                ],
              },
            })
          : { count: 0 };

      const deletedFlightEvents =
        flightIds.length > 0 || sessionIds.length > 0
          ? await transaction.flightEvent.deleteMany({
              where: {
                OR: [
                  ...(flightIds.length > 0
                    ? [
                        {
                          flightId: {
                            in: flightIds,
                          },
                        },
                      ]
                    : []),
                  ...(sessionIds.length > 0
                    ? [
                        {
                          sessionId: {
                            in: sessionIds,
                          },
                        },
                      ]
                    : []),
                ],
              },
            })
          : { count: 0 };

      const deletedBookings = await transaction.booking.deleteMany({
        where: {
          id: {
            in: bookingIds,
          },
        },
      });

      return {
        deletedBookings: deletedBookings.count,
        deletedFlightEvents: deletedFlightEvents.count,
        deletedViolations: deletedViolations.count,
      };
    });

    logAdminAction("acars.cleanup.execute", currentUser.id, currentUser.id, {
      ...summary.counts,
      deletedBookings: deleted.deletedBookings,
      deletedFlightEvents: deleted.deletedFlightEvents,
      deletedViolations: deleted.deletedViolations,
    });

    return {
      ...summary,
      deleted: {
        bookings: deleted.deletedBookings,
        flights: summary.counts.flights,
        sessions: summary.counts.sessions,
        pireps: summary.counts.pireps,
        telemetryPoints: summary.counts.telemetryPoints,
        flightEvents: deleted.deletedFlightEvents,
        violations: deleted.deletedViolations,
      },
    };
  }

  public async getReferenceData() {
    const [airportsResult, hubsResult, aircraftTypesResult, simbriefAirframesResult] =
      await Promise.allSettled([
      this.prisma.airport.findMany({
        orderBy: { icao: "asc" },
        select: {
          id: true,
          icao: true,
          iata: true,
          name: true,
          city: true,
          countryCode: true,
        },
      }),
      this.prisma.hub.findMany({
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
        },
      }),
      this.prisma.aircraftType.findMany({
        orderBy: { icaoCode: "asc" },
        select: {
          id: true,
          icaoCode: true,
          name: true,
          manufacturer: true,
        },
      }),
      this.prisma.simbriefAirframe.findMany({
        orderBy: [{ registration: "asc" }, { name: "asc" }],
        include: simbriefAirframeInclude,
      }),
    ]);

    return {
      airports: this.unwrapReferenceDataset("airports", airportsResult),
      hubs: this.unwrapReferenceDataset("hubs", hubsResult),
      aircraftTypes: this.unwrapReferenceDataset(
        "aircraft types",
        aircraftTypesResult,
      ),
      simbriefAirframes: this.serializeSimbriefAirframeList(
        this.unwrapReferenceDataset(
          "SimBrief airframes",
          simbriefAirframesResult,
        ) as AdminSimbriefAirframeRecord[],
      ),
    } as const;
  }

  public async listAirports() {
    const airports = await this.prisma.airport.findMany({
      where: {
        isActive: true,
      },
      orderBy: { icao: "asc" },
      select: {
        id: true,
        icao: true,
        iata: true,
        name: true,
        city: true,
        countryCode: true,
        latitude: true,
        longitude: true,
        elevationFt: true,
        isActive: true,
      },
    });

    return airports.map((airport) => ({
      id: airport.id,
      icao: airport.icao,
      iata: airport.iata,
      name: airport.name,
      city: airport.city,
      countryCode: airport.countryCode,
      latitude: decimalToNumber(airport.latitude),
      longitude: decimalToNumber(airport.longitude),
      elevationFt: airport.elevationFt,
      isActive: airport.isActive,
    }));
  }

  public async listAircraftTypes() {
    try {
      return await this.prisma.aircraftType.findMany({
        orderBy: { icaoCode: "asc" },
        select: {
          id: true,
          icaoCode: true,
          name: true,
          manufacturer: true,
        },
      });
    } catch (error) {
      this.logAdminDatasetError("aircraft types", error);
      return [];
    }
  }

  public async listSimbriefAirframes() {
    try {
      const airframes = await this.prisma.simbriefAirframe.findMany({
        orderBy: [{ registration: "asc" }, { name: "asc" }],
        include: simbriefAirframeInclude,
      });

      return this.serializeSimbriefAirframeList(airframes);
    } catch (error) {
      this.logAdminDatasetError("SimBrief airframes", error);
      return [];
    }
  }

  public async getSimbriefConfig() {
    const setting = await this.prisma.setting.findUnique({
      where: {
        key: PRIVATE_SIMBRIEF_CONFIG_SETTING_KEY,
      },
      include: {
        updatedBy: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    const config = normalizePrivateSimbriefConfig(setting?.value);

    return {
      hasApiKey: Boolean(config.apiKey),
      maskedApiKey: maskSecret(config.apiKey),
      updatedAt: setting?.updatedAt.toISOString() ?? null,
      updatedBy: setting?.updatedBy ?? null,
    };
  }

  public async updateSimbriefConfig(
    payload: UpdateAdminSimbriefConfigDto,
    currentUser: AuthenticatedUser,
  ) {
    const normalizedApiKey = payload.apiKey?.trim() ?? "";

    if (payload.clearApiKey) {
      await this.prisma.setting.deleteMany({
        where: {
          key: PRIVATE_SIMBRIEF_CONFIG_SETTING_KEY,
        },
      });

      logAdminAction(
        "simbrief.config.clear",
        currentUser.id,
        PRIVATE_SIMBRIEF_CONFIG_SETTING_KEY,
      );

      return {
        hasApiKey: false,
        maskedApiKey: null,
        updatedAt: null,
        updatedBy: null,
      };
    }

    if (normalizedApiKey.length === 0) {
      throw new BadRequestException(
        "Renseignez une clé API SimBrief ou utilisez l'action d'effacement.",
      );
    }

    const setting = await this.prisma.setting.upsert({
      where: {
        key: PRIVATE_SIMBRIEF_CONFIG_SETTING_KEY,
      },
      update: {
        value: {
          apiKey: normalizedApiKey,
        } satisfies Prisma.InputJsonValue,
        isPublic: false,
        description:
          "Clé API SimBrief privée stockée côté serveur pour les intégrations de dispatch et d'import.",
        updatedById: currentUser.id,
      },
      create: {
        key: PRIVATE_SIMBRIEF_CONFIG_SETTING_KEY,
        value: {
          apiKey: normalizedApiKey,
        } satisfies Prisma.InputJsonValue,
        isPublic: false,
        description:
          "Clé API SimBrief privée stockée côté serveur pour les intégrations de dispatch et d'import.",
        updatedById: currentUser.id,
      },
      include: {
        updatedBy: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    logAdminAction(
      "simbrief.config.update",
      currentUser.id,
      PRIVATE_SIMBRIEF_CONFIG_SETTING_KEY,
      {
        hasApiKey: true,
      },
    );

    return {
      hasApiKey: true,
      maskedApiKey: maskSecret(normalizedApiKey),
      updatedAt: setting.updatedAt.toISOString(),
      updatedBy: setting.updatedBy,
    };
  }

  public async getRules() {
    const setting = await this.prisma.setting.findUnique({
      where: {
        key: PUBLIC_RULES_SETTING_KEY,
      },
      include: {
        updatedBy: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    const content = normalizeRulesContent(setting?.value);

    return {
      sections: content.sections,
      updatedAt: setting?.updatedAt.toISOString() ?? null,
      updatedBy: setting?.updatedBy ?? null,
    };
  }

  public async updateRules(
    payload: UpdateAdminRulesDto,
    currentUser: AuthenticatedUser,
  ) {
    const normalizedContent = normalizeRulesContent(payload);

    const setting = await this.prisma.setting.upsert({
      where: {
        key: PUBLIC_RULES_SETTING_KEY,
      },
      update: {
        value: normalizedContent as unknown as Prisma.InputJsonValue,
        isPublic: true,
        description:
          "Contenu éditable du règlement public (comportement, exploitation, activité et sanctions).",
        updatedById: currentUser.id,
      },
      create: {
        key: PUBLIC_RULES_SETTING_KEY,
        value: normalizedContent as unknown as Prisma.InputJsonValue,
        isPublic: true,
        description:
          "Contenu éditable du règlement public (comportement, exploitation, activité et sanctions).",
        updatedById: currentUser.id,
      },
      include: {
        updatedBy: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    logAdminAction("rules.update", currentUser.id, PUBLIC_RULES_SETTING_KEY, {
      sections: normalizedContent.sections.length,
    });

    return {
      sections: normalizedContent.sections,
      updatedAt: setting.updatedAt.toISOString(),
      updatedBy: setting.updatedBy,
    };
  }

  public async initializeAircraftTypeReferenceData(
    currentUser: AuthenticatedUser,
  ) {
    await this.upsertAircraftTypeReferenceData();
    logAdminAction(
      "reference.aircraft-types.initialize",
      currentUser.id,
      currentUser.id,
    );

    return this.getReferenceData();
  }

  public async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: adminUserListInclude,
    });

    return users.map((user) => this.serializeAdminUserListItem(user));
  }

  public async listPireps() {
    const pireps = await this.prisma.pirep.findMany({
      where: {
        status: {
          not: PirepStatus.DRAFT,
        },
      },
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      include: adminPirepInclude,
    });

    return this.serializeAdminPirepList(pireps);
  }

  public async reviewPirep(
    id: string,
    payload: ReviewAdminPirepDto,
    currentUser: AuthenticatedUser,
  ) {
    let previousStatus: PirepStatus | null = null;

    try {
      const pirep = await this.prisma.$transaction(async (transaction) => {
        const existingPirep = await transaction.pirep.findUnique({
          where: { id },
          include: adminPirepInclude,
        });

        if (!existingPirep) {
          throw new NotFoundException("Rapport de vol introuvable.");
        }

        if (existingPirep.status === PirepStatus.DRAFT) {
          throw new ConflictException(
            "Seuls les rapports de vol soumis peuvent être validés ou rejetés.",
          );
        }

        previousStatus = existingPirep.status;

        return transaction.pirep.update({
          where: { id },
          data: {
            status: payload.status,
            reviewedAt: new Date(),
            reviewedById: currentUser.id,
            reviewerComment: normalizeOptionalString(payload.reviewerComment),
          },
          include: adminPirepInclude,
        });
      });

      logAdminAction("pirep.review", currentUser.id, id, {
        previousStatus,
        nextStatus: payload.status,
      });

      return this.serializeAdminPirep(pirep);
    } catch (error) {
      throw this.normalizePrismaError(error, "Rapport de vol");
    }
  }

  public async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: adminUserDetailInclude,
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    const counts = await this.getAdminUserDetailCounts(user.pilotProfile?.id ?? null);

    return this.serializeAdminUserDetail(user, counts);
  }

  public async updateUser(
    id: string,
    payload: UpdateAdminUserDto,
    currentUser: AuthenticatedUser,
  ) {
    if (currentUser.id === id && payload.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException("You cannot suspend your own administrator account.");
    }

    if (currentUser.id === id && payload.role === UserPlatformRole.USER) {
      throw new ForbiddenException("You cannot remove your own administrator role.");
    }

    try {
      const user = await this.prisma.$transaction(async (transaction) => {
        const existingUser = await transaction.user.findUnique({
          where: { id },
          include: {
            pilotProfile: true,
          },
        });

        if (!existingUser) {
          throw new NotFoundException("User not found.");
        }

        await this.assertAdminChangeIsAllowed(
          transaction,
          existingUser.id,
          existingUser.role,
          existingUser.status,
          payload.role,
          payload.status,
        );

        const pilotProfileUpdateData: Prisma.PilotProfileUpdateInput = {};

        if (payload.firstName !== undefined) {
          pilotProfileUpdateData.firstName = payload.firstName.trim();
        }

        if (payload.lastName !== undefined) {
          pilotProfileUpdateData.lastName = payload.lastName.trim();
        }

        if (payload.pilotNumber !== undefined) {
          pilotProfileUpdateData.pilotNumber = payload.pilotNumber
            .trim()
            .toUpperCase();
        }

        if (payload.callsign !== undefined) {
          pilotProfileUpdateData.callsign =
            normalizeOptionalString(payload.callsign)?.toUpperCase() ?? null;
        }

        if (payload.countryCode !== undefined) {
          pilotProfileUpdateData.countryCode = normalizeOptionalString(payload.countryCode);
        }

        if (payload.status === UserStatus.ACTIVE) {
          pilotProfileUpdateData.status = PilotStatus.ACTIVE;
        }

        if (payload.status === UserStatus.SUSPENDED) {
          pilotProfileUpdateData.status = PilotStatus.SUSPENDED;
        }

        if (
          existingUser.pilotProfile === null &&
          Object.keys(pilotProfileUpdateData).length > 0
        ) {
          throw new ConflictException("This user does not have a pilot profile to update.");
        }

        await transaction.user.update({
          where: { id },
          data: {
            ...(payload.role !== undefined ? { role: payload.role } : {}),
            ...(payload.status !== undefined ? { status: payload.status } : {}),
            ...(payload.username !== undefined
              ? { username: payload.username.trim().toLowerCase() }
              : {}),
          },
        });

        if (
          existingUser.pilotProfile &&
          Object.keys(pilotProfileUpdateData).length > 0
        ) {
          await transaction.pilotProfile.update({
            where: { id: existingUser.pilotProfile.id },
            data: pilotProfileUpdateData,
          });
        }

        return transaction.user.findUniqueOrThrow({
          where: { id },
          include: adminUserDetailInclude,
        });
      });

      const counts = await this.getAdminUserDetailCounts(user.pilotProfile?.id ?? null);
      logAdminAction("user.update", currentUser.id, id, {
        role: payload.role ?? null,
        status: payload.status ?? null,
      });

      return this.serializeAdminUserDetail(user, counts);
    } catch (error) {
      throw this.normalizePrismaError(error, "User");
    }
  }

  public async suspendUser(id: string, currentUser: AuthenticatedUser) {
    if (currentUser.id === id) {
      throw new ForbiddenException("You cannot suspend your own administrator account.");
    }

    try {
      const user = await this.prisma.$transaction(async (transaction) => {
        const existingUser = await transaction.user.findUnique({
          where: { id },
          include: {
            pilotProfile: true,
          },
        });

        if (!existingUser) {
          throw new NotFoundException("User not found.");
        }

        await this.assertAdminChangeIsAllowed(
          transaction,
          existingUser.id,
          existingUser.role,
          existingUser.status,
          undefined,
          UserStatus.SUSPENDED,
        );

        await transaction.user.update({
          where: { id },
          data: {
            status: UserStatus.SUSPENDED,
          },
        });

        if (existingUser.pilotProfile) {
          await transaction.pilotProfile.update({
            where: {
              id: existingUser.pilotProfile.id,
            },
            data: {
              status: PilotStatus.SUSPENDED,
            },
          });
        }

        return transaction.user.findUniqueOrThrow({
          where: { id },
          include: adminUserDetailInclude,
        });
      });

      const counts = await this.getAdminUserDetailCounts(user.pilotProfile?.id ?? null);
      logAdminAction("user.suspend", currentUser.id, id);

      return this.serializeAdminUserDetail(user, counts);
    } catch (error) {
      throw this.normalizePrismaError(error, "User");
    }
  }

  public async activateUser(id: string, _currentUser: AuthenticatedUser) {
    try {
      const user = await this.prisma.$transaction(async (transaction) => {
        const existingUser = await transaction.user.findUnique({
          where: { id },
          include: {
            pilotProfile: true,
          },
        });

        if (!existingUser) {
          throw new NotFoundException("User not found.");
        }

        await transaction.user.update({
          where: { id },
          data: {
            status: UserStatus.ACTIVE,
          },
        });

        if (existingUser.pilotProfile) {
          await transaction.pilotProfile.update({
            where: {
              id: existingUser.pilotProfile.id,
            },
            data: {
              status: PilotStatus.ACTIVE,
            },
          });
        }

        return transaction.user.findUniqueOrThrow({
          where: { id },
          include: adminUserDetailInclude,
        });
      });

      const counts = await this.getAdminUserDetailCounts(user.pilotProfile?.id ?? null);
      logAdminAction("user.activate", _currentUser.id, id);

      return this.serializeAdminUserDetail(user, counts);
    } catch (error) {
      throw this.normalizePrismaError(error, "User");
    }
  }

  public async updateUserAvatar(
    id: string,
    file: UploadedAvatarFile,
    currentUser: AuthenticatedUser,
  ) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
      },
    });

    if (!existingUser) {
      throw new NotFoundException("User not found.");
    }

    const avatarUrl = await this.avatarStorageService.uploadUserAvatar(id, file);

    await this.prisma.user.update({
      where: { id },
      data: {
        avatarUrl,
      },
    });

    logAdminAction("user.avatar.update", currentUser.id, id);

    return this.getUser(id);
  }

  public async listAircraft() {
    const aircraft = await this.prisma.aircraft.findMany({
      orderBy: { registration: "asc" },
      include: adminAircraftInclude,
    });

    return this.serializeAircraftList(aircraft);
  }

  public async getAircraft(id: string) {
    const aircraft = await this.prisma.aircraft.findUnique({
      where: { id },
      include: adminAircraftInclude,
    });

    if (!aircraft) {
      throw new NotFoundException("Aircraft not found.");
    }

    return this.serializeAircraft(aircraft);
  }

  public async createAircraftFromSimbriefAirframe(
    payload: ImportAdminAircraftFromSimbriefAirframeDto,
    currentUser: AuthenticatedUser,
  ) {
    const importedAircraft = await this.prisma.$transaction(async (transaction) => {
      const airframe = await transaction.simbriefAirframe.findUnique({
        where: {
          id: payload.simbriefAirframeId,
        },
        include: simbriefAirframeInclude,
      });

      if (!airframe) {
        throw new NotFoundException("SimBrief airframe not found.");
      }

      if (airframe.linkedAircraftId) {
        throw new ConflictException(
          "Cette airframe SimBrief est déjà liée à un appareil de la flotte.",
        );
      }

      if (!airframe.linkedAircraftTypeId) {
        throw new ConflictException(
          "Cette airframe SimBrief n'est pas encore mappée vers un type appareil de référence.",
        );
      }

      if (!airframe.registration) {
        throw new ConflictException(
          "Cette airframe SimBrief ne fournit pas d'immatriculation exploitable.",
        );
      }

      const aircraft = await transaction.aircraft.create({
        data: {
          registration: airframe.registration.trim().toUpperCase(),
          label: normalizeOptionalString(airframe.name),
          aircraftTypeId: airframe.linkedAircraftTypeId,
          hubId: normalizeOptionalString(payload.hubId),
          status: payload.status ?? "ACTIVE",
          notes:
            normalizeOptionalString(payload.notes) ??
            "Importé depuis SimBrief Airframe.",
        },
        include: adminAircraftInclude,
      });

      await transaction.simbriefAirframe.update({
        where: {
          id: airframe.id,
        },
        data: {
          linkedAircraftId: aircraft.id,
        },
      });

      return transaction.aircraft.findUniqueOrThrow({
        where: {
          id: aircraft.id,
        },
        include: adminAircraftInclude,
      });
    });

    logAdminAction("aircraft.import-from-simbrief-airframe", currentUser.id, importedAircraft.id, {
      simbriefAirframeId: payload.simbriefAirframeId,
    });

    return this.serializeAircraft(importedAircraft);
  }

  public async linkAircraftToSimbriefAirframe(
    aircraftId: string,
    payload: LinkAdminAircraftSimbriefAirframeDto,
    currentUser: AuthenticatedUser,
  ) {
    const aircraft = await this.prisma.$transaction(async (transaction) => {
      const existingAircraft = await transaction.aircraft.findUnique({
        where: {
          id: aircraftId,
        },
        include: adminAircraftInclude,
      });

      if (!existingAircraft) {
        throw new NotFoundException("Aircraft not found.");
      }

      const airframe = await transaction.simbriefAirframe.findUnique({
        where: {
          id: payload.simbriefAirframeId,
        },
        include: simbriefAirframeInclude,
      });

      if (!airframe) {
        throw new NotFoundException("SimBrief airframe not found.");
      }

      if (
        airframe.linkedAircraftId &&
        airframe.linkedAircraftId !== existingAircraft.id
      ) {
        throw new ConflictException(
          "Cette airframe SimBrief est déjà liée à un autre appareil.",
        );
      }

      if (
        airframe.linkedAircraftTypeId &&
        airframe.linkedAircraftTypeId !== existingAircraft.aircraftTypeId
      ) {
        throw new ConflictException(
          "Le type appareil de la flotte ne correspond pas à celui de l'airframe SimBrief.",
        );
      }

      await transaction.simbriefAirframe.update({
        where: {
          id: airframe.id,
        },
        data: {
          linkedAircraftId: existingAircraft.id,
        },
      });

      return transaction.aircraft.findUniqueOrThrow({
        where: {
          id: existingAircraft.id,
        },
        include: adminAircraftInclude,
      });
    });

    logAdminAction("aircraft.link-simbrief-airframe", currentUser.id, aircraft.id, {
      simbriefAirframeId: payload.simbriefAirframeId,
    });

    return this.serializeAircraft(aircraft);
  }

  public async unlinkAircraftFromSimbriefAirframe(
    aircraftId: string,
    currentUser: AuthenticatedUser,
  ) {
    const aircraft = await this.prisma.$transaction(async (transaction) => {
      const existingAircraft = await transaction.aircraft.findUnique({
        where: {
          id: aircraftId,
        },
        include: {
          simbriefAirframe: true,
        },
      });

      if (!existingAircraft) {
        throw new NotFoundException("Aircraft not found.");
      }

      if (existingAircraft.simbriefAirframe) {
        await transaction.simbriefAirframe.update({
          where: {
            id: existingAircraft.simbriefAirframe.id,
          },
          data: {
            linkedAircraftId: null,
          },
        });
      }

      return transaction.aircraft.findUniqueOrThrow({
        where: {
          id: aircraftId,
        },
        include: adminAircraftInclude,
      });
    });

    logAdminAction("aircraft.unlink-simbrief-airframe", currentUser.id, aircraftId);
    return this.serializeAircraft(aircraft);
  }

  public async createAircraft(
    payload: CreateAdminAircraftDto,
    currentUser: AuthenticatedUser,
  ) {
    try {
      const aircraft = await this.prisma.$transaction(async (transaction) => {
        const createdAircraft = await transaction.aircraft.create({
          data: {
            registration: payload.registration.trim().toUpperCase(),
            label: normalizeOptionalString(payload.label),
            aircraftTypeId: payload.aircraftTypeId,
            hubId: normalizeOptionalString(payload.hubId),
            status: payload.status as AircraftStatus,
            notes: normalizeOptionalString(payload.notes),
          },
          include: adminAircraftInclude,
        });

        if (payload.simbriefAirframeId) {
          await this.assertAndLinkSimbriefAirframe(
            transaction,
            createdAircraft.id,
            payload.simbriefAirframeId,
            createdAircraft.aircraftTypeId,
          );
        }

        return transaction.aircraft.findUniqueOrThrow({
          where: {
            id: createdAircraft.id,
          },
          include: adminAircraftInclude,
        });
      });

      logAdminAction("aircraft.create", currentUser.id, aircraft.id);
      return this.serializeAircraft(aircraft);
    } catch (error) {
      throw this.normalizePrismaError(error, "Aircraft");
    }
  }

  public async updateAircraft(
    id: string,
    payload: UpdateAdminAircraftDto,
    currentUser: AuthenticatedUser,
  ) {
    try {
      const aircraft = await this.prisma.$transaction(async (transaction) => {
        const updatedAircraft = await transaction.aircraft.update({
          where: { id },
          data: {
            ...(payload.registration !== undefined
              ? { registration: payload.registration.trim().toUpperCase() }
              : {}),
            ...(payload.label !== undefined
              ? { label: normalizeOptionalString(payload.label) }
              : {}),
            ...(payload.aircraftTypeId !== undefined
              ? { aircraftTypeId: payload.aircraftTypeId }
              : {}),
            ...(payload.hubId !== undefined
              ? { hubId: normalizeOptionalString(payload.hubId) }
              : {}),
            ...(payload.status !== undefined ? { status: payload.status } : {}),
            ...(payload.notes !== undefined
              ? { notes: normalizeOptionalString(payload.notes) }
              : {}),
          },
          include: adminAircraftInclude,
        });

        if (payload.simbriefAirframeId !== undefined) {
          if (payload.simbriefAirframeId === null) {
            await transaction.simbriefAirframe.updateMany({
              where: {
                linkedAircraftId: updatedAircraft.id,
              },
              data: {
                linkedAircraftId: null,
              },
            });
          } else {
            await this.assertAndLinkSimbriefAirframe(
              transaction,
              updatedAircraft.id,
              payload.simbriefAirframeId,
              updatedAircraft.aircraftTypeId,
            );
          }
        }

        return transaction.aircraft.findUniqueOrThrow({
          where: { id: updatedAircraft.id },
          include: adminAircraftInclude,
        });
      });

      logAdminAction("aircraft.update", currentUser.id, id);
      return this.serializeAircraft(aircraft);
    } catch (error) {
      throw this.normalizePrismaError(error, "Aircraft");
    }
  }

  public async deleteAircraft(id: string, currentUser: AuthenticatedUser) {
    try {
      await this.prisma.aircraft.delete({
        where: { id },
      });
      logAdminAction("aircraft.delete", currentUser.id, id);
    } catch (error) {
      throw this.normalizePrismaError(error, "Aircraft");
    }

    return { success: true };
  }

  public async listHubs() {
    try {
      const hubs = await this.prisma.hub.findMany({
        orderBy: { code: "asc" },
        include: adminHubInclude,
      });

      return this.serializeHubList(hubs);
    } catch (error) {
      this.logAdminDatasetError("hubs", error);
      return [];
    }
  }

  public async getHub(id: string) {
    const hub = await this.prisma.hub.findUnique({
      where: { id },
      include: adminHubInclude,
    });

    if (!hub) {
      throw new NotFoundException("Hub not found.");
    }

    return this.serializeHub(hub);
  }

  public async createHub(
    payload: CreateAdminHubDto,
    currentUser: AuthenticatedUser,
  ) {
    try {
      const hub = await this.prisma.hub.create({
        data: {
          code: payload.code.trim().toUpperCase(),
          name: payload.name.trim(),
          airportId: payload.airportId,
          isActive: payload.isActive ?? true,
        },
        include: adminHubInclude,
      });

      logAdminAction("hub.create", currentUser.id, hub.id);
      return this.serializeHub(hub);
    } catch (error) {
      throw this.normalizePrismaError(error, "Hub");
    }
  }

  public async updateHub(
    id: string,
    payload: UpdateAdminHubDto,
    currentUser: AuthenticatedUser,
  ) {
    try {
      const hub = await this.prisma.hub.update({
        where: { id },
        data: {
          ...(payload.code !== undefined
            ? { code: payload.code.trim().toUpperCase() }
            : {}),
          ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
          ...(payload.airportId !== undefined ? { airportId: payload.airportId } : {}),
          ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        },
        include: adminHubInclude,
      });

      logAdminAction("hub.update", currentUser.id, id);
      return this.serializeHub(hub);
    } catch (error) {
      throw this.normalizePrismaError(error, "Hub");
    }
  }

  public async deleteHub(id: string, currentUser: AuthenticatedUser) {
    try {
      await this.prisma.hub.delete({
        where: { id },
      });
      logAdminAction("hub.delete", currentUser.id, id);
    } catch (error) {
      throw this.normalizePrismaError(error, "Hub");
    }

    return { success: true };
  }

  public async listRoutes() {
    const routes = await this.prisma.route.findMany({
      orderBy: { code: "asc" },
      include: adminRouteInclude,
    });

    return routes.map((item) => this.serializeRoute(item));
  }

  public async getRoute(id: string) {
    const route = await this.prisma.route.findUnique({
      where: { id },
      include: adminRouteInclude,
    });

    if (!route) {
      throw new NotFoundException("Route not found.");
    }

    return this.serializeRoute(route);
  }

  public async createRoute(
    payload: CreateAdminRouteDto,
    currentUser: AuthenticatedUser,
  ) {
    try {
      const route = await this.prisma.route.create({
        data: {
          code: payload.code.trim().toUpperCase(),
          flightNumber: payload.flightNumber.trim().toUpperCase(),
          departureAirportId: payload.departureAirportId,
          arrivalAirportId: payload.arrivalAirportId,
          departureHubId: normalizeOptionalString(payload.departureHubId),
          arrivalHubId: normalizeOptionalString(payload.arrivalHubId),
          aircraftTypeId: normalizeOptionalString(payload.aircraftTypeId),
          distanceNm: normalizeOptionalInt(payload.distanceNm),
          blockTimeMinutes: normalizeOptionalInt(payload.blockTimeMinutes),
          isActive: payload.isActive ?? true,
          notes: normalizeOptionalString(payload.notes),
        },
        include: adminRouteInclude,
      });

      logAdminAction("route.create", currentUser.id, route.id);
      return this.serializeRoute(route);
    } catch (error) {
      throw this.normalizePrismaError(error, "Route");
    }
  }

  public async updateRoute(
    id: string,
    payload: UpdateAdminRouteDto,
    currentUser: AuthenticatedUser,
  ) {
    try {
      const route = await this.prisma.route.update({
        where: { id },
        data: {
          ...(payload.code !== undefined
            ? { code: payload.code.trim().toUpperCase() }
            : {}),
          ...(payload.flightNumber !== undefined
            ? { flightNumber: payload.flightNumber.trim().toUpperCase() }
            : {}),
          ...(payload.departureAirportId !== undefined
            ? { departureAirportId: payload.departureAirportId }
            : {}),
          ...(payload.arrivalAirportId !== undefined
            ? { arrivalAirportId: payload.arrivalAirportId }
            : {}),
          ...(payload.departureHubId !== undefined
            ? { departureHubId: normalizeOptionalString(payload.departureHubId) }
            : {}),
          ...(payload.arrivalHubId !== undefined
            ? { arrivalHubId: normalizeOptionalString(payload.arrivalHubId) }
            : {}),
          ...(payload.aircraftTypeId !== undefined
            ? { aircraftTypeId: normalizeOptionalString(payload.aircraftTypeId) }
            : {}),
          ...(payload.distanceNm !== undefined
            ? { distanceNm: normalizeOptionalInt(payload.distanceNm) }
            : {}),
          ...(payload.blockTimeMinutes !== undefined
            ? { blockTimeMinutes: normalizeOptionalInt(payload.blockTimeMinutes) }
            : {}),
          ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
          ...(payload.notes !== undefined
            ? { notes: normalizeOptionalString(payload.notes) }
            : {}),
        },
        include: adminRouteInclude,
      });

      logAdminAction("route.update", currentUser.id, id);
      return this.serializeRoute(route);
    } catch (error) {
      throw this.normalizePrismaError(error, "Route");
    }
  }

  public async deleteRoute(id: string, currentUser: AuthenticatedUser) {
    try {
      await this.prisma.route.delete({
        where: { id },
      });
      logAdminAction("route.delete", currentUser.id, id);
    } catch (error) {
      throw this.normalizePrismaError(error, "Route");
    }

    return { success: true };
  }

  private async getAdminUserDetailCounts(
    pilotProfileId: string | null,
  ): Promise<AdminUserDetailCounts> {
    if (!pilotProfileId) {
      return {
        activeBookingsCount: 0,
        completedFlightsCount: 0,
      };
    }

    const [activeBookingsCount, completedFlightsCount] = await Promise.all([
      this.prisma.booking.count({
        where: {
          pilotProfileId,
          status: {
            in: [BookingStatus.RESERVED, BookingStatus.IN_PROGRESS],
          },
        },
      }),
      this.prisma.flight.count({
        where: {
          pilotProfileId,
          status: FlightStatus.COMPLETED,
        },
      }),
    ]);

    return {
      activeBookingsCount,
      completedFlightsCount,
    };
  }

  private async assertAdminChangeIsAllowed(
    transaction: Prisma.TransactionClient,
    targetUserId: string,
    currentRole: UserPlatformRole,
    currentStatus: UserStatus,
    nextRole: UserPlatformRole | undefined,
    nextStatus: UserStatus | undefined,
  ): Promise<void> {
    if (currentRole !== UserPlatformRole.ADMIN) {
      return;
    }

    const resultingRole = nextRole ?? currentRole;
    const resultingStatus = nextStatus ?? currentStatus;

    if (
      resultingRole === UserPlatformRole.ADMIN &&
      resultingStatus === UserStatus.ACTIVE
    ) {
      return;
    }

    const activeAdminCount = await transaction.user.count({
      where: {
        role: UserPlatformRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    if (activeAdminCount <= 1) {
      throw new ForbiddenException(
        "The last active administrator cannot be suspended or demoted.",
      );
    }

    const remainingActiveAdmins = await transaction.user.count({
      where: {
        role: UserPlatformRole.ADMIN,
        status: UserStatus.ACTIVE,
        NOT: {
          id: targetUserId,
        },
      },
    });

    if (remainingActiveAdmins === 0) {
      throw new ForbiddenException(
        "The last active administrator cannot be suspended or demoted.",
      );
    }
  }

  private async upsertAircraftTypeReferenceData(): Promise<void> {
    for (const aircraftType of REFERENCE_AIRCRAFT_TYPES) {
      await this.prisma.aircraftType.upsert({
        where: {
          icaoCode: aircraftType.icaoCode,
        },
        update: aircraftType,
        create: aircraftType,
      });
    }
  }

  private serializeAdminUserListItem(user: AdminUserListRecord) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: getAvatarUrl(user),
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      pilotProfile: user.pilotProfile
        ? {
            id: user.pilotProfile.id,
            pilotNumber: user.pilotProfile.pilotNumber,
            callsign: user.pilotProfile.callsign,
            firstName: user.pilotProfile.firstName,
            lastName: user.pilotProfile.lastName,
            countryCode: user.pilotProfile.countryCode,
            status: user.pilotProfile.status,
            hoursFlownMinutes: user.pilotProfile.hoursFlownMinutes,
            experiencePoints: user.pilotProfile.experiencePoints,
            hub: user.pilotProfile.hub
              ? {
                  id: user.pilotProfile.hub.id,
                  code: user.pilotProfile.hub.code,
                  name: user.pilotProfile.hub.name,
                }
              : null,
            rank: user.pilotProfile.rank
              ? {
                  id: user.pilotProfile.rank.id,
                  code: user.pilotProfile.rank.code,
                  name: user.pilotProfile.rank.name,
                  sortOrder: user.pilotProfile.rank.sortOrder,
                }
              : null,
          }
        : null,
      stats: {
        hoursFlownMinutes: user.pilotProfile?.hoursFlownMinutes ?? 0,
        bookingsCount: user.pilotProfile?._count.bookings ?? 0,
        pirepsCount: user.pilotProfile?._count.pireps ?? 0,
        flightsCount: user.pilotProfile?._count.flights ?? 0,
      },
    };
  }

  private serializeAdminUserDetail(
    user: AdminUserDetailRecord,
    counts: AdminUserDetailCounts,
  ) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: getAvatarUrl(user),
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      pilotProfile: user.pilotProfile
        ? {
            id: user.pilotProfile.id,
            pilotNumber: user.pilotProfile.pilotNumber,
            callsign: user.pilotProfile.callsign,
            firstName: user.pilotProfile.firstName,
            lastName: user.pilotProfile.lastName,
            countryCode: user.pilotProfile.countryCode,
            simbriefPilotId: user.pilotProfile.simbriefPilotId,
            status: user.pilotProfile.status,
            experiencePoints: user.pilotProfile.experiencePoints,
            hoursFlownMinutes: user.pilotProfile.hoursFlownMinutes,
            joinedAt: user.pilotProfile.joinedAt,
            hub: user.pilotProfile.hub
              ? {
                  id: user.pilotProfile.hub.id,
                  code: user.pilotProfile.hub.code,
                  name: user.pilotProfile.hub.name,
                }
              : null,
            rank: user.pilotProfile.rank
              ? {
                  id: user.pilotProfile.rank.id,
                  code: user.pilotProfile.rank.code,
                  name: user.pilotProfile.rank.name,
                  sortOrder: user.pilotProfile.rank.sortOrder,
                }
              : null,
          }
        : null,
      stats: {
        hoursFlownMinutes: user.pilotProfile?.hoursFlownMinutes ?? 0,
        bookingsCount: user.pilotProfile?._count.bookings ?? 0,
        activeBookingsCount: counts.activeBookingsCount,
        pirepsCount: user.pilotProfile?._count.pireps ?? 0,
        flightsCount: user.pilotProfile?._count.flights ?? 0,
        completedFlightsCount: counts.completedFlightsCount,
      },
      recentBookings:
        user.pilotProfile?.bookings.map((booking) =>
          this.serializeAdminRecentBooking(booking),
        ) ?? [],
      recentPireps:
        user.pilotProfile?.pireps.map((pirep) => this.serializeAdminRecentPirep(pirep)) ??
        [],
    };
  }

  private serializeAdminRecentBooking(
    booking: NonNullable<AdminUserDetailRecord["pilotProfile"]>["bookings"][number],
  ) {
    return {
      id: booking.id,
      status: booking.status,
      reservedFlightNumber: booking.reservedFlightNumber,
      bookedFor: booking.bookedFor,
      reservedAt: booking.reservedAt,
      aircraft: {
        id: booking.aircraft.id,
        registration: booking.aircraft.registration,
        label: booking.aircraft.label,
        aircraftType: {
          id: booking.aircraft.aircraftType.id,
          icaoCode: booking.aircraft.aircraftType.icaoCode,
          name: booking.aircraft.aircraftType.name,
        },
      },
      departureAirport: {
        id: booking.departureAirport.id,
        icao: booking.departureAirport.icao,
        name: booking.departureAirport.name,
      },
      arrivalAirport: {
        id: booking.arrivalAirport.id,
        icao: booking.arrivalAirport.icao,
        name: booking.arrivalAirport.name,
      },
      flight: booking.flight
        ? {
            id: booking.flight.id,
            status: booking.flight.status,
          }
        : null,
    };
  }

  private serializeAdminRecentPirep(
    pirep: NonNullable<AdminUserDetailRecord["pilotProfile"]>["pireps"][number],
  ) {
    return {
      id: pirep.id,
      status: pirep.status,
      source: pirep.source,
      submittedAt: pirep.submittedAt,
      createdAt: pirep.createdAt,
      blockTimeMinutes: pirep.blockTimeMinutes,
      flightTimeMinutes: pirep.flightTimeMinutes,
      score: pirep.score,
      landingRateFpm: pirep.landingRateFpm,
      flight: pirep.flight
        ? {
            id: pirep.flight.id,
            flightNumber: pirep.flight.flightNumber,
          }
        : null,
      aircraft: {
        id: pirep.aircraft.id,
        registration: pirep.aircraft.registration,
        label: pirep.aircraft.label,
        aircraftType: {
          id: pirep.aircraft.aircraftType.id,
          icaoCode: pirep.aircraft.aircraftType.icaoCode,
          name: pirep.aircraft.aircraftType.name,
        },
      },
      departureAirport: {
        id: pirep.departureAirport.id,
        icao: pirep.departureAirport.icao,
        name: pirep.departureAirport.name,
      },
      arrivalAirport: {
        id: pirep.arrivalAirport.id,
        icao: pirep.arrivalAirport.icao,
        name: pirep.arrivalAirport.name,
      },
    };
  }

  private serializeAdminPirep(pirep: AdminPirepRecord) {
    return {
      id: pirep.id,
      status: pirep.status,
      source: pirep.source,
      submittedAt: pirep.submittedAt,
      reviewedAt: pirep.reviewedAt,
      createdAt: pirep.createdAt,
      blockTimeMinutes: pirep.blockTimeMinutes,
      flightTimeMinutes: pirep.flightTimeMinutes,
      fuelUsedKg: decimalToNumber(pirep.fuelUsedKg),
      score: pirep.score,
      landingRateFpm: pirep.landingRateFpm,
      summary: pirep.summary,
      pilotComment: pirep.pilotComment,
      reviewerComment: pirep.reviewerComment,
      flight: {
        id: pirep.flight.id,
        flightNumber: pirep.flight.flightNumber,
        status: pirep.flight.status,
      },
      pilotProfile: {
        id: pirep.pilotProfile.id,
        pilotNumber: pirep.pilotProfile.pilotNumber,
        firstName: pirep.pilotProfile.firstName,
        lastName: pirep.pilotProfile.lastName,
        user: {
          id: pirep.pilotProfile.user.id,
          username: pirep.pilotProfile.user.username,
          email: pirep.pilotProfile.user.email,
        },
      },
      reviewedBy: pirep.reviewedBy
        ? {
            id: pirep.reviewedBy.id,
            username: pirep.reviewedBy.username,
            email: pirep.reviewedBy.email,
          }
        : null,
      aircraft: {
        id: pirep.aircraft.id,
        registration: pirep.aircraft.registration,
        label: pirep.aircraft.label,
        aircraftType: {
          id: pirep.aircraft.aircraftType.id,
          icaoCode: pirep.aircraft.aircraftType.icaoCode,
          name: pirep.aircraft.aircraftType.name,
        },
        hub: pirep.aircraft.hub
          ? {
              id: pirep.aircraft.hub.id,
              code: pirep.aircraft.hub.code,
              name: pirep.aircraft.hub.name,
            }
          : null,
      },
      departureAirport: {
        id: pirep.departureAirport.id,
        icao: pirep.departureAirport.icao,
        name: pirep.departureAirport.name,
      },
      arrivalAirport: {
        id: pirep.arrivalAirport.id,
        icao: pirep.arrivalAirport.icao,
        name: pirep.arrivalAirport.name,
      },
    };
  }

  private serializeAdminPirepList(pireps: AdminPirepRecord[]) {
    return pireps.flatMap((item) => {
      try {
        return [this.serializeAdminPirep(item)];
      } catch (error) {
        this.logAdminDatasetError(`pirep ${item.id}`, error);
        return [];
      }
    });
  }

  private async assertAndLinkSimbriefAirframe(
    transaction: Prisma.TransactionClient,
    aircraftId: string,
    simbriefAirframeId: string,
    aircraftTypeId: string,
  ) {
    const airframe = await transaction.simbriefAirframe.findUnique({
      where: {
        id: simbriefAirframeId,
      },
      include: simbriefAirframeInclude,
    });

    if (!airframe) {
      throw new NotFoundException("SimBrief airframe not found.");
    }

    if (airframe.linkedAircraftId && airframe.linkedAircraftId !== aircraftId) {
      throw new ConflictException(
        "Cette airframe SimBrief est déjà liée à un autre appareil.",
      );
    }

    if (
      airframe.linkedAircraftTypeId &&
      airframe.linkedAircraftTypeId !== aircraftTypeId
    ) {
      throw new ConflictException(
        "Le type appareil de la flotte ne correspond pas à celui de l'airframe SimBrief.",
      );
    }

    await transaction.simbriefAirframe.update({
      where: {
        id: simbriefAirframeId,
      },
      data: {
        linkedAircraftId: aircraftId,
      },
    });
  }

  private serializeSimbriefAirframe(airframe: AdminSimbriefAirframeRecord) {
    return {
      id: airframe.id,
      simbriefAirframeId: airframe.simbriefAirframeId,
      name: airframe.name,
      aircraftIcao: airframe.aircraftIcao,
      registration: airframe.registration,
      selcal: airframe.selcal,
      equipment: airframe.equipment,
      engineType: airframe.engineType,
      wakeCategory: airframe.wakeCategory,
      rawJson: airframe.rawJson,
      linkedAircraftType: airframe.linkedAircraftType
        ? {
            id: airframe.linkedAircraftType.id,
            icaoCode: airframe.linkedAircraftType.icaoCode,
            name: airframe.linkedAircraftType.name,
            manufacturer: airframe.linkedAircraftType.manufacturer,
          }
        : null,
      linkedAircraft: airframe.linkedAircraft
        ? {
            id: airframe.linkedAircraft.id,
            registration: airframe.linkedAircraft.registration,
            label: airframe.linkedAircraft.label,
            status: airframe.linkedAircraft.status,
            aircraftType: {
              id: airframe.linkedAircraft.aircraftType.id,
              icaoCode: airframe.linkedAircraft.aircraftType.icaoCode,
              name: airframe.linkedAircraft.aircraftType.name,
            },
            hub: airframe.linkedAircraft.hub
              ? {
                  id: airframe.linkedAircraft.hub.id,
                  code: airframe.linkedAircraft.hub.code,
                  name: airframe.linkedAircraft.hub.name,
                }
              : null,
          }
        : null,
      ownerUser: airframe.ownerUser
        ? {
            id: airframe.ownerUser.id,
            username: airframe.ownerUser.username,
            email: airframe.ownerUser.email,
          }
        : null,
      pilotProfile: airframe.pilotProfile
        ? {
            id: airframe.pilotProfile.id,
            pilotNumber: airframe.pilotProfile.pilotNumber,
            firstName: airframe.pilotProfile.firstName,
            lastName: airframe.pilotProfile.lastName,
          }
        : null,
      createdAt: airframe.createdAt,
      updatedAt: airframe.updatedAt,
    };
  }

  private serializeAircraft(aircraft: AdminAircraftRecord) {
    return {
      id: aircraft.id,
      registration: aircraft.registration,
      label: aircraft.label,
      status: aircraft.status,
      notes: aircraft.notes,
      aircraftType: {
        id: aircraft.aircraftType.id,
        icaoCode: aircraft.aircraftType.icaoCode,
        name: aircraft.aircraftType.name,
        manufacturer: aircraft.aircraftType.manufacturer,
        category: aircraft.aircraftType.category,
        cruiseSpeedKts: aircraft.aircraftType.cruiseSpeedKts,
        minRank: aircraft.aircraftType.minRank
          ? {
              id: aircraft.aircraftType.minRank.id,
              code: aircraft.aircraftType.minRank.code,
              name: aircraft.aircraftType.minRank.name,
              sortOrder: aircraft.aircraftType.minRank.sortOrder,
            }
          : null,
      },
      hub: aircraft.hub
        ? {
            id: aircraft.hub.id,
            code: aircraft.hub.code,
            name: aircraft.hub.name,
          }
        : null,
      simbriefAirframe: aircraft.simbriefAirframe
        ? {
            id: aircraft.simbriefAirframe.id,
            simbriefAirframeId: aircraft.simbriefAirframe.simbriefAirframeId,
            name: aircraft.simbriefAirframe.name,
            aircraftIcao: aircraft.simbriefAirframe.aircraftIcao,
            registration: aircraft.simbriefAirframe.registration,
            linkedAircraftType: aircraft.simbriefAirframe.linkedAircraftType
              ? {
                  id: aircraft.simbriefAirframe.linkedAircraftType.id,
                  icaoCode: aircraft.simbriefAirframe.linkedAircraftType.icaoCode,
                  name: aircraft.simbriefAirframe.linkedAircraftType.name,
                }
              : null,
          }
        : null,
    };
  }

  private serializeAircraftList(aircraft: AdminAircraftRecord[]) {
    return aircraft.flatMap((item) => {
      try {
        return [this.serializeAircraft(item)];
      } catch (error) {
        this.logAdminDatasetError(
          `aircraft ${item.registration}`,
          error,
        );
        return [];
      }
    });
  }

  private serializeHubList(hubs: AdminHubRecord[]) {
    return hubs.flatMap((item) => {
      try {
        return [this.serializeHub(item)];
      } catch (error) {
        this.logAdminDatasetError(`hub ${item.code}`, error);
        return [];
      }
    });
  }

  private serializeSimbriefAirframeList(
    airframes: AdminSimbriefAirframeRecord[],
  ) {
    return airframes.flatMap((airframe) => {
      try {
        return [this.serializeSimbriefAirframe(airframe)];
      } catch (error) {
        this.logAdminDatasetError(
          `SimBrief airframe ${airframe.registration ?? airframe.name}`,
          error,
        );
        return [];
      }
    });
  }

  private unwrapReferenceDataset<TValue>(
    label: string,
    result: PromiseSettledResult<TValue[]>,
  ): TValue[] {
    if (result.status === "fulfilled") {
      return result.value;
    }

    this.logAdminDatasetError(label, result.reason);
    return [];
  }

  private logAdminDatasetError(label: string, error: unknown): void {
    const serializedError =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
          }
        : {
            name: typeof error,
            message: String(error),
          };

    console.error("[admin] dataset failed", {
      label,
      error: serializedError,
    });
  }

  private serializeHub(hub: AdminHubRecord) {
    return {
      id: hub.id,
      code: hub.code,
      name: hub.name,
      isActive: hub.isActive,
      airport: {
        id: hub.airport.id,
        icao: hub.airport.icao,
        iata: hub.airport.iata,
        name: hub.airport.name,
        city: hub.airport.city,
        countryCode: hub.airport.countryCode,
        latitude: decimalToNumber(hub.airport.latitude),
        longitude: decimalToNumber(hub.airport.longitude),
      },
    };
  }

  private serializeRoute(route: AdminRouteRecord) {
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

  private normalizePrismaError(error: unknown, entityName: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return new NotFoundException(`${entityName} not found.`);
      }

      if (error.code === "P2002") {
        return new ConflictException(`${entityName} already exists.`);
      }

      if (error.code === "P2003") {
        return new ConflictException(
          `${entityName} cannot be deleted or updated because it is referenced by other records.`,
        );
      }
    }

    return error as Error;
  }
}
