# Virtual Easyjet

Monorepo TypeScript pour la plateforme Virtual Easyjet :

- site web Next.js
- API NestJS
- backend ACARS MVP
- client desktop Electron MVP

Virtual Easyjet est une compagnie aerienne virtuelle non officielle, creee par des passionnes de simulation de vol, sans affiliation avec easyJet.

## Sprint 1

Le socle local actuellement stabilise couvre :

- lancement local unifie pour PostgreSQL + API + web
- session web SSR fiabilisee pour l'espace pilote
- espace pilote avec etats `loading / empty / error` homogenes
- theme dark premium conserve
- jeu de donnees local reseede automatiquement pour une demo relancable

Ce sprint ne change pas le perimetre produit et n'ajoute pas de nouvelle feature metier.

## Prerequis

- Node.js 20+
- pnpm 10+
- Docker Desktop ou un PostgreSQL local disponible sur `localhost:5432`

## Installation

```bash
pnpm install
cp .env.example .env
```

## Demarrage local rapide

Commande unique recommandee :

```bash
pnpm dev:local
```

Cette commande :

1. verifie PostgreSQL sur `localhost:5432`
2. demarre Docker Compose si besoin
3. applique les migrations Prisma
4. recharge les seeds de demo MVP
5. lance l'API NestJS
6. lance le web Next.js

URLs locales :

- web : `http://localhost:3000`
- api : `http://localhost:3001/api`
- swagger : `http://localhost:3001/docs`
- acars service : `http://localhost:3002/acars` (demarrage manuel hors Sprint 1)
- page ACARS : `http://localhost:3000/acars`

## Comptes de demo

- pilote : `pilotdemo` / `Pilot123!`
- email pilote : `pilot@va.local`

Le seed recharge aussi les donnees de demonstration utiles pour tester l'espace pilote localement.

## Scripts utiles

- `pnpm dev:local` : demarrage local unifie PostgreSQL + API + web
- `pnpm dev:web` : lance seulement le frontend web
- `pnpm dev:api` : lance seulement l'API
- `pnpm dev:acars-service` : lance seulement le backend ACARS
- `pnpm dev:acars-desktop` : lance seulement le desktop ACARS
- `pnpm build:acars-desktop` : compile le desktop Electron
- `pnpm package:acars-desktop` : genere l'installateur Windows et la version portable
- `pnpm package:acars-desktop:dir` : genere une version packee non installee
- `pnpm start:web:prod` : lance le frontend web en mode production apres build
- `pnpm start:api:prod` : lance l'API compilee en mode production apres build
- `pnpm start:acars-service:prod` : lance le service ACARS compile en mode production apres build
- `pnpm db:generate` : regenere Prisma Client
- `pnpm db:migrate` : workflow de migration Prisma
- `pnpm db:migrate:deploy` : applique les migrations versionnees en environnement cible
- `pnpm db:seed` : recharge les seeds de demo
- `pnpm test:e2e` : lance le test E2E MVP backend/ACARS

## Packaging ACARS Windows

Le desktop peut etre distribue comme vrai logiciel Windows via `electron-builder`.

Commande recommande depuis la racine :

```bash
pnpm package:acars-desktop
```

Sorties attendues :

- `apps/acars-desktop/release/Virtual-Easyjet-ACARS-Setup-0.1.0-x64.exe`
- `apps/acars-desktop/release/Virtual-Easyjet-ACARS-Portable-0.1.0-x64.exe`

Commande alternative pour verifier seulement le package sans installateur :

```bash
pnpm package:acars-desktop:dir
```

Limites actuelles de distribution :

- pas de signature de code Windows
- `signAndEditExecutable` est desactive pour eviter un echec `winCodeSign` sur certaines machines Windows sans privilege symlink
- pas d'auto-update
- SmartScreen ou certains antivirus peuvent afficher un avertissement tant que le binaire n'est pas signe
- le lien public du telechargement doit etre branche via `ACARS_DOWNLOAD_URL`

Note PowerShell :

- si `pnpm` est bloque par la policy d'execution (`pnpm.ps1`), lancer les memes commandes avec `pnpm.cmd`

Variables web pour activer le telechargement public :

- `ACARS_DOWNLOAD_URL`
- `NEXT_PUBLIC_ACARS_CURRENT_VERSION`

Exemple :

```dotenv
ACARS_DOWNLOAD_URL="https://github.com/virtualeasyjet/virtual-easyjet-acars/releases/download/v0.1.0/Virtual-Easyjet-ACARS-Setup-0.1.0-x64.exe"
NEXT_PUBLIC_ACARS_CURRENT_VERSION="0.1.0"
```

## Validation locale web

Une fois `pnpm dev:local` lance :

1. ouvrir `http://localhost:3000`
2. verifier les pages publiques :
   - `/`
   - `/compagnie`
   - `/flotte`
   - `/hubs`
   - `/routes`
   - `/recrutement`
   - `/reglement`
   - `/connexion`
3. se connecter avec `pilotdemo` / `Pilot123!`
4. verifier l'espace pilote :
   - `/dashboard`
   - `/profil`
   - `/bookings`
   - `/vols`
   - `/pireps`

## Perimetre actuel

Inclus :

- auth web et API
- espace pilote MVP
- donnees publiques VA
- bookings, vols, PIREPs MVP
- backend ACARS MVP
- client desktop ACARS mock et live

Hors Sprint 1 :

- nouvelles features metier VA
- admin avance
- CMS avance
- qualifications, exams, checkrides
- deploiement public

## Documentation utile

- `docs/architecture.md`
- `docs/data-model.md`
- `docs/manual-validation.md`
- `docs/acars-distribution.md`
- `docs/deployment.md`
- `packages/database/prisma/schema.prisma`
