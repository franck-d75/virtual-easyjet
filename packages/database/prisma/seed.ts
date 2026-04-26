import { hash } from "bcryptjs";
import {
  PilotStatus,
  PrismaClient,
  UserPlatformRole,
  UserStatus,
} from "@prisma/client";

import { loadRootEnvironment } from "./load-root-env.js";

Object.assign(process.env, loadRootEnvironment());

const prisma = new PrismaClient();

const DEMO_BOOKING_IDS = [
  "seed-booking-demo-reserved",
  "seed-booking-demo-active",
  "seed-booking-demo-history",
  "seed-booking-demo-return",
  "seed-booking-demo-history-barcelona",
  "seed-booking-demo-history-lisbon",
  "seed-booking-demo-history-amsterdam",
  "seed-booking-demo-history-nice",
] as const;

const DEMO_FLIGHT_IDS = [
  "seed-flight-demo-active",
  "seed-flight-demo-history",
  "seed-flight-demo-history-barcelona",
  "seed-flight-demo-history-lisbon",
  "seed-flight-demo-history-amsterdam",
  "seed-flight-demo-history-nice",
] as const;

const DEMO_PIREP_IDS = [
  "seed-pirep-demo-history",
  "seed-pirep-demo-history-barcelona",
  "seed-pirep-demo-history-lisbon",
  "seed-pirep-demo-history-amsterdam",
  "seed-pirep-demo-history-nice",
] as const;

const DEMO_SCHEDULE_IDS = [
  "seed-afr100-daily",
  "seed-vej102-daily",
  "seed-vej215-daily",
  "seed-vej216-daily",
  "seed-vej331-daily",
  "seed-vej332-daily",
  "seed-vej441-weekday",
  "seed-vej442-weekday",
  "seed-vej551-daily",
  "seed-vej552-daily",
  "seed-vej661-weekend",
] as const;

const DEMO_ROUTE_CODES = [
  "VEJ101",
  "VEJ102",
  "VEJ215",
  "VEJ216",
  "VEJ331",
  "VEJ332",
  "VEJ441",
  "VEJ442",
  "VEJ551",
  "VEJ552",
  "VEJ661",
] as const;

const DEMO_AIRCRAFT_REGISTRATIONS = [
  "F-HVEJ",
  "G-VEJA",
  "G-VEJB",
  "EC-VEJC",
  "I-VEJD",
  "CS-VEJE",
] as const;

const DEMO_HUB_CODES = ["PAR", "LGW", "BCN", "MXP", "LIS"] as const;
const DEMO_NEWS_SLUG = "virtual-easyjet-network-ready";
const DEMO_USER_EMAILS = ["admin@va.local", "pilot@va.local"] as const;

type AccountSeedConfig = {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  countryCode: string | null;
  platformRole: UserPlatformRole;
  roleCodes: string[];
  createPilotProfile: boolean;
  pilotNumber?: string | null;
  callsign?: string | null;
  simbriefPilotId?: string | null;
  pilotStatus?: PilotStatus;
};

