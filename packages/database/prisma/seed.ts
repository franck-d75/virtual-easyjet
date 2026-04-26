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

const PRODUCTION_AIRCRAFT_TYPES = [
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

const PRODUCTION_AIRPORTS = [
  {
    icao: "LSGG",
    iata: "GVA",
    name: "Geneva Airport",
    city: "Geneva",
    countryCode: "CH",
    latitude: "46.2380640",
    longitude: "6.1089500",
    elevationFt: 1411,
  },
  {
    icao: "LFSB",
    iata: "BSL",
    name: "EuroAirport Basel Mulhouse Freiburg",
    city: "Basel",
    countryCode: "CH",
    latitude: "47.5989410",
    longitude: "7.5291670",
    elevationFt: 885,
  },
  {
    icao: "LSZH",
    iata: "ZRH",
    name: "Zurich Airport",
    city: "Zurich",
    countryCode: "CH",
    latitude: "47.4580570",
    longitude: "8.5480560",
    elevationFt: 1416,
  },
  {
    icao: "EGKK",
    iata: "LGW",
    name: "London Gatwick Airport",
    city: "London",
    countryCode: "GB",
    latitude: "51.1480560",
    longitude: "-0.1902780",
    elevationFt: 203,
  },
  {
    icao: "EHAM",
    iata: "AMS",
    name: "Amsterdam Airport Schiphol",
    city: "Amsterdam",
    countryCode: "NL",
    latitude: "52.3086010",
    longitude: "4.7638890",
    elevationFt: -11,
  },
  {
    icao: "LFPG",
    iata: "CDG",
    name: "Paris Charles de Gaulle Airport",
    city: "Paris",
    countryCode: "FR",
    latitude: "49.0097220",
    longitude: "2.5477780",
    elevationFt: 392,
  },
  {
    icao: "LFMN",
    iata: "NCE",
    name: "Nice Cote d'Azur Airport",
    city: "Nice",
    countryCode: "FR",
    latitude: "43.6652780",
    longitude: "7.2150000",
    elevationFt: 12,
  },
  {
    icao: "EDDB",
    iata: "BER",
    name: "Berlin Brandenburg Airport",
    city: "Berlin",
    countryCode: "DE",
    latitude: "52.3666670",
    longitude: "13.5033330",
    elevationFt: 157,
  },
  {
    icao: "LIRF",
    iata: "FCO",
    name: "Leonardo da Vinci Rome Fiumicino Airport",
    city: "Rome",
    countryCode: "IT",
    latitude: "41.8002780",
    longitude: "12.2388890",
    elevationFt: 15,
  },
  {
    icao: "LEBL",
    iata: "BCN",
    name: "Josep Tarradellas Barcelona El Prat Airport",
    city: "Barcelona",
    countryCode: "ES",
    latitude: "41.2971000",
    longitude: "2.0784600",
    elevationFt: 12,
  },
] as const;

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

async function seedAircraftTypes(): Promise<void> {
  for (const aircraftType of PRODUCTION_AIRCRAFT_TYPES) {
    await prisma.aircraftType.upsert({
      where: {
        icaoCode: aircraftType.icaoCode,
      },
      update: aircraftType,
      create: aircraftType,
    });
  }
}

async function seedAirports(): Promise<void> {
  for (const airport of PRODUCTION_AIRPORTS) {
    await prisma.airport.upsert({
      where: {
        icao: airport.icao,
      },
      update: airport,
      create: airport,
    });
  }
}

async function ensureRoleAssignments(
  userId: string,
  roleCodes: string[],
): Promise<void> {
  const roles = await prisma.role.findMany({
    where: {
      code: {
        in: roleCodes,
      },
    },
    select: {
      id: true,
    },
  });

  for (const role of roles) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId,
        roleId: role.id,
      },
    });
  }
}

async function seedUserAccount(config: AccountSeedConfig): Promise<string> {
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
      avatarUrl: null,
    },
  });

  await ensureRoleAssignments(user.id, config.roleCodes);

  if (!config.createPilotProfile) {
    return user.id;
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

  return user.id;
}

async function findExistingAdmins() {
  return prisma.user.findMany({
    where: {
      OR: [
        {
          role: UserPlatformRole.ADMIN,
        },
        {
          roles: {
            some: {
              role: {
                code: "admin",
              },
            },
          },
        },
      ],
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      email: true,
    },
  });
}

async function ensureBootstrapAdmin(adminConfig: AccountSeedConfig): Promise<string> {
  const existingAdmins = await findExistingAdmins();

  if (existingAdmins.length > 0) {
    for (const admin of existingAdmins) {
      await prisma.user.update({
        where: {
          id: admin.id,
        },
        data: {
          role: UserPlatformRole.ADMIN,
        },
      });
      await ensureRoleAssignments(admin.id, ["admin"]);
    }

    return existingAdmins[0]!.id;
  }

  return seedUserAccount(adminConfig);
}

async function seedSettings(adminUserId: string): Promise<void> {
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
        updatedById: adminUserId,
      },
      create: {
        key: setting.key,
        value: setting.value,
        description: setting.description,
        isPublic: setting.isPublic,
        updatedById: adminUserId,
      },
    });
  }
}

async function main(): Promise<void> {
  const adminConfig = readAdminConfig();
  const optionalPilotConfig = readOptionalPilotConfig();

  await seedRoles();
  await seedRanks();
  await seedAirports();
  await seedAircraftTypes();

  const adminUserId = await ensureBootstrapAdmin(adminConfig);

  if (optionalPilotConfig) {
    await seedUserAccount(optionalPilotConfig);
  }

  await seedSettings(adminUserId);
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
