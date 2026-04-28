import { Dependencies, Injectable } from "@nestjs/common";
import { FlightPhase, Prisma, SessionStatus } from "@va/database";
import type { LiveMapAircraft, LiveMapPhase } from "@va/shared";

import { decimalToNumber } from "../../common/utils/decimal.utils.js";
import { PrismaService } from "../prisma/prisma.service.js";

const LIVE_PHASE_THRESHOLDS = {
  parkedSpeedKts: 5,
  pushbackSpeedKts: 15,
  airborneAltitudeFt: 1000,
} as const;

const HIDDEN_ACARS_STATUSES: SessionStatus[] = [
  SessionStatus.COMPLETED,
  SessionStatus.ABORTED,
];

const LIVE_SESSION_LOOKBACK_MS = 15 * 60 * 1000;

const liveSessionSelect = {
  status: true,
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
      aircraft: {
        select: {
          registration: true,
        },
      },
    },
  },
} satisfies Prisma.AcarsSessionSelect;

type LiveSessionRecord = Prisma.AcarsSessionGetPayload<{
  select: typeof liveSessionSelect;
}>;

@Injectable()
@Dependencies(PrismaService)
export class AcarsLiveService {
  public constructor(private readonly prisma: PrismaService) {}

  public async listLiveFlights(): Promise<LiveMapAircraft[]> {
    const staleThreshold = new Date(Date.now() - LIVE_SESSION_LOOKBACK_MS);
    const sessions = await this.prisma.acarsSession.findMany({
      where: {
        status: {
          notIn: HIDDEN_ACARS_STATUSES,
        },
        lastTelemetryAt: {
          gte: staleThreshold,
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

    console.info("[api] live map sessions returned count", {
      count: liveFlights.length,
      callsigns: liveFlights.map((flight) => flight.callsign),
      statuses: sessions.map((session) => session.status),
      phases: sessions.map((session) => session.detectedPhase),
    });

    return liveFlights;
  }

  private serializeSession(session: LiveSessionRecord): LiveMapAircraft {
    const altitude = Math.max(session.currentAltitudeFt ?? 0, 0);
    const speed = Math.max(session.currentGroundspeedKts ?? 0, 0);

    return {
      callsign: session.flight.flightNumber,
      flightNumber: session.flight.flightNumber,
      registration: session.flight.aircraft.registration,
      lat: decimalToNumber(session.currentLatitude) ?? 0,
      lon: decimalToNumber(session.currentLongitude) ?? 0,
      altitude,
      speed,
      heading: normalizeHeading(session.currentHeadingDeg),
      onGround: session.currentOnGround,
      phase: deriveLiveMapPhase(
        altitude,
        speed,
        session.detectedPhase,
        session.currentOnGround,
      ),
    };
  }
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

  if (altitudeFt > LIVE_PHASE_THRESHOLDS.airborneAltitudeFt) {
    return "AIRBORNE";
  }

  if (speedKts < LIVE_PHASE_THRESHOLDS.parkedSpeedKts) {
    return "PARKED";
  }

  return "TAXI";
}

