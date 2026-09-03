# BMG — Préparation Pennylane

Outil statique interne : les documents sont lus et transformés dans le navigateur, sans stockage serveur.

## Ajouter une société

1. Ajouter son profil dans `public/profiles.js` : établissements Uber, taux de TVA et comptes.
2. Ajouter un adaptateur de caisse dans `parseCash` si son rapport n'utilise pas les rubriques Liquide, Solide et Alcool.
3. Ajouter la société dans la liste de `public/index.html`.
4. Valider le profil sur un mois témoin en comparant chaque ligne avec un import Pennylane approuvé.

Le téléchargement reste bloqué si la société, la période, les totaux de TVA, les versements ou l'équilibre comptable ne sont pas cohérents.
