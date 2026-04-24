import { hash } from "bcryptjs";
import {
  AircraftStatus,
  BookingStatus,
  FlightStatus,
  NewsPostStatus,
  PirepSource,
  PirepStatus,
  PilotStatus,
  PrismaClient,
  UserStatus,
} from "@prisma/client";
import { loadRootEnvironment } from "./load-root-env.js";

Object.assign(process.env, loadRootEnvironment());
const prisma = new PrismaClient();

const DEMO_RESERVED_BOOKING_ID = "seed-booking-demo-reserved";
const DEMO_ACTIVE_BOOKING_ID = "seed-booking-demo-active";
const DEMO_HISTORY_BOOKING_ID = "seed-booking-demo-history";
const DEMO_ACTIVE_FLIGHT_ID = "seed-flight-demo-active";
const DEMO_HISTORY_FLIGHT_ID = "seed-flight-demo-history";
const DEMO_HISTORY_PIREP_ID = "seed-pirep-demo-history";

function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

async function resetSeededBookingExecution(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      flight: true,
    },
  });

  const flightId = booking?.flight?.id;

  if (!flightId) {
    return;
  }

  const sessions = await prisma.acarsSession.findMany({
    where: { flightId },
    select: { id: true },
  });
  const sessionIds = sessions.map((session) => session.id);

  const pireps = await prisma.pirep.findMany({
    where: { flightId },
    select: { id: true },
  });
  const pirepIds = pireps.map((pirep) => pirep.id);

  await prisma.violation.deleteMany({
    where: {
      OR: [
        { flightId },
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
  });

  if (sessionIds.length > 0) {
    await prisma.flightEvent.deleteMany({
      where: {
        OR: [
          { flightId },
          {
            sessionId: {
              in: sessionIds,
            },
          },
        ],
      },
    });

    await prisma.telemetryPoint.deleteMany({
      where: {
        sessionId: {
          in: sessionIds,
        },
      },
    });
  } else {
    await prisma.flightEvent.deleteMany({
      where: { flightId },
    });
  }

  await prisma.pirep.deleteMany({
    where: { flightId },
  });

  await prisma.acarsSession.deleteMany({
    where: { flightId },
  });

  await prisma.flight.delete({
    where: { id: flightId },
  });
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
      description: "Entry-level pilot rank.",
    },
    {
      code: "FO",
      name: "First Officer",
      sortOrder: 20,
      minFlights: 10,
      minHoursMinutes: 600,
      minScore: 70,
      description: "First officer rank for active pilots.",
    },
    {
      code: "CPT",
      name: "Captain",
      sortOrder: 30,
      minFlights: 35,
      minHoursMinutes: 2400,
      minScore: 80,
      description: "Captain rank for experienced pilots.",
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

async function seedAirportsAndHub(): Promise<void> {
  const airports = [
    {
      icao: "LFPG",
      iata: "CDG",
      name: "Paris Charles de Gaulle",
      city: "Paris",
      countryCode: "FR",
      latitude: 49.0097,
      longitude: 2.5479,
      elevationFt: 392,
    },
    {
      icao: "EGLL",
      iata: "LHR",
      name: "London Heathrow",
      city: "London",
      countryCode: "GB",
      latitude: 51.47,
      longitude: -0.4543,
      elevationFt: 83,
    },
    {
      icao: "LFPO",
      iata: "ORY",
      name: "Paris Orly",
      city: "Paris",
      countryCode: "FR",
      latitude: 48.7262,
      longitude: 2.3652,
      elevationFt: 291,
    },
  ];

  for (const airport of airports) {
    await prisma.airport.upsert({
      where: { icao: airport.icao },
      update: airport,
      create: airport,
    });
  }

  const lfpg = await prisma.airport.findUniqueOrThrow({
    where: { icao: "LFPG" },
  });

  await prisma.hub.upsert({
    where: { code: "PAR" },
    update: {
      name: "Paris Hub",
      airportId: lfpg.id,
      isActive: true,
    },
    create: {
      code: "PAR",
      name: "Paris Hub",
      airportId: lfpg.id,
      isActive: true,
    },
  });
}

async function seedFleet(): Promise<void> {
  const captainRank = await prisma.rank.findUniqueOrThrow({
    where: { code: "CPT" },
  });
  const parisHub = await prisma.hub.findUniqueOrThrow({
    where: { code: "PAR" },
  });

  await prisma.aircraftType.upsert({
    where: { icaoCode: "A20N" },
    update: {
      name: "Airbus A320neo",
      manufacturer: "Airbus",
      category: "Airliner",
      minRankId: captainRank.id,
      cruiseSpeedKts: 450,
      isActive: true,
    },
    create: {
      icaoCode: "A20N",
      name: "Airbus A320neo",
      manufacturer: "Airbus",
      category: "Airliner",
      minRankId: captainRank.id,
      cruiseSpeedKts: 450,
      isActive: true,
    },
  });

  await prisma.aircraftType.upsert({
    where: { icaoCode: "B738" },
    update: {
      name: "Boeing 737-800",
      manufacturer: "Boeing",
      category: "Airliner",
      cruiseSpeedKts: 445,
      isActive: true,
    },
    create: {
      icaoCode: "B738",
      name: "Boeing 737-800",
      manufacturer: "Boeing",
      category: "Airliner",
      cruiseSpeedKts: 445,
      isActive: true,
    },
  });

  const a20n = await prisma.aircraftType.findUniqueOrThrow({
    where: { icaoCode: "A20N" },
  });

  await prisma.aircraft.upsert({
    where: { registration: "F-HVAA" },
    update: {
      label: "A320neo Paris 01",
      aircraftTypeId: a20n.id,
      hubId: parisHub.id,
      status: AircraftStatus.ACTIVE,
    },
    create: {
      registration: "F-HVAA",
      label: "A320neo Paris 01",
      aircraftTypeId: a20n.id,
      hubId: parisHub.id,
      status: AircraftStatus.ACTIVE,
    },
  });
}

async function seedRoutesAndSchedules(): Promise<void> {
  const lfpg = await prisma.airport.findUniqueOrThrow({
    where: { icao: "LFPG" },
  });
  const egll = await prisma.airport.findUniqueOrThrow({
    where: { icao: "EGLL" },
  });
  const parisHub = await prisma.hub.findUniqueOrThrow({
    where: { code: "PAR" },
  });
  const a20n = await prisma.aircraftType.findUniqueOrThrow({
    where: { icaoCode: "A20N" },
  });
  const airframe = await prisma.aircraft.findUniqueOrThrow({
    where: { registration: "F-HVAA" },
  });

  await prisma.route.upsert({
    where: { code: "AFR100" },
    update: {
      flightNumber: "AFR100",
      departureAirportId: lfpg.id,
      arrivalAirportId: egll.id,
      departureHubId: parisHub.id,
      aircraftTypeId: a20n.id,
      distanceNm: 188,
      blockTimeMinutes: 80,
      isActive: true,
    },
    create: {
      code: "AFR100",
      flightNumber: "AFR100",
      departureAirportId: lfpg.id,
      arrivalAirportId: egll.id,
      departureHubId: parisHub.id,
      aircraftTypeId: a20n.id,
      distanceNm: 188,
      blockTimeMinutes: 80,
      isActive: true,
    },
  });

  const route = await prisma.route.findUniqueOrThrow({
    where: { code: "AFR100" },
  });

  await prisma.schedule.upsert({
    where: { id: "seed-afr100-daily" },
    update: {
      routeId: route.id,
      aircraftId: airframe.id,
      departureAirportId: lfpg.id,
      arrivalAirportId: egll.id,
      callsign: "AFR100",
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      departureTimeUtc: "08:00",
      arrivalTimeUtc: "09:20",
      isActive: true,
    },
    create: {
      id: "seed-afr100-daily",
      routeId: route.id,
      aircraftId: airframe.id,
      departureAirportId: lfpg.id,
      arrivalAirportId: egll.id,
      callsign: "AFR100",
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      departureTimeUtc: "08:00",
      arrivalTimeUtc: "09:20",
      isActive: true,
    },
  });
}

async function seedAdminAndDemoPilot(): Promise<void> {
  const [adminRole, staffRole, pilotRole, cadetRank, captainRank, parisHub] =
    await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { code: "admin" } }),
      prisma.role.findUniqueOrThrow({ where: { code: "staff" } }),
      prisma.role.findUniqueOrThrow({ where: { code: "pilot" } }),
      prisma.rank.findUniqueOrThrow({ where: { code: "CADET" } }),
      prisma.rank.findUniqueOrThrow({ where: { code: "CPT" } }),
      prisma.hub.findUniqueOrThrow({ where: { code: "PAR" } }),
    ]);

  const adminPasswordHash = await hash("ChangeMe123!", 12);
  const pilotPasswordHash = await hash("Pilot123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@va.local" },
    update: {
      username: "admin",
      passwordHash: adminPasswordHash,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: "admin@va.local",
      username: "admin",
      passwordHash: adminPasswordHash,
      status: UserStatus.ACTIVE,
    },
  });

  const demoPilot = await prisma.user.upsert({
    where: { email: "pilot@va.local" },
    update: {
      username: "pilotdemo",
      passwordHash: pilotPasswordHash,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: "pilot@va.local",
      username: "pilotdemo",
      passwordHash: pilotPasswordHash,
      status: UserStatus.ACTIVE,
    },
  });

  const roleAssignments = [
    { userId: admin.id, roleId: adminRole.id },
    { userId: admin.id, roleId: staffRole.id },
    { userId: admin.id, roleId: pilotRole.id },
    { userId: demoPilot.id, roleId: pilotRole.id },
  ];

  for (const assignment of roleAssignments) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: assignment.userId,
          roleId: assignment.roleId,
        },
      },
      update: {},
      create: assignment,
    });
  }

  await prisma.pilotProfile.upsert({
    where: { userId: admin.id },
    update: {
      pilotNumber: "VAADMIN",
      firstName: "Virtual",
      lastName: "Admin",
      hubId: parisHub.id,
      rankId: cadetRank.id,
      status: PilotStatus.ACTIVE,
    },
    create: {
      userId: admin.id,
      pilotNumber: "VAADMIN",
      firstName: "Virtual",
      lastName: "Admin",
      hubId: parisHub.id,
      rankId: cadetRank.id,
      status: PilotStatus.ACTIVE,
    },
  });

  await prisma.pilotProfile.upsert({
    where: { userId: demoPilot.id },
    update: {
      pilotNumber: "VA00001",
      firstName: "Demo",
      lastName: "Pilot",
      hubId: parisHub.id,
      rankId: captainRank.id,
      status: PilotStatus.ACTIVE,
      experiencePoints: 240,
      hoursFlownMinutes: 95,
    },
    create: {
      userId: demoPilot.id,
      pilotNumber: "VA00001",
      firstName: "Demo",
      lastName: "Pilot",
      hubId: parisHub.id,
      rankId: captainRank.id,
      status: PilotStatus.ACTIVE,
      experiencePoints: 240,
      hoursFlownMinutes: 95,
    },
  });
}

