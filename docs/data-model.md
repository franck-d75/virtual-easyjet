# Modele de donnees MVP

## Principes

- `bookings` represente la reservation pilote.
- `flights` represente l'instance operationnelle d'un vol reserve.
- `acars_sessions` represente la session technique de tracking.
- `telemetry_points` garde l'historique brut minimum.
- `flight_events` garde les evenements interpretes.
- `pireps` garde le rapport final exploitable par le metier.

Cette separation permet de garder des regles claires:

- un vol doit etre reserve avant depart,
- un booking ne produit qu'un seul `flight`,
- un `pirep` final reference un `flight`,
- une session ACARS peut etre interrompue puis reprise si elle reste rattachee au meme `flight`.

Regle canonique supplementaire a figer:

- le `flight` est l'unique execution canonique du `booking`,
- un `booking` abort ne produit pas un second `flight`,
- toute relance apres abort exige un nouveau `booking`, sauf regle metier future explicitement documentee.

## Ownership des tables par service

Pour eviter le chevauchement entre `apps/api` et `apps/acars-service`, chaque table a un proprietaire principal en ecriture.

### Tables ecrites principalement par `apps/api`

- `users`
- `pilot_profiles`
- `roles`
- `user_roles`
- `refresh_tokens`
- `ranks`
- `hubs`
- `airports`
- `aircraft_types`
- `aircraft`
- `routes`
- `schedules`
- `bookings`
- `qualifications`
- `exams`
- `checkrides`
- `staff_notes`
- `settings`
- `news_posts`
- `content_pages`

### Tables ecrites principalement par `apps/acars-service`

- `flights`
- `acars_sessions`
- `telemetry_points`
- `flight_events`
- `violations`
- champs techniques et auto-generes des `pireps`

### Tables partagees avec regles d'ecriture strictes

- `pireps`
  `apps/acars-service` cree et remplit la partie automatique.
  `apps/api` met a jour la moderation, le statut final et les commentaires staff.
- `bookings`
  `apps/api` cree, annule et gere la reservation.
  `apps/acars-service` ne peut mettre a jour que l'etat d'execution lie au vol.
- `flights`
  `apps/acars-service` cree et maintient l'execution.
  `apps/api` lit pour l'historique, le dashboard et le live.

Pour le MVP immediat:

- `flights` et `acars_sessions` sont traites comme des entites d'execution canonique,
- la reconnexion ACARS ne cree pas une nouvelle entite de vol,
- la reprise ACARS ne cree pas une seconde session de vol dans le schema MVP retenu.

## Tables metier principales

| Table | Role dans le MVP | Notes |
| --- | --- | --- |
| `users` | Compte applicatif principal | Utilise pour le web, l'admin et le client ACARS |
| `pilot_profiles` | Identite pilote VA | Numero pilote, hub, rank, stats cumulees, SimBrief Pilot ID optionnel |
| `roles` | Catalogue de roles | `admin`, `staff`, `pilot`, etc. |
| `ranks` | Grades pilotes | Conditionnent progression et acces |
| `hubs` | Bases operationnelles | Rattachees a un aeroport |
| `airports` | Aeroports de reference | ICAO/IATA, coordonnees, statut |
| `aircraft_types` | Types avion | A320, B738, C208, etc. |
| `aircraft` | Flotte operee | Immatriculation, type, hub, statut |
| `routes` | Routes VA | Couple depart/arrivee, type avion recommande |
| `schedules` | Vols programmables | Jours d'operation et horaires standards |
| `bookings` | Reservations pilotes | Point d'entree obligatoire d'un vol |
| `flights` | Vols operationnels | Crees a partir d'un booking demarre |
| `acars_sessions` | Sessions ACARS | Etat courant et resume live |
| `telemetry_points` | Points bruts | Historique minimum pour reconstruction et audit |
| `flight_events` | Evenements detectes | Phases, anomalies, checkpoints metier |
| `pireps` | Rapport final | Manuel ou auto, score et validation |
| `violations` | Infractions / anomalies | Overspeed, hard landing, crash, etc. |
| `qualifications` | Catalogue de qualifications | Types avion, aeroport, procedure |
| `exams` | Examens de qualification | Base theorique minimale |
| `checkrides` | Evaluations pratiques | Resultat staff/pilote |
| `staff_notes` | Notes internes staff | Historique de moderation et suivi |
| `settings` | Parametres applicatifs | Seuils ACARS, branding, options publiques |
| `news_posts` | Actualites | Contenu public date et publie |

## Tables de support ajoutees

Ces tables ne faisaient pas partie de la liste minimale, mais elles sont necessaires a une implementation propre:

