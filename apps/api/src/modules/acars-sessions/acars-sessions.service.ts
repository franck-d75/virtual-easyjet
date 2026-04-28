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
  EventSeverity,
  FlightEventType,
  FlightPhase,
  FlightStatus,
  PirepSource,
  PirepStatus,
  Prisma,
  SessionStatus,
} from "@va/database";
import type { AuthenticatedUser } from "@va/shared";
import { randomUUID } from "node:crypto";

import { decimalToNumber } from "../../common/utils/decimal.utils.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CompleteSessionDto } from "./dto/complete-session.dto.js";
import type { CreateSessionDto } from "./dto/create-session.dto.js";
import type { IngestTelemetryDto } from "./dto/ingest-telemetry.dto.js";
import {
  detectFlightPhase,
  formatFlightPhaseLabel,
} from "./phase-detector.js";

const sessionInclude = {
  flight: {
    include: {
      booking: true,
      pilotProfile: true,
      departureAirport: true,
      arrivalAirport: true,
      aircraft: {
        include: {
          aircraftType: true,
        },
      },
    },
  },
  pirep: true,
  telemetryPoints: {
    orderBy: {
      capturedAt: "desc",
    },
    take: 1,
  },
} satisfies Prisma.AcarsSessionInclude;

type SessionRecord = Prisma.AcarsSessionGetPayload<{
  include: typeof sessionInclude;
}>;

const OFF_BLOCK_PHASES: FlightPhase[] = [
  FlightPhase.PUSHBACK,
  FlightPhase.TAXI_OUT,
  FlightPhase.TAKEOFF,
  FlightPhase.CLIMB,
  FlightPhase.CRUISE,
  FlightPhase.DESCENT,
  FlightPhase.APPROACH,
  FlightPhase.LANDING,
  FlightPhase.TAXI_IN,
  FlightPhase.ARRIVAL_PARKING,
];

const TAKEOFF_PHASES: FlightPhase[] = [
  FlightPhase.TAKEOFF,
  FlightPhase.CLIMB,
  FlightPhase.CRUISE,
];

@Injectable()
@Dependencies(PrismaService)
export class AcarsSessionsService {
  public constructor(private readonly prisma: PrismaService) {}

  public async createSession(
    user: AuthenticatedUser,
    payload: CreateSessionDto,
  ) {
    const pilotProfileId = this.getRequiredPilotProfileId(user);

    try {
      const session = await this.prisma.$transaction(async (transaction) => {
        const flight = await transaction.flight.findUnique({
          where: { id: payload.flightId },
          include: {
            booking: true,
          },
        });

        if (!flight) {
          throw new NotFoundException("Flight not found.");
        }

        this.assertFlightOwnership(flight.pilotProfileId, pilotProfileId);
        this.assertFlightCanStartSession(flight.status, flight.booking.status);

        const existingSession = await transaction.acarsSession.findUnique({
          where: { flightId: flight.id },
        });

        if (existingSession) {
          throw new ConflictException(
            "A canonical ACARS session already exists for this flight.",
          );
        }

        const createdSession = await transaction.acarsSession.create({
          data: {
            flightId: flight.id,
            simulatorProvider: payload.simulatorProvider ?? "MSFS",
            clientVersion: payload.clientVersion ?? null,
            status: SessionStatus.CONNECTED,
            startedAt: new Date(),
            resumeToken: randomUUID(),
            connectCount: 1,
            detectedPhase: FlightPhase.PRE_FLIGHT,
          },
        });

        if (
          flight.status === FlightStatus.PLANNED ||
          flight.booking.status === BookingStatus.RESERVED
        ) {
          await transaction.flight.update({
            where: { id: flight.id },
            data: {
              status: FlightStatus.IN_PROGRESS,
            },
          });

          await transaction.booking.update({
            where: { id: flight.bookingId },
            data: {
              status: BookingStatus.IN_PROGRESS,
            },
          });
        }

        await transaction.flightEvent.create({
          data: {
            sessionId: createdSession.id,
            flightId: flight.id,
            type: FlightEventType.SESSION_STARTED,
            severity: EventSeverity.INFO,
            title: "ACARS session started",
            message: "The desktop client created the canonical ACARS session.",
            occurredAt: new Date(),
          },
        });

        return transaction.acarsSession.findUniqueOrThrow({
          where: { id: createdSession.id },
          include: sessionInclude,
        });
      });

      return this.serializeSession(session);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "A canonical ACARS session already exists for this flight.",
        );
      }

