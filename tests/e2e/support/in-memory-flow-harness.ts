import {
  AircraftStatus,
  BookingStatus,
  FlightPhase,
  FlightStatus,
  PilotStatus,
  PirepStatus,
  PirepSource,
  SessionStatus,
  UserStatus,
} from "@va/database";
import type { AuthenticatedUser } from "@va/shared";

import { BookingsService } from "../../../apps/api/src/modules/bookings/bookings.service.js";
import { FlightsService } from "../../../apps/api/src/modules/flights/flights.service.js";
import { AcarsSessionsService } from "../../../apps/acars-service/src/modules/acars-sessions/acars-sessions.service.js";

type UserRecord = {
  id: string;
  email: string;
  username: string;
  status: UserStatus;
};

type RankRecord = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  minFlights: number;
  minHoursMinutes: number;
  minScore: number;
  description: string | null;
  isActive: boolean;
};

type AirportRecord = {
  id: string;
  icao: string;
  iata: string | null;
  name: string;
  city: string | null;
  countryCode: string;
  latitude: number;
  longitude: number;
  elevationFt: number | null;
  isActive: boolean;
};

type HubRecord = {
  id: string;
  code: string;
  name: string;
  airportId: string;
  isActive: boolean;
};

type PilotProfileRecord = {
  id: string;
  userId: string;
  pilotNumber: string;
  callsign: string | null;
  firstName: string;
  lastName: string;
  countryCode: string | null;
  hubId: string | null;
  rankId: string | null;
  status: PilotStatus;
  experiencePoints: number;
  hoursFlownMinutes: number;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type AircraftTypeRecord = {
  id: string;
  icaoCode: string;
  name: string;
  manufacturer: string | null;
  category: string | null;
  minRankId: string | null;
  cruiseSpeedKts: number | null;
  isActive: boolean;
};

type AircraftRecord = {
  id: string;
  registration: string;
  label: string | null;
  aircraftTypeId: string;
  hubId: string | null;
  status: AircraftStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type RouteRecord = {
  id: string;
  code: string;
  flightNumber: string;
  departureAirportId: string;
  arrivalAirportId: string;
  departureHubId: string | null;
  arrivalHubId: string | null;
  aircraftTypeId: string | null;
  distanceNm: number | null;
  blockTimeMinutes: number | null;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ScheduleRecord = {
  id: string;
  routeId: string;
  aircraftId: string | null;
  departureAirportId: string;
  arrivalAirportId: string;
  callsign: string;
  daysOfWeek: number[];
  departureTimeUtc: string;
  arrivalTimeUtc: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type BookingRecord = {
  id: string;
  pilotProfileId: string;
  scheduleId: string | null;
  routeId: string | null;
  aircraftId: string;
  departureAirportId: string;
  arrivalAirportId: string;
  reservedFlightNumber: string;
  bookedFor: Date;
  status: BookingStatus;
  reservedAt: Date;
  expiresAt: Date | null;
  cancelledAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type FlightRecord = {
  id: string;
  bookingId: string;
  pilotProfileId: string;
  routeId: string | null;
  aircraftId: string;
  departureAirportId: string;
  arrivalAirportId: string;
  flightNumber: string;
  status: FlightStatus;
  plannedOffBlockAt: Date | null;
  actualOffBlockAt: Date | null;
  actualTakeoffAt: Date | null;
  actualLandingAt: Date | null;
  actualOnBlockAt: Date | null;
  distanceFlownNm: number | null;
  durationMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type AcarsSessionRecord = {
  id: string;
  flightId: string;
  simulatorProvider: string;
  clientVersion: string | null;
  status: SessionStatus;
  startedAt: Date | null;
  endedAt: Date | null;
  disconnectedAt: Date | null;
  resumeToken: string | null;
  connectCount: number;
  lastTelemetryAt: Date | null;
  lastHeartbeatAt: Date | null;
  detectedPhase: FlightPhase;
  currentLatitude: number | null;
  currentLongitude: number | null;
  currentAltitudeFt: number | null;
  currentGroundspeedKts: number | null;
  currentHeadingDeg: number | null;
  currentVerticalSpeedFpm: number | null;
  currentOnGround: boolean | null;
  departureFuelKg: number | null;
  arrivalFuelKg: number | null;
  eventSummary: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

type TelemetryPointRecord = {
  id: bigint;
  sessionId: string;
  capturedAt: Date;
  latitude: number;
  longitude: number;
  altitudeFt: number;
  groundspeedKts: number;
  headingDeg: number;
  verticalSpeedFpm: number;
  onGround: boolean;
  fuelTotalKg: number | null;
  gearPercent: number | null;
  flapsPercent: number | null;
  parkingBrake: boolean | null;
  createdAt: Date;
};

type FlightEventRecord = {
  id: bigint;
  sessionId: string;
  flightId: string;
  type: string;
  phase?: FlightPhase | null;
  severity: string;
  code?: string | null;
  title: string;
  message?: string | null;
  payload?: Record<string, unknown> | null;
  occurredAt: Date;
  createdAt: Date;
};

type PirepRecord = {
  id: string;
  flightId: string;
  sessionId: string | null;
  pilotProfileId: string;
  source: PirepSource;
  status: PirepStatus;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewedById: string | null;
  departureAirportId: string;
  arrivalAirportId: string;
  aircraftId: string;
  blockTimeMinutes: number | null;
  flightTimeMinutes: number | null;
  fuelUsedKg: number | null;
  landingRateFpm: number | null;
  score: number | null;
  summary: Record<string, unknown> | null;
  pilotComment: string | null;
  reviewerComment: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function unimplementedAsync<TArgs extends unknown[], TResult>(
  name: string,
): (...args: TArgs) => Promise<TResult> {
  return async (..._args: TArgs) => {
    throw new Error(`${name} was called before the in-memory harness was initialized.`);
  };
}

class InMemoryPrismaClient {
  public readonly store: {
    users: UserRecord[];
    ranks: RankRecord[];
    airports: AirportRecord[];
    hubs: HubRecord[];
    pilotProfiles: PilotProfileRecord[];
    aircraftTypes: AircraftTypeRecord[];
    aircraft: AircraftRecord[];
    routes: RouteRecord[];
    schedules: ScheduleRecord[];
    bookings: BookingRecord[];
    flights: FlightRecord[];
    acarsSessions: AcarsSessionRecord[];
    telemetryPoints: TelemetryPointRecord[];
    flightEvents: FlightEventRecord[];
    pireps: PirepRecord[];
  };

  private bookingSequence = 0;
  private flightSequence = 0;
  private sessionSequence = 0;
  private pirepSequence = 0;
  private telemetrySequence = 0n;
  private eventSequence = 0n;

  public constructor() {
    const now = new Date("2030-01-01T00:00:00.000Z");

    this.store = {
      users: [
        {
          id: "user-pilot-1",
          email: "pilot@va.local",
          username: "pilotdemo",
          status: UserStatus.ACTIVE,
        },
      ],
      ranks: [
        {
          id: "rank-cadet",
          code: "CADET",
          name: "Cadet",
          sortOrder: 10,
          minFlights: 0,
          minHoursMinutes: 0,
          minScore: 0,
          description: "Entry rank",
          isActive: true,
        },
      ],
      airports: [
        {
          id: "airport-lfpg",
          icao: "LFPG",
          iata: "CDG",
          name: "Paris Charles de Gaulle",
          city: "Paris",
          countryCode: "FR",
          latitude: 49.0097,
          longitude: 2.5479,
          elevationFt: 392,
          isActive: true,
        },
        {
          id: "airport-egll",
          icao: "EGLL",
          iata: "LHR",
          name: "London Heathrow",
          city: "London",
          countryCode: "GB",
          latitude: 51.47,
          longitude: -0.4543,
          elevationFt: 83,
          isActive: true,
        },
      ],
      hubs: [
        {
          id: "hub-par",
          code: "PAR",
          name: "Paris Hub",
          airportId: "airport-lfpg",
          isActive: true,
        },
      ],
      pilotProfiles: [
        {
          id: "pilot-profile-1",
          userId: "user-pilot-1",
          pilotNumber: "VA00001",
          callsign: null,
          firstName: "Demo",
          lastName: "Pilot",
          countryCode: "FR",
          hubId: "hub-par",
          rankId: "rank-cadet",
          status: PilotStatus.ACTIVE,
          experiencePoints: 0,
          hoursFlownMinutes: 0,
          joinedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      ],
      aircraftTypes: [
        {
          id: "aircraft-type-a20n",
          icaoCode: "A20N",
          name: "Airbus A320neo",
          manufacturer: "Airbus",
          category: "Airliner",
          minRankId: null,
          cruiseSpeedKts: 450,
          isActive: true,
        },
      ],
      aircraft: [
        {
          id: "aircraft-1",
          registration: "F-HVAA",
          label: "A320neo Paris 01",
          aircraftTypeId: "aircraft-type-a20n",
          hubId: "hub-par",
          status: AircraftStatus.ACTIVE,
          notes: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
      routes: [
        {
          id: "route-afr100",
          code: "AFR100",
          flightNumber: "AFR100",
          departureAirportId: "airport-lfpg",
          arrivalAirportId: "airport-egll",
          departureHubId: "hub-par",
          arrivalHubId: null,
          aircraftTypeId: "aircraft-type-a20n",
          distanceNm: 188,
          blockTimeMinutes: 80,
          isActive: true,
          notes: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
      schedules: [
        {
          id: "schedule-afr100-daily",
          routeId: "route-afr100",
          aircraftId: "aircraft-1",
          departureAirportId: "airport-lfpg",
          arrivalAirportId: "airport-egll",
          callsign: "AFR100",
          daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
          departureTimeUtc: "08:00",
          arrivalTimeUtc: "09:20",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      bookings: [],
      flights: [],
      acarsSessions: [],
      telemetryPoints: [],
      flightEvents: [],
      pireps: [],
    };

    this.setupMethods();
  }

  public readonly $transaction = async <T>(
    callback: (transaction: InMemoryPrismaClient) => Promise<T>,
  ): Promise<T> => callback(this);

  public readonly pilotProfile = {
    findUnique: unimplementedAsync<any[], any>("pilotProfile.findUnique"),
  };

  public readonly schedule = {
    findUnique: unimplementedAsync<any[], any>("schedule.findUnique"),
  };

  public readonly booking = {
    create: unimplementedAsync<any[], any>("booking.create"),
    findUnique: unimplementedAsync<any[], any>("booking.findUnique"),
    findUniqueOrThrow: unimplementedAsync<any[], any>(
      "booking.findUniqueOrThrow",
    ),
    update: unimplementedAsync<any[], any>("booking.update"),
  };

  public readonly flight = {
    create: unimplementedAsync<any[], any>("flight.create"),
    findUnique: unimplementedAsync<any[], any>("flight.findUnique"),
    findUniqueOrThrow: unimplementedAsync<any[], any>(
      "flight.findUniqueOrThrow",
    ),
    update: unimplementedAsync<any[], any>("flight.update"),
  };

  public readonly acarsSession = {
    create: unimplementedAsync<any[], any>("acarsSession.create"),
    findUnique: unimplementedAsync<any[], any>("acarsSession.findUnique"),
    findUniqueOrThrow: unimplementedAsync<any[], any>(
      "acarsSession.findUniqueOrThrow",
    ),
    update: unimplementedAsync<any[], any>("acarsSession.update"),
  };

  public readonly telemetryPoint = {
    create: unimplementedAsync<any[], any>("telemetryPoint.create"),
    count: unimplementedAsync<any[], any>("telemetryPoint.count"),
  };

  public readonly flightEvent = {
    create: unimplementedAsync<any[], any>("flightEvent.create"),
    createMany: unimplementedAsync<any[], any>("flightEvent.createMany"),
  };

  public readonly pirep = {
    upsert: unimplementedAsync<any[], any>("pirep.upsert"),
  };

  private setupMethods(): void {
    this.pilotProfile.findUnique = async ({
      where,
    }: {
      where: { id: string };
    }) => {
      const profile = this.store.pilotProfiles.find((item) => item.id === where.id);
      return profile ? this.buildPilotProfile(profile) : null;
    };

    this.schedule.findUnique = async ({
      where,
    }: {
      where: { id: string };
    }) => {
      const schedule = this.store.schedules.find((item) => item.id === where.id);
      return schedule ? this.buildSchedule(schedule) : null;
    };

    this.booking.create = async ({ data }: { data: Record<string, unknown> }) => {
      const now = new Date();
      const booking: BookingRecord = {
        id: `booking-${++this.bookingSequence}`,
        pilotProfileId: data.pilotProfileId as string,
        scheduleId: (data.scheduleId as string | null | undefined) ?? null,
        routeId: (data.routeId as string | null | undefined) ?? null,
        aircraftId: data.aircraftId as string,
        departureAirportId: data.departureAirportId as string,
        arrivalAirportId: data.arrivalAirportId as string,
        reservedFlightNumber: data.reservedFlightNumber as string,
        bookedFor: data.bookedFor as Date,
        status: (data.status as BookingStatus) ?? BookingStatus.RESERVED,
        reservedAt: now,
        expiresAt: (data.expiresAt as Date | null | undefined) ?? null,
        cancelledAt: (data.cancelledAt as Date | null | undefined) ?? null,
        notes: (data.notes as string | null | undefined) ?? null,
        createdAt: now,
        updatedAt: now,
      };

      this.store.bookings.push(booking);
      return this.buildBooking(booking);
    };

    this.booking.findUnique = async ({
      where,
    }: {
      where: { id: string };
    }) => {
      const booking = this.store.bookings.find((item) => item.id === where.id);
      return booking ? this.buildBooking(booking) : null;
    };

    this.booking.findUniqueOrThrow = async ({
      where,
    }: {
      where: { id: string };
    }) => {
      const booking = await this.booking.findUnique({ where });

      if (!booking) {
        throw new Error("Booking not found.");
      }

      return booking;
    };

    this.booking.update = async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const booking = this.store.bookings.find((item) => item.id === where.id);

      if (!booking) {
        throw new Error("Booking not found.");
      }

      Object.assign(booking, data, {
        updatedAt: new Date(),
      });

      return this.buildBooking(booking);
    };

    this.flight.create = async ({ data }: { data: Record<string, unknown> }) => {
      const now = new Date();
      const flight: FlightRecord = {
        id: `flight-${++this.flightSequence}`,
        bookingId: data.bookingId as string,
        pilotProfileId: data.pilotProfileId as string,
        routeId: (data.routeId as string | null | undefined) ?? null,
        aircraftId: data.aircraftId as string,
        departureAirportId: data.departureAirportId as string,
        arrivalAirportId: data.arrivalAirportId as string,
        flightNumber: data.flightNumber as string,
        status: (data.status as FlightStatus) ?? FlightStatus.PLANNED,
        plannedOffBlockAt:
          (data.plannedOffBlockAt as Date | null | undefined) ?? null,
        actualOffBlockAt:
          (data.actualOffBlockAt as Date | null | undefined) ?? null,
        actualTakeoffAt:
          (data.actualTakeoffAt as Date | null | undefined) ?? null,
        actualLandingAt:
          (data.actualLandingAt as Date | null | undefined) ?? null,
        actualOnBlockAt:
          (data.actualOnBlockAt as Date | null | undefined) ?? null,
        distanceFlownNm:
          (data.distanceFlownNm as number | null | undefined) ?? null,
        durationMinutes:
          (data.durationMinutes as number | null | undefined) ?? null,
        createdAt: now,
        updatedAt: now,
      };

      this.store.flights.push(flight);
      return this.buildFlight(flight);
    };

    this.flight.findUnique = async ({
      where,
    }: {
      where: { id: string };
    }) => {
      const flight = this.store.flights.find((item) => item.id === where.id);
      return flight ? this.buildFlight(flight) : null;
    };

    this.flight.findUniqueOrThrow = async ({
      where,
    }: {
      where: { id: string };
    }) => {
      const flight = await this.flight.findUnique({ where });

      if (!flight) {
        throw new Error("Flight not found.");
      }

      return flight;
    };

    this.flight.update = async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const flight = this.store.flights.find((item) => item.id === where.id);

      if (!flight) {
        throw new Error("Flight not found.");
      }

      Object.assign(flight, data, {
        updatedAt: new Date(),
      });

      return this.buildFlight(flight);
    };

    this.acarsSession.create = async ({
      data,
    }: {
      data: Record<string, unknown>;
    }) => {
      const now = new Date();
      const session: AcarsSessionRecord = {
        id: `session-${++this.sessionSequence}`,
        flightId: data.flightId as string,
        simulatorProvider: (data.simulatorProvider as string) ?? "MSFS",
        clientVersion: (data.clientVersion as string | null | undefined) ?? null,
        status: (data.status as SessionStatus) ?? SessionStatus.CREATED,
        startedAt: (data.startedAt as Date | null | undefined) ?? null,
        endedAt: (data.endedAt as Date | null | undefined) ?? null,
        disconnectedAt:
          (data.disconnectedAt as Date | null | undefined) ?? null,
        resumeToken: (data.resumeToken as string | null | undefined) ?? null,
        connectCount: (data.connectCount as number | undefined) ?? 0,
        lastTelemetryAt:
          (data.lastTelemetryAt as Date | null | undefined) ?? null,
        lastHeartbeatAt:
          (data.lastHeartbeatAt as Date | null | undefined) ?? null,
        detectedPhase:
          (data.detectedPhase as FlightPhase | undefined) ?? FlightPhase.PRE_FLIGHT,
        currentLatitude:
          (data.currentLatitude as number | null | undefined) ?? null,
        currentLongitude:
          (data.currentLongitude as number | null | undefined) ?? null,
        currentAltitudeFt:
          (data.currentAltitudeFt as number | null | undefined) ?? null,
        currentGroundspeedKts:
          (data.currentGroundspeedKts as number | null | undefined) ?? null,
        currentHeadingDeg:
          (data.currentHeadingDeg as number | null | undefined) ?? null,
        currentVerticalSpeedFpm:
          (data.currentVerticalSpeedFpm as number | null | undefined) ?? null,
        currentOnGround:
          (data.currentOnGround as boolean | null | undefined) ?? null,
        departureFuelKg:
          (data.departureFuelKg as number | null | undefined) ?? null,
        arrivalFuelKg:
          (data.arrivalFuelKg as number | null | undefined) ?? null,
        eventSummary:
          (data.eventSummary as Record<string, unknown> | null | undefined) ?? null,
        createdAt: now,
        updatedAt: now,
      };

      this.store.acarsSessions.push(session);
      return this.buildSession(session);
    };

    this.acarsSession.findUnique = async ({
      where,
    }: {
      where: { id?: string; flightId?: string };
    }) => {
      const session = this.store.acarsSessions.find((item) => {
        if (where.id) {
          return item.id === where.id;
        }

        if (where.flightId) {
          return item.flightId === where.flightId;
        }

        return false;
      });

      return session ? this.buildSession(session) : null;
    };

    this.acarsSession.findUniqueOrThrow = async ({
      where,
    }: {
      where: { id?: string; flightId?: string };
    }) => {
      const session = await this.acarsSession.findUnique({ where });

      if (!session) {
        throw new Error("Session not found.");
      }

      return session;
    };

    this.acarsSession.update = async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const session = this.store.acarsSessions.find((item) => item.id === where.id);

      if (!session) {
        throw new Error("Session not found.");
      }

      Object.assign(session, data, {
        updatedAt: new Date(),
      });

      return this.buildSession(session);
    };

    this.telemetryPoint.create = async ({
      data,
    }: {
      data: Record<string, unknown>;
    }) => {
      const telemetryPoint: TelemetryPointRecord = {
        id: ++this.telemetrySequence,
        sessionId: data.sessionId as string,
        capturedAt: data.capturedAt as Date,
        latitude: data.latitude as number,
        longitude: data.longitude as number,
        altitudeFt: data.altitudeFt as number,
        groundspeedKts: data.groundspeedKts as number,
        headingDeg: data.headingDeg as number,
        verticalSpeedFpm: data.verticalSpeedFpm as number,
        onGround: data.onGround as boolean,
        fuelTotalKg: (data.fuelTotalKg as number | null | undefined) ?? null,
        gearPercent: (data.gearPercent as number | null | undefined) ?? null,
        flapsPercent: (data.flapsPercent as number | null | undefined) ?? null,
        parkingBrake: (data.parkingBrake as boolean | null | undefined) ?? null,
        createdAt: new Date(),
      };

      this.store.telemetryPoints.push(telemetryPoint);
      return telemetryPoint;
    };

    this.telemetryPoint.count = async ({
      where,
    }: {
      where: { sessionId: string };
    }) =>
      this.store.telemetryPoints.filter((item) => item.sessionId === where.sessionId)
        .length;

    this.flightEvent.create = async ({
      data,
    }: {
      data: Record<string, unknown>;
    }) => {
      const event: FlightEventRecord = {
        id: ++this.eventSequence,
        sessionId: data.sessionId as string,
        flightId: data.flightId as string,
        type: data.type as string,
        phase: (data.phase as FlightPhase | null | undefined) ?? null,
        severity: data.severity as string,
        code: (data.code as string | null | undefined) ?? null,
        title: data.title as string,
        message: (data.message as string | null | undefined) ?? null,
        payload: (data.payload as Record<string, unknown> | null | undefined) ?? null,
        occurredAt: data.occurredAt as Date,
        createdAt: new Date(),
      };

      this.store.flightEvents.push(event);
      return event;
    };

    this.flightEvent.createMany = async ({
      data,
    }: {
      data: Record<string, unknown>[];
    }) => {
      for (const item of data) {
        await this.flightEvent.create({ data: item });
      }

      return { count: data.length };
    };

    this.pirep.upsert = async ({
      where,
      update,
      create,
    }: {
      where: { flightId: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }) => {
      const existingPirep = this.store.pireps.find(
        (item) => item.flightId === where.flightId,
      );

      if (existingPirep) {
        Object.assign(existingPirep, update, {
          updatedAt: new Date(),
        });
        return existingPirep;
      }

      const now = new Date();
      const pirep: PirepRecord = {
        id: `pirep-${++this.pirepSequence}`,
        flightId: create.flightId as string,
        sessionId: (create.sessionId as string | null | undefined) ?? null,
        pilotProfileId: create.pilotProfileId as string,
        source: create.source as PirepSource,
        status: create.status as PirepStatus,
        submittedAt: (create.submittedAt as Date | null | undefined) ?? null,
        reviewedAt: null,
        reviewedById: null,
        departureAirportId: create.departureAirportId as string,
        arrivalAirportId: create.arrivalAirportId as string,
        aircraftId: create.aircraftId as string,
        blockTimeMinutes:
          (create.blockTimeMinutes as number | null | undefined) ?? null,
        flightTimeMinutes:
          (create.flightTimeMinutes as number | null | undefined) ?? null,
        fuelUsedKg: (create.fuelUsedKg as number | null | undefined) ?? null,
        landingRateFpm: null,
        score: null,
        summary:
          (create.summary as Record<string, unknown> | null | undefined) ?? null,
        pilotComment:
          (create.pilotComment as string | null | undefined) ?? null,
        reviewerComment: null,
        createdAt: now,
        updatedAt: now,
      };

      this.store.pireps.push(pirep);
      return pirep;
    };
  }

  private buildPilotProfile(profile: PilotProfileRecord) {
    return {
      ...profile,
      user: this.requireUser(profile.userId),
      hub: profile.hubId ? this.requireHub(profile.hubId) : null,
      rank: profile.rankId ? this.requireRank(profile.rankId) : null,
    };
  }

  private buildAircraftType(aircraftType: AircraftTypeRecord) {
    return {
      ...aircraftType,
      minRank: aircraftType.minRankId
        ? this.requireRank(aircraftType.minRankId)
        : null,
    };
  }

  private buildAircraft(aircraft: AircraftRecord) {
    return {
      ...aircraft,
      aircraftType: this.buildAircraftType(
        this.requireAircraftType(aircraft.aircraftTypeId),
      ),
      hub: aircraft.hubId ? this.requireHub(aircraft.hubId) : null,
    };
  }

  private buildRoute(route: RouteRecord) {
    return {
      ...route,
      departureAirport: this.requireAirport(route.departureAirportId),
      arrivalAirport: this.requireAirport(route.arrivalAirportId),
      departureHub: route.departureHubId ? this.requireHub(route.departureHubId) : null,
      arrivalHub: route.arrivalHubId ? this.requireHub(route.arrivalHubId) : null,
      aircraftType: route.aircraftTypeId
        ? this.buildAircraftType(this.requireAircraftType(route.aircraftTypeId))
        : null,
    };
  }

  private buildSchedule(schedule: ScheduleRecord) {
    return {
      ...schedule,
      route: this.buildRoute(this.requireRoute(schedule.routeId)),
      aircraft: schedule.aircraftId
        ? this.buildAircraft(this.requireAircraft(schedule.aircraftId))
        : null,
    };
  }

  private buildBooking(booking: BookingRecord) {
    const flight = this.store.flights.find((item) => item.bookingId === booking.id);

    return {
      ...booking,
      pilotProfile: this.buildPilotProfile(
        this.requirePilotProfile(booking.pilotProfileId),
      ),
      schedule: booking.scheduleId
        ? this.requireSchedule(booking.scheduleId)
        : null,
      route: booking.routeId ? this.buildRoute(this.requireRoute(booking.routeId)) : null,
      aircraft: this.buildAircraft(this.requireAircraft(booking.aircraftId)),
      departureAirport: this.requireAirport(booking.departureAirportId),
      arrivalAirport: this.requireAirport(booking.arrivalAirportId),
      flight: flight ? { ...flight } : null,
    };
  }

  private buildFlight(flight: FlightRecord) {
    const session = this.store.acarsSessions.find((item) => item.flightId === flight.id);
    const pirep = this.store.pireps.find((item) => item.flightId === flight.id) ?? null;

    return {
      ...flight,
      booking: this.requireBooking(flight.bookingId),
      pilotProfile: this.buildPilotProfile(
        this.requirePilotProfile(flight.pilotProfileId),
      ),
      route: flight.routeId ? this.buildRoute(this.requireRoute(flight.routeId)) : null,
      aircraft: this.buildAircraft(this.requireAircraft(flight.aircraftId)),
      departureAirport: this.requireAirport(flight.departureAirportId),
      arrivalAirport: this.requireAirport(flight.arrivalAirportId),
      acarsSession: session ? { ...session } : null,
      pirep,
    };
  }

  private buildSession(session: AcarsSessionRecord) {
    const flight = this.requireFlight(session.flightId);
    const latestTelemetry = this.store.telemetryPoints
      .filter((item) => item.sessionId === session.id)
      .sort((left, right) => right.capturedAt.getTime() - left.capturedAt.getTime())
      .slice(0, 1);

    return {
      ...session,
      flight: {
        ...flight,
        booking: this.requireBooking(flight.bookingId),
        pilotProfile: this.requirePilotProfile(flight.pilotProfileId),
        departureAirport: this.requireAirport(flight.departureAirportId),
        arrivalAirport: this.requireAirport(flight.arrivalAirportId),
        aircraft: this.buildAircraft(this.requireAircraft(flight.aircraftId)),
      },
      pirep: this.store.pireps.find((item) => item.flightId === session.flightId) ?? null,
      telemetryPoints: latestTelemetry,
    };
  }

  private requireUser(id: string): UserRecord {
    const user = this.store.users.find((item) => item.id === id);

    if (!user) {
      throw new Error(`User ${id} not found.`);
    }

    return user;
  }

  private requireRank(id: string): RankRecord {
    const rank = this.store.ranks.find((item) => item.id === id);

    if (!rank) {
      throw new Error(`Rank ${id} not found.`);
    }

    return rank;
  }

  private requireAirport(id: string): AirportRecord {
    const airport = this.store.airports.find((item) => item.id === id);

    if (!airport) {
      throw new Error(`Airport ${id} not found.`);
    }

    return airport;
  }

  private requireHub(id: string): HubRecord {
    const hub = this.store.hubs.find((item) => item.id === id);

    if (!hub) {
      throw new Error(`Hub ${id} not found.`);
    }

    return hub;
  }

  private requirePilotProfile(id: string): PilotProfileRecord {
    const profile = this.store.pilotProfiles.find((item) => item.id === id);

    if (!profile) {
      throw new Error(`Pilot profile ${id} not found.`);
    }

    return profile;
  }

  private requireAircraftType(id: string): AircraftTypeRecord {
    const aircraftType = this.store.aircraftTypes.find((item) => item.id === id);

    if (!aircraftType) {
      throw new Error(`Aircraft type ${id} not found.`);
    }

    return aircraftType;
  }

  private requireAircraft(id: string): AircraftRecord {
    const aircraft = this.store.aircraft.find((item) => item.id === id);

    if (!aircraft) {
      throw new Error(`Aircraft ${id} not found.`);
    }

    return aircraft;
  }

  private requireRoute(id: string): RouteRecord {
    const route = this.store.routes.find((item) => item.id === id);

    if (!route) {
      throw new Error(`Route ${id} not found.`);
    }

    return route;
  }

  private requireSchedule(id: string): ScheduleRecord {
    const schedule = this.store.schedules.find((item) => item.id === id);

    if (!schedule) {
      throw new Error(`Schedule ${id} not found.`);
    }

    return schedule;
  }

  private requireBooking(id: string): BookingRecord {
    const booking = this.store.bookings.find((item) => item.id === id);

    if (!booking) {
      throw new Error(`Booking ${id} not found.`);
    }

    return booking;
  }

  private requireFlight(id: string): FlightRecord {
    const flight = this.store.flights.find((item) => item.id === id);

    if (!flight) {
      throw new Error(`Flight ${id} not found.`);
    }

    return flight;
  }
}

export function createFlowHarness() {
  const prisma = new InMemoryPrismaClient();

  const user: AuthenticatedUser = {
    id: "user-pilot-1",
    email: "pilot@va.local",
    username: "pilotdemo",
    roles: ["pilot"],
    pilotProfileId: "pilot-profile-1",
  };

  return {
    prisma,
    user,
    bookingsService: new BookingsService(prisma as never),
    flightsService: new FlightsService(prisma as never),
    acarsSessionsService: new AcarsSessionsService(prisma as never),
  };
}
