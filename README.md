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
`otacosProfile()` dans `public/profiles.js` (voir HAGTACOS et COLMIOS) — les comptes
diffèrent réellement d'une société à l'autre, il faut les reprendre du modèle signé par
l'expert-comptable, jamais les supposer identiques.

**État (3 septembre 2026)** :
- HAGTACOS et COLMIOS : profils actifs, formule vérifiée sur le modèle de juillet 2026.
  HAGTACOS reproduit le modèle à la vingtaine de centimes près sur toutes les lignes ;
  COLMIOS s'équilibre mais ses totaux de juillet (5,5 % notamment) n'ont pas pu être
  retrouvés à l'identique depuis l'export brut — à confirmer avec l'expert-comptable sur
  un mois (probablement août 2026).
- FARTACOS, EPIOS, GEIPIOS, SARIOS, HAUTIOS, MULIOS, ARIOS, VINIOS (voir `otacosPending`
  dans `profiles.js`) : structure prête, **non activées** dans `index.html` tant que leur
  modèle mensuel signé n'a pas donné leurs comptes et leur identifiant Uber réels.
