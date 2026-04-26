# Validation Locale MVP

Procedure manuelle de validation du flux desktop MVP contre les backends NestJS existants, avec un vrai PostgreSQL local via Docker.

## URLs locales finales

- API VA: `http://localhost:3001/api`
- Backend ACARS: `http://localhost:3002/acars`
- Swagger API: `http://localhost:3001/docs`
- API base URL desktop: `http://localhost:3001/api`
- ACARS base URL desktop: `http://localhost:3002/acars`

## Donnees de demonstration

Cette procedure utilise la seed de demonstration explicite :

```bash
pnpm db:seed:demo
```

Comptes et objets attendus :

- Pilote desktop: `pilot@va.local` / `Pilot123!`
- Pilot profile: `VA00001`
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

7. Charger la seed de demonstration:

```bash
pnpm db:seed:demo
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
2. Verifier que le mode backend affiche ou selectionne `live`.
3. Verifier que `API base URL` et `ACARS base URL` valent exactement `http://localhost:3001/api` et `http://localhost:3002/acars`.
4. Se connecter avec `pilot@va.local` / `Pilot123!`.
5. Cliquer sur `Reload`.
6. Verifier les donnees chargees :
   - `seed-booking-demo-reserved` apparait en `RESERVED` et sans flight
   - `seed-booking-demo-active` apparait en `IN_PROGRESS`
   - `seed-flight-demo-active` apparait en `IN_PROGRESS` et sans session ACARS
7. Cliquer sur `Create ACARS session`.
8. Verifier qu'une session est creee avec :
   - `status = CONNECTED`
   - `detectedPhase = PRE_FLIGHT`
9. Envoyer la telemetrie via le formulaire `Manual telemetry`.
10. Verifier la progression de phases attendue :
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
11. Saisir un commentaire pilote si souhaite.
12. Cliquer sur `Complete session`.
13. Verifier le resultat final :
    - la session passe en `COMPLETED`
    - la phase finale devient `COMPLETED`
    - le flight passe en `COMPLETED`
    - le booking passe en `COMPLETED`
    - un PIREP automatique est affiche avec `status = SUBMITTED`

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

## Reinitialisation de la demonstration

Pour remettre le flight desktop seed dans un etat propre:

```bash
pnpm db:seed:demo
```

## Verification optionnelle du flux API booking -> flight

Le desktop MVP ne cree pas encore de flight a partir d'un booking. Pour verifier cette partie cote API:

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