function normalizeOptionalString(value: string | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function readAdminConfig(): AccountSeedConfig {
  return {
    email:
      normalizeOptionalString(process.env.SEED_ADMIN_EMAIL)?.toLowerCase() ??
      "admin@virtual-easyjet.local",
    username:
      normalizeOptionalString(process.env.SEED_ADMIN_USERNAME) ??
      "virtualeasyjet-admin",
    password:
      normalizeOptionalString(process.env.SEED_ADMIN_PASSWORD) ??
      "ChangeMe-Admin123!",
    firstName:
      normalizeOptionalString(process.env.SEED_ADMIN_FIRST_NAME) ?? "Virtual",
    lastName:
      normalizeOptionalString(process.env.SEED_ADMIN_LAST_NAME) ?? "Admin",
    countryCode:
      normalizeOptionalString(process.env.SEED_ADMIN_COUNTRY_CODE) ?? "FR",
    platformRole: UserPlatformRole.ADMIN,
    roleCodes: ["admin"],
    createPilotProfile: false,
  };
}

function readOptionalPilotConfig(): AccountSeedConfig | null {
  const email = normalizeOptionalString(process.env.SEED_PILOT_EMAIL)?.toLowerCase();
  const username = normalizeOptionalString(process.env.SEED_PILOT_USERNAME);
  const password = normalizeOptionalString(process.env.SEED_PILOT_PASSWORD);

  if (!email || !username || !password) {
    return null;
  }

  return {
    email,
    username,
    password,
    firstName:
      normalizeOptionalString(process.env.SEED_PILOT_FIRST_NAME) ?? "Pilot",
    lastName:
      normalizeOptionalString(process.env.SEED_PILOT_LAST_NAME) ?? "User",
    countryCode:
      normalizeOptionalString(process.env.SEED_PILOT_COUNTRY_CODE) ?? "FR",
    platformRole: UserPlatformRole.USER,
    roleCodes: ["pilot"],
    createPilotProfile: true,
    pilotNumber:
      normalizeOptionalString(process.env.SEED_PILOT_NUMBER) ?? "VA00001",
    callsign: normalizeOptionalString(process.env.SEED_PILOT_CALLSIGN),
    simbriefPilotId: normalizeOptionalString(process.env.SEED_PILOT_SIMBRIEF_ID),
    pilotStatus: PilotStatus.ACTIVE,
  };
}

async function cleanupLegacyDemoArtifacts(
  preservedEmails: readonly string[],
): Promise<void> {
  const demoUsersToDelete = await prisma.user.findMany({
    where: {
      email: {
        in: [...DEMO_USER_EMAILS].filter(
          (email) => !preservedEmails.includes(email),
        ),
      },
    },
    select: {
      id: true,
      pilotProfile: {
        select: {
          id: true,
        },
      },
    },
  });

  const demoUserIdsToDelete = demoUsersToDelete.map((user) => user.id);
  const demoPilotProfileIdsToDelete = demoUsersToDelete
    .map((user) => user.pilotProfile?.id ?? null)
    .filter((pilotProfileId): pilotProfileId is string => pilotProfileId !== null);

  const demoPilotBookings = await prisma.booking.findMany({
    where: {
      pilotProfileId: {
        in: demoPilotProfileIdsToDelete,
      },
    },
    select: {
      id: true,
    },
  });

  const demoPilotFlights = await prisma.flight.findMany({
    where: {
      pilotProfileId: {
        in: demoPilotProfileIdsToDelete,
      },
    },
    select: {
      id: true,
    },
  });

  const demoPilotPireps = await prisma.pirep.findMany({
    where: {
      pilotProfileId: {
        in: demoPilotProfileIdsToDelete,
      },
    },
    select: {
      id: true,
    },
  });

  const bookingIdsToDelete = [
    ...new Set([
      ...DEMO_BOOKING_IDS,
      ...demoPilotBookings.map((booking) => booking.id),
    ]),
  ];

  const flightIdsToDelete = [
    ...new Set([
      ...DEMO_FLIGHT_IDS,
      ...demoPilotFlights.map((flight) => flight.id),
    ]),
  ];

  const pirepIdsToDelete = [
    ...new Set([
      ...DEMO_PIREP_IDS,
      ...demoPilotPireps.map((pirep) => pirep.id),
    ]),
  ];

  const demoSessions = await prisma.acarsSession.findMany({
    where: {
      flightId: {
        in: flightIdsToDelete,
      },
    },
    select: {
      id: true,
    },
  });

  const demoSessionIds = demoSessions.map((session) => session.id);

  await prisma.violation.deleteMany({
    where: {
      OR: [
        {
          flightId: {
            in: flightIdsToDelete,
          },
        },
        {
          pirepId: {
            in: pirepIdsToDelete,
          },
        },
        ...(demoSessionIds.length > 0
          ? [
              {
                sessionId: {
                  in: demoSessionIds,
                },
              },
            ]
          : []),
      ],
    },
  });

  if (demoSessionIds.length > 0) {
    await prisma.telemetryPoint.deleteMany({
      where: {
        sessionId: {
          in: demoSessionIds,
        },
      },
    });
  }

  await prisma.flightEvent.deleteMany({
    where: {
      OR: [
        {
          flightId: {
            in: flightIdsToDelete,
          },
        },
        ...(demoSessionIds.length > 0
          ? [
              {
                sessionId: {
                  in: demoSessionIds,
                },
              },
            ]
          : []),
      ],
    },
  });

  await prisma.pirep.deleteMany({
    where: {
      OR: [
        {
          id: {
            in: pirepIdsToDelete,
          },
        },
        {
          flightId: {
            in: flightIdsToDelete,
          },
        },
      ],
    },
  });

  await prisma.acarsSession.deleteMany({
    where: {
      flightId: {
        in: flightIdsToDelete,
      },
    },
  });

  await prisma.flight.deleteMany({
    where: {
      OR: [
        {
          id: {
            in: flightIdsToDelete,
          },
        },
        {
          bookingId: {
            in: bookingIdsToDelete,
          },
        },
      ],
    },
  });

  await prisma.booking.deleteMany({
    where: {
      id: {
        in: bookingIdsToDelete,
      },
    },
  });

  await prisma.schedule.deleteMany({
    where: {
      id: {
        in: [...DEMO_SCHEDULE_IDS],
      },
    },
  });

  await prisma.route.deleteMany({
    where: {
      code: {
        in: [...DEMO_ROUTE_CODES],
      },
      schedules: {
        none: {},
      },
      bookings: {
        none: {},
      },
      flights: {
        none: {},
      },
    },
  });

  await prisma.aircraft.deleteMany({
    where: {
      registration: {
        in: [...DEMO_AIRCRAFT_REGISTRATIONS],
      },
      schedules: {
        none: {},
      },
      bookings: {
        none: {},
      },
      flights: {
        none: {},
      },
      pireps: {
        none: {},
      },
    },
  });

  await prisma.hub.deleteMany({
    where: {
      code: {
        in: [...DEMO_HUB_CODES],
      },
      pilots: {
        none: {},
      },
      aircraft: {
        none: {},
      },
      routesFrom: {
        none: {},
      },
      routesTo: {
        none: {},
      },
    },
  });

  await prisma.newsPost.deleteMany({
    where: {
      slug: DEMO_NEWS_SLUG,
    },
  });

  if (demoUserIdsToDelete.length > 0) {
    await prisma.setting.updateMany({
      where: {
        updatedById: {
          in: demoUserIdsToDelete,
        },
      },
      data: {
        updatedById: null,
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: demoUserIdsToDelete,
        },
      },
    });
  }
}

