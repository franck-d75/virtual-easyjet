# Déploiement pré-hébergement

Ce document fige la procédure de mise en ligne actuelle de Virtual Easyjet après validation locale complète du monorepo.

## État validé

La version actuelle a été validée localement sur les points suivants :

- `pnpm build`
- `pnpm test:e2e`
- `pnpm package:acars-desktop`
- pages web publiques : `/`, `/compagnie`, `/flotte`, `/hubs`, `/routes`, `/recrutement`, `/reglement`, `/connexion`, `/live-map`, `/acars`
- session web SSR via cookies HttpOnly :
  - `POST /api/session/login`
  - `GET /api/session/me`
  - `POST /api/session/refresh`
  - `POST /api/session/logout`
  - accès aux pages `/dashboard`, `/profil`, `/bookings`, `/vols`, `/pireps`
- API live :
  - `GET /api/public/stats`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `GET /api/bookings/me`
  - `GET /api/flights/me`
  - `GET /api/acars/live`
- backend ACARS :
  - `GET /acars/health`
  - `POST /acars/sessions`
  - `GET /acars/sessions/:id`
  - `POST /acars/sessions/:id/telemetry`
  - `POST /acars/sessions/:id/complete`

## Composants à héberger

Le projet se déploie en quatre blocs distincts :

1. Web Next.js
   Route publique recommandée : `https://virtualeasyjet.example`
2. API NestJS
   URL publique recommandée : `https://api.virtualeasyjet.example/api`
3. Service ACARS NestJS
   URL publique recommandée : `https://acars.virtualeasyjet.example/acars`
4. PostgreSQL
   Base de données séparée, non exposée publiquement

Le desktop ACARS n’est pas un service serveur. Il doit être distribué séparément sous forme de binaire Windows :

- `apps/acars-desktop/release/Virtual-Easyjet-ACARS-Setup-0.1.0-x64.exe`
- `apps/acars-desktop/release/Virtual-Easyjet-ACARS-Portable-0.1.0-x64.exe`

## Variables d’environnement

Le workspace charge les variables depuis la racine via `.env`, puis `.env.local`, puis les variables système.

### Variables communes minimales

```dotenv
NODE_ENV="production"
DATABASE_URL="postgresql://user:password@db-host:5432/va_platform?schema=public"
CORS_ORIGIN="https://virtualeasyjet.example"
JWT_ACCESS_SECRET="change-me-long-random-secret"
JWT_REFRESH_SECRET="change-me-long-random-secret"
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL="30d"
```

### Web

```dotenv
WEB_API_BASE_URL="https://api.virtualeasyjet.example/api"
NEXT_PUBLIC_API_BASE_URL="https://api.virtualeasyjet.example/api"
NEXT_PUBLIC_APP_URL="https://virtualeasyjet.example"
NEXT_PUBLIC_ACARS_CURRENT_VERSION="0.1.0"
ACARS_DOWNLOAD_URL="https://downloads.virtualeasyjet.example/Virtual-Easyjet-ACARS-Setup-0.1.0-x64.exe"
NEXT_PUBLIC_ACARS_DOWNLOAD_URL="https://downloads.virtualeasyjet.example/Virtual-Easyjet-ACARS-Setup-0.1.0-x64.exe"
```

Notes :

- `WEB_API_BASE_URL` est utilisé côté serveur Next.js.
- `NEXT_PUBLIC_API_BASE_URL` est utilisé côté client.
- `ACARS_DOWNLOAD_URL` suffit pour la page `/acars` et le proxy `/api/downloads/acars`.
- `NEXT_PUBLIC_ACARS_DOWNLOAD_URL` reste utile comme fallback public explicite.

### API

```dotenv
API_PORT="3001"
```

### Service ACARS

```dotenv
ACARS_PORT="3002"
ACARS_RESUME_TIMEOUT_MINUTES="20"
ACARS_OVERSPEED_GRACE_SECONDS="15"
ACARS_HARD_LANDING_THRESHOLD_FPM="-500"
```

### Variables non nécessaires pour ce déploiement MVP

Ces variables existent dans `.env.example`, mais ne sont pas requises pour la mise en ligne MVP actuelle si vous ne branchez pas encore ce périmètre :

- `S3_ENDPOINT`
- `S3_REGION`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_BUCKET`
- `NEXT_PUBLIC_ACARS_BASE_URL`
- `NEXT_PUBLIC_WS_BASE_URL`
- `DESKTOP_API_BASE_URL`
- `DESKTOP_ACARS_BASE_URL`
- `DESKTOP_BACKEND_MODE`
- `DESKTOP_CLIENT_VERSION`
- `DESKTOP_SIMULATOR_PROVIDER`

## Commandes exactes côté serveur

Depuis la racine du monorepo :

### Installation

```bash
pnpm install --frozen-lockfile
```

### Génération Prisma

```bash
pnpm db:generate
```

### Migration de production

```bash
pnpm db:migrate:deploy
```

### Seed

Ne lancer le seed que pour une démo ou un environnement de recette.

```bash
pnpm db:seed
```

### Build complet

```bash
pnpm build
```

### Démarrage des services

Web :

```bash
pnpm start:web:prod
```

API :

```bash
pnpm start:api:prod
```

Service ACARS :

```bash
pnpm start:acars-service:prod
```

### Commandes directes équivalentes

Si vous préférez piloter les process sans `pnpm` :

```bash
node apps/api/dist/apps/api/src/main.js
node apps/acars-service/dist/apps/acars-service/src/main.js
pnpm --filter @va/web start
```

## Procédure de mise en ligne recommandée

1. Provisionner PostgreSQL.
2. Déployer le monorepo sur la machine applicative.
3. Créer le fichier `.env` à la racine avec les valeurs de production.
4. Lancer `pnpm install --frozen-lockfile`.
5. Lancer `pnpm db:generate`.
6. Lancer `pnpm db:migrate:deploy`.
7. Lancer `pnpm build`.
8. Démarrer les trois services via un superviseur de process :
   - web
   - api
   - acars-service
9. Mettre un reverse proxy devant les trois services.
10. Publier les binaires ACARS Windows sur un stockage public ou GitHub Releases.
11. Renseigner `ACARS_DOWNLOAD_URL` et `NEXT_PUBLIC_ACARS_CURRENT_VERSION`.

## Reverse proxy recommandé

Exemple d’exposition publique :

- `virtualeasyjet.example` -> `localhost:3000`
- `api.virtualeasyjet.example` -> `localhost:3001`
- `acars.virtualeasyjet.example` -> `localhost:3002`

Points d’attention :

- conserver `CORS_ORIGIN` aligné avec l’origine web publique
- activer TLS partout
- ne jamais exposer PostgreSQL
- garder des logs de process séparés pour le web, l’API et ACARS

## Artefacts à livrer

### À déployer sur le serveur

- code source du monorepo
- `node_modules` issus de `pnpm install`
- builds :
  - `apps/web/.next`
  - `apps/api/dist`
  - `apps/acars-service/dist`

### À publier séparément

- `apps/acars-desktop/release/Virtual-Easyjet-ACARS-Setup-0.1.0-x64.exe`
- `apps/acars-desktop/release/Virtual-Easyjet-ACARS-Portable-0.1.0-x64.exe`

## Points à surveiller avant production publique

- le projet est prêt pour un pré-hébergement sérieux, mais il reste sans pipeline CI/CD automatisé
- aucun lint structuré n’est encore câblé
- la couverture de tests reste concentrée sur le flux MVP principal
- le desktop Windows n’est pas signé
- le seed reste orienté démonstration, pas données réelles d’exploitation
