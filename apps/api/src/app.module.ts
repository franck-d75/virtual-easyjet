import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { JwtAuthGuard } from "./common/guards/jwt-auth.guard.js";
import { RolesGuard } from "./common/guards/roles.guard.js";
import { RateLimitGuard } from "./common/security/rate-limit.guard.js";
import { RateLimitService } from "./common/security/rate-limit.service.js";
import { validateApiEnv } from "./config/env.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { AdminModule } from "./modules/admin/admin.module.js";
import { AcarsLiveModule } from "./modules/acars-live/acars-live.module.js";
import { AcarsSessionsModule } from "./modules/acars-sessions/acars-sessions.module.js";
import { AircraftModule } from "./modules/aircraft/aircraft.module.js";
import { AirportsModule } from "./modules/airports/airports.module.js";
import { BookingsModule } from "./modules/bookings/bookings.module.js";
import { FlightsModule } from "./modules/flights/flights.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { HubsModule } from "./modules/hubs/hubs.module.js";
import { PilotProfilesModule } from "./modules/pilot-profiles/pilot-profiles.module.js";
import { PrismaModule } from "./modules/prisma/prisma.module.js";
import { PublicModule } from "./modules/public/public.module.js";
import { RanksModule } from "./modules/ranks/ranks.module.js";
import { RolesModule } from "./modules/roles/roles.module.js";
import { RoutesModule } from "./modules/routes/routes.module.js";
import { UsersModule } from "./modules/users/users.module.js";

const WORKSPACE_MARKER = "pnpm-workspace.yaml";

function findWorkspaceRoot(startDirectory: string): string {
  let currentDirectory = startDirectory;

  while (true) {
    if (existsSync(resolve(currentDirectory, WORKSPACE_MARKER))) {
      return currentDirectory;
    }

    const parentDirectory = resolve(currentDirectory, "..");

    if (parentDirectory === currentDirectory) {
      return startDirectory;
    }

    currentDirectory = parentDirectory;
  }
}

const appModuleDirectory = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = findWorkspaceRoot(appModuleDirectory);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(repositoryRoot, ".env.local"),
        resolve(repositoryRoot, ".env"),
      ],
      validate: validateApiEnv,
    }),
    PrismaModule,
    HealthModule,
    PublicModule,
    AcarsLiveModule,
    AcarsSessionsModule,
    AuthModule,
    AdminModule,
    UsersModule,
    PilotProfilesModule,
    RolesModule,
    RanksModule,
    AirportsModule,
    HubsModule,
    AircraftModule,
    RoutesModule,
    BookingsModule,
    FlightsModule,
  ],
  providers: [
    RateLimitService,
    RateLimitGuard,
    JwtAuthGuard,
    RolesGuard,
    {
      provide: APP_GUARD,
      useExisting: RateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: RolesGuard,
    },
  ],
})
export class AppModule {}

