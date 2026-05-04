# Virtual Easyjet ACARS Desktop

Client desktop Windows Electron pour Virtual Easyjet.

## Fonctions couvertes

- authentification pilote sur `https://api.virtual-easyjet.fr/api`
- chargement du profil pilote et du dernier OFP SimBrief
- lecture des reservations et vols exploitables
- ouverture d'une session ACARS reelle
- suivi SimConnect MSFS2024 avec envoi periodique de telemetrie
- cloture de vol et preparation du PIREP

## Prerequis

- Windows 10/11
- Node.js 20+
- pnpm 10+
- MSFS2024 lance pour le suivi live SimConnect

## Build

```bash
pnpm --filter @va/acars build
```

## Packaging Windows

```bash
pnpm --filter @va/acars package
```

Artefacts generes :

- `C:\Users\franc\Documents\Codex\2026-04-21-tu-es-un-ing-nieur-logiciel\apps\acars-desktop\release\Virtual-Easyjet-ACARS-Setup-0.1.2-x64.exe`
- `C:\Users\franc\Documents\Codex\2026-04-21-tu-es-un-ing-nieur-logiciel\apps\acars-desktop\release\Virtual-Easyjet-ACARS-Portable-0.1.2-x64.exe`

## Configuration desktop

Valeurs par defaut :

- API VA : `https://api.virtual-easyjet.fr/api`
- service ACARS : `https://api.virtual-easyjet.fr/acars`
- simulateur cible : `MSFS2024`
- mode telemetrie : `simconnect`

## Flux operationnel

1. se connecter avec le compte pilote
2. charger reservations, vols et OFP
3. creer le vol depuis une reservation si necessaire
4. ouvrir une session ACARS
5. connecter MSFS2024 via SimConnect
6. lancer le suivi live
7. terminer le vol et envoyer le PIREP

## Limites connues

- pas d'auto-update
- pas de signature de code Windows
- l'API ACARS doit etre joignable pour le tracking live
- si MSFS2024 est ferme, le client reste utilisable mais le suivi SimConnect reste indisponible
