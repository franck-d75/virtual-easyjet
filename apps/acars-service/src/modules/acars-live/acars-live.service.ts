import { Dependencies, Injectable } from "@nestjs/common";
import { FlightPhase, Prisma, SessionStatus } from "@va/database";
import type { LiveMapAircraft, LiveMapPhase } from "@va/shared";

import { PrismaService } from "../prisma/prisma.service.js";

const ACTIVE_ACARS_STATUSES: SessionStatus[] = [
  SessionStatus.CONNECTED,
  SessionStatus.TRACKING,
];

const liveSessionSelect = {
  arrivalFuelKg: true,
  eventSummary: true,
  currentAltitudeFt: true,
  currentGroundspeedKts: true,
  currentHeadingDeg: true,
  currentLatitude: true,
  currentLongitude: true,
  currentOnGround: true,
  detectedPhase: true,
  flight: {
    select: {
      flightNumber: true,
    },
  },
} satisfies Prisma.AcarsSessionSelect;

type LiveSessionRecord = Prisma.AcarsSessionGetPayload<{
  select: typeof liveSessionSelect;
}>;

function readEventSummaryNumber(
  summary: Prisma.JsonValue | null,
  key: string,
): number | null {
  if (
    typeof summary !== "object" ||
    summary === null ||
    Array.isArray(summary)
  ) {
    return null;
  }

  const value = (summary as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

@Injectable()
@Dependencies(PrismaService)
export class AcarsLiveService {
  public constructor(private readonly prisma: PrismaService) {}

  public async listLiveFlights(): Promise<LiveMapAircraft[]> {
    const sessions = await this.prisma.acarsSession.findMany({
      where: {
        status: {
          in: ACTIVE_ACARS_STATUSES,
        },
        lastTelemetryAt: {
          not: null,
        },
        currentLatitude: {
          not: null,
        },
        currentLongitude: {
          not: null,
        },
      },
      orderBy: {
        lastTelemetryAt: "desc",
      },
      select: liveSessionSelect,
    });

    const liveFlights = sessions.map((session) => this.serializeSession(session));

    console.info("[acars] live map sessions returned count", {
      count: liveFlights.length,
      flights: liveFlights.map((flight) => ({
        callsign: flight.callsign,
        phase: flight.phase,
        altitudeFt: flight.altitude,
        speedKts: flight.speed,
        fuelTotalKg: flight.fuelTotalKg ?? null,
        passengersLive: flight.passengersLive ?? null,
      })),
    });

    return liveFlights;
  }

  private serializeSession(session: LiveSessionRecord): LiveMapAircraft {
    const altitude = Math.max(session.currentAltitudeFt ?? 0, 0);
    const speed = Math.max(session.currentGroundspeedKts ?? 0, 0);

    return {
      callsign: session.flight.flightNumber,
      lat: decimalToNumber(session.currentLatitude) ?? 0,
      lon: decimalToNumber(session.currentLongitude) ?? 0,
      altitude,
      speed,
      fuelTotalKg: decimalToNumber(session.arrivalFuelKg),
      passengersLive: readEventSummaryNumber(
        session.eventSummary,
        "livePassengerCount",
      ),
      heading: normalizeHeading(session.currentHeadingDeg),
      phase: deriveLiveMapPhase(
        altitude,
        speed,
        session.detectedPhase,
        session.currentOnGround,
      ),
    };
  }
}

function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numericValue = value.toNumber();
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeHeading(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0;
  }

  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function deriveLiveMapPhase(
  altitudeFt: number,
  speedKts: number,
  detectedPhase: FlightPhase,
  onGround: boolean | null,
): LiveMapPhase {
  if (detectedPhase === FlightPhase.PUSHBACK) {
    return "PUSHBACK";
  }

  if (
    detectedPhase === FlightPhase.PRE_FLIGHT ||
    detectedPhase === FlightPhase.DEPARTURE_PARKING ||
    detectedPhase === FlightPhase.ARRIVAL_PARKING ||
    detectedPhase === FlightPhase.COMPLETED
  ) {
    return "PARKED";
  }

  if (
    detectedPhase === FlightPhase.TAXI_OUT ||
    detectedPhase === FlightPhase.TAXI_IN
  ) {
    return "TAXI";
  }

  if (
    detectedPhase === FlightPhase.TAKEOFF ||
    detectedPhase === FlightPhase.CLIMB ||
    detectedPhase === FlightPhase.CRUISE ||
    detectedPhase === FlightPhase.DESCENT ||
    detectedPhase === FlightPhase.APPROACH ||
    detectedPhase === FlightPhase.LANDING
  ) {
    return "AIRBORNE";
  }

  if (onGround === false) {
    return "AIRBORNE";
  }

  if (onGround === true) {
    return speedKts <= 1 ? "PARKED" : "TAXI";
  }

  if (altitudeFt > 1000) {
    return "AIRBORNE";
  }

  if (speedKts < 5) {
    return "PARKED";
  }

  return "TAXI";
}
