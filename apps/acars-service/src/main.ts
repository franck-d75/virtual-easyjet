import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import type { AcarsEnvironment } from "./config/env.js";

type RequestLike = {
  method: string;
  originalUrl: string;
};

type ResponseLike = {
  statusCode: number;
  on: (event: "finish", listener: () => void) => void;
};

type NextLike = () => void;

function parseCorsOrigins(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get<ConfigService<AcarsEnvironment, true>>(ConfigService);
  const corsOrigins = parseCorsOrigins(
    configService.get("CORS_ORIGIN", { infer: true }),
  );
  const nodeEnv = configService.get("NODE_ENV", { infer: true });

  app.setGlobalPrefix("acars");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.use(
    (request: RequestLike, response: ResponseLike, next: NextLike) => {
      const startedAt = Date.now();

      response.on("finish", () => {
        console.info("[acars]", {
          method: request.method,
          path: request.originalUrl,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
        });
      });

      next();
    },
  );

  const acarsPort = configService.get("ACARS_PORT", { infer: true });
  await app.listen(acarsPort);
  console.info("[acars] ready", {
    nodeEnv,
    port: acarsPort,
    corsOrigins,
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start ACARS service", error);
  process.exit(1);
});
