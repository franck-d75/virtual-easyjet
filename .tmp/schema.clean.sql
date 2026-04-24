-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "PilotStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "AircraftStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('RESERVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FlightStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ABORTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('CREATED', 'CONNECTED', 'TRACKING', 'DISCONNECTED', 'COMPLETED', 'ABORTED');

-- CreateEnum
CREATE TYPE "FlightPhase" AS ENUM ('PRE_FLIGHT', 'DEPARTURE_PARKING', 'PUSHBACK', 'TAXI_OUT', 'TAKEOFF', 'CLIMB', 'CRUISE', 'DESCENT', 'APPROACH', 'LANDING', 'TAXI_IN', 'ARRIVAL_PARKING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "FlightEventType" AS ENUM ('BOOKING_VALIDATED', 'SESSION_STARTED', 'SESSION_RESUMED', 'SESSION_DISCONNECTED', 'PHASE_CHANGED', 'VIOLATION_RECORDED', 'PIREP_GENERATED', 'FLIGHT_COMPLETED', 'FLIGHT_ABORTED');

-- CreateEnum
CREATE TYPE "EventSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PirepSource" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "PirepStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ViolationSeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ViolationType" AS ENUM ('NO_BOOKING', 'AIRCRAFT_MISMATCH', 'AIRPORT_MISMATCH', 'ROUTE_MISMATCH', 'CRASH', 'ABNORMAL_DISCONNECT', 'OVERSPEED', 'HARD_LANDING', 'INCOMPLETE_FLIGHT', 'INVALID_AIRFRAME');

-- CreateEnum
CREATE TYPE "QualificationKind" AS ENUM ('GENERAL', 'AIRCRAFT', 'AIRPORT', 'PROCEDURE', 'RANK');

-- CreateEnum
CREATE TYPE "CheckrideStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'PASSED', 'FAILED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NewsPostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pilotNumber" TEXT NOT NULL,
    "callsign" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "countryCode" TEXT,
    "hubId" TEXT,
    "rankId" TEXT,
    "status" "PilotStatus" NOT NULL DEFAULT 'ACTIVE',
    "experiencePoints" INTEGER NOT NULL DEFAULT 0,
    "hoursFlownMinutes" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rank" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "minFlights" INTEGER NOT NULL DEFAULT 0,
    "minHoursMinutes" INTEGER NOT NULL DEFAULT 0,
    "minScore" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hub" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "airportId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hub_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Airport" (
    "id" TEXT NOT NULL,
    "icao" TEXT NOT NULL,
    "iata" TEXT,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "countryCode" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "elevationFt" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Airport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AircraftType" (
    "id" TEXT NOT NULL,
    "icaoCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "category" TEXT,
    "minRankId" TEXT,
    "cruiseSpeedKts" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AircraftType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aircraft" (
    "id" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "label" TEXT,
    "aircraftTypeId" TEXT NOT NULL,
    "hubId" TEXT,
    "status" "AircraftStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Aircraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "flightNumber" TEXT NOT NULL,
    "departureAirportId" TEXT NOT NULL,
    "arrivalAirportId" TEXT NOT NULL,
    "departureHubId" TEXT,
    "arrivalHubId" TEXT,
    "aircraftTypeId" TEXT,
    "distanceNm" INTEGER,
    "blockTimeMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "aircraftId" TEXT,
    "departureAirportId" TEXT NOT NULL,
    "arrivalAirportId" TEXT NOT NULL,
    "callsign" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "departureTimeUtc" VARCHAR(5) NOT NULL,
    "arrivalTimeUtc" VARCHAR(5) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "pilotProfileId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "routeId" TEXT,
    "aircraftId" TEXT NOT NULL,
    "departureAirportId" TEXT NOT NULL,
    "arrivalAirportId" TEXT NOT NULL,
    "reservedFlightNumber" TEXT NOT NULL,
    "bookedFor" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'RESERVED',
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flight" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "pilotProfileId" TEXT NOT NULL,
    "routeId" TEXT,
    "aircraftId" TEXT NOT NULL,
    "departureAirportId" TEXT NOT NULL,
    "arrivalAirportId" TEXT NOT NULL,
    "flightNumber" TEXT NOT NULL,
    "status" "FlightStatus" NOT NULL DEFAULT 'PLANNED',
    "plannedOffBlockAt" TIMESTAMP(3),
    "actualOffBlockAt" TIMESTAMP(3),
    "actualTakeoffAt" TIMESTAMP(3),
    "actualLandingAt" TIMESTAMP(3),
    "actualOnBlockAt" TIMESTAMP(3),
    "distanceFlownNm" INTEGER,
    "durationMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcarsSession" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "simulatorProvider" TEXT NOT NULL DEFAULT 'MSFS',
    "clientVersion" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'CREATED',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "resumeToken" TEXT,
    "connectCount" INTEGER NOT NULL DEFAULT 0,
    "lastTelemetryAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "detectedPhase" "FlightPhase" NOT NULL DEFAULT 'PRE_FLIGHT',
    "currentLatitude" DECIMAL(10,7),
    "currentLongitude" DECIMAL(10,7),
    "currentAltitudeFt" INTEGER,
    "currentGroundspeedKts" INTEGER,
    "currentHeadingDeg" INTEGER,
    "currentVerticalSpeedFpm" INTEGER,
    "currentOnGround" BOOLEAN,
    "departureFuelKg" DECIMAL(10,2),
    "arrivalFuelKg" DECIMAL(10,2),
    "eventSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcarsSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelemetryPoint" (
    "id" BIGSERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "altitudeFt" INTEGER NOT NULL,
    "groundspeedKts" INTEGER NOT NULL,
    "headingDeg" INTEGER NOT NULL,
    "verticalSpeedFpm" INTEGER NOT NULL,
    "onGround" BOOLEAN NOT NULL,
    "fuelTotalKg" DECIMAL(10,2),
    "gearPercent" INTEGER,
    "flapsPercent" INTEGER,
    "parkingBrake" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelemetryPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightEvent" (
    "id" BIGSERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "type" "FlightEventType" NOT NULL,
    "phase" "FlightPhase",
    "severity" "EventSeverity" NOT NULL DEFAULT 'INFO',
    "code" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pirep" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "sessionId" TEXT,
    "pilotProfileId" TEXT NOT NULL,
    "source" "PirepSource" NOT NULL DEFAULT 'AUTO',
    "status" "PirepStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "departureAirportId" TEXT NOT NULL,
    "arrivalAirportId" TEXT NOT NULL,
    "aircraftId" TEXT NOT NULL,
    "blockTimeMinutes" INTEGER,
    "flightTimeMinutes" INTEGER,
    "fuelUsedKg" DECIMAL(10,2),
    "landingRateFpm" INTEGER,
    "score" INTEGER,
    "summary" JSONB,
    "pilotComment" TEXT,
    "reviewerComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pirep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Violation" (
    "id" TEXT NOT NULL,
    "flightId" TEXT,
    "sessionId" TEXT,
    "pirepId" TEXT,
    "pilotProfileId" TEXT NOT NULL,
    "type" "ViolationType" NOT NULL,
    "severity" "ViolationSeverity" NOT NULL DEFAULT 'MINOR',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thresholdNumeric" DECIMAL(10,2),
    "measuredNumeric" DECIMAL(10,2),
    "payload" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Violation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Qualification" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "QualificationKind" NOT NULL,
    "description" TEXT,
    "aircraftTypeId" TEXT,
    "airportId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Qualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotQualification" (
    "pilotProfileId" TEXT NOT NULL,
    "qualificationId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "awardedById" TEXT,
    "notes" TEXT,

    CONSTRAINT "PilotQualification_pkey" PRIMARY KEY ("pilotProfileId","qualificationId")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "qualificationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "passingScore" INTEGER NOT NULL DEFAULT 70,
    "durationMinutes" INTEGER,
    "questionBank" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Checkride" (
    "id" TEXT NOT NULL,
    "pilotProfileId" TEXT NOT NULL,
    "qualificationId" TEXT NOT NULL,
    "aircraftTypeId" TEXT,
    "examinerId" TEXT,
    "status" "CheckrideStatus" NOT NULL DEFAULT 'REQUESTED',
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "score" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Checkride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffNote" (
    "id" TEXT NOT NULL,
    "pilotProfileId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isConfidential" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "NewsPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "status" "NewsPostStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PilotProfile_userId_key" ON "PilotProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PilotProfile_pilotNumber_key" ON "PilotProfile"("pilotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PilotProfile_callsign_key" ON "PilotProfile"("callsign");

-- CreateIndex
CREATE INDEX "PilotProfile_hubId_idx" ON "PilotProfile"("hubId");

-- CreateIndex
CREATE INDEX "PilotProfile_rankId_idx" ON "PilotProfile"("rankId");

-- CreateIndex
CREATE UNIQUE INDEX "Rank_code_key" ON "Rank"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Hub_code_key" ON "Hub"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Hub_airportId_key" ON "Hub"("airportId");

-- CreateIndex
CREATE UNIQUE INDEX "Airport_icao_key" ON "Airport"("icao");

-- CreateIndex
CREATE UNIQUE INDEX "AircraftType_icaoCode_key" ON "AircraftType"("icaoCode");

-- CreateIndex
CREATE UNIQUE INDEX "Aircraft_registration_key" ON "Aircraft"("registration");

-- CreateIndex
CREATE INDEX "Aircraft_aircraftTypeId_idx" ON "Aircraft"("aircraftTypeId");

-- CreateIndex
CREATE INDEX "Aircraft_hubId_idx" ON "Aircraft"("hubId");

-- CreateIndex
CREATE UNIQUE INDEX "Route_code_key" ON "Route"("code");

-- CreateIndex
CREATE INDEX "Route_departureAirportId_arrivalAirportId_idx" ON "Route"("departureAirportId", "arrivalAirportId");

-- CreateIndex
CREATE INDEX "Route_aircraftTypeId_idx" ON "Route"("aircraftTypeId");

-- CreateIndex
CREATE INDEX "Schedule_routeId_isActive_idx" ON "Schedule"("routeId", "isActive");

-- CreateIndex
CREATE INDEX "Booking_pilotProfileId_status_idx" ON "Booking"("pilotProfileId", "status");

-- CreateIndex
CREATE INDEX "Booking_bookedFor_status_idx" ON "Booking"("bookedFor", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Flight_bookingId_key" ON "Flight"("bookingId");

-- CreateIndex
CREATE INDEX "Flight_pilotProfileId_status_idx" ON "Flight"("pilotProfileId", "status");

-- CreateIndex
CREATE INDEX "Flight_status_createdAt_idx" ON "Flight"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AcarsSession_flightId_key" ON "AcarsSession"("flightId");

-- CreateIndex
CREATE UNIQUE INDEX "AcarsSession_resumeToken_key" ON "AcarsSession"("resumeToken");

-- CreateIndex
CREATE INDEX "AcarsSession_status_lastTelemetryAt_idx" ON "AcarsSession"("status", "lastTelemetryAt");

-- CreateIndex
CREATE INDEX "TelemetryPoint_sessionId_capturedAt_idx" ON "TelemetryPoint"("sessionId", "capturedAt");

-- CreateIndex
CREATE INDEX "FlightEvent_sessionId_occurredAt_idx" ON "FlightEvent"("sessionId", "occurredAt");

-- CreateIndex
CREATE INDEX "FlightEvent_flightId_occurredAt_idx" ON "FlightEvent"("flightId", "occurredAt");

-- CreateIndex
CREATE INDEX "FlightEvent_flightId_type_occurredAt_idx" ON "FlightEvent"("flightId", "type", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Pirep_flightId_key" ON "Pirep"("flightId");

-- CreateIndex
CREATE UNIQUE INDEX "Pirep_sessionId_key" ON "Pirep"("sessionId");

-- CreateIndex
CREATE INDEX "Pirep_pilotProfileId_status_idx" ON "Pirep"("pilotProfileId", "status");

-- CreateIndex
CREATE INDEX "Violation_pilotProfileId_detectedAt_idx" ON "Violation"("pilotProfileId", "detectedAt");

-- CreateIndex
CREATE INDEX "Violation_flightId_type_idx" ON "Violation"("flightId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Qualification_code_key" ON "Qualification"("code");

-- CreateIndex
CREATE INDEX "Checkride_pilotProfileId_status_idx" ON "Checkride"("pilotProfileId", "status");

-- CreateIndex
CREATE INDEX "StaffNote_pilotProfileId_createdAt_idx" ON "StaffNote"("pilotProfileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsPost_slug_key" ON "NewsPost"("slug");

-- CreateIndex
CREATE INDEX "NewsPost_status_publishedAt_idx" ON "NewsPost"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPage_slug_key" ON "ContentPage"("slug");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotProfile" ADD CONSTRAINT "PilotProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotProfile" ADD CONSTRAINT "PilotProfile_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotProfile" ADD CONSTRAINT "PilotProfile_rankId_fkey" FOREIGN KEY ("rankId") REFERENCES "Rank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hub" ADD CONSTRAINT "Hub_airportId_fkey" FOREIGN KEY ("airportId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AircraftType" ADD CONSTRAINT "AircraftType_minRankId_fkey" FOREIGN KEY ("minRankId") REFERENCES "Rank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aircraft" ADD CONSTRAINT "Aircraft_aircraftTypeId_fkey" FOREIGN KEY ("aircraftTypeId") REFERENCES "AircraftType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aircraft" ADD CONSTRAINT "Aircraft_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_departureAirportId_fkey" FOREIGN KEY ("departureAirportId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_arrivalAirportId_fkey" FOREIGN KEY ("arrivalAirportId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_departureHubId_fkey" FOREIGN KEY ("departureHubId") REFERENCES "Hub"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_arrivalHubId_fkey" FOREIGN KEY ("arrivalHubId") REFERENCES "Hub"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_aircraftTypeId_fkey" FOREIGN KEY ("aircraftTypeId") REFERENCES "AircraftType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "Aircraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_departureAirportId_fkey" FOREIGN KEY ("departureAirportId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_arrivalAirportId_fkey" FOREIGN KEY ("arrivalAirportId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_pilotProfileId_fkey" FOREIGN KEY ("pilotProfileId") REFERENCES "PilotProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "Aircraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_departureAirportId_fkey" FOREIGN KEY ("departureAirportId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_arrivalAirportId_fkey" FOREIGN KEY ("arrivalAirportId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_pilotProfileId_fkey" FOREIGN KEY ("pilotProfileId") REFERENCES "PilotProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "Aircraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_departureAirportId_fkey" FOREIGN KEY ("departureAirportId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_arrivalAirportId_fkey" FOREIGN KEY ("arrivalAirportId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcarsSession" ADD CONSTRAINT "AcarsSession_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetryPoint" ADD CONSTRAINT "TelemetryPoint_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcarsSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightEvent" ADD CONSTRAINT "FlightEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcarsSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightEvent" ADD CONSTRAINT "FlightEvent_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pirep" ADD CONSTRAINT "Pirep_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pirep" ADD CONSTRAINT "Pirep_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcarsSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pirep" ADD CONSTRAINT "Pirep_pilotProfileId_fkey" FOREIGN KEY ("pilotProfileId") REFERENCES "PilotProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pirep" ADD CONSTRAINT "Pirep_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pirep" ADD CONSTRAINT "Pirep_departureAirportId_fkey" FOREIGN KEY ("departureAirportId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pirep" ADD CONSTRAINT "Pirep_arrivalAirportId_fkey" FOREIGN KEY ("arrivalAirportId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pirep" ADD CONSTRAINT "Pirep_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "Aircraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Violation" ADD CONSTRAINT "Violation_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Violation" ADD CONSTRAINT "Violation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcarsSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Violation" ADD CONSTRAINT "Violation_pirepId_fkey" FOREIGN KEY ("pirepId") REFERENCES "Pirep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Violation" ADD CONSTRAINT "Violation_pilotProfileId_fkey" FOREIGN KEY ("pilotProfileId") REFERENCES "PilotProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Qualification" ADD CONSTRAINT "Qualification_aircraftTypeId_fkey" FOREIGN KEY ("aircraftTypeId") REFERENCES "AircraftType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Qualification" ADD CONSTRAINT "Qualification_airportId_fkey" FOREIGN KEY ("airportId") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotQualification" ADD CONSTRAINT "PilotQualification_pilotProfileId_fkey" FOREIGN KEY ("pilotProfileId") REFERENCES "PilotProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotQualification" ADD CONSTRAINT "PilotQualification_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "Qualification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotQualification" ADD CONSTRAINT "PilotQualification_awardedById_fkey" FOREIGN KEY ("awardedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "Qualification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkride" ADD CONSTRAINT "Checkride_pilotProfileId_fkey" FOREIGN KEY ("pilotProfileId") REFERENCES "PilotProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkride" ADD CONSTRAINT "Checkride_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "Qualification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkride" ADD CONSTRAINT "Checkride_aircraftTypeId_fkey" FOREIGN KEY ("aircraftTypeId") REFERENCES "AircraftType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkride" ADD CONSTRAINT "Checkride_examinerId_fkey" FOREIGN KEY ("examinerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffNote" ADD CONSTRAINT "StaffNote_pilotProfileId_fkey" FOREIGN KEY ("pilotProfileId") REFERENCES "PilotProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffNote" ADD CONSTRAINT "StaffNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsPost" ADD CONSTRAINT "NewsPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPage" ADD CONSTRAINT "ContentPage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

