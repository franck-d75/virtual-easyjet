import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";

import { PrismaModule } from "../prisma/prisma.module.js";
import { JwtStrategy } from "./strategies/jwt.strategy.js";

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({
      defaultStrategy: "jwt",
    }),
  ],
  providers: [JwtStrategy],
})
export class AuthModule {}
