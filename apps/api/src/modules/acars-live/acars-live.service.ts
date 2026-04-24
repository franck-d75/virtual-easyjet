import { Dependencies, Injectable } from "@nestjs/common";
import {
  FlightPhase,
  FlightStatus,
  Prisma,
  SessionStatus,
} from "@va/database";
import type { LiveMapAircraft, LiveMapPhase } from "@va/shared";

import { decimalToNumber } from "../../common/utils/decimal.utils.js";
import { PrismaService } from "../prisma/prisma.service.js";

const LIVE_PHASE_THRESHOLDS = {
  parkedSpeedKts: 5,
  pushbackSpeedKts: 15,
  airborneAltitudeFt: 1000,
} as const;

const ACTIVE_ACARS_STATUSES: SessionStatus[] = [
  SessionStatus.CONNECTED,
  SessionStatus.TRACKING,
];

const liveSessionSelect = {
  currentAltitudeFt: true,
  currentGroundspeedKts: true,
  currentHeadingDeg: true,
  currentLatitude: true,
  currentLongitude: true,
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
        flight: {
          is: {
            status: FlightStatus.IN_PROGRESS,
          },
        },
      },
      orderBy: {
        lastTelemetryAt: "desc",
      },
      select: liveSessionSelect,
    });

    return sessions.map((session) => this.serializeSession(session));
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
      heading: normalizeHeading(session.currentHeadingDeg),
      phase: deriveLiveMapPhase(altitude, speed, session.detectedPhase),
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
): LiveMapPhase {
  if (altitudeFt > LIVE_PHASE_THRESHOLDS.airborneAltitudeFt) {
    return "AIRBORNE";
  }

  if (altitudeFt > 0) {
    return "AIRBORNE";
  }

  if (speedKts < LIVE_PHASE_THRESHOLDS.parkedSpeedKts) {
    return "PARKED";
  }

  if (speedKts <= LIVE_PHASE_THRESHOLDS.pushbackSpeedKts) {
    return "PUSHBACK";
  }

  if (detectedPhase === "DEPARTURE_PARKING" || detectedPhase === "ARRIVAL_PARKING") {
    return "PARKED";
  }

  return "TAXI";
}
