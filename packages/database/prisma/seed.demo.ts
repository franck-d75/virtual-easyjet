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
  UserPlatformRole,
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

type SeedOperationScenario = {
  bookingId: string;
  flightId?: string;
  pirepId?: string;
  scheduleId: string;
  bookingStatus: BookingStatus;
  bookedFor: Date;
  reservedAt: Date;
  expiresAt?: Date | null;
  notes: string;
  flightStatus?: FlightStatus;
  plannedOffBlockAt?: Date | null;
  actualOffBlockAt?: Date | null;
  actualTakeoffAt?: Date | null;
  actualLandingAt?: Date | null;
  actualOnBlockAt?: Date | null;
  distanceFlownNm?: number | null;
  durationMinutes?: number | null;
  pirepStatus?: PirepStatus;
  pirepSource?: PirepSource;
  fuelUsedKg?: number | null;
  flightTimeMinutes?: number | null;
  landingRateFpm?: number | null;
  score?: number | null;
  pilotComment?: string | null;
  reviewerComment?: string | null;
};

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
      description: "Premier rang attribué lors de l’arrivée dans la compagnie.",
    },
    {
      code: "FO",
      name: "First Officer",
      sortOrder: 20,
      minFlights: 3,
      minHoursMinutes: 600,
      minScore: 70,
      description: "Pilote en ligne opérationnel sur le réseau court-courrier.",
    },
    {
      code: "CPT",
      name: "Captain",
      sortOrder: 30,
      minFlights: 6,
      minHoursMinutes: 3000,
      minScore: 80,
      description: "Commandant de bord confirmé sur les lignes principales.",
    },
    {
      code: "SCC",
      name: "Senior Captain",
      sortOrder: 40,
      minFlights: 12,
      minHoursMinutes: 6000,
      minScore: 88,
      description: "Rang supérieur réservé aux pilotes les plus réguliers.",
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

async function seedAirportsAndHubs(): Promise<void> {
  const airports = [
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
    {
      icao: "EGKK",
      iata: "LGW",
      name: "London Gatwick",
      city: "London",
      countryCode: "GB",
      latitude: 51.1481,
      longitude: -0.1903,
      elevationFt: 202,
    },
    {
      icao: "LEBL",
      iata: "BCN",
      name: "Barcelona El Prat",
      city: "Barcelona",
      countryCode: "ES",
      latitude: 41.2974,
      longitude: 2.0833,
      elevationFt: 12,
    },
    {
      icao: "LIMC",
      iata: "MXP",
      name: "Milan Malpensa",
      city: "Milan",
      countryCode: "IT",
      latitude: 45.63,
      longitude: 8.7231,
      elevationFt: 768,
    },
    {
      icao: "LPPT",
      iata: "LIS",
      name: "Lisbon Humberto Delgado",
      city: "Lisbon",
      countryCode: "PT",
      latitude: 38.7742,
      longitude: -9.1342,
      elevationFt: 374,
    },
    {
      icao: "EHAM",
      iata: "AMS",
      name: "Amsterdam Schiphol",
      city: "Amsterdam",
      countryCode: "NL",
      latitude: 52.3086,
      longitude: 4.7639,
      elevationFt: -11,
    },
    {
      icao: "LFMN",
      iata: "NCE",
      name: "Nice Cote d'Azur",
      city: "Nice",
      countryCode: "FR",
      latitude: 43.6653,
      longitude: 7.215,
      elevationFt: 12,
    },
    {
      icao: "EDDM",
      iata: "MUC",
      name: "Munich",
      city: "Munich",
      countryCode: "DE",
      latitude: 48.3538,
      longitude: 11.7861,
      elevationFt: 1487,
    },
  ];

  for (const airport of airports) {
    await prisma.airport.upsert({
      where: { icao: airport.icao },
      update: airport,
      create: airport,
    });
  }

  const hubs = [
    { code: "PAR", name: "Paris Orly Base", airportIcao: "LFPO" },
    { code: "LGW", name: "London Gatwick Base", airportIcao: "EGKK" },
    { code: "BCN", name: "Barcelona Base", airportIcao: "LEBL" },
    { code: "MXP", name: "Milan Malpensa Base", airportIcao: "LIMC" },
    { code: "LIS", name: "Lisbon Base", airportIcao: "LPPT" },
  ];

  for (const hub of hubs) {
    const airport = await prisma.airport.findUniqueOrThrow({
      where: { icao: hub.airportIcao },
    });

    await prisma.hub.upsert({
      where: { code: hub.code },
      update: {
        name: hub.name,
        airportId: airport.id,
        isActive: true,
      },
      create: {
        code: hub.code,
        name: hub.name,
        airportId: airport.id,
        isActive: true,
      },
    });
  }
}

async function seedFleet(): Promise<void> {
  const rankByCode = new Map(
    (
      await prisma.rank.findMany({
        select: { id: true, code: true },
      })
    ).map((rank) => [rank.code, rank.id]),
  );

  const hubByCode = new Map(
    (
      await prisma.hub.findMany({
        select: { id: true, code: true },
      })
    ).map((hub) => [hub.code, hub.id]),
  );

  const aircraftTypes = [
    {
      icaoCode: "A319",
      name: "Airbus A319",
      manufacturer: "Airbus",
      category: "Narrow-body",
      minRankCode: "FO",
      cruiseSpeedKts: 430,
    },
    {
      icaoCode: "A320",
      name: "Airbus A320",
      manufacturer: "Airbus",
      category: "Narrow-body",
      minRankCode: "FO",
      cruiseSpeedKts: 447,
    },
    {
      icaoCode: "A20N",
      name: "Airbus A320neo",
      manufacturer: "Airbus",
      category: "Narrow-body",
      minRankCode: "FO",
      cruiseSpeedKts: 450,
    },
    {
      icaoCode: "A21N",
      name: "Airbus A321neo",
      manufacturer: "Airbus",
      category: "Narrow-body",
      minRankCode: "CPT",
      cruiseSpeedKts: 460,
    },
  ];

  for (const aircraftType of aircraftTypes) {
    await prisma.aircraftType.upsert({
      where: { icaoCode: aircraftType.icaoCode },
      update: {
        name: aircraftType.name,
        manufacturer: aircraftType.manufacturer,
        category: aircraftType.category,
        minRankId: rankByCode.get(aircraftType.minRankCode) ?? null,
        cruiseSpeedKts: aircraftType.cruiseSpeedKts,
        isActive: true,
      },
      create: {
        icaoCode: aircraftType.icaoCode,
        name: aircraftType.name,
        manufacturer: aircraftType.manufacturer,
        category: aircraftType.category,
        minRankId: rankByCode.get(aircraftType.minRankCode) ?? null,
        cruiseSpeedKts: aircraftType.cruiseSpeedKts,
        isActive: true,
      },
    });
  }

  const aircraftTypeByCode = new Map(
    (
      await prisma.aircraftType.findMany({
        select: { id: true, icaoCode: true },
      })
    ).map((aircraftType) => [aircraftType.icaoCode, aircraftType.id]),
  );

  const fleet = [
    {
      registration: "F-HVEJ",
      label: "Paris Orly 01",
      aircraftTypeCode: "A20N",
      hubCode: "PAR",
      status: AircraftStatus.ACTIVE,
      notes: "Appareil principal du programme de démonstration.",
    },
    {
      registration: "G-VEJA",
      label: "London Gatwick 01",
      aircraftTypeCode: "A20N",
      hubCode: "LGW",
      status: AircraftStatus.ACTIVE,
      notes: "Rotation dense sur le réseau Royaume-Uni - Europe.",
    },
    {
      registration: "G-VEJB",
      label: "London Gatwick 02",
      aircraftTypeCode: "A320",
      hubCode: "LGW",
      status: AircraftStatus.ACTIVE,
      notes: "Appareil standard pour les rotations continentales.",
    },
    {
      registration: "EC-VEJC",
      label: "Barcelona 01",
      aircraftTypeCode: "A319",
      hubCode: "BCN",
      status: AircraftStatus.ACTIVE,
      notes: "Appareil léger dédié aux lignes à forte fréquence.",
    },
    {
      registration: "I-VEJD",
      label: "Milan Malpensa 01",
      aircraftTypeCode: "A320",
      hubCode: "MXP",
      status: AircraftStatus.ACTIVE,
      notes: "Base nord de l'Italie pour le réseau loisirs et affaires.",
    },
    {
      registration: "CS-VEJE",
      label: "Lisbon 01",
      aircraftTypeCode: "A21N",
      hubCode: "LIS",
      status: AircraftStatus.MAINTENANCE,
      notes: "Appareil en maintenance planifiée avant retour en ligne.",
    },
  ];

  for (const airframe of fleet) {
    await prisma.aircraft.upsert({
      where: { registration: airframe.registration },
      update: {
        label: airframe.label,
        aircraftTypeId: aircraftTypeByCode.get(airframe.aircraftTypeCode)!,
        hubId: hubByCode.get(airframe.hubCode) ?? null,
        status: airframe.status,
        notes: airframe.notes,
      },
      create: {
        registration: airframe.registration,
        label: airframe.label,
        aircraftTypeId: aircraftTypeByCode.get(airframe.aircraftTypeCode)!,
        hubId: hubByCode.get(airframe.hubCode) ?? null,
        status: airframe.status,
        notes: airframe.notes,
      },
    });
  }
}

async function seedRoutesAndSchedules(): Promise<void> {
  const airportByIcao = new Map(
    (
      await prisma.airport.findMany({
        select: { id: true, icao: true },
      })
    ).map((airport) => [airport.icao, airport.id]),
  );

  const hubByCode = new Map(
    (
      await prisma.hub.findMany({
        select: { id: true, code: true },
      })
    ).map((hub) => [hub.code, hub.id]),
  );

  const aircraftTypeByCode = new Map(
    (
      await prisma.aircraftType.findMany({
        select: { id: true, icaoCode: true },
      })
    ).map((aircraftType) => [aircraftType.icaoCode, aircraftType.id]),
  );

  const aircraftByRegistration = new Map(
    (
      await prisma.aircraft.findMany({
        select: { id: true, registration: true },
      })
    ).map((aircraft) => [aircraft.registration, aircraft.id]),
  );

  const routes = [
    {
      code: "VEJ101",
      flightNumber: "VEJ101",
      departureAirportIcao: "LFPO",
      arrivalAirportIcao: "EGKK",
      departureHubCode: "PAR",
      arrivalHubCode: "LGW",
      aircraftTypeCode: "A20N",
      distanceNm: 182,
      blockTimeMinutes: 75,
      notes: "Rotation phare du matin entre Paris Orly et Londres Gatwick.",
    },
    {
      code: "VEJ102",
      flightNumber: "VEJ102",
      departureAirportIcao: "EGKK",
      arrivalAirportIcao: "LFPO",
      departureHubCode: "LGW",
      arrivalHubCode: "PAR",
      aircraftTypeCode: "A20N",
      distanceNm: 182,
      blockTimeMinutes: 80,
      notes: "Retour de fin de matinée depuis Londres vers Paris.",
    },
    {
      code: "VEJ215",
      flightNumber: "VEJ215",
      departureAirportIcao: "LEBL",
      arrivalAirportIcao: "LIMC",
      departureHubCode: "BCN",
      arrivalHubCode: "MXP",
      aircraftTypeCode: "A319",
      distanceNm: 397,
      blockTimeMinutes: 105,
      notes: "Ligne méditerranéenne à forte fréquence.",
    },
    {
      code: "VEJ216",
      flightNumber: "VEJ216",
      departureAirportIcao: "LIMC",
      arrivalAirportIcao: "LEBL",
      departureHubCode: "MXP",
      arrivalHubCode: "BCN",
      aircraftTypeCode: "A320",
      distanceNm: 397,
      blockTimeMinutes: 105,
      notes: "Retour stratégique entre Milan et Barcelone.",
    },
    {
      code: "VEJ331",
      flightNumber: "VEJ331",
      departureAirportIcao: "LPPT",
      arrivalAirportIcao: "LFPO",
      departureHubCode: "LIS",
      arrivalHubCode: "PAR",
      aircraftTypeCode: "A20N",
      distanceNm: 779,
      blockTimeMinutes: 145,
      notes: "Ligne longue du réseau ouest européen.",
    },
    {
      code: "VEJ332",
      flightNumber: "VEJ332",
      departureAirportIcao: "LFPO",
      arrivalAirportIcao: "LPPT",
      departureHubCode: "PAR",
      arrivalHubCode: "LIS",
      aircraftTypeCode: "A20N",
      distanceNm: 779,
      blockTimeMinutes: 150,
      notes: "Rotation de soirée orientée régularité opérationnelle.",
    },
    {
      code: "VEJ441",
      flightNumber: "VEJ441",
      departureAirportIcao: "EGKK",
      arrivalAirportIcao: "EHAM",
      departureHubCode: "LGW",
      arrivalHubCode: null,
      aircraftTypeCode: "A320",
      distanceNm: 199,
      blockTimeMinutes: 80,
      notes: "Pont court-courrier entre le sud de l'Angleterre et Amsterdam.",
    },
    {
      code: "VEJ442",
      flightNumber: "VEJ442",
      departureAirportIcao: "EHAM",
      arrivalAirportIcao: "EGKK",
      departureHubCode: null,
      arrivalHubCode: "LGW",
      aircraftTypeCode: "A320",
      distanceNm: 199,
      blockTimeMinutes: 85,
      notes: "Retour depuis Amsterdam sur la base de Londres Gatwick.",
    },
    {
      code: "VEJ551",
      flightNumber: "VEJ551",
      departureAirportIcao: "LFPO",
      arrivalAirportIcao: "LFMN",
      departureHubCode: "PAR",
      arrivalHubCode: null,
      aircraftTypeCode: "A20N",
      distanceNm: 370,
      blockTimeMinutes: 95,
      notes: "Navette loisirs entre Paris et la Côte d'Azur.",
    },
    {
      code: "VEJ552",
      flightNumber: "VEJ552",
      departureAirportIcao: "LFMN",
      arrivalAirportIcao: "LFPO",
      departureHubCode: null,
      arrivalHubCode: "PAR",
      aircraftTypeCode: "A20N",
      distanceNm: 370,
      blockTimeMinutes: 95,
      notes: "Retour vers Paris en milieu de journée.",
    },
    {
      code: "VEJ661",
      flightNumber: "VEJ661",
      departureAirportIcao: "LEBL",
      arrivalAirportIcao: "EDDM",
      departureHubCode: "BCN",
      arrivalHubCode: null,
      aircraftTypeCode: "A21N",
      distanceNm: 577,
      blockTimeMinutes: 120,
      notes: "Ligne premium réservée aux commandants de bord.",
    },
  ];

  for (const route of routes) {
    await prisma.route.upsert({
      where: { code: route.code },
      update: {
        flightNumber: route.flightNumber,
        departureAirportId: airportByIcao.get(route.departureAirportIcao)!,
        arrivalAirportId: airportByIcao.get(route.arrivalAirportIcao)!,
        departureHubId: route.departureHubCode
          ? (hubByCode.get(route.departureHubCode) ?? null)
          : null,
        arrivalHubId: route.arrivalHubCode
          ? (hubByCode.get(route.arrivalHubCode) ?? null)
          : null,
        aircraftTypeId: aircraftTypeByCode.get(route.aircraftTypeCode) ?? null,
        distanceNm: route.distanceNm,
        blockTimeMinutes: route.blockTimeMinutes,
        isActive: true,
        notes: route.notes,
      },
      create: {
        code: route.code,
        flightNumber: route.flightNumber,
        departureAirportId: airportByIcao.get(route.departureAirportIcao)!,
        arrivalAirportId: airportByIcao.get(route.arrivalAirportIcao)!,
        departureHubId: route.departureHubCode
          ? (hubByCode.get(route.departureHubCode) ?? null)
          : null,
        arrivalHubId: route.arrivalHubCode
          ? (hubByCode.get(route.arrivalHubCode) ?? null)
          : null,
        aircraftTypeId: aircraftTypeByCode.get(route.aircraftTypeCode) ?? null,
        distanceNm: route.distanceNm,
        blockTimeMinutes: route.blockTimeMinutes,
        isActive: true,
        notes: route.notes,
      },
    });
  }

  const routeByCode = new Map(
    (
      await prisma.route.findMany({
        select: { id: true, code: true },
      })
    ).map((route) => [route.code, route.id]),
  );

  const schedules = [
    {
      id: "seed-afr100-daily",
      routeCode: "VEJ101",
      aircraftRegistration: "F-HVEJ",
      departureAirportIcao: "LFPO",
      arrivalAirportIcao: "EGKK",
      callsign: "VEJ101",
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      departureTimeUtc: "06:15",
      arrivalTimeUtc: "07:30",
    },
    {
      id: "seed-vej102-daily",
      routeCode: "VEJ102",
      aircraftRegistration: "G-VEJA",
      departureAirportIcao: "EGKK",
      arrivalAirportIcao: "LFPO",
      callsign: "VEJ102",
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      departureTimeUtc: "08:20",
      arrivalTimeUtc: "10:00",
    },
    {
      id: "seed-vej215-daily",
      routeCode: "VEJ215",
      aircraftRegistration: "EC-VEJC",
      departureAirportIcao: "LEBL",
      arrivalAirportIcao: "LIMC",
      callsign: "VEJ215",
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      departureTimeUtc: "10:05",
      arrivalTimeUtc: "11:50",
    },
    {
      id: "seed-vej216-daily",
      routeCode: "VEJ216",
      aircraftRegistration: "I-VEJD",
      departureAirportIcao: "LIMC",
      arrivalAirportIcao: "LEBL",
      callsign: "VEJ216",
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      departureTimeUtc: "13:20",
      arrivalTimeUtc: "15:05",
    },
    {
      id: "seed-vej331-daily",
      routeCode: "VEJ331",
      aircraftRegistration: "F-HVEJ",
      departureAirportIcao: "LPPT",
      arrivalAirportIcao: "LFPO",
      callsign: "VEJ331",
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      departureTimeUtc: "06:40",
      arrivalTimeUtc: "09:05",
    },
    {
      id: "seed-vej332-daily",
      routeCode: "VEJ332",
      aircraftRegistration: "F-HVEJ",
      departureAirportIcao: "LFPO",
      arrivalAirportIcao: "LPPT",
      callsign: "VEJ332",
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      departureTimeUtc: "18:10",
      arrivalTimeUtc: "20:40",
    },
    {
      id: "seed-vej441-weekday",
      routeCode: "VEJ441",
      aircraftRegistration: "G-VEJB",
      departureAirportIcao: "EGKK",
      arrivalAirportIcao: "EHAM",
      callsign: "VEJ441",
      daysOfWeek: [1, 2, 3, 4, 5],
      departureTimeUtc: "12:30",
      arrivalTimeUtc: "13:50",
    },
    {
      id: "seed-vej442-weekday",
      routeCode: "VEJ442",
      aircraftRegistration: "G-VEJB",
      departureAirportIcao: "EHAM",
      arrivalAirportIcao: "EGKK",
      callsign: "VEJ442",
      daysOfWeek: [1, 2, 3, 4, 5],
      departureTimeUtc: "15:05",
      arrivalTimeUtc: "16:30",
    },
    {
      id: "seed-vej551-daily",
      routeCode: "VEJ551",
      aircraftRegistration: "F-HVEJ",
      departureAirportIcao: "LFPO",
      arrivalAirportIcao: "LFMN",
      callsign: "VEJ551",
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      departureTimeUtc: "09:45",
      arrivalTimeUtc: "11:20",
    },
    {
      id: "seed-vej552-daily",
      routeCode: "VEJ552",
      aircraftRegistration: "F-HVEJ",
      departureAirportIcao: "LFMN",
      arrivalAirportIcao: "LFPO",
      callsign: "VEJ552",
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      departureTimeUtc: "12:20",
      arrivalTimeUtc: "13:55",
    },
  ];

  for (const schedule of schedules) {
    await prisma.schedule.upsert({
      where: { id: schedule.id },
      update: {
        routeId: routeByCode.get(schedule.routeCode)!,
        aircraftId:
          aircraftByRegistration.get(schedule.aircraftRegistration) ?? null,
        departureAirportId: airportByIcao.get(schedule.departureAirportIcao)!,
        arrivalAirportId: airportByIcao.get(schedule.arrivalAirportIcao)!,
        callsign: schedule.callsign,
        daysOfWeek: schedule.daysOfWeek,
        departureTimeUtc: schedule.departureTimeUtc,
        arrivalTimeUtc: schedule.arrivalTimeUtc,
        isActive: true,
      },
      create: {
        id: schedule.id,
        routeId: routeByCode.get(schedule.routeCode)!,
        aircraftId:
          aircraftByRegistration.get(schedule.aircraftRegistration) ?? null,
        departureAirportId: airportByIcao.get(schedule.departureAirportIcao)!,
        arrivalAirportId: airportByIcao.get(schedule.arrivalAirportIcao)!,
        callsign: schedule.callsign,
        daysOfWeek: schedule.daysOfWeek,
        departureTimeUtc: schedule.departureTimeUtc,
        arrivalTimeUtc: schedule.arrivalTimeUtc,
        isActive: true,
      },
    });
  }
}

async function cleanupLegacySeedArtifacts(): Promise<void> {
  const [
    replacementAircraft,
    legacyAircraft,
    replacementRoute,
    legacyRoute,
    demoPilotProfile,
  ] =
    await Promise.all([
      prisma.aircraft.findUnique({
        where: { registration: "F-HVEJ" },
      }),
      prisma.aircraft.findUnique({
        where: { registration: "F-HVAA" },
      }),
      prisma.route.findUnique({
        where: { code: "VEJ101" },
      }),
      prisma.route.findUnique({
        where: { code: "AFR100" },
      }),
      prisma.pilotProfile.findUnique({
        where: { pilotNumber: "VA00001" },
      }),
    ]);

  if (replacementAircraft && legacyAircraft) {
    await prisma.schedule.updateMany({
      where: {
        aircraftId: legacyAircraft.id,
      },
      data: {
        aircraftId: replacementAircraft.id,
      },
    });

    await prisma.booking.updateMany({
      where: {
        aircraftId: legacyAircraft.id,
      },
      data: {
        aircraftId: replacementAircraft.id,
      },
    });

    await prisma.flight.updateMany({
      where: {
        aircraftId: legacyAircraft.id,
      },
      data: {
        aircraftId: replacementAircraft.id,
      },
    });

    await prisma.pirep.updateMany({
      where: {
        aircraftId: legacyAircraft.id,
      },
      data: {
        aircraftId: replacementAircraft.id,
      },
    });
  }

  if (replacementRoute && legacyRoute) {
    await prisma.schedule.updateMany({
      where: {
        routeId: legacyRoute.id,
      },
      data: {
        routeId: replacementRoute.id,
        callsign: replacementRoute.flightNumber,
      },
    });

    await prisma.booking.updateMany({
      where: {
        routeId: legacyRoute.id,
      },
      data: {
        routeId: replacementRoute.id,
        reservedFlightNumber: replacementRoute.flightNumber,
      },
    });

    await prisma.flight.updateMany({
      where: {
        routeId: legacyRoute.id,
      },
      data: {
        routeId: replacementRoute.id,
        flightNumber: replacementRoute.flightNumber,
      },
    });
  }

  if (replacementAircraft && replacementRoute && demoPilotProfile) {
    await prisma.booking.updateMany({
      where: {
        pilotProfileId: demoPilotProfile.id,
        reservedFlightNumber: "AFR100",
      },
      data: {
        routeId: replacementRoute.id,
        aircraftId: replacementAircraft.id,
        departureAirportId: replacementRoute.departureAirportId,
        arrivalAirportId: replacementRoute.arrivalAirportId,
        reservedFlightNumber: replacementRoute.flightNumber,
      },
    });

    await prisma.flight.updateMany({
      where: {
        pilotProfileId: demoPilotProfile.id,
        flightNumber: "AFR100",
      },
      data: {
        routeId: replacementRoute.id,
        aircraftId: replacementAircraft.id,
        departureAirportId: replacementRoute.departureAirportId,
        arrivalAirportId: replacementRoute.arrivalAirportId,
        flightNumber: replacementRoute.flightNumber,
      },
    });
  }

  await prisma.newsPost.deleteMany({
    where: {
      slug: "welcome-to-horizon-virtual",
    },
  });

  if (legacyRoute) {
    await prisma.route.delete({
      where: {
        id: legacyRoute.id,
      },
    });
  }

  if (legacyAircraft) {
    await prisma.aircraft.delete({
      where: {
        id: legacyAircraft.id,
      },
    });
  }

  await prisma.aircraftType.deleteMany({
    where: {
      icaoCode: "B738",
    },
  });
}

async function seedAdminAndDemoPilot(): Promise<void> {
  const [adminRole, staffRole, pilotRole, cadetRank, foRank, parisHub] =
    await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { code: "admin" } }),
      prisma.role.findUniqueOrThrow({ where: { code: "staff" } }),
      prisma.role.findUniqueOrThrow({ where: { code: "pilot" } }),
      prisma.rank.findUniqueOrThrow({ where: { code: "CADET" } }),
      prisma.rank.findUniqueOrThrow({ where: { code: "FO" } }),
      prisma.hub.findUniqueOrThrow({ where: { code: "PAR" } }),
    ]);

  const adminPasswordHash = await hash("ChangeMe123!", 12);
  const pilotPasswordHash = await hash("Pilot123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@va.local" },
    update: {
      username: "admin",
      avatarUrl:
        "https://api.dicebear.com/9.x/initials/svg?seed=Virtual%20Admin",
      passwordHash: adminPasswordHash,
      role: UserPlatformRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: "admin@va.local",
      username: "admin",
      avatarUrl:
        "https://api.dicebear.com/9.x/initials/svg?seed=Virtual%20Admin",
      passwordHash: adminPasswordHash,
      role: UserPlatformRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const demoPilot = await prisma.user.upsert({
    where: { email: "pilot@va.local" },
    update: {
      username: "pilotdemo",
      avatarUrl:
        "https://api.dicebear.com/9.x/initials/svg?seed=Camille%20Noiret",
      passwordHash: pilotPasswordHash,
      role: UserPlatformRole.USER,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: "pilot@va.local",
      username: "pilotdemo",
      avatarUrl:
        "https://api.dicebear.com/9.x/initials/svg?seed=Camille%20Noiret",
      passwordHash: pilotPasswordHash,
      role: UserPlatformRole.USER,
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
      callsign: "VEJ-ADM",
      firstName: "Virtual",
      lastName: "Admin",
      countryCode: "FR",
      hubId: parisHub.id,
      rankId: cadetRank.id,
      status: PilotStatus.ACTIVE,
    },
    create: {
      userId: admin.id,
      pilotNumber: "VAADMIN",
      callsign: "VEJ-ADM",
      firstName: "Virtual",
      lastName: "Admin",
      countryCode: "FR",
      hubId: parisHub.id,
      rankId: cadetRank.id,
      status: PilotStatus.ACTIVE,
    },
  });

  await prisma.pilotProfile.upsert({
    where: { userId: demoPilot.id },
    update: {
      pilotNumber: "VA00001",
      callsign: "VEJ4512",
      firstName: "Camille",
      lastName: "Noiret",
      countryCode: "FR",
      hubId: parisHub.id,
      rankId: foRank.id,
      status: PilotStatus.ACTIVE,
      experiencePoints: 540,
      hoursFlownMinutes: 2880,
    },
    create: {
      userId: demoPilot.id,
      pilotNumber: "VA00001",
      callsign: "VEJ4512",
      firstName: "Camille",
      lastName: "Noiret",
      countryCode: "FR",
      hubId: parisHub.id,
      rankId: foRank.id,
      status: PilotStatus.ACTIVE,
      experiencePoints: 540,
      hoursFlownMinutes: 2880,
    },
  });
}

