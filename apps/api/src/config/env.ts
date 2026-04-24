import { z } from "zod";

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
});

export type ApiEnvironment = z.infer<typeof apiEnvSchema>;

export function validateApiEnv(
  config: Record<string, unknown>,
): ApiEnvironment {
  return apiEnvSchema.parse(config);
}

