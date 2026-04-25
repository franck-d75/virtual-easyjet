import {
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
  Prisma,
  type AircraftStatus,
  UserPlatformRole,
  UserStatus,
} from "@va/database";
import type { AuthenticatedUser } from "@va/shared";

import { AvatarStorageService } from "../../common/storage/avatar-storage.service.js";
import type { UploadedAvatarFile } from "../../common/storage/avatar-upload.constants.js";
import { decimalToNumber } from "../../common/utils/decimal.utils.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type {
  CreateAdminAircraftDto,
  CreateAdminHubDto,
  CreateAdminRouteDto,
  UpdateAdminUserDto,
  UpdateAdminAircraftDto,
  UpdateAdminHubDto,
  UpdateAdminRouteDto,
} from "./dto/admin.dto.js";

const adminAircraftInclude = {
  aircraftType: {
    include: {
      minRank: true,
    },
  },
  hub: true,
} satisfies Prisma.AircraftInclude;

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

type AdminAircraftRecord = Prisma.AircraftGetPayload<{
  include: typeof adminAircraftInclude;
}>;

type AdminHubRecord = Prisma.HubGetPayload<{
  include: typeof adminHubInclude;
}>;

type AdminRouteRecord = Prisma.RouteGetPayload<{
  include: typeof adminRouteInclude;
}>;

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

  public async getReferenceData() {
    const [airports, hubs, aircraftTypes] = await Promise.all([
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
    ]);

    return {
      airports,
      hubs,
      aircraftTypes,
    };
  }

  public async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: adminUserListInclude,
    });

    return users.map((user) => this.serializeAdminUserListItem(user));
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

    return aircraft.map((item) => this.serializeAircraft(item));
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

  public async createAircraft(
    payload: CreateAdminAircraftDto,
    currentUser: AuthenticatedUser,
  ) {
    try {
      const aircraft = await this.prisma.aircraft.create({
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
      const aircraft = await this.prisma.aircraft.update({
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
    const hubs = await this.prisma.hub.findMany({
      orderBy: { code: "asc" },
      include: adminHubInclude,
    });

    return hubs.map((item) => this.serializeHub(item));
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
    };
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