      throw error;
    }
  }

  public async findById(id: string, user: AuthenticatedUser) {
    const pilotProfileId = this.getRequiredPilotProfileId(user);

    const session = await this.prisma.acarsSession.findUnique({
      where: { id },
      include: sessionInclude,
    });

    if (!session) {
      throw new NotFoundException("ACARS session not found.");
    }

    this.assertFlightOwnership(session.flight.pilotProfileId, pilotProfileId);

    return this.serializeSession(session);
  }

  public async ingestTelemetry(
    id: string,
    user: AuthenticatedUser,
    payload: IngestTelemetryDto,
  ) {
    const pilotProfileId = this.getRequiredPilotProfileId(user);
    console.info("[api] telemetry received", {
      sessionId: id,
      pilotProfileId,
      latitude: payload.latitude,
      longitude: payload.longitude,
      altitudeFt: payload.altitudeFt,
      groundspeedKts: payload.groundspeedKts,
      onGround: payload.onGround,
      capturedAt: payload.capturedAt ?? null,
    });

    const session = await this.prisma.$transaction(async (transaction) => {
      const existingSession = await transaction.acarsSession.findUnique({
        where: { id },
        include: sessionInclude,
      });

      if (!existingSession) {
        throw new NotFoundException("ACARS session not found.");
      }

      this.assertFlightOwnership(
        existingSession.flight.pilotProfileId,
        pilotProfileId,
      );
      this.assertSessionIsMutable(existingSession.status);

      const capturedAt = payload.capturedAt ? new Date(payload.capturedAt) : new Date();

      if (Number.isNaN(capturedAt.getTime())) {
        throw new BadRequestException("capturedAt must be a valid ISO-8601 datetime.");
      }

      const nextPhase = detectFlightPhase({
        previousPhase: existingSession.detectedPhase,
        previousOnGround: existingSession.currentOnGround,
        onGround: payload.onGround,
        groundspeedKts: payload.groundspeedKts,
        altitudeFt: payload.altitudeFt,
        verticalSpeedFpm: payload.verticalSpeedFpm,
        parkingBrake: payload.parkingBrake ?? null,
      });

      await transaction.telemetryPoint.create({
        data: {
          sessionId: existingSession.id,
          capturedAt,
          latitude: payload.latitude,
          longitude: payload.longitude,
          altitudeFt: payload.altitudeFt,
          groundspeedKts: payload.groundspeedKts,
          headingDeg: payload.headingDeg,
          verticalSpeedFpm: payload.verticalSpeedFpm,
          onGround: payload.onGround,
          fuelTotalKg: payload.fuelTotalKg ?? null,
          gearPercent: payload.gearPercent ?? null,
          flapsPercent: payload.flapsPercent ?? null,
          parkingBrake: payload.parkingBrake ?? null,
        },
      });

      const acarsUpdate: Prisma.AcarsSessionUpdateInput = {
        status: SessionStatus.TRACKING,
        startedAt: existingSession.startedAt ?? capturedAt,
        lastTelemetryAt: capturedAt,
        lastHeartbeatAt: capturedAt,
        detectedPhase: nextPhase,
        currentLatitude: payload.latitude,
        currentLongitude: payload.longitude,
        currentAltitudeFt: payload.altitudeFt,
        currentGroundspeedKts: payload.groundspeedKts,
        currentHeadingDeg: payload.headingDeg,
        currentVerticalSpeedFpm: payload.verticalSpeedFpm,
        currentOnGround: payload.onGround,
        arrivalFuelKg: payload.fuelTotalKg ?? existingSession.arrivalFuelKg,
      };

      if (existingSession.departureFuelKg === null && payload.fuelTotalKg !== undefined) {
        acarsUpdate.departureFuelKg = payload.fuelTotalKg;
      }

      await transaction.acarsSession.update({
        where: { id: existingSession.id },
        data: acarsUpdate,
      });

      const flightUpdate: Prisma.FlightUpdateInput = {};

      if (
        !existingSession.flight.actualOffBlockAt &&
        OFF_BLOCK_PHASES.includes(nextPhase)
      ) {
        flightUpdate.actualOffBlockAt = capturedAt;
      }

      if (
        !existingSession.flight.actualTakeoffAt &&
        TAKEOFF_PHASES.includes(nextPhase) &&
        payload.onGround === false
      ) {
        flightUpdate.actualTakeoffAt = capturedAt;
      }

      if (
        !existingSession.flight.actualLandingAt &&
        nextPhase === FlightPhase.LANDING
      ) {
        flightUpdate.actualLandingAt = capturedAt;
      }

      if (
        !existingSession.flight.actualOnBlockAt &&
        nextPhase === FlightPhase.ARRIVAL_PARKING
      ) {
        flightUpdate.actualOnBlockAt = capturedAt;
      }

      if (Object.keys(flightUpdate).length > 0) {
        await transaction.flight.update({
          where: { id: existingSession.flightId },
          data: flightUpdate,
        });
      }

      if (nextPhase !== existingSession.detectedPhase) {
        await transaction.flightEvent.create({
          data: {
            sessionId: existingSession.id,
            flightId: existingSession.flightId,
            type: FlightEventType.PHASE_CHANGED,
            phase: nextPhase,
            severity: EventSeverity.INFO,
            title: `Phase changed to ${formatFlightPhaseLabel(nextPhase)}`,
            message: "The ACARS phase detector advanced the current flight phase.",
            occurredAt: capturedAt,
            payload: {
              previousPhase: existingSession.detectedPhase,
              nextPhase,
            },
          },
        });
      }

      return transaction.acarsSession.findUniqueOrThrow({
        where: { id: existingSession.id },
        include: sessionInclude,
      });
    });

    console.info("[api] live session upserted", {
      sessionId: session.id,
      flightId: session.flightId,
      phase: session.detectedPhase,
      latitude: session.currentLatitude?.toString?.() ?? null,
      longitude: session.currentLongitude?.toString?.() ?? null,
      altitudeFt: session.currentAltitudeFt ?? null,
      groundspeedKts: session.currentGroundspeedKts ?? null,
      onGround: session.currentOnGround ?? null,
      lastTelemetryAt: session.lastTelemetryAt?.toISOString?.() ?? null,
    });

    return this.serializeSession(session);
  }

  public async completeSession(
    id: string,
    user: AuthenticatedUser,
    payload: CompleteSessionDto,
  ) {
    const pilotProfileId = this.getRequiredPilotProfileId(user);

    const session = await this.prisma.$transaction(async (transaction) => {
      const existingSession = await transaction.acarsSession.findUnique({
        where: { id },
        include: sessionInclude,
      });

      if (!existingSession) {
        throw new NotFoundException("ACARS session not found.");
      }

      this.assertFlightOwnership(
        existingSession.flight.pilotProfileId,
        pilotProfileId,
      );

      if (existingSession.status === SessionStatus.COMPLETED) {
        throw new ConflictException("This ACARS session is already completed.");
      }

      if (existingSession.status === SessionStatus.ABORTED) {
        throw new ConflictException("This ACARS session is already aborted.");
      }

      if (existingSession.flight.status === FlightStatus.ABORTED) {
        throw new ConflictException("The linked flight is already aborted.");
      }

      if (existingSession.flight.status === FlightStatus.COMPLETED) {
        throw new ConflictException("The linked flight is already completed.");
      }

      if (existingSession.flight.booking.status !== BookingStatus.IN_PROGRESS) {
        throw new BadRequestException(
          "The linked booking is not in a valid in-progress state.",
        );
      }

      const latestTelemetry = existingSession.telemetryPoints[0] ?? null;
      const completedAt = latestTelemetry?.capturedAt ?? new Date();
      const finalParkingDetected =
        existingSession.detectedPhase === FlightPhase.ARRIVAL_PARKING ||
        (latestTelemetry?.onGround === true && latestTelemetry.parkingBrake === true);
      const actualOffBlockAt =
        existingSession.flight.actualOffBlockAt ??
        existingSession.startedAt ??
        completedAt;
      const actualTakeoffAt = existingSession.flight.actualTakeoffAt;
      const actualLandingAt = existingSession.flight.actualLandingAt;
      const actualOnBlockAt = existingSession.flight.actualOnBlockAt ?? completedAt;

      const blockTimeMinutes = Math.max(
        0,
        Math.round(
          (actualOnBlockAt.getTime() - actualOffBlockAt.getTime()) / 60_000,
        ),
      );
      const flightTimeMinutes =
        actualTakeoffAt && actualLandingAt
          ? Math.max(
              0,
              Math.round(
                (actualLandingAt.getTime() - actualTakeoffAt.getTime()) / 60_000,
              ),
            )
          : null;
      const fuelUsedKg =
        existingSession.departureFuelKg !== null &&
        existingSession.arrivalFuelKg !== null
          ? Math.max(
              0,
              Number(existingSession.departureFuelKg) -
                Number(existingSession.arrivalFuelKg),
            )
          : null;
      const telemetryPointCount = await transaction.telemetryPoint.count({
        where: { sessionId: existingSession.id },
      });
      const pirepSummary = {
        telemetryPointCount,
        finalParkingDetected,
        completionPhase: existingSession.detectedPhase,
        sessionCompletedAt: completedAt.toISOString(),
      };

      await transaction.acarsSession.update({
        where: { id: existingSession.id },
        data: {
          status: SessionStatus.COMPLETED,
          endedAt: completedAt,
          detectedPhase: FlightPhase.COMPLETED,
          lastHeartbeatAt: completedAt,
          arrivalFuelKg:
            latestTelemetry?.fuelTotalKg ?? existingSession.arrivalFuelKg,
          eventSummary: pirepSummary,
          currentLatitude: latestTelemetry
            ? latestTelemetry.latitude
            : existingSession.currentLatitude,
          currentLongitude: latestTelemetry
            ? latestTelemetry.longitude
            : existingSession.currentLongitude,
          currentAltitudeFt: latestTelemetry
            ? latestTelemetry.altitudeFt
            : existingSession.currentAltitudeFt,
          currentGroundspeedKts: latestTelemetry
            ? latestTelemetry.groundspeedKts
            : existingSession.currentGroundspeedKts,
          currentHeadingDeg: latestTelemetry
            ? latestTelemetry.headingDeg
            : existingSession.currentHeadingDeg,
          currentVerticalSpeedFpm: latestTelemetry
            ? latestTelemetry.verticalSpeedFpm
            : existingSession.currentVerticalSpeedFpm,
          currentOnGround: latestTelemetry
            ? latestTelemetry.onGround
            : existingSession.currentOnGround,
        },
      });

      await transaction.flight.update({
        where: { id: existingSession.flightId },
        data: {
          status: FlightStatus.COMPLETED,
          actualOffBlockAt,
          actualTakeoffAt,
          actualLandingAt,
          actualOnBlockAt,
          durationMinutes: blockTimeMinutes,
        },
      });

      await transaction.booking.update({
        where: { id: existingSession.flight.bookingId },
        data: {
          status: BookingStatus.COMPLETED,
        },
      });

      await transaction.pirep.upsert({
        where: { flightId: existingSession.flightId },
        update: {
          sessionId: existingSession.id,
          status: PirepStatus.SUBMITTED,
          submittedAt: completedAt,
          blockTimeMinutes,
          flightTimeMinutes,
          fuelUsedKg,
          summary: pirepSummary,
          pilotComment: payload.pilotComment ?? null,
        },
        create: {
          flightId: existingSession.flightId,
          sessionId: existingSession.id,
          pilotProfileId: existingSession.flight.pilotProfileId,
          source: PirepSource.AUTO,
          status: PirepStatus.SUBMITTED,
          submittedAt: completedAt,
          departureAirportId: existingSession.flight.departureAirportId,
          arrivalAirportId: existingSession.flight.arrivalAirportId,
          aircraftId: existingSession.flight.aircraftId,
          blockTimeMinutes,
          flightTimeMinutes,
          fuelUsedKg,
          summary: pirepSummary,
          pilotComment: payload.pilotComment ?? null,
        },
      });

      await transaction.flightEvent.createMany({
        data: [
          {
            sessionId: existingSession.id,
            flightId: existingSession.flightId,
            type: FlightEventType.PIREP_GENERATED,
            severity: EventSeverity.INFO,
            title: "Automatic PIREP generated",
            message: "The ACARS service generated the canonical MVP PIREP.",
            occurredAt: completedAt,
            payload: pirepSummary,
          },
          {
            sessionId: existingSession.id,
            flightId: existingSession.flightId,
            type: FlightEventType.FLIGHT_COMPLETED,
            phase: FlightPhase.COMPLETED,
            severity: EventSeverity.INFO,
            title: "Flight completed",
            message: "The ACARS session finalized the linked flight.",
            occurredAt: completedAt,
          },
        ],
      });

      return transaction.acarsSession.findUniqueOrThrow({
        where: { id: existingSession.id },
        include: sessionInclude,
      });
    });

    return this.serializeSession(session);
  }

  private getRequiredPilotProfileId(user: AuthenticatedUser): string {
    if (!user.pilotProfileId) {
      throw new ForbiddenException("A pilot profile is required for ACARS actions.");
    }

    return user.pilotProfileId;
  }

  private assertFlightOwnership(
    ownerPilotProfileId: string,
    requesterPilotProfileId: string,
  ): void {
    if (ownerPilotProfileId !== requesterPilotProfileId) {
      throw new ForbiddenException("You cannot access this ACARS session.");
    }
  }

  private assertFlightCanStartSession(
    flightStatus: FlightStatus,
    bookingStatus: BookingStatus,
  ): void {
    if (flightStatus === FlightStatus.COMPLETED) {
      throw new BadRequestException("Completed flights cannot start a new ACARS session.");
    }

    if (flightStatus === FlightStatus.ABORTED) {
      throw new BadRequestException("Aborted flights cannot start a new ACARS session.");
    }

    if (
      flightStatus !== FlightStatus.IN_PROGRESS &&
      flightStatus !== FlightStatus.PLANNED
    ) {
      throw new BadRequestException(
        "Only ready or in-progress flights can start an ACARS session.",
      );
    }

    if (
      bookingStatus !== BookingStatus.IN_PROGRESS &&
      bookingStatus !== BookingStatus.RESERVED
    ) {
      throw new BadRequestException(
        "The linked booking is not in a valid ready or in-progress state.",
      );
    }
  }

  private assertSessionIsMutable(status: SessionStatus): void {
    if (status === SessionStatus.COMPLETED) {
      throw new ConflictException("This ACARS session is already completed.");
    }

    if (status === SessionStatus.ABORTED) {
      throw new ConflictException("This ACARS session is already aborted.");
    }
  }

  private serializeSession(session: SessionRecord) {
    const latestTelemetry = session.telemetryPoints[0] ?? null;

    return {
      id: session.id,
      flightId: session.flightId,
      simulatorProvider: session.simulatorProvider,
      clientVersion: session.clientVersion,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      disconnectedAt: session.disconnectedAt,
      connectCount: session.connectCount,
      lastTelemetryAt: session.lastTelemetryAt,
      lastHeartbeatAt: session.lastHeartbeatAt,
      detectedPhase: session.detectedPhase,
      currentPosition: {
        latitude: decimalToNumber(session.currentLatitude),
        longitude: decimalToNumber(session.currentLongitude),
        altitudeFt: session.currentAltitudeFt,
        groundspeedKts: session.currentGroundspeedKts,
        headingDeg: session.currentHeadingDeg,
        verticalSpeedFpm: session.currentVerticalSpeedFpm,
        onGround: session.currentOnGround,
      },
      fuel: {
        departureFuelKg: decimalToNumber(session.departureFuelKg),
        arrivalFuelKg: decimalToNumber(session.arrivalFuelKg),
      },
      latestTelemetry: latestTelemetry
        ? {
            id: latestTelemetry.id.toString(),
            capturedAt: latestTelemetry.capturedAt,
            latitude: decimalToNumber(latestTelemetry.latitude),
            longitude: decimalToNumber(latestTelemetry.longitude),
            altitudeFt: latestTelemetry.altitudeFt,
            groundspeedKts: latestTelemetry.groundspeedKts,
            headingDeg: latestTelemetry.headingDeg,
            verticalSpeedFpm: latestTelemetry.verticalSpeedFpm,
            onGround: latestTelemetry.onGround,
            fuelTotalKg: decimalToNumber(latestTelemetry.fuelTotalKg),
            gearPercent: latestTelemetry.gearPercent,
            flapsPercent: latestTelemetry.flapsPercent,
            parkingBrake: latestTelemetry.parkingBrake,
          }
        : null,
      eventSummary: session.eventSummary,
      flight: {
        id: session.flight.id,
        status: session.flight.status,
        flightNumber: session.flight.flightNumber,
        bookingId: session.flight.bookingId,
        departureAirport: {
          icao: session.flight.departureAirport.icao,
          name: session.flight.departureAirport.name,
        },
        arrivalAirport: {
          icao: session.flight.arrivalAirport.icao,
          name: session.flight.arrivalAirport.name,
        },
        aircraft: {
          registration: session.flight.aircraft.registration,
          label: session.flight.aircraft.label,
          aircraftType: {
            icaoCode: session.flight.aircraft.aircraftType.icaoCode,
            name: session.flight.aircraft.aircraftType.name,
          },
        },
      },
      pirep: session.pirep
        ? {
            id: session.pirep.id,
            status: session.pirep.status,
            source: session.pirep.source,
            submittedAt: session.pirep.submittedAt,
          }
        : null,
    };
  }
}