async function seedDemoOperations(): Promise<void> {
  const [demoPilotProfile, schedule] = await Promise.all([
    prisma.pilotProfile.findUniqueOrThrow({
      where: { pilotNumber: "VA00001" },
    }),
    prisma.schedule.findUniqueOrThrow({
      where: { id: "seed-afr100-daily" },
    }),
  ]);

  if (!schedule.aircraftId) {
    throw new Error("The seeded AFR100 schedule must have an assigned aircraft.");
  }

  await resetSeededBookingExecution(DEMO_RESERVED_BOOKING_ID);
  await resetSeededBookingExecution(DEMO_ACTIVE_BOOKING_ID);
  await resetSeededBookingExecution(DEMO_HISTORY_BOOKING_ID);

  const now = new Date();
  const reservedBookedFor = addMinutes(now, 120);
  const activeBookedFor = addMinutes(now, -20);
  const historicalBookedFor = addMinutes(now, -1_440);
  const historicalOffBlockAt = addMinutes(historicalBookedFor, 5);
  const historicalTakeoffAt = addMinutes(historicalBookedFor, 18);
  const historicalLandingAt = addMinutes(historicalBookedFor, 84);
  const historicalOnBlockAt = addMinutes(historicalBookedFor, 95);

  await prisma.booking.upsert({
    where: { id: DEMO_RESERVED_BOOKING_ID },
    update: {
      pilotProfileId: demoPilotProfile.id,
      scheduleId: schedule.id,
      routeId: schedule.routeId,
      aircraftId: schedule.aircraftId,
      departureAirportId: schedule.departureAirportId,
      arrivalAirportId: schedule.arrivalAirportId,
      reservedFlightNumber: schedule.callsign,
      bookedFor: reservedBookedFor,
      status: BookingStatus.RESERVED,
      reservedAt: now,
      expiresAt: addMinutes(now, 360),
      cancelledAt: null,
      notes:
        "Seeded reserved booking for the API demo flow. Use this one to create a new canonical flight.",
    },
    create: {
      id: DEMO_RESERVED_BOOKING_ID,
      pilotProfileId: demoPilotProfile.id,
      scheduleId: schedule.id,
      routeId: schedule.routeId,
      aircraftId: schedule.aircraftId,
      departureAirportId: schedule.departureAirportId,
      arrivalAirportId: schedule.arrivalAirportId,
      reservedFlightNumber: schedule.callsign,
      bookedFor: reservedBookedFor,
      status: BookingStatus.RESERVED,
      reservedAt: now,
      expiresAt: addMinutes(now, 360),
      notes:
        "Seeded reserved booking for the API demo flow. Use this one to create a new canonical flight.",
    },
  });

  await prisma.booking.upsert({
    where: { id: DEMO_ACTIVE_BOOKING_ID },
    update: {
      pilotProfileId: demoPilotProfile.id,
      scheduleId: schedule.id,
      routeId: schedule.routeId,
      aircraftId: schedule.aircraftId,
      departureAirportId: schedule.departureAirportId,
      arrivalAirportId: schedule.arrivalAirportId,
      reservedFlightNumber: schedule.callsign,
      bookedFor: activeBookedFor,
      status: BookingStatus.IN_PROGRESS,
      reservedAt: addMinutes(now, -30),
      expiresAt: null,
      cancelledAt: null,
      notes:
        "Seeded in-progress booking paired with the canonical desktop demo flight.",
    },
    create: {
      id: DEMO_ACTIVE_BOOKING_ID,
      pilotProfileId: demoPilotProfile.id,
      scheduleId: schedule.id,
      routeId: schedule.routeId,
      aircraftId: schedule.aircraftId,
      departureAirportId: schedule.departureAirportId,
      arrivalAirportId: schedule.arrivalAirportId,
      reservedFlightNumber: schedule.callsign,
      bookedFor: activeBookedFor,
      status: BookingStatus.IN_PROGRESS,
      reservedAt: addMinutes(now, -30),
      notes:
        "Seeded in-progress booking paired with the canonical desktop demo flight.",
    },
  });

  await prisma.flight.upsert({
    where: { id: DEMO_ACTIVE_FLIGHT_ID },
    update: {
      bookingId: DEMO_ACTIVE_BOOKING_ID,
      pilotProfileId: demoPilotProfile.id,
      routeId: schedule.routeId,
      aircraftId: schedule.aircraftId,
      departureAirportId: schedule.departureAirportId,
      arrivalAirportId: schedule.arrivalAirportId,
      flightNumber: schedule.callsign,
      status: FlightStatus.IN_PROGRESS,
      plannedOffBlockAt: activeBookedFor,
      actualOffBlockAt: null,
      actualTakeoffAt: null,
      actualLandingAt: null,
      actualOnBlockAt: null,
      distanceFlownNm: null,
      durationMinutes: null,
    },
    create: {
      id: DEMO_ACTIVE_FLIGHT_ID,
      bookingId: DEMO_ACTIVE_BOOKING_ID,
      pilotProfileId: demoPilotProfile.id,
      routeId: schedule.routeId,
      aircraftId: schedule.aircraftId,
      departureAirportId: schedule.departureAirportId,
      arrivalAirportId: schedule.arrivalAirportId,
      flightNumber: schedule.callsign,
      status: FlightStatus.IN_PROGRESS,
      plannedOffBlockAt: activeBookedFor,
    },
  });

  await prisma.booking.upsert({
    where: { id: DEMO_HISTORY_BOOKING_ID },
    update: {
      pilotProfileId: demoPilotProfile.id,
      scheduleId: schedule.id,
      routeId: schedule.routeId,
      aircraftId: schedule.aircraftId,
      departureAirportId: schedule.departureAirportId,
      arrivalAirportId: schedule.arrivalAirportId,
      reservedFlightNumber: schedule.callsign,
      bookedFor: historicalBookedFor,
      status: BookingStatus.COMPLETED,
      reservedAt: addMinutes(historicalBookedFor, -45),
      expiresAt: null,
      cancelledAt: null,
      notes:
        "Seeded completed booking used by the web MVP to display a first historical flight and PIREP.",
    },
    create: {
      id: DEMO_HISTORY_BOOKING_ID,
      pilotProfileId: demoPilotProfile.id,
      scheduleId: schedule.id,
      routeId: schedule.routeId,
      aircraftId: schedule.aircraftId,
      departureAirportId: schedule.departureAirportId,
      arrivalAirportId: schedule.arrivalAirportId,
      reservedFlightNumber: schedule.callsign,
      bookedFor: historicalBookedFor,
      status: BookingStatus.COMPLETED,
      reservedAt: addMinutes(historicalBookedFor, -45),
      notes:
        "Seeded completed booking used by the web MVP to display a first historical flight and PIREP.",
    },
  });

  await prisma.flight.upsert({
    where: { id: DEMO_HISTORY_FLIGHT_ID },
    update: {
      bookingId: DEMO_HISTORY_BOOKING_ID,
      pilotProfileId: demoPilotProfile.id,
      routeId: schedule.routeId,
      aircraftId: schedule.aircraftId,
      departureAirportId: schedule.departureAirportId,
      arrivalAirportId: schedule.arrivalAirportId,
      flightNumber: schedule.callsign,
      status: FlightStatus.COMPLETED,
      plannedOffBlockAt: historicalBookedFor,
      actualOffBlockAt: historicalOffBlockAt,
      actualTakeoffAt: historicalTakeoffAt,
      actualLandingAt: historicalLandingAt,
      actualOnBlockAt: historicalOnBlockAt,
      distanceFlownNm: 188,
      durationMinutes: 95,
    },
    create: {
      id: DEMO_HISTORY_FLIGHT_ID,
      bookingId: DEMO_HISTORY_BOOKING_ID,
      pilotProfileId: demoPilotProfile.id,
      routeId: schedule.routeId,
      aircraftId: schedule.aircraftId,
      departureAirportId: schedule.departureAirportId,
      arrivalAirportId: schedule.arrivalAirportId,
      flightNumber: schedule.callsign,
      status: FlightStatus.COMPLETED,
      plannedOffBlockAt: historicalBookedFor,
      actualOffBlockAt: historicalOffBlockAt,
      actualTakeoffAt: historicalTakeoffAt,
      actualLandingAt: historicalLandingAt,
      actualOnBlockAt: historicalOnBlockAt,
      distanceFlownNm: 188,
      durationMinutes: 95,
    },
  });

  await prisma.pirep.upsert({
    where: { id: DEMO_HISTORY_PIREP_ID },
    update: {
      flightId: DEMO_HISTORY_FLIGHT_ID,
      sessionId: null,
      pilotProfileId: demoPilotProfile.id,
      source: PirepSource.MANUAL,
      status: PirepStatus.ACCEPTED,
      submittedAt: historicalOnBlockAt,
      departureAirportId: schedule.departureAirportId,
      arrivalAirportId: schedule.arrivalAirportId,
      aircraftId: schedule.aircraftId,
      blockTimeMinutes: 95,
      flightTimeMinutes: 66,
      fuelUsedKg: 2450,
      landingRateFpm: -240,
      score: 89,
      summary: {
        origin: "seed",
        note: "Historical accepted PIREP seeded for the web MVP.",
      },
      pilotComment: "Historical MVP demonstration flight.",
      reviewerComment: "Accepted by seeded staff review.",
    },
    create: {
      id: DEMO_HISTORY_PIREP_ID,
      flightId: DEMO_HISTORY_FLIGHT_ID,
      sessionId: null,
      pilotProfileId: demoPilotProfile.id,
      source: PirepSource.MANUAL,
      status: PirepStatus.ACCEPTED,
      submittedAt: historicalOnBlockAt,
      departureAirportId: schedule.departureAirportId,
      arrivalAirportId: schedule.arrivalAirportId,
      aircraftId: schedule.aircraftId,
      blockTimeMinutes: 95,
      flightTimeMinutes: 66,
      fuelUsedKg: 2450,
      landingRateFpm: -240,
      score: 89,
      summary: {
        origin: "seed",
        note: "Historical accepted PIREP seeded for the web MVP.",
      },
      pilotComment: "Historical MVP demonstration flight.",
      reviewerComment: "Accepted by seeded staff review.",
    },
  });
}

