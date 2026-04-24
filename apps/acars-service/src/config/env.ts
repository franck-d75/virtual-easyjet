import { z } from "zod";

export const acarsEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ACARS_PORT: z.coerce.number().int().positive().default(3002),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  JWT_ACCESS_SECRET: z.string().min(1),
  ACARS_RESUME_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(20),
  ACARS_OVERSPEED_GRACE_SECONDS: z.coerce.number().int().positive().default(15),
  ACARS_HARD_LANDING_THRESHOLD_FPM: z.coerce.number().int().default(-500),
});

export type AcarsEnvironment = z.infer<typeof acarsEnvSchema>;

export function validateAcarsEnv(
  config: Record<string, unknown>,
): AcarsEnvironment {
  return acarsEnvSchema.parse(config);
}
