# Virtual Easyjet

Monorepo TypeScript pour la plateforme Virtual Easyjet :

- site web Next.js
- API NestJS
- backend ACARS MVP
- client desktop Electron Windows

Virtual Easyjet est une compagnie aerienne virtuelle non officielle, creee par des passionnes de simulation de vol, sans affiliation avec easyJet.

## Sprint 1

Le socle local actuellement stabilise couvre :

- lancement local unifie pour PostgreSQL + API + web
- session web SSR fiabilisee pour l'espace pilote
- espace pilote avec etats `loading / empty / error` homogenes
- theme dark premium conserve
- seed de production vierge par defaut, avec seed demo separe explicite

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
4. recharge les seeds de demo explicites
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

Le jeu de demonstration n'est charge que par `pnpm dev:local` ou `pnpm db:seed:demo`.
Le seed par defaut `pnpm db:seed` prepare une compagnie vierge avec admin, roles, ranks et settings systeme, sans donnees operationnelles fictives.

## Scripts utiles

- `pnpm dev:local` : demarrage local unifie PostgreSQL + API + web
- `pnpm dev:web` : lance seulement le frontend web
- `pnpm dev:api` : lance seulement l'API
- `pnpm dev:acars-service` : lance seulement le backend ACARS
- `pnpm dev:acars` : lance seulement le desktop ACARS
- `pnpm dev:acars-desktop` : alias historique du desktop ACARS
- `pnpm build:acars` : compile le client Electron Windows
- `pnpm build:acars-desktop` : alias historique du build desktop
- `pnpm package:acars` : genere l'installateur Windows et la version portable
- `pnpm package:acars-desktop` : alias historique du packaging desktop
- `pnpm package:acars-desktop:dir` : genere une version packee non installee
- `pnpm start:web:prod` : lance le frontend web en mode production apres build
- `pnpm start:api:prod` : lance l'API compilee en mode production apres build
- `pnpm start:acars-service:prod` : lance le service ACARS compile en mode production apres build
- `pnpm db:generate` : regenere Prisma Client
- `pnpm db:migrate` : workflow de migration Prisma
- `pnpm db:migrate:deploy` : applique les migrations versionnees en environnement cible
- `pnpm db:seed` : seed de production vierge par defaut
- `pnpm db:seed:demo` : recharge la seed de demonstration explicite
- `pnpm test:e2e` : lance le test E2E MVP backend/ACARS

Variables de seed utiles :

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_USERNAME`
- `SEED_ADMIN_PASSWORD`
- `SEED_PILOT_*` uniquement si vous voulez precharger un vrai compte pilote vide

## Packaging ACARS Windows

Le client ACARS peut etre distribue comme vrai logiciel Windows via `electron-builder`.

Commande recommande depuis la racine :

```bash
pnpm --filter @va/acars package
```

Sorties attendues :

- `apps/acars-desktop/release/Virtual-Easyjet-ACARS-Setup-0.1.0-x64.exe`
- `apps/acars-desktop/release/Virtual-Easyjet-ACARS-Portable-0.1.0-x64.exe`

Commande alternative pour verifier seulement le package sans installateur :

```bash
pnpm --filter @va/acars package:dir
```

Limites actuelles de distribution :

- pas de signature de code Windows
- `signAndEditExecutable` est desactive pour eviter un echec `winCodeSign` sur certaines machines Windows sans privilege symlink
- pas d'auto-update
- SmartScreen ou certains antivirus peuvent afficher un avertissement tant que le binaire n'est pas signe
- le lien public du telechargement doit etre branche via `ACARS_DOWNLOAD_URL`

Build simple du client :

```bash
pnpm --filter @va/acars build
```

Le telechargement web `/acars` et `/api/acars/download` ne sert plus le preview zip. Il redirige vers `ACARS_DOWNLOAD_URL` quand une release publique est configuree, ou sert localement le vrai build Windows si un installateur existe dans `apps/acars-desktop/release`.

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
- client desktop ACARS Windows avec auth reelle, OFP SimBrief et suivi SimConnect

Hors Sprint 1 :

- nouvelles features metier VA
- admin avance
- CMS avance
- qualifications, exams, checkrides
- deploiement public

## Documentation utile

- `docs/architecture.md`
- `docs/acars-msfs2024.md`
- `apps/acars-desktop/README.md`
- `docs/data-model.md`
- `docs/manual-validation.md`
- `docs/acars-distribution.md`
- `docs/deployment.md`
- `packages/database/prisma/schema.prisma`
