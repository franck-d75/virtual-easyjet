# Validation pilote production

Ce document sert de checklist pour tester un vol complet sur le site heberge
et le client ACARS publie.

## Pre-requis

- compte pilote actif
- compte SimBrief connecte au profil pilote
- au moins une route active sur le site
- au moins un avion de flotte relie a un airframe SimBrief
- ACARS `0.1.2` installe ou lance en version portable

## Parcours web avant ACARS

1. Ouvrir le site public et se connecter.
2. Aller sur `Routes`.
3. Cliquer sur `Reserver ce vol` sur une route active.
4. Verifier que la page `Reservation` devient disponible dans le menu pilote.
5. Depuis `Reservation`, cliquer sur `Generer via SimBrief`.
6. Verifier que SimBrief s'ouvre avec :
   - depart et arrivee de la route reservee
   - callsign/numero de vol de la route
   - appareil affecte depuis la flotte
   - airframe SimBrief correspondant a l'avion de flotte
   - alternates en `AUTO`
7. Generer l'OFP dans SimBrief.
8. Revenir sur la page `Reservation`.
9. Verifier que le site detecte l'OFP correspondant.
10. Verifier que le temps bloc estime est affiche.
11. Avant lancement ACARS, verifier que `Annuler la reservation` reste disponible.
12. Annuler une reservation de test si besoin, puis reserver de nouveau le vol.

## Parcours ACARS

1. Lancer ACARS `0.1.2`.
2. Se connecter avec le meme compte pilote.
3. Recharger les operations.
4. Verifier que le vol genere depuis le site apparait comme vol exploitable.
5. Ouvrir le vol dans ACARS.
6. Demarrer la session ACARS.
7. Confirmer cote site que l'annulation n'est plus disponible une fois la
   session ACARS creee.

## Controle Live Map

Verifier la carte en direct pendant les phases du vol :

- appareil au parking : icone et trace rouges
- pushback : icone et trace orange
- taxi : icone et trace jaunes
- en vol : icone et trace verts
- tag avion : alternance entre numero de vol et nom pilote
- route SimBrief : visible au survol de l'avion, pas affichee pour tous les
  avions en permanence
- aucune route visible si aucun pilote n'est connecte a ACARS

## Fin de vol et PIREP

1. Terminer le vol dans ACARS.
2. Verifier que la session passe en `COMPLETED`.
3. Verifier que le vol passe en `COMPLETED`.
4. Verifier qu'un PIREP est cree.
5. Aller sur `PIREP` dans l'espace pilote.
6. Verifier que le rapport est visible.
7. Verifier sur le tableau de bord et le profil :
   - heures de vol actualisees
   - XP actualises
   - rang recalcule si le seuil est atteint
   - nombre de vols termines actualise

## Regression a surveiller

- un vol deja pris en charge par ACARS ne doit plus etre annulable
- un OFP SimBrief qui ne correspond pas a la route reservee ne doit pas creer
  de vol ACARS
- un pilote doit utiliser son propre compte SimBrief si son profil en contient
  un
- les anciennes releases ACARS doivent rester disponibles dans GitHub Releases
