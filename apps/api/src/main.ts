import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module.js";
import type { ApiEnvironment } from "./config/env.js";

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
  const configService = app.get<ConfigService<ApiEnvironment, true>>(ConfigService);

  const corsOrigin = configService.get("CORS_ORIGIN", { infer: true });
  const apiPort = configService.get("API_PORT", { infer: true });
  const nodeEnv = configService.get("NODE_ENV", { infer: true });
  const corsOrigins = parseCorsOrigins(corsOrigin);

  app.setGlobalPrefix("api");
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Virtual Airline API")
    .setDescription("MVP API for the virtual airline platform.")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

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