| Table | Pourquoi elle existe |
| --- | --- |
| `user_roles` | Relation N-N entre utilisateurs et roles |
| `refresh_tokens` | Rotation des refresh tokens JWT |
| `pilot_qualifications` | Attribution des qualifications aux pilotes |
| `content_pages` | Edition simple des pages publiques statiques |

## Relations clefs

- `users 1-1 pilot_profiles`
- `users N-N roles` via `user_roles`
- `pilot_profiles 1-N bookings`
- `bookings 1-1 flights`
- `flights 1-0..1 acars_sessions`
- `acars_sessions 1-N telemetry_points`
- `acars_sessions 1-N flight_events`
- `flights 1-1 pireps`
- `pireps 1-N violations`
- `pilot_profiles N-N qualifications` via `pilot_qualifications`

## Cycle de vie metier principal

### 1. Avant vol

- `users` et `pilot_profiles` representent le pilote.
- `routes`, `schedules`, `aircraft`, `airports` representent l'offre VA.
- `bookings` represente le choix du pilote pour un vol donne.

### 2. Execution du vol

- `flights` represente le vol reellement demarre a partir d'un booking.
- `acars_sessions` represente l'unique session canonique de tracking du vol dans le MVP immediat.
- `telemetry_points` represente les echantillons techniques.
- `flight_events` represente les evenements interpretables.

### 3. Apres vol

- `violations` represente les incoherences ou fautes detectees.
- `pireps` represente le rapport final.
- `staff_notes` garde le contexte staff si necessaire.

## Regles metier encodees dans le modele

- `bookings.flight` est unique: un booking produit au maximum un vol.
- `pireps.flightId` est unique: un vol ne produit qu'un PIREP final principal.
- `acars_sessions.flightId` est unique: un vol ne produit qu'une session canonique dans le MVP immediat.
- `acars_sessions.resumeToken` est unique: la reprise de session reste controlee.
- `pilot_profiles.userId` est unique: un compte n'a qu'un profil pilote.
- `aircraft.registration`, `airports.icao`, `news_posts.slug` sont uniques.

Regles metier attendues dans les services:

- un vol ne peut pas etre demarre sans `booking` reserve,
- un `flight` reste l'execution canonique unique du `booking`,
- un `flight` abort ne declenche pas la creation d'un second `flight` sur le meme `booking`,
- l'appareil utilise doit correspondre a la reservation ou a une substitution autorisee,
- les aeroports depart/arrivee doivent correspondre a la reservation,
- un PIREP auto ne doit pas etre finalise sans parking d'arrivee detecte, sauf anomalie explicite,
- une reprise ACARS ne doit rattacher la session qu'au meme `flight`.

## Preparation SimBrief

Le MVP stocke un champ optionnel `pilot_profiles.simbriefPilotId`.

Choix retenu :

- stockage du `SimBrief Pilot ID` plutot que du username
- raison : l'API SimBrief permet les deux, mais le `userid` est la cle la plus stable pour retrouver un OFP
- le champ est nullable pour ne pas bloquer les pilotes non equipes
- une contrainte d'unicite protege la liaison pilote -> compte SimBrief

Ce champ prepare les evolutions suivantes sans alourdir le sprint courant :

- recuperation du dernier OFP cote backend, a la demande et sans stockage persistant
- exploitation dans le web pilote via un resume OFP normalise
- exploitation future dans le desktop ACARS

## Choix sur l'identite pilote en session ACARS

Le schema retire `AcarsSession.userId`.

Le choix retenu est:

- l'identite pilote canonique pendant le vol est portee par `flight.pilotProfileId`,
- `User` reste une identite d'authentification,
- `PilotProfile` reste l'identite metier pilote,
- on evite ainsi une ambiguite `user` versus `pilotProfile` dans les requetes ACARS.

Si une lecture directe du pilote devient necessaire plus tard, on ajoutera preferentiellement un `pilotProfileId` denormalise, pas un `userId` concurrent.

## Champs importants pour l'ACARS

Le modele garde deux niveaux de granularite:

- donnees brutes dans `telemetry_points`,
- resume courant dans `acars_sessions`.

Pourquoi:

- la carte live et l'etat en cours doivent etre rapides a lire,
- l'historique brut doit rester disponible pour reconstruire un PIREP ou verifier une anomalie,
- on evite de calculer le live en relisant toute la telemetrie.

`acars_sessions` contient donc un snapshot courant:

- position,
- altitude,
- groundspeed,
- heading,
- vertical speed,
- on ground,
- phase detectee,
- derniere telemetrie,
- carburant depart/arrivee.

Le lien entre `flights`, `acars_sessions` et `pireps` est strict:

