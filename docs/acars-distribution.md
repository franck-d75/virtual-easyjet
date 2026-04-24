# Distribution ACARS

## Objectif

Distribuer `Virtual Easyjet ACARS` comme application Windows installable,
sans changer le perimetre metier du MVP.

## Outil retenu

- `electron-builder`

Raisons :

- standard Electron tres repandu
- bon support Windows et NSIS
- packaging reproductible depuis le monorepo
- configuration simple a maintenir

## Configuration retenue

Package desktop :

- produit : `Virtual Easyjet ACARS`
- version : `0.1.0`
- cible Windows :
  - `nsis`
  - `portable`
- architecture : `x64`
- icone : `apps/acars-desktop/build-resources/icon.ico`
- sortie : `apps/acars-desktop/release/`

Particularites de build locale :

- `win.signAndEditExecutable` est desactive dans `electron-builder.json`
- raison : sur cette machine Windows, l'extraction de `winCodeSign` echouait a cause des liens symboliques sans privilege suffisant
- consequence : le packaging Windows local reste reproductible sans signature, adapte au MVP et a la pre-distribution
- un hook `afterPack` applique ensuite `rcedit` sur l'executable Windows unpacked pour reinjecter l'icone et les metadonnees Windows utiles

## Probleme d'icone Windows

Cause exacte constatee :

- `electron-builder` sait utiliser `build-resources/icon.ico` pour le setup et le binaire portable
- mais avec `win.signAndEditExecutable: false`, l'executable Windows installe pouvait conserver les ressources Electron generiques
- les raccourcis Windows bureau et menu demarrer pointent vers `Virtual Easyjet ACARS.exe`
- si cet executable garde l'icone generique, les raccourcis heritent eux aussi de la mauvaise icone

En pratique, le probleme n'etait donc pas le raccourci lui-meme, mais l'executable cible utilise par le raccourci.

## Strategie retenue pour figer la chaine Windows

Pourquoi `signAndEditExecutable` reste desactive :

- sur cette machine Windows, l'etape interne `winCodeSign` de `electron-builder` echouait a l'extraction
- cause technique : creation de liens symboliques sans privilege suffisant
- garder cette option active cassait la generation du package
- pour une chaine de release stable, on prefere un packaging reproductible non signe plutot qu'un packaging aleatoire ou bloque

Pourquoi `afterPack + rcedit` est utilise :

- `afterPack` s'execute apres creation de `release/win-unpacked/`
- a ce moment-la, l'executable Windows final existe deja et peut etre corrige avant fabrication du setup NSIS
- `rcedit` permet de definir explicitement :
  - l'icone `.ico`
  - `ProductName`
  - `FileDescription`
  - `CompanyName`
  - `FileVersion`
  - `ProductVersion`
- ainsi, le setup, l'executable installe, le raccourci bureau et le raccourci menu demarrer convergent tous vers la meme identite visuelle ACARS

Configuration actuellement figee :

- `win.icon = build-resources/icon.ico`
- `win.signAndEditExecutable = false`
- `nsis.installerIcon = build-resources/icon.ico`
- `nsis.uninstallerIcon = build-resources/icon.ico`
- `afterPack = ./scripts/after-pack.cjs`

Le hook `afterPack` applique `rcedit` sur :

- `apps/acars-desktop/release/win-unpacked/Virtual Easyjet ACARS.exe`

Resultat attendu apres packaging :

- setup Windows avec icone ACARS
- executable installe avec icone ACARS
- raccourci bureau avec icone ACARS
- raccourci menu demarrer avec icone ACARS

## Scripts

Depuis la racine du repo :

- `pnpm build:acars-desktop`
- `pnpm package:acars-desktop`
- `pnpm package:acars-desktop:dir`

Depuis `apps/acars-desktop` :

- `pnpm build`
- `pnpm package:win`
- `pnpm package:dir`

## Procedure locale exacte

1. installer les dependances :

```bash
pnpm install
```

2. compiler le desktop :

```bash
pnpm build:acars-desktop
```

3. generer les binaires Windows :

```bash
pnpm package:acars-desktop
```

Si PowerShell bloque `pnpm.ps1`, utiliser :

```bash
pnpm.cmd package:acars-desktop
```

4. verifier dans les logs de packaging la ligne :

```text
[afterPack] Patched Windows executable resources
```

5. recuperer les artefacts dans :

- `apps/acars-desktop/release/Virtual-Easyjet-ACARS-Setup-0.1.0-x64.exe`
- `apps/acars-desktop/release/Virtual-Easyjet-ACARS-Portable-0.1.0-x64.exe`

