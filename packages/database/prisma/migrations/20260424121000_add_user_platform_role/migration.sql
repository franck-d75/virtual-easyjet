CREATE TYPE "UserPlatformRole" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "User"
ADD COLUMN "role" "UserPlatformRole" NOT NULL DEFAULT 'USER';

UPDATE "User"
SET "role" = 'ADMIN'
WHERE EXISTS (
  SELECT 1
  FROM "UserRole"
  INNER JOIN "Role" ON "Role"."id" = "UserRole"."roleId"
  WHERE "UserRole"."userId" = "User"."id"
    AND "Role"."code" = 'admin'
);