- un `flight` a au plus une `acars_session` dans le MVP immediat,
- cette session unique est la session canonique pour le PIREP automatique,
- `Pirep.sessionId` peut etre nul uniquement pour un cas manuel ou exceptionnel sans session ACARS exploitable.

`telemetry_points` garde volontairement un set minimal:

- latitude,
- longitude,
- altitude,
- groundspeed,
- heading,
- vertical speed,
- on ground,
- carburant total,
- gear,
- flaps,
- parking brake.

## Modele de scoring et de violations

Le schema n'impose pas un algorithme complique. Il prepare simplement:

- des `flight_events` comprehensibles,
- des `violations` explicites,
- un `score` final dans `pireps`,
- un `summary` JSON pour stocker les details calcules.

Cette approche permet de faire evoluer l'algorithme sans casser le schema.

### Vocabulaire ferme des `flight_events`

Le champ `type` utilise un vocabulaire ferme:

- `BOOKING_VALIDATED`
- `SESSION_STARTED`
- `SESSION_RESUMED`
- `SESSION_DISCONNECTED`
- `PHASE_CHANGED`
- `VIOLATION_RECORDED`
- `PIREP_GENERATED`
- `FLIGHT_COMPLETED`
- `FLIGHT_ABORTED`

La granularite plus fine reste portee par:

- `phase`
- `code`
- `message`
- `payload`

### Structure des `violations`

Pour eviter les chaines libres:

- `thresholdNumeric` porte le seuil numerique principal si applicable,
- `measuredNumeric` porte la valeur mesuree principale si applicable,
- `payload` porte le contexte structure si besoin, par exemple l'unite, la duree, les valeurs attendues et recues, ou la cle de reglage.

## Index recommandes des le MVP

- `telemetry_points(sessionId, capturedAt)`
- `flight_events(sessionId, occurredAt)`
- `acars_sessions(status, lastTelemetryAt)`
- `bookings(pilotProfileId, status)`
- `bookings(bookedFor, status)`
- `flights(status, createdAt)`
- `violations(pilotProfileId, detectedAt)`
- `news_posts(status, publishedAt)`

## Pages publiques et contenu

Le besoin de contenu public va au-dela des actualites:

- recrutement,
- reglement,
- presentation,
- documentation ACARS.

Plutot que de surcharger `settings`, le schema ajoute `content_pages` pour permettre une edition simple des pages administrees.

## Format strict des champs de planning

### `Schedule.departureTimeUtc`

- format texte `HH:MM`
- heure UTC
- 24 heures
- zero-padding obligatoire
- exemple: `08:00`

### `Schedule.arrivalTimeUtc`

- format texte `HH:MM`
- heure UTC
- 24 heures
- zero-padding obligatoire
- exemple: `09:20`

### `Schedule.daysOfWeek`

- tableau d'entiers ISO-8601
- `1 = lundi`, `7 = dimanche`
- valeurs uniques uniquement
- ordre croissant attendu
- exemple: `[1, 2, 3, 4, 5]`

## Points de vigilance du schema MVP

- `telemetry_points` peut grossir vite: il faudra une retention ou un archivage a moyen terme.
- `settings.value` et `pireps.summary` utilisent du JSON pour garder de la souplesse, mais il faut eviter d'y cacher du metier critique non documente.
- `schedules.daysOfWeek` est volontairement simple; si la planification devient plus riche, un modele plus expressif pourra etre introduit.
- `flights` et `bookings` doivent rester separes: reservation et execution ne doivent pas etre refusionnees dans une seule table.
- le schema conserve quelques tables de phase suivante, mais le MVP executable immediat ne doit pas dependre d'elles.

## Evolution prevue sans casser le MVP

- ajout d'un read-model `live_flights` si la charge augmente,
- retention plus fine des `telemetry_points`,
- audit plus complet des actions admin,
- ajout d'attachements ou de documents stockes en S3,
- extension du moteur de qualifications.

## Perimetre MVP executable immediat

### Tables/modules a utiliser maintenant

- `users`
- `pilot_profiles`
- `roles`
- `user_roles`
- `refresh_tokens`
- `ranks`
- `hubs`
- `airports`
- `aircraft_types`
- `aircraft`
- `routes`
- `schedules`
- `bookings`
- `flights`
- `acars_sessions`
- `telemetry_points`
- `flight_events`
- `pireps`
- `violations`
- `news_posts` si la premiere livraison expose deja des actualites gerees en base

### Tables/modules reportes apres MVP immediat

- `qualifications`
- `pilot_qualifications`
- `exams`
- `checkrides`
- `staff_notes`
- `content_pages`
- usage elargi de `settings` hors seuils essentiels et branding minimum
