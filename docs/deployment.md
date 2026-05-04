# Deployment

This document captures the current deployment procedure for Virtual Easyjet after local validation of the monorepo.

## Validated scope

The current version has been validated on these points:

- `pnpm build`
- `pnpm test:e2e`
- `pnpm package:acars-desktop`
- public web pages: `/`, `/compagnie`, `/flotte`, `/hubs`, `/routes`, `/recrutement`, `/reglement`, `/connexion`, `/live-map`, `/acars`
- SSR web session via HttpOnly cookies:
  - `POST /api/session/login`
  - `GET /api/session/me`
  - `POST /api/session/refresh`
  - `POST /api/session/logout`
  - access to `/dashboard`, `/profil`, `/bookings`, `/vols`, `/pireps`
- live API:
  - `GET /api/public/home`
  - `GET /api/public/stats`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `GET /api/bookings/me`
  - `GET /api/flights/me`
  - `GET /api/acars/live`
- ACARS service:
  - `GET /acars/health`
  - `POST /acars/sessions`
  - `GET /acars/sessions/:id`
  - `POST /acars/sessions/:id/telemetry`
  - `POST /acars/sessions/:id/complete`

## Hosted components

The platform deploys as four blocks:

1. Next.js web app
2. NestJS API
3. NestJS ACARS service
4. PostgreSQL

The Windows ACARS desktop client is distributed separately as a binary, not hosted as a server process.

## Environment variables

The workspace loads variables from the repo root using `.env`, then `.env.local`, then system environment variables.

### Shared minimum

```dotenv
NODE_ENV="production"
DATABASE_URL="postgresql://user:password@db-host:5432/va_platform?schema=public"
CORS_ORIGIN="https://www.virtual-easyjet.fr,https://virtual-easyjet.fr,https://virtual-easyjet-web.vercel.app"
JWT_ACCESS_SECRET="change-me-long-random-secret"
JWT_REFRESH_SECRET="change-me-long-random-secret"
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL="30d"
```

### Web

```dotenv
WEB_API_BASE_URL="https://api.virtual-easyjet.fr/api"
NEXT_PUBLIC_API_BASE_URL="https://api.virtual-easyjet.fr/api"
NEXT_PUBLIC_API_URL="https://api.virtual-easyjet.fr"
NEXT_PUBLIC_APP_URL="https://www.virtual-easyjet.fr"
NEXT_PUBLIC_ACARS_CURRENT_VERSION="0.1.2"
ACARS_INSTALLER_DOWNLOAD_URL="https://github.com/franck-d75/virtual-easyjet/releases/download/v0.1.2/Virtual-Easyjet-ACARS-Setup-0.1.2-x64.exe"
ACARS_PORTABLE_DOWNLOAD_URL="https://github.com/franck-d75/virtual-easyjet/releases/download/v0.1.2/Virtual-Easyjet-ACARS-Portable-0.1.2-x64.exe"
```

### API

```dotenv
API_PORT="3001"
```

### ACARS service

```dotenv
ACARS_PORT="3002"
ACARS_RESUME_TIMEOUT_MINUTES="20"
ACARS_OVERSPEED_GRACE_SECONDS="15"
ACARS_HARD_LANDING_THRESHOLD_FPM="-500"
```

### Optional clean production seed

```dotenv
SEED_ADMIN_EMAIL="admin@virtual-easyjet.local"
SEED_ADMIN_USERNAME="virtualeasyjet-admin"
SEED_ADMIN_PASSWORD="ChangeMe-Admin123!"
SEED_ADMIN_FIRST_NAME="Virtual"
SEED_ADMIN_LAST_NAME="Admin"
SEED_ADMIN_COUNTRY_CODE="FR"
```

Optional pilot bootstrap:

```dotenv
SEED_PILOT_EMAIL=""
SEED_PILOT_USERNAME=""
SEED_PILOT_PASSWORD=""
SEED_PILOT_FIRST_NAME=""
SEED_PILOT_LAST_NAME=""
SEED_PILOT_COUNTRY_CODE="FR"
SEED_PILOT_NUMBER=""
SEED_PILOT_CALLSIGN=""
SEED_PILOT_SIMBRIEF_ID=""
```

Leave `SEED_PILOT_*` empty if you want the production seed to keep public stats at `0`.

## Server commands

From the monorepo root:

### Install

```bash
pnpm install --frozen-lockfile
```

### Prisma client

```bash
pnpm db:generate
```

### Migrations

```bash
pnpm db:migrate:deploy
```

### Clean production seed

```bash
pnpm db:seed
```

This seed keeps the platform empty by default:

- admin account
- roles
- ranks
- settings
- no demo fleet
- no demo hubs
- no demo routes
- no demo bookings
- no demo flights
- no demo PIREPs
- no demo ACARS traffic

### Optional demo seed

```bash
pnpm db:seed:demo
```

Use this demo seed only for local showcase or desktop validation, never as the default production bootstrap.

### Full build

```bash
pnpm build
```

### Service start

Web:

```bash
pnpm start:web:prod
```

API:

```bash
pnpm start:api:prod
```

ACARS service:

```bash
pnpm start:acars-service:prod
```

## Recommended deployment sequence

1. Provision PostgreSQL.
2. Deploy the monorepo to the application host.
3. Create the root `.env` file with production values.
4. Run `pnpm install --frozen-lockfile`.
5. Run `pnpm db:generate`.
6. Run `pnpm db:migrate:deploy`.
7. Run `pnpm db:seed`.
8. Run `pnpm build`.
9. Start the three application processes behind a supervisor.
10. Publish the ACARS Windows binaries separately.
11. Set `NEXT_PUBLIC_ACARS_CURRENT_VERSION`, `ACARS_INSTALLER_DOWNLOAD_URL`, and `ACARS_PORTABLE_DOWNLOAD_URL`.

## Reverse proxy example

- `www.virtual-easyjet.fr` -> `localhost:3000`
- `api.virtual-easyjet.fr` -> `localhost:3001`
- `acars.virtual-easyjet.fr` -> `localhost:3002`

Keep these rules:

- align `CORS_ORIGIN` with the public web origin
- enable TLS everywhere
- never expose PostgreSQL publicly
- keep separate process logs for web, API and ACARS

## Release artifacts

### Deploy on the server

- monorepo source code
- installed dependencies from `pnpm install`
- build outputs:
  - `apps/web/.next`
  - `apps/api/dist`
  - `apps/acars-service/dist`

### Publish separately

- `apps/acars-desktop/release/Virtual-Easyjet-ACARS-Setup-0.1.2-x64.exe`
- `apps/acars-desktop/release/Virtual-Easyjet-ACARS-Portable-0.1.2-x64.exe`

## Notes before public launch

- the project is ready for serious preproduction hosting
- CI/CD is still manual
- structured linting is still limited
- tests are concentrated on the MVP flow
- the Windows desktop binary is not code-signed yet
- the default production seed is now clean and no longer loads demo operations
