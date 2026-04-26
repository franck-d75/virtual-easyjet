CREATE TABLE "SimbriefAirframe" (
    "id" TEXT NOT NULL,
    "simbriefAirframeId" VARCHAR(64) NOT NULL,
    "name" TEXT NOT NULL,
    "aircraftIcao" VARCHAR(8) NOT NULL,
    "registration" TEXT,
    "selcal" TEXT,
    "equipment" TEXT,
    "engineType" TEXT,
    "wakeCategory" TEXT,
    "rawJson" JSONB NOT NULL,
    "linkedAircraftTypeId" TEXT,
    "linkedAircraftId" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "pilotProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimbriefAirframe_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SimbriefAirframe_simbriefAirframeId_key" ON "SimbriefAirframe"("simbriefAirframeId");
CREATE UNIQUE INDEX "SimbriefAirframe_linkedAircraftId_key" ON "SimbriefAirframe"("linkedAircraftId");
CREATE INDEX "SimbriefAirframe_linkedAircraftTypeId_idx" ON "SimbriefAirframe"("linkedAircraftTypeId");
CREATE INDEX "SimbriefAirframe_ownerUserId_idx" ON "SimbriefAirframe"("ownerUserId");
CREATE INDEX "SimbriefAirframe_pilotProfileId_idx" ON "SimbriefAirframe"("pilotProfileId");

ALTER TABLE "SimbriefAirframe"
ADD CONSTRAINT "SimbriefAirframe_linkedAircraftTypeId_fkey"
FOREIGN KEY ("linkedAircraftTypeId") REFERENCES "AircraftType"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SimbriefAirframe"
ADD CONSTRAINT "SimbriefAirframe_linkedAircraftId_fkey"
FOREIGN KEY ("linkedAircraftId") REFERENCES "Aircraft"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SimbriefAirframe"
ADD CONSTRAINT "SimbriefAirframe_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SimbriefAirframe"
ADD CONSTRAINT "SimbriefAirframe_pilotProfileId_fkey"
FOREIGN KEY ("pilotProfileId") REFERENCES "PilotProfile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
