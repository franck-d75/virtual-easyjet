# Distribution ACARS

Virtual Easyjet ACARS est distribue comme application Windows via
`electron-builder`.

## Version courante

- version publiee : `0.1.2`
- tag GitHub : `v0.1.2`
- page release : `https://github.com/franck-d75/virtual-easyjet/releases/tag/v0.1.2`
- ancien canal conserve : les releases precedentes ne doivent pas etre
  supprimees

## Artefacts publies

La release courante expose deux packages :

- `Virtual-Easyjet-ACARS-Setup-0.1.2-x64.exe`
- `Virtual-Easyjet-ACARS-Portable-0.1.2-x64.exe`

Le fichier blockmap peut etre conserve dans GitHub Releases pour preparer un
futur mecanisme d'update, mais il n'est pas necessaire pour l'installation
manuelle.

## Packaging local

Depuis la racine du repo :

```bash
pnpm --filter @va/acars package
```

Sorties attendues :

- `apps/acars-desktop/release/Virtual-Easyjet-ACARS-Setup-0.1.2-x64.exe`
- `apps/acars-desktop/release/Virtual-Easyjet-ACARS-Portable-0.1.2-x64.exe`

Verification rapide sans creer l'installateur :

```bash
pnpm --filter @va/acars package:dir
```

## Page web

La page publique `/acars` affiche deux boutons :

- version installation : `/api/acars/download?variant=installer`
- version portable : `/api/acars/download?variant=portable`

La route historique `/api/downloads/acars` redirige toujours vers
`/api/acars/download`, donc elle conserve le comportement installateur par
defaut.

## Resolution des liens

Le web resout le telechargement dans cet ordre :

1. URL explicite configuree dans l'environnement
2. fallback GitHub Releases pour la version courante

Variables supportees :

- `NEXT_PUBLIC_ACARS_CURRENT_VERSION`
- `ACARS_INSTALLER_DOWNLOAD_URL`
- `NEXT_PUBLIC_ACARS_INSTALLER_DOWNLOAD_URL`
- `ACARS_PORTABLE_DOWNLOAD_URL`
- `NEXT_PUBLIC_ACARS_PORTABLE_DOWNLOAD_URL`

Compatibilite historique :

- `ACARS_DOWNLOAD_URL`
- `NEXT_PUBLIC_ACARS_DOWNLOAD_URL`

Ces deux anciennes variables pointent uniquement vers la version installation.

Exemple :

```dotenv
NEXT_PUBLIC_ACARS_CURRENT_VERSION="0.1.2"
ACARS_INSTALLER_DOWNLOAD_URL="https://github.com/franck-d75/virtual-easyjet/releases/download/v0.1.2/Virtual-Easyjet-ACARS-Setup-0.1.2-x64.exe"
ACARS_PORTABLE_DOWNLOAD_URL="https://github.com/franck-d75/virtual-easyjet/releases/download/v0.1.2/Virtual-Easyjet-ACARS-Portable-0.1.2-x64.exe"
```

## Configuration electron-builder

- cible Windows : `nsis` et `portable`
- architecture : `x64`
- icone : `apps/acars-desktop/build-resources/icon.ico`
- sortie : `apps/acars-desktop/release/`
- signature : non activee pour le MVP

`win.signAndEditExecutable` reste desactive afin d'eviter les echecs
`winCodeSign` sur les machines Windows sans privilege symlink. Le hook
`afterPack` applique `rcedit` sur l'executable Windows pour reinjecter l'icone
et les metadonnees produit.

## Verification avant publication

1. Compiler le desktop :

```bash
pnpm --filter @va/acars build
```

2. Generer les packages :

```bash
pnpm --filter @va/acars package
```

3. Verifier que les fichiers setup et portable existent dans `release/`.
4. Creer ou mettre a jour la GitHub Release correspondant au tag.
5. Televerser le setup, la portable et, si souhaite, le blockmap.
6. Verifier `/acars` et les deux liens de telechargement.

## Limites connues

- executables non signes
- avertissement SmartScreen possible
- pas d'auto-update actif
- distribution Windows uniquement pour le moment
