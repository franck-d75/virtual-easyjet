import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { JwtAuthGuard } from "./common/guards/jwt-auth.guard.js";
import { RateLimitGuard } from "./common/security/rate-limit.guard.js";
import { RateLimitService } from "./common/security/rate-limit.service.js";
import { validateAcarsEnv } from "./config/env.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { AcarsLiveModule } from "./modules/acars-live/acars-live.module.js";
import { AcarsSessionsModule } from "./modules/acars-sessions/acars-sessions.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { PrismaModule } from "./modules/prisma/prisma.module.js";

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
      validate: validateAcarsEnv,
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    AcarsLiveModule,
    AcarsSessionsModule,
  ],
  providers: [
    RateLimitService,
    RateLimitGuard,
    JwtAuthGuard,
    {
      provide: APP_GUARD,
      useExisting: RateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
