import { defineConfig } from "prisma/config";

import { loadRootEnvironment } from "./prisma/load-root-env.js";

const environment = loadRootEnvironment();
const databaseUrl = environment.DATABASE_URL;

Object.assign(process.env, environment);

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required. Define it in the repository root .env or .env.local file.",
  );
}

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  engine: "classic",
  datasource: {
    url: databaseUrl,
  },
});