async function seedSettingsAndNews(): Promise<void> {
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@va.local" },
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
    },
    {
      key: "public.branding",
      value: {
        airlineName: "Virtual Easyjet",
        airlineCode: "VEJ",
        primaryHub: "LFPG",
      },
      description: "Public branding displayed by the website.",
    },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {
        value: setting.value,
        description: setting.description,
        updatedById: admin.id,
      },
      create: {
        key: setting.key,
        value: setting.value,
        description: setting.description,
        updatedById: admin.id,
      },
    });
  }

  await prisma.newsPost.upsert({
    where: { slug: "welcome-to-horizon-virtual" },
    update: {
      title: "Welcome to Horizon Virtual",
      excerpt: "The MVP platform is ready for its first operational iteration.",
      content:
        "This seed post demonstrates the public news feed that will later power the web home page.",
      status: NewsPostStatus.PUBLISHED,
      publishedAt: new Date(),
      authorId: admin.id,
    },
    create: {
      slug: "welcome-to-horizon-virtual",
      title: "Welcome to Horizon Virtual",
      excerpt: "The MVP platform is ready for its first operational iteration.",
      content:
        "This seed post demonstrates the public news feed that will later power the web home page.",
      status: NewsPostStatus.PUBLISHED,
      publishedAt: new Date(),
      authorId: admin.id,
    },
  });
}

async function main(): Promise<void> {
  await seedRoles();
  await seedRanks();
  await seedAirportsAndHub();
  await seedFleet();
  await seedRoutesAndSchedules();
  await seedAdminAndDemoPilot();
  await seedDemoOperations();
  await seedSettingsAndNews();
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
