# BMG — Préparation Pennylane

Outil statique interne : les documents sont lus et transformés dans le navigateur, sans stockage serveur.

## Ajouter une société

1. Ajouter son profil dans `public/profiles.js` : établissements Uber, taux de TVA et comptes.
2. Ajouter un adaptateur de caisse dans `parseCash` si son rapport n'utilise pas les rubriques Liquide, Solide et Alcool.
3. Ajouter la société dans la liste de `public/index.html`.
4. Valider le profil sur un mois témoin en comparant chaque ligne avec un import Pennylane approuvé.

Le téléchargement reste bloqué si la société, la période, les totaux de TVA, les versements ou l'équilibre comptable ne sont pas cohérents.

## Sociétés O'Tacos

Moteur commun (`vatBreakdown: 'otacos-5.5-and-10'` dans `app.js`) partagé par toutes les
sociétés O'Tacos, validé cellule par cellule sur le modèle mensuel HAGTACOS de juillet 2026 :

- Ventes 5,5 % = (TVA 1 sur les ventes) / 0,055
- Ventes 10 % HT = [(Ventes TTC + Facturation rétroactive TTC + Offres TTC) − TTC de la
  part 5,5 %] / 1,10
- Une colonne Uber optionnelle, « Ajustement marketing (TVA incluse) », vient équilibrer
  l'écriture chez O'Tacos (crédit si positive) — absente chez PDFK/STRASGAME, elle est
  ignorée automatiquement si le fichier ne la contient pas.

Chaque société n'a que ses **comptes** et son **identifiant Uber** à définir via
`otacosProfile()` dans `public/profiles.js` — les comptes diffèrent réellement d'une
société à l'autre (confirmé : 4 comptes sur 7 différaient déjà entre HAGTACOS et
COLMIOS), il ne faut jamais les supposer identiques sans vérification.

**Comment les comptes ont été trouvés (4 septembre 2026)** : pas depuis le tableur de
l'expert-comptable seul — celui-ci peut noter un compte "de travail" différent de celui
réellement utilisé à l'import (constaté sur HAGTACOS : le tableur notait
44571100/44571500/44566020, mais Pennylane a réellement posté sur 44571008/44571006/44566).
La source fiable est l'écriture RÉELLEMENT posée dans Pennylane, lue via l'API
(`GET /ledger_entry_lines` filtré par date, puis `GET /ledger_entries/{id}` pour voir
toutes les lignes de l'écriture). Voir `refac-pennylane_3/pennylane_api.py` (projet voisin)
pour un client Pennylane déjà prêt à l'emploi.

**État (4 septembre 2026) — 10 sociétés O'Tacos actives dans `index.html`** :
- **HAGTACOS** : comptes confirmés sur l'écriture réelle de juillet 2026 ; l'outil
  reproduit cette écriture ligne par ligne, au centime près (16 lignes, testé).
- **COLMIOS** : comptes confirmés (identiques à la réalité). La répartition 5,5 %/10 %
  calculée par l'outil ne retombe pas exactement sur celle réellement postée en juillet
  (236,91 € contre 234,11 € réels sur la part 5,5 % HT — écart de quelques euros qui se
  déplace entre les deux comptes de TVA, sans casser l'équilibre global). La méthode de
  calcul exacte de l'expert-comptable pour COLMIOS n'a pas pu être retrouvée depuis
  l'export Uber brut malgré plusieurs tentatives. **À confirmer avec l'expert-comptable
  sur août 2026.**
- **FARTACOS, EPIOS, GEIPIOS, SARIOS, HAUTIOS, MULIOS, VINIOS** : comptes confirmés via
  l'écriture réelle de juillet 2026 de chaque dossier (même méthode qu'HAGTACOS).
- **ARIOS** : comptes confirmés également (structure identique aux autres sauf le compte
  de versement, `580009` au lieu de `580006`).
- **Toutes les 8** (hors HAGTACOS/COLMIOS) : activées **sans identifiant Uber**
  (`uberEstablishments` vide) à la demande de Baptiste le 4 sept. 2026 — l'outil ne peut
  donc pas vérifier que le fichier Uber déposé correspond bien à la société sélectionnée
  pour celles-ci. Il faudra un vrai export Uber de chacune pour renseigner cet
  identifiant. Aucune n'a encore été testée avec son propre fichier Uber réel (seul un
  test structurel avec le fichier HAGTACOS a été fait sur FARTACOS, pour vérifier que le
  moteur applique bien les bons comptes sans erreur — pas pour valider les montants).

**Prochaine étape prévue (compte rendu au 4 sept. 2026, tard le soir)** : Baptiste veut
tester août 2026 sur les 10 sociétés O'Tacos dès que possible. Le code est prêt et poussé
en local ; il ne manque que le push vers GitHub (bloqué côté agent, voir plus bas) pour
que ça arrive sur `https://bmg-pennylane.netlify.app`.

## Hébergement

Dépôt GitHub privé : `baptiste-guilmain/bmg-preparation-pennylane`. Déployé sur Netlify
(`https://bmg-pennylane.netlify.app`, visibilité "Public" — accessible sans compte
Netlify, mais non répertorié) à chaque push sur `main`, dossier de publication `dist`.

**Important** : l'agent Claude ne peut pas pousser vers GitHub depuis cet environnement
(bloqué par un filtre de sécurité, quelle que soit la méthode). Chaque mise à jour de
code doit être poussée manuellement par Baptiste :
```
cd "chemin du dossier"
git push origin main
```
(la première fois demande une connexion GitHub via le navigateur ; ensuite c'est
immédiat). Netlify republie automatiquement après le push.
