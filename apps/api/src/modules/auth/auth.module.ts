import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { PrismaModule } from "../prisma/prisma.module.js";
import { UsersModule } from "../users/users.module.js";
import { AuthBruteforceService } from "./auth-bruteforce.service.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtStrategy } from "./strategies/jwt.strategy.js";

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    PassportModule.register({
      defaultStrategy: "jwt",
    }),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthBruteforceService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}

