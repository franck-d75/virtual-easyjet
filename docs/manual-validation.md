# Validation Locale MVP

Procedure manuelle de validation du flux desktop MVP contre les backends NestJS existants, avec un vrai PostgreSQL local via Docker.

## URLs locales finales

- API VA: `http://localhost:3001/api`
- Backend ACARS: `http://localhost:3002/acars`
- Swagger API: `http://localhost:3001/docs`
- Champs par defaut du desktop:
- API base URL: `http://localhost:3001/api`
- ACARS base URL: `http://localhost:3002/acars`

## Donnees de demonstration seedées

- Pilote desktop: `pilot@va.local` / `Pilot123!`
- Pilot profile: `VA00001`
- Rank: `CPT`
- Schedule compatible: `seed-afr100-daily`
- Callsign / route: `AFR100` (`LFPG -> EGLL`)
- Aircraft: `F-HVAA` (`A20N`)
- Booking reserve pour test API: `seed-booking-demo-reserved`
- Booking deja en cours pour test desktop: `seed-booking-demo-active`
- Flight deja exploitable par le desktop: `seed-flight-demo-active`

## Demarrage exact

1. Installer les dependances:

```bash
pnpm install
```

2. Copier la configuration d'environnement:

```bash
cp .env.example .env
```

3. Forcer le desktop en mode live pour cette validation. Ajouter dans `.env.local`:

```bash
DESKTOP_BACKEND_MODE="live"
```

4. Demarrer PostgreSQL:

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

5. Generer Prisma:

```bash
pnpm db:generate
```

6. Appliquer les migrations versionnees:

```bash
pnpm --filter @va/database exec prisma migrate deploy
```

7. Seed de demonstration:

```bash
pnpm db:seed
```

8. Demarrer l'API VA dans un premier terminal:

```bash
pnpm dev:api
```

9. Demarrer le backend ACARS dans un second terminal:

```bash
pnpm dev:acars-service
```

10. Demarrer le desktop Electron dans un troisieme terminal:

```bash
pnpm dev:acars-desktop
```

## Scenario manuel desktop exact

1. Ouvrir le desktop.
2. Verifier que le mode backend affiche ou selectionne est `live`.
3. Verifier que les champs `API base URL` et `ACARS base URL` valent exactement `http://localhost:3001/api` et `http://localhost:3002/acars`.
4. Si le desktop avait deja ete lance avec d'anciennes valeurs memorisees, remplacer manuellement toute URL legacy sans prefixe, par exemple `http://localhost:3001` ou `http://localhost:3002`.
5. Se connecter avec `pilot@va.local` / `Pilot123!`.
6. Cliquer sur `Reload`.
7. Verifier les donnees chargees:
- le booking `seed-booking-demo-reserved` apparait en `RESERVED` et sans flight
- le booking `seed-booking-demo-active` apparait en `IN_PROGRESS`
- le flight `seed-flight-demo-active` / `AFR100` apparait en `IN_PROGRESS` et sans session ACARS
8. Cliquer sur `Create ACARS session` pour `AFR100`.
9. Verifier qu'une session est creee avec:
- `status = CONNECTED`
- `detectedPhase = PRE_FLIGHT`
10. Envoyer la telemetrie via le formulaire `Manual telemetry`, en reprenant la sequence manuelle ci-dessous.
11. Verifier la progression de phases attendue:
- `DEPARTURE_PARKING`
- `PUSHBACK`
- `TAXI_OUT`
- `TAKEOFF`
- `CLIMB`
- `CRUISE`
- `DESCENT`
- `APPROACH`
- `LANDING`
- `TAXI_IN`
- `ARRIVAL_PARKING`
12. Saisir un commentaire pilote si souhaite.
13. Cliquer sur `Complete session`.
14. Verifier le resultat final:
- la session passe en `COMPLETED`
- la phase finale devient `COMPLETED`
- le flight passe en `COMPLETED`
- le booking passe en `COMPLETED`
- un PIREP automatique est affiche avec `status = SUBMITTED`

Sequence de telemetrie manuelle validee localement:

1. Departure parking
   `lat=49.0097 lon=2.5479 alt=0 gs=0 hdg=270 vs=0 onGround=true fuel=6200 gear=100 flaps=0 parkingBrake=true`
2. Pushback
   `lat=49.00965 lon=2.5477 alt=0 gs=2 hdg=260 vs=0 onGround=true fuel=6180 gear=100 flaps=0 parkingBrake=false`
3. Taxi out
   `lat=49.01 lon=2.55 alt=0 gs=18 hdg=270 vs=0 onGround=true fuel=6150 gear=100 flaps=5 parkingBrake=false`
4. Takeoff
   `lat=49.02 lon=2.58 alt=700 gs=155 hdg=270 vs=1600 onGround=false fuel=6000 gear=40 flaps=10 parkingBrake=false`
5. Climb
   `lat=49.3 lon=1.9 alt=8000 gs=250 hdg=290 vs=1800 onGround=false fuel=5700 gear=0 flaps=0 parkingBrake=false`
6. Cruise
   `lat=50.0 lon=0.9 alt=34000 gs=440 hdg=300 vs=20 onGround=false fuel=5200 gear=0 flaps=0 parkingBrake=false`
7. Descent
   `lat=50.25 lon=0.55 alt=9000 gs=310 hdg=305 vs=-1400 onGround=false fuel=5050 gear=0 flaps=0 parkingBrake=false`
8. Approach
   `lat=50.7 lon=-0.2 alt=2500 gs=180 hdg=310 vs=-900 onGround=false fuel=4700 gear=60 flaps=15 parkingBrake=false`
9. Landing
   `lat=51.47 lon=-0.4543 alt=0 gs=120 hdg=270 vs=-200 onGround=true fuel=4500 gear=100 flaps=30 parkingBrake=false`
10. Taxi in
   `lat=51.471 lon=-0.455 alt=0 gs=18 hdg=250 vs=0 onGround=true fuel=4350 gear=100 flaps=0 parkingBrake=false`
11. Arrival parking
   `lat=51.472 lon=-0.456 alt=0 gs=0 hdg=180 vs=0 onGround=true fuel=4300 gear=100 flaps=0 parkingBrake=true`

## Endpoints effectivement utilises par le desktop

API VA:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/bookings/me`
- `GET /api/flights/me`

Backend ACARS:

- `POST /acars/sessions`
- `GET /acars/sessions/:id`
- `POST /acars/sessions/:id/telemetry`
- `POST /acars/sessions/:id/complete`

## Reinitialisation de la demo

Pour remettre le flight desktop seedé dans un etat propre:

```bash
pnpm db:seed
```

Ce reseed supprime la session ACARS, la telemetrie, les events et le PIREP attaches a `seed-flight-demo-active`, puis recree:

- `seed-booking-demo-reserved` en `RESERVED`
- `seed-booking-demo-active` en `IN_PROGRESS`
- `seed-flight-demo-active` en `IN_PROGRESS`

## Verification optionnelle du flux API booking -> flight

Le desktop MVP ne cree pas encore de flight a partir d'un booking. Pour verifier cette partie cote API sans sortir du perimetre actuel:

1. Ouvrir Swagger sur `http://localhost:3001/docs`
2. Se connecter avec `POST /auth/login`
3. Utiliser le token obtenu sur `Authorize`
4. Appeler `POST /flights` avec:

```json
{
  "bookingId": "seed-booking-demo-reserved"
}
```

Resultat attendu:

- creation d'un unique flight canonique pour ce booking
- le booking passe de `RESERVED` a `IN_PROGRESS`
- aucun second flight ne peut etre cree sur ce meme booking
