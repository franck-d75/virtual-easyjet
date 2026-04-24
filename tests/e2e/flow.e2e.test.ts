import assert from "node:assert/strict";
import test from "node:test";

import {
  BookingStatus,
  FlightEventType,
  FlightPhase,
  FlightStatus,
  PirepSource,
  PirepStatus,
  SessionStatus,
} from "@va/database";

import { createFlowHarness } from "./support/in-memory-flow-harness.js";

test("MVP flow completes from booking to automatic PIREP", async () => {
  const harness = createFlowHarness();

  const booking = await harness.bookingsService.create(harness.user, {
    scheduleId: "schedule-afr100-daily",
    bookedFor: "2030-01-02T08:00:00.000Z",
    notes: "Morning rotation",
  });

  assert.equal(booking.status, BookingStatus.RESERVED);
  assert.equal(booking.flight, null);

  const flight = await harness.flightsService.create(harness.user, {
    bookingId: booking.id,
  });

  assert.equal(flight.status, FlightStatus.IN_PROGRESS);
  assert.equal(flight.booking.status, BookingStatus.IN_PROGRESS);

  await assert.rejects(
    () =>
      harness.flightsService.create(harness.user, {
        bookingId: booking.id,
      }),
    /canonical flight/i,
  );

  const session = await harness.acarsSessionsService.createSession(harness.user, {
    flightId: flight.id,
    simulatorProvider: "MSFS",
    clientVersion: "0.1.0-test",
  });

  assert.equal(session.status, SessionStatus.CONNECTED);
  assert.equal(session.detectedPhase, FlightPhase.PRE_FLIGHT);

  const telemetrySequence = [
    {
      expectedPhase: FlightPhase.DEPARTURE_PARKING,
      payload: {
        capturedAt: "2030-01-02T08:00:00.000Z",
        latitude: 49.0097,
        longitude: 2.5479,
        altitudeFt: 0,
        groundspeedKts: 0,
        headingDeg: 270,
        verticalSpeedFpm: 0,
        onGround: true,
        fuelTotalKg: 6200,
        gearPercent: 100,
        flapsPercent: 0,
        parkingBrake: true,
      },
    },
    {
      expectedPhase: FlightPhase.PUSHBACK,
      payload: {
        capturedAt: "2030-01-02T08:02:00.000Z",
        latitude: 49.00965,
        longitude: 2.5477,
        altitudeFt: 0,
        groundspeedKts: 2,
        headingDeg: 260,
        verticalSpeedFpm: 0,
        onGround: true,
        fuelTotalKg: 6180,
        gearPercent: 100,
        flapsPercent: 0,
        parkingBrake: false,
      },
    },
    {
      expectedPhase: FlightPhase.TAXI_OUT,
      payload: {
        capturedAt: "2030-01-02T08:06:00.000Z",
        latitude: 49.01,
        longitude: 2.55,
        altitudeFt: 0,
        groundspeedKts: 18,
        headingDeg: 270,
        verticalSpeedFpm: 0,
        onGround: true,
        fuelTotalKg: 6150,
        gearPercent: 100,
        flapsPercent: 5,
        parkingBrake: false,
      },
    },
    {
      expectedPhase: FlightPhase.TAKEOFF,
      payload: {
        capturedAt: "2030-01-02T08:12:00.000Z",
        latitude: 49.02,
        longitude: 2.58,
        altitudeFt: 700,
        groundspeedKts: 155,
        headingDeg: 270,
        verticalSpeedFpm: 1600,
        onGround: false,
        fuelTotalKg: 6000,
        gearPercent: 40,
        flapsPercent: 10,
        parkingBrake: false,
      },
    },
    {
      expectedPhase: FlightPhase.CLIMB,
      payload: {
        capturedAt: "2030-01-02T08:16:00.000Z",
        latitude: 49.3,
        longitude: 1.9,
        altitudeFt: 8000,
        groundspeedKts: 250,
        headingDeg: 290,
        verticalSpeedFpm: 1800,
        onGround: false,
        fuelTotalKg: 5700,
        gearPercent: 0,
        flapsPercent: 0,
        parkingBrake: false,
      },
    },
    {
      expectedPhase: FlightPhase.CRUISE,
      payload: {
        capturedAt: "2030-01-02T08:28:00.000Z",
        latitude: 50.0,
        longitude: 0.9,
        altitudeFt: 34000,
        groundspeedKts: 440,
        headingDeg: 300,
        verticalSpeedFpm: 20,
        onGround: false,
        fuelTotalKg: 5200,
        gearPercent: 0,
        flapsPercent: 0,
        parkingBrake: false,
      },
    },
    {
      expectedPhase: FlightPhase.DESCENT,
      payload: {
        capturedAt: "2030-01-02T08:29:00.000Z",
        latitude: 50.1,
        longitude: 0.8,
        altitudeFt: 0,
        groundspeedKts: 15,
        headingDeg: 300,
        verticalSpeedFpm: 0,
        onGround: true,
        fuelTotalKg: 5190,
        gearPercent: 100,
        flapsPercent: 0,
        parkingBrake: false,
      },
    },
    {
      expectedPhase: FlightPhase.DESCENT,
      payload: {
        capturedAt: "2030-01-02T08:31:00.000Z",
        latitude: 50.25,
        longitude: 0.55,
        altitudeFt: 9000,
        groundspeedKts: 310,
        headingDeg: 305,
        verticalSpeedFpm: -1400,
        onGround: false,
        fuelTotalKg: 5050,
        gearPercent: 0,
        flapsPercent: 0,
        parkingBrake: false,
      },
    },
    {
      expectedPhase: FlightPhase.APPROACH,
      payload: {
        capturedAt: "2030-01-02T08:36:00.000Z",
        latitude: 50.7,
        longitude: -0.2,
        altitudeFt: 2500,
        groundspeedKts: 180,
        headingDeg: 310,
        verticalSpeedFpm: -900,
        onGround: false,
        fuelTotalKg: 4700,
        gearPercent: 60,
        flapsPercent: 15,
        parkingBrake: false,
      },
    },
    {
      expectedPhase: FlightPhase.LANDING,
      payload: {
        capturedAt: "2030-01-02T08:42:00.000Z",
        latitude: 51.47,
        longitude: -0.4543,
        altitudeFt: 0,
        groundspeedKts: 120,
        headingDeg: 270,
        verticalSpeedFpm: -200,
        onGround: true,
        fuelTotalKg: 4500,
        gearPercent: 100,
        flapsPercent: 30,
        parkingBrake: false,
      },
    },
    {
      expectedPhase: FlightPhase.TAXI_IN,
      payload: {
        capturedAt: "2030-01-02T08:47:00.000Z",
        latitude: 51.471,
        longitude: -0.455,
        altitudeFt: 0,
        groundspeedKts: 18,
        headingDeg: 250,
        verticalSpeedFpm: 0,
        onGround: true,
        fuelTotalKg: 4350,
        gearPercent: 100,
        flapsPercent: 0,
        parkingBrake: false,
      },
    },
    {
      expectedPhase: FlightPhase.ARRIVAL_PARKING,
      payload: {
        capturedAt: "2030-01-02T08:55:00.000Z",
        latitude: 51.472,
        longitude: -0.456,
        altitudeFt: 0,
        groundspeedKts: 0,
        headingDeg: 180,
        verticalSpeedFpm: 0,
        onGround: true,
        fuelTotalKg: 4300,
        gearPercent: 100,
        flapsPercent: 0,
        parkingBrake: true,
      },
    },
  ];

  for (const step of telemetrySequence) {
    const updatedSession = await harness.acarsSessionsService.ingestTelemetry(
      session.id,
      harness.user,
      step.payload,
    );

    assert.equal(updatedSession.detectedPhase, step.expectedPhase);
  }

  const completedSession = await harness.acarsSessionsService.completeSession(
    session.id,
    harness.user,
    {
      pilotComment: "Smooth flight for MVP validation.",
    },
  );

  assert.equal(completedSession.status, SessionStatus.COMPLETED);
  assert.equal(completedSession.detectedPhase, FlightPhase.COMPLETED);
  assert.ok(completedSession.pirep);
  assert.equal(completedSession.pirep?.status, PirepStatus.SUBMITTED);

  const storedBooking = harness.prisma.store.bookings[0];
  const storedFlight = harness.prisma.store.flights[0];
  const storedSession = harness.prisma.store.acarsSessions[0];
  const storedPirep = harness.prisma.store.pireps[0];

  assert.equal(storedBooking?.status, BookingStatus.COMPLETED);
  assert.equal(storedFlight?.status, FlightStatus.COMPLETED);
  assert.equal(storedSession?.status, SessionStatus.COMPLETED);
  assert.equal(storedSession?.detectedPhase, FlightPhase.COMPLETED);
  assert.equal(storedPirep?.status, PirepStatus.SUBMITTED);
  assert.equal(storedPirep?.source, PirepSource.AUTO);
  assert.equal(storedPirep?.pilotComment, "Smooth flight for MVP validation.");
  assert.ok((storedPirep?.blockTimeMinutes ?? 0) > 0);
  assert.ok((storedPirep?.fuelUsedKg ?? 0) > 0);

  const eventTypes = harness.prisma.store.flightEvents.map((event) => event.type);
  assert.ok(eventTypes.includes(FlightEventType.SESSION_STARTED));
  assert.ok(eventTypes.includes(FlightEventType.PHASE_CHANGED));
  assert.ok(eventTypes.includes(FlightEventType.PIREP_GENERATED));
  assert.ok(eventTypes.includes(FlightEventType.FLIGHT_COMPLETED));
});