async function seedRoles(): Promise<void> {
  const roles = [
    {
      code: "admin",
      name: "Administrator",
      description: "Full platform administration access.",
    },
    {
      code: "staff",
      name: "Staff",
      description: "Operational and moderation access.",
    },
    {
      code: "pilot",
      name: "Pilot",
      description: "Standard pilot access to the VA platform.",
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: role,
      create: role,
    });
  }
}

async function seedRanks(): Promise<void> {
  const ranks = [
    {
      code: "CADET",
      name: "Cadet",
      sortOrder: 10,
      minFlights: 0,
      minHoursMinutes: 0,
      minScore: 0,
      description: "Initial rank assigned to a new pilot profile.",
    },
    {
      code: "FO",
      name: "First Officer",
      sortOrder: 20,
      minFlights: 3,
      minHoursMinutes: 600,
      minScore: 70,
      description: "Operational pilot rank for the short-haul network.",
    },
    {
      code: "CPT",
      name: "Captain",
      sortOrder: 30,
      minFlights: 6,
      minHoursMinutes: 3000,
      minScore: 80,
      description: "Confirmed captain rank on the main network.",
    },
    {
      code: "SCC",
      name: "Senior Captain",
      sortOrder: 40,
      minFlights: 12,
      minHoursMinutes: 6000,
      minScore: 88,
      description: "Senior rank reserved for the most consistent pilots.",
    },
  ];

  for (const rank of ranks) {
    await prisma.rank.upsert({
      where: { code: rank.code },
      update: rank,
      create: rank,
    });
  }
}

