-- AlterTable
ALTER TABLE "PilotProfile"
ADD COLUMN "simbriefPilotId" VARCHAR(32);

-- CreateIndex
CREATE UNIQUE INDEX "PilotProfile_simbriefPilotId_key"
ON "PilotProfile"("simbriefPilotId");
