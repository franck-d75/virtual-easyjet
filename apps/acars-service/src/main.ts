import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import {
  applyHttpSecurityHeaders,
  createCorsOriginHandler,
  parseCorsOrigins,
} from "./common/security/http-security.utils.js";
import type { AcarsEnvironment } from "./config/env.js";

type RequestLike = {
  method: string;
  originalUrl: string;
};

type ResponseLike = {
  statusCode: number;
  on: (event: "finish", listener: () => void) => void;
  setHeader: (name: string, value: string) => void;
};

type NextLike = () => void;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get<ConfigService<AcarsEnvironment, true>>(ConfigService);
  const corsOrigins = parseCorsOrigins(
    configService.get("CORS_ORIGIN", { infer: true }),
  );
  const nodeEnv = configService.get("NODE_ENV", { infer: true });

  app.getHttpAdapter().getInstance().disable?.("x-powered-by");
  app.setGlobalPrefix("acars");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: createCorsOriginHandler(
      configService.get("CORS_ORIGIN", { infer: true }),
      nodeEnv,
    ),
    credentials: true,
  });
  app.use(
    (request: RequestLike, response: ResponseLike, next: NextLike) => {
      const startedAt = Date.now();

      applyHttpSecurityHeaders(request, response);

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