6. pour une verification sans installeur :

```bash
pnpm package:acars-desktop:dir
```

7. verification Windows recommandee apres installation :

- installer le setup
- verifier que `Virtual Easyjet ACARS.exe` est present dans `C:\Users\<user>\AppData\Local\Programs\Virtual Easyjet ACARS`
- verifier que les raccourcis :
  - bureau
  - menu demarrer
  pointent vers `Virtual Easyjet ACARS.exe,0`

## Strategie de publication recommandee

La page web publique utilise la route `/acars` et le proxy de telechargement
`/api/downloads/acars`.

Recommandation d'hebergement du binaire :

1. deposer les artefacts dans un bucket S3-compatible ou GitHub Releases
2. exposer une URL stable vers l'installateur
3. configurer `ACARS_DOWNLOAD_URL` cote site web
4. garder `NEXT_PUBLIC_ACARS_CURRENT_VERSION` synchronise avec la release

Exemple :

- `ACARS_DOWNLOAD_URL=https://downloads.virtualeasyjet.example/Virtual-Easyjet-ACARS-Setup-0.1.0-x64.exe`

## Premiere release GitHub

Procedure recommandee pour une premiere diffusion publique simple :

1. generer les artefacts localement :

```bash
pnpm package:acars-desktop
```

2. verifier les fichiers dans `apps/acars-desktop/release/`
3. creer un tag GitHub coherent avec la version desktop :

```text
v0.1.0
```

4. creer une GitHub Release intitulee par exemple :

```text
Virtual Easyjet ACARS 0.1.0
```

5. televerser uniquement les artefacts utiles a la diffusion :

- `Virtual-Easyjet-ACARS-Setup-0.1.0-x64.exe`
- `Virtual-Easyjet-ACARS-Portable-0.1.0-x64.exe`

6. ne pas publier pour cette premiere diffusion :

- `builder-debug.yml`
- `Virtual-Easyjet-ACARS-Setup-0.1.0-x64.exe.blockmap`
- le dossier `win-unpacked/`
- les fichiers de verification locale eventuels

7. recuperer l'URL publique finale de l'installateur dans GitHub Releases
8. renseigner cette URL dans `ACARS_DOWNLOAD_URL`
9. renseigner la version visible dans `NEXT_PUBLIC_ACARS_CURRENT_VERSION`
10. redeployer le site web pour activer le bouton de telechargement public

## Variables d'environnement web

Variables a renseigner pour brancher la page publique :

- `ACARS_DOWNLOAD_URL`
- `NEXT_PUBLIC_ACARS_CURRENT_VERSION`

Exemple pour la release `0.1.0` :

```dotenv
ACARS_DOWNLOAD_URL="https://github.com/virtualeasyjet/virtual-easyjet-acars/releases/download/v0.1.0/Virtual-Easyjet-ACARS-Setup-0.1.0-x64.exe"
NEXT_PUBLIC_ACARS_CURRENT_VERSION="0.1.0"
```

Comportement attendu :

- `/acars` affiche la version courante
- le bouton `Telecharger` pointe vers `/api/downloads/acars`
- `/api/downloads/acars` redirige vers `ACARS_DOWNLOAD_URL`

Si `ACARS_DOWNLOAD_URL` est absent :

- `/api/downloads/acars` renvoie vers `/acars?download=unavailable`
- la page publique affiche un etat informatif plutot qu'un lien casse

## Validation locale de premiere diffusion

Verification realisee sur la build `0.1.0` :

- setup Windows genere : `OK`
- version setup : `0.1.0`
- nom produit setup : `Virtual Easyjet ACARS`
- description setup : `Client desktop ACARS Windows pour Virtual Easyjet.`
- auteur setup : `Virtual Easyjet`
- installation silencieuse dans un dossier de test : `OK`
- lancement de l'executable installe : `OK`
- executable installe avec icone ACARS : `OK`
- raccourci bureau pointe vers `Virtual Easyjet ACARS.exe,0` : `OK`
- raccourci menu demarrer pointe vers `Virtual Easyjet ACARS.exe,0` : `OK`
- page web `/acars` avec version configuree : `OK`
- route `/api/downloads/acars` avec URL configuree : redirection `307` vers l'URL publique attendue

## Limites connues

- pas de signature de code Windows dans ce sprint
- executables verifies comme `NotSigned` sous Windows
- pas d'auto-update
- pas de canal de release incremental
- avertissement SmartScreen probable sur machines externes tant que le binaire n'est pas signe
- la distribution web est preparee, mais depend d'une URL publique reellement hebergee
