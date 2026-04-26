import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module.js";
import type { ApiEnvironment } from "./config/env.js";
import {
  applyHttpSecurityHeaders,
  createCorsOriginHandler,
  parseCorsOrigins,
} from "./common/security/http-security.utils.js";

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

const DEFAULT_ALLOWED_CORS_ORIGINS = [
  "https://virtual-easyjet.fr",
  "https://www.virtual-easyjet.fr",
  "https://virtual-easyjet-web.vercel.app",
  "http://localhost:3000",
] as const;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get<ConfigService<ApiEnvironment, true>>(ConfigService);

  const corsOrigin = configService.get("CORS_ORIGIN", { infer: true });
  const apiPort = configService.get("API_PORT", { infer: true });
  const nodeEnv = configService.get("NODE_ENV", { infer: true });
  const corsOrigins = Array.from(
    new Set([...DEFAULT_ALLOWED_CORS_ORIGINS, ...parseCorsOrigins(corsOrigin)]),
  );
  const corsOriginValue = corsOrigins.join(",");

  app.getHttpAdapter().getInstance().disable?.("x-powered-by");
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: createCorsOriginHandler(corsOriginValue, nodeEnv),
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Accept",
      "Authorization",
      "Content-Type",
      "Origin",
      "X-Requested-With",
    ],
    exposedHeaders: [
      "Retry-After",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
    ],
  });
  app.use(
    (request: RequestLike, response: ResponseLike, next: NextLike) => {
      const startedAt = Date.now();

      applyHttpSecurityHeaders(request, response);

      response.on("finish", () => {
        console.info("[api]", {
          method: request.method,
          path: request.originalUrl,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
        });
      });

      next();
    },
  );

  if (nodeEnv !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Virtual Airline API")
      .setDescription("MVP API for the virtual airline platform.")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("docs", app, document);
  }

  await app.listen(apiPort);
  console.info("[api] ready", {
    nodeEnv,
    port: apiPort,
    corsOrigins,
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start API", error);
  process.exit(1);
});