async function seedDemoOperations(): Promise<void> {
  const [demoPilotProfile, admin] = await Promise.all([
    prisma.pilotProfile.findUniqueOrThrow({
      where: { pilotNumber: "VA00001" },
    }),
    prisma.user.findUniqueOrThrow({
      where: { email: "admin@va.local" },
    }),
  ]);

  const scheduleIds = [
    "seed-afr100-daily",
    "seed-vej102-daily",
    "seed-vej215-daily",
    "seed-vej216-daily",
    "seed-vej331-daily",
    "seed-vej441-weekday",
    "seed-vej551-daily",
  ];

  const schedules = await prisma.schedule.findMany({
    where: {
      id: {
        in: scheduleIds,
      },
    },
    select: {
      id: true,
      routeId: true,
      aircraftId: true,
      departureAirportId: true,
      arrivalAirportId: true,
      callsign: true,
      route: {
        select: {
          distanceNm: true,
          blockTimeMinutes: true,
        },
      },
    },
  });

  const scheduleById = new Map(schedules.map((schedule) => [schedule.id, schedule]));

  const operations = [
    DEMO_RESERVED_BOOKING_ID,
    DEMO_ACTIVE_BOOKING_ID,
    DEMO_HISTORY_BOOKING_ID,
    "seed-booking-demo-return",
    "seed-booking-demo-history-barcelona",
    "seed-booking-demo-history-lisbon",
    "seed-booking-demo-history-amsterdam",
    "seed-booking-demo-history-nice",
  ];

  for (const bookingId of operations) {
    await resetSeededBookingExecution(bookingId);
  }

  const now = new Date();
  const scenarios: SeedOperationScenario[] = [
    {
      bookingId: DEMO_RESERVED_BOOKING_ID,
      scheduleId: "seed-afr100-daily",
      bookingStatus: BookingStatus.RESERVED,
      bookedFor: addMinutes(now, 150),
      reservedAt: addMinutes(now, -15),
      expiresAt: addMinutes(now, 420),
      notes:
        "Rotation mise en avant sur le dashboard pour tester le flux booking vers vol.",
    },
    {
      bookingId: "seed-booking-demo-return",
      scheduleId: "seed-vej102-daily",
      bookingStatus: BookingStatus.RESERVED,
      bookedFor: addMinutes(now, 540),
      reservedAt: addMinutes(now, -10),
      expiresAt: addMinutes(now, 900),
      notes:
        "Réservation complémentaire pour montrer plusieurs rotations disponibles.",
    },
    {
      bookingId: DEMO_ACTIVE_BOOKING_ID,
      flightId: DEMO_ACTIVE_FLIGHT_ID,
      scheduleId: "seed-vej216-daily",
      bookingStatus: BookingStatus.IN_PROGRESS,
      bookedFor: addMinutes(now, -45),
      reservedAt: addMinutes(now, -120),
      expiresAt: null,
      notes:
        "Vol actif de démonstration destiné au client desktop ACARS live.",
      flightStatus: FlightStatus.IN_PROGRESS,
      plannedOffBlockAt: addMinutes(now, -45),
      actualOffBlockAt: null,
      actualTakeoffAt: null,
      actualLandingAt: null,
      actualOnBlockAt: null,
      distanceFlownNm: null,
      durationMinutes: null,
    },
    {
      bookingId: DEMO_HISTORY_BOOKING_ID,
      flightId: DEMO_HISTORY_FLIGHT_ID,
      pirepId: DEMO_HISTORY_PIREP_ID,
      scheduleId: "seed-afr100-daily",
      bookingStatus: BookingStatus.COMPLETED,
      bookedFor: addMinutes(now, -1_440),
      reservedAt: addMinutes(now, -1_500),
      expiresAt: null,
      notes:
        "Vol terminé récent pour alimenter le dashboard pilote et l'historique web.",
      flightStatus: FlightStatus.COMPLETED,
      plannedOffBlockAt: addMinutes(now, -1_440),
      actualOffBlockAt: addMinutes(now, -1_433),
      actualTakeoffAt: addMinutes(now, -1_418),
      actualLandingAt: addMinutes(now, -1_368),
      actualOnBlockAt: addMinutes(now, -1_360),
      distanceFlownNm: 182,
      durationMinutes: 80,
      pirepStatus: PirepStatus.ACCEPTED,
      pirepSource: PirepSource.AUTO,
      fuelUsedKg: 1920,
      flightTimeMinutes: 62,
      landingRateFpm: -198,
      score: 93,
      pilotComment:
        "Rotation matinale fluide avec arrivée stabilisée sur Londres Gatwick.",
      reviewerComment: "PIREP validé pour la démonstration de l'espace pilote.",
    },
    {
      bookingId: "seed-booking-demo-history-barcelona",
      flightId: "seed-flight-demo-history-barcelona",
      pirepId: "seed-pirep-demo-history-barcelona",
      scheduleId: "seed-vej215-daily",
      bookingStatus: BookingStatus.COMPLETED,
      bookedFor: addMinutes(now, -4_320),
      reservedAt: addMinutes(now, -4_390),
      expiresAt: null,
      notes:
        "Vol historique Barcelone vers Milan pour enrichir l'activité récente.",
      flightStatus: FlightStatus.COMPLETED,
      plannedOffBlockAt: addMinutes(now, -4_320),
      actualOffBlockAt: addMinutes(now, -4_312),
      actualTakeoffAt: addMinutes(now, -4_297),
      actualLandingAt: addMinutes(now, -4_234),
      actualOnBlockAt: addMinutes(now, -4_225),
      distanceFlownNm: 397,
      durationMinutes: 95,
      pirepStatus: PirepStatus.ACCEPTED,
      pirepSource: PirepSource.AUTO,
      fuelUsedKg: 2550,
      flightTimeMinutes: 78,
      landingRateFpm: -231,
      score: 90,
      pilotComment:
        "Vol dense mais régulier entre Barcelone et Milan, sans écart notable.",
      reviewerComment: "Validation staff automatique issue du seed.",
    },
    {
      bookingId: "seed-booking-demo-history-lisbon",
      flightId: "seed-flight-demo-history-lisbon",
      pirepId: "seed-pirep-demo-history-lisbon",
      scheduleId: "seed-vej331-daily",
      bookingStatus: BookingStatus.COMPLETED,
      bookedFor: addMinutes(now, -7_200),
      reservedAt: addMinutes(now, -7_260),
      expiresAt: null,
      notes:
        "Vol historique plus long pour crédibiliser le volume horaire du pilote.",
      flightStatus: FlightStatus.COMPLETED,
      plannedOffBlockAt: addMinutes(now, -7_200),
      actualOffBlockAt: addMinutes(now, -7_194),
      actualTakeoffAt: addMinutes(now, -7_178),
      actualLandingAt: addMinutes(now, -7_090),
      actualOnBlockAt: addMinutes(now, -7_078),
      distanceFlownNm: 779,
      durationMinutes: 122,
      pirepStatus: PirepStatus.ACCEPTED,
      pirepSource: PirepSource.AUTO,
      fuelUsedKg: 3180,
      flightTimeMinutes: 100,
      landingRateFpm: -176,
      score: 95,
      pilotComment:
        "Profil de descente propre et bloc maîtrisé sur l'approche de Paris.",
      reviewerComment: "Exécution solide, conforme aux critères de la VA.",
    },
    {
      bookingId: "seed-booking-demo-history-amsterdam",
      flightId: "seed-flight-demo-history-amsterdam",
      pirepId: "seed-pirep-demo-history-amsterdam",
      scheduleId: "seed-vej441-weekday",
      bookingStatus: BookingStatus.COMPLETED,
      bookedFor: addMinutes(now, -10_080),
      reservedAt: addMinutes(now, -10_140),
      expiresAt: null,
      notes:
        "Ligne business courte pour montrer une rotation rapide et un autre hub.",
      flightStatus: FlightStatus.COMPLETED,
      plannedOffBlockAt: addMinutes(now, -10_080),
      actualOffBlockAt: addMinutes(now, -10_074),
      actualTakeoffAt: addMinutes(now, -10_061),
      actualLandingAt: addMinutes(now, -10_012),
      actualOnBlockAt: addMinutes(now, -10_004),
      distanceFlownNm: 199,
      durationMinutes: 76,
      pirepStatus: PirepStatus.ACCEPTED,
      pirepSource: PirepSource.MANUAL,
      fuelUsedKg: 1640,
      flightTimeMinutes: 58,
      landingRateFpm: -210,
      score: 88,
      pilotComment:
        "PIREP manuel complété après une rotation courte et régulière vers Amsterdam.",
      reviewerComment: "Rapport validé après vérification rapide.",
    },
    {
      bookingId: "seed-booking-demo-history-nice",
      flightId: "seed-flight-demo-history-nice",
      pirepId: "seed-pirep-demo-history-nice",
      scheduleId: "seed-vej551-daily",
      bookingStatus: BookingStatus.COMPLETED,
      bookedFor: addMinutes(now, -12_960),
      reservedAt: addMinutes(now, -13_020),
      expiresAt: null,
      notes:
        "Rotation domestique loisirs pour donner du relief au réseau et au carnet de vol.",
      flightStatus: FlightStatus.COMPLETED,
      plannedOffBlockAt: addMinutes(now, -12_960),
      actualOffBlockAt: addMinutes(now, -12_954),
      actualTakeoffAt: addMinutes(now, -12_941),
      actualLandingAt: addMinutes(now, -12_884),
      actualOnBlockAt: addMinutes(now, -12_876),
      distanceFlownNm: 370,
      durationMinutes: 84,
      pirepStatus: PirepStatus.ACCEPTED,
      pirepSource: PirepSource.AUTO,
      fuelUsedKg: 2100,
      flightTimeMinutes: 66,
      landingRateFpm: -184,
      score: 91,
      pilotComment:
        "Secteur domestique sans incident, roulage final court à l'arrivée.",
      reviewerComment: "Vol proprement exécuté, validé pour la démonstration.",
    },
  ];

  for (const scenario of scenarios) {
    const schedule = scheduleById.get(scenario.scheduleId);

    if (!schedule?.aircraftId) {
      throw new Error(
        `The seeded schedule ${scenario.scheduleId} must have an assigned aircraft.`,
      );
    }

    await prisma.booking.upsert({
      where: { id: scenario.bookingId },
      update: {
        pilotProfileId: demoPilotProfile.id,
        scheduleId: schedule.id,
        routeId: schedule.routeId,
        aircraftId: schedule.aircraftId,
        departureAirportId: schedule.departureAirportId,
        arrivalAirportId: schedule.arrivalAirportId,
        reservedFlightNumber: schedule.callsign,
        bookedFor: scenario.bookedFor,
        status: scenario.bookingStatus,
        reservedAt: scenario.reservedAt,
        expiresAt: scenario.expiresAt ?? null,
        cancelledAt: null,
        notes: scenario.notes,
      },
      create: {
        id: scenario.bookingId,
        pilotProfileId: demoPilotProfile.id,
        scheduleId: schedule.id,
        routeId: schedule.routeId,
        aircraftId: schedule.aircraftId,
        departureAirportId: schedule.departureAirportId,
        arrivalAirportId: schedule.arrivalAirportId,
        reservedFlightNumber: schedule.callsign,
        bookedFor: scenario.bookedFor,
        status: scenario.bookingStatus,
        reservedAt: scenario.reservedAt,
        expiresAt: scenario.expiresAt ?? null,
        notes: scenario.notes,
      },
    });

    if (!scenario.flightId || !scenario.flightStatus) {
      continue;
    }

    await prisma.flight.upsert({
      where: { id: scenario.flightId },
      update: {
        bookingId: scenario.bookingId,
        pilotProfileId: demoPilotProfile.id,
        routeId: schedule.routeId,
        aircraftId: schedule.aircraftId,
        departureAirportId: schedule.departureAirportId,
        arrivalAirportId: schedule.arrivalAirportId,
        flightNumber: schedule.callsign,
        status: scenario.flightStatus,
        plannedOffBlockAt: scenario.plannedOffBlockAt ?? scenario.bookedFor,
        actualOffBlockAt: scenario.actualOffBlockAt ?? null,
        actualTakeoffAt: scenario.actualTakeoffAt ?? null,
        actualLandingAt: scenario.actualLandingAt ?? null,
        actualOnBlockAt: scenario.actualOnBlockAt ?? null,
        distanceFlownNm:
          scenario.distanceFlownNm ?? schedule.route.distanceNm ?? null,
        durationMinutes:
          scenario.durationMinutes ?? schedule.route.blockTimeMinutes ?? null,
      },
      create: {
        id: scenario.flightId,
        bookingId: scenario.bookingId,
        pilotProfileId: demoPilotProfile.id,
        routeId: schedule.routeId,
        aircraftId: schedule.aircraftId,
        departureAirportId: schedule.departureAirportId,
        arrivalAirportId: schedule.arrivalAirportId,
        flightNumber: schedule.callsign,
        status: scenario.flightStatus,
        plannedOffBlockAt: scenario.plannedOffBlockAt ?? scenario.bookedFor,
        actualOffBlockAt: scenario.actualOffBlockAt ?? null,
        actualTakeoffAt: scenario.actualTakeoffAt ?? null,
        actualLandingAt: scenario.actualLandingAt ?? null,
        actualOnBlockAt: scenario.actualOnBlockAt ?? null,
        distanceFlownNm:
          scenario.distanceFlownNm ?? schedule.route.distanceNm ?? null,
        durationMinutes:
          scenario.durationMinutes ?? schedule.route.blockTimeMinutes ?? null,
      },
    });

    if (!scenario.pirepId || !scenario.pirepStatus) {
      continue;
    }

    await prisma.pirep.upsert({
      where: { id: scenario.pirepId },
      update: {
        flightId: scenario.flightId,
        sessionId: null,
        pilotProfileId: demoPilotProfile.id,
        source: scenario.pirepSource ?? PirepSource.AUTO,
        status: scenario.pirepStatus,
        submittedAt: scenario.actualOnBlockAt ?? scenario.bookedFor,
        reviewedAt:
          scenario.pirepStatus === PirepStatus.ACCEPTED
            ? addMinutes(scenario.actualOnBlockAt ?? scenario.bookedFor, 35)
            : null,
        reviewedById:
          scenario.pirepStatus === PirepStatus.ACCEPTED ? admin.id : null,
        departureAirportId: schedule.departureAirportId,
        arrivalAirportId: schedule.arrivalAirportId,
        aircraftId: schedule.aircraftId,
        blockTimeMinutes:
          scenario.durationMinutes ?? schedule.route.blockTimeMinutes ?? null,
        flightTimeMinutes:
          scenario.flightTimeMinutes ??
          Math.max(
            0,
            (scenario.durationMinutes ?? schedule.route.blockTimeMinutes ?? 0) -
              18,
          ),
        fuelUsedKg: scenario.fuelUsedKg ?? null,
        landingRateFpm: scenario.landingRateFpm ?? null,
        score: scenario.score ?? null,
        summary: {
          origin: "seed",
          route: schedule.callsign,
          note: scenario.notes,
        },
        pilotComment: scenario.pilotComment ?? null,
        reviewerComment: scenario.reviewerComment ?? null,
      },
      create: {
        id: scenario.pirepId,
        flightId: scenario.flightId,
        sessionId: null,
        pilotProfileId: demoPilotProfile.id,
        source: scenario.pirepSource ?? PirepSource.AUTO,
        status: scenario.pirepStatus,
        submittedAt: scenario.actualOnBlockAt ?? scenario.bookedFor,
        reviewedAt:
          scenario.pirepStatus === PirepStatus.ACCEPTED
            ? addMinutes(scenario.actualOnBlockAt ?? scenario.bookedFor, 35)
            : null,
        reviewedById:
          scenario.pirepStatus === PirepStatus.ACCEPTED ? admin.id : null,
        departureAirportId: schedule.departureAirportId,
        arrivalAirportId: schedule.arrivalAirportId,
        aircraftId: schedule.aircraftId,
        blockTimeMinutes:
          scenario.durationMinutes ?? schedule.route.blockTimeMinutes ?? null,
        flightTimeMinutes:
          scenario.flightTimeMinutes ??
          Math.max(
            0,
            (scenario.durationMinutes ?? schedule.route.blockTimeMinutes ?? 0) -
              18,
          ),
        fuelUsedKg: scenario.fuelUsedKg ?? null,
        landingRateFpm: scenario.landingRateFpm ?? null,
        score: scenario.score ?? null,
        summary: {
          origin: "seed",
          route: schedule.callsign,
          note: scenario.notes,
        },
        pilotComment: scenario.pilotComment ?? null,
        reviewerComment: scenario.reviewerComment ?? null,
      },
    });
  }
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
        primaryHub: "LFPO",
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
    where: { slug: "virtual-easyjet-network-ready" },
    update: {
      title: "Le réseau Virtual Easyjet est prêt",
      excerpt:
        "Le seed charge désormais une flotte plus crédible, plusieurs hubs européens et un historique pilote complet.",
      content:
        "Cette actualité de démonstration accompagne la première itération publique de la plateforme Virtual Easyjet avec des données opérationnelles réalistes pour le site web, l'API et ACARS.",
      status: NewsPostStatus.PUBLISHED,
      publishedAt: new Date(),
      authorId: admin.id,
    },
    create: {
      slug: "virtual-easyjet-network-ready",
      title: "Le réseau Virtual Easyjet est prêt",
      excerpt:
        "Le seed charge désormais une flotte plus crédible, plusieurs hubs européens et un historique pilote complet.",
      content:
        "Cette actualité de démonstration accompagne la première itération publique de la plateforme Virtual Easyjet avec des données opérationnelles réalistes pour le site web, l'API et ACARS.",
      status: NewsPostStatus.PUBLISHED,
      publishedAt: new Date(),
      authorId: admin.id,
    },
  });
}

async function main(): Promise<void> {
  await seedRoles();
  await seedRanks();
  await seedAirportsAndHubs();
  await seedFleet();
  await seedRoutesAndSchedules();
  await seedAdminAndDemoPilot();
  await seedDemoOperations();
  await cleanupLegacySeedArtifacts();
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