async function seedUserAccount(config: AccountSeedConfig): Promise<void> {
  const passwordHash = await hash(config.password, 12);

  const user = await prisma.user.upsert({
    where: {
      email: config.email,
    },
    update: {
      username: config.username,
      passwordHash,
      role: config.platformRole,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: config.email,
      username: config.username,
      passwordHash,
      role: config.platformRole,
      status: UserStatus.ACTIVE,
    },
  });

  const roles = await prisma.role.findMany({
    where: {
      code: {
        in: config.roleCodes,
      },
    },
    select: {
      id: true,
      code: true,
    },
  });

  const roleIds = new Set(roles.map((role) => role.id));
  const existingAssignments = await prisma.userRole.findMany({
    where: {
      userId: user.id,
    },
    select: {
      roleId: true,
    },
  });

  const existingRoleIds = new Set(
    existingAssignments.map((assignment) => assignment.roleId),
  );

  for (const role of roles) {
    if (!existingRoleIds.has(role.id)) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      });
    }
  }

  await prisma.userRole.deleteMany({
    where: {
      userId: user.id,
      roleId: {
        notIn: [...roleIds],
      },
    },
  });

  if (!config.createPilotProfile) {
    await prisma.pilotProfile.deleteMany({
      where: {
        userId: user.id,
      },
    });
    return;
  }

  const cadetRank = await prisma.rank.findUniqueOrThrow({
    where: {
      code: "CADET",
    },
    select: {
      id: true,
    },
  });

  await prisma.pilotProfile.upsert({
    where: {
      userId: user.id,
    },
    update: {
      pilotNumber: config.pilotNumber ?? "VA00001",
      callsign: config.callsign ?? null,
      firstName: config.firstName,
      lastName: config.lastName,
      countryCode: config.countryCode ?? null,
      simbriefPilotId: config.simbriefPilotId ?? null,
      rankId: cadetRank.id,
      hubId: null,
      status: config.pilotStatus ?? PilotStatus.ACTIVE,
      experiencePoints: 0,
      hoursFlownMinutes: 0,
    },
    create: {
      userId: user.id,
      pilotNumber: config.pilotNumber ?? "VA00001",
      callsign: config.callsign ?? null,
      firstName: config.firstName,
      lastName: config.lastName,
      countryCode: config.countryCode ?? null,
      simbriefPilotId: config.simbriefPilotId ?? null,
      rankId: cadetRank.id,
      status: config.pilotStatus ?? PilotStatus.ACTIVE,
      experiencePoints: 0,
      hoursFlownMinutes: 0,
    },
  });
}

async function seedSettings(adminEmail: string): Promise<void> {
  const admin = await prisma.user.findUniqueOrThrow({
    where: {
      email: adminEmail,
    },
    select: {
      id: true,
    },
  });

  const settings = [
    {
      key: "acars.thresholds",
      value: {
        hardLandingFpm: -500,
        overspeedGraceSeconds: 15,
        resumeTimeoutMinutes: 20,
      },
      description: "ACARS detection thresholds used by the MVP rules engine.",
      isPublic: false,
    },
    {
      key: "public.branding",
      value: {
        airlineName: "Virtual Easyjet",
        airlineCode: "VEJ",
      },
      description: "Public branding displayed by the website.",
      isPublic: true,
    },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: {
        key: setting.key,
      },
      update: {
        value: setting.value,
        description: setting.description,
        isPublic: setting.isPublic,
        updatedById: admin.id,
      },
      create: {
        key: setting.key,
        value: setting.value,
        description: setting.description,
        isPublic: setting.isPublic,
        updatedById: admin.id,
      },
    });
  }
}

async function main(): Promise<void> {
  const adminConfig = readAdminConfig();
  const optionalPilotConfig = readOptionalPilotConfig();
  const preservedEmails = [adminConfig.email];

  if (optionalPilotConfig) {
    preservedEmails.push(optionalPilotConfig.email);
  }

  await cleanupLegacyDemoArtifacts(preservedEmails);
  await seedRoles();
  await seedRanks();
  await seedUserAccount(adminConfig);

  if (optionalPilotConfig) {
    await seedUserAccount(optionalPilotConfig);
  }

  await cleanupLegacyDemoArtifacts(preservedEmails);
  await seedSettings(adminConfig.email);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
