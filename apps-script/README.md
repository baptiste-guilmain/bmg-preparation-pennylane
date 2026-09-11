# Déploiement Workspace

Cette version fournit l'outil en Web App Google Apps Script. Les fichiers
importés (Uber, caisse) restent dans le navigateur — jamais envoyés à Drive
ni à Apps Script. L'envoi direct à Pennylane (bouton "Confirmer et envoyer")
et l'archivage Drive de chaque écriture générée sont en revanche des
fonctionnalités RÉELLES et actives : elles appellent Code.gs via
`google.script.run`, qui lit les jetons API Pennylane depuis les propriétés
de script (jamais transmis au navigateur) et écrit réellement dans Pennylane
et dans le Drive du compte de déploiement.

## Comptes requis

- **Déploiement** : `baptiste.guilmain@bmggroupe.fr` (compte du domaine
  Workspace BMG). Ne pas déployer depuis un compte Gmail personnel.
- **Jetons API Pennylane** : un par société, dans une propriété de script
  `PENNYLANE_TOKEN_<ID EN MAJUSCULES>` (Extensions > Apps Script >
  Paramètres du projet > Propriétés du script — ex. `PENNYLANE_TOKEN_HAGTACOS`).
  Sans ce jeton, l'envoi Pennylane et le suivi du mois échouent proprement
  pour cette société (message d'erreur explicite), le reste de l'outil
  continue de fonctionner.

## ⚠️ Accès : ANYONE, pas DOMAIN

Changé le 11 sept. 2026 (à la demande de Baptiste, pour un collaborateur
utilisant un compte Gmail personnel plutôt qu'un compte du domaine BMG) :

```json
"webapp": { "access": "ANYONE", "executeAs": "USER_DEPLOYING" }
```

Concrètement : **n'importe quel compte Google (pas seulement `@bmggroupe.fr`)
qui possède le lien `/exec` peut ouvrir l'outil et, faute de vérification
d'identité dans Code.gs, écrire réellement dans Pennylane sur les 15
sociétés.** Le lien `/exec` doit donc être traité comme un secret :
- ne jamais le publier dans un endroit public (voir la note plus bas sur la
  visibilité du dépôt) ;
- ne le transmettre qu'aux personnes qui doivent réellement saisir du CA.

## Publication

1. Créer un projet sur https://script.new avec le compte Workspace choisi.
2. Ajouter ou remplacer `Code.gs`, `Index.html` et le manifeste
   `appsscript.json` par les fichiers de ce dossier.
3. Dans **Déployer > Nouveau déploiement > Application Web**, choisir :
   - Exécuter en tant que : **moi** (le compte Workspace de déploiement) ;
   - Accès : **ANYONE** (voir l'avertissement ci-dessus).
4. Autoriser le projet, puis diffuser l'URL `/exec` aux personnes concernées.

## Mise à jour

Après une modification de `public/`, exécuter `node apps-script/build-appsscript.mjs`
pour régénérer `Index.html`. Une vérification GitHub Actions
(`.github/workflows/apps-script-check.yml`) échoue si `Index.html` n'a pas été
régénéré après un changement dans `public/` — un rappel pour ne pas oublier
cette étape avant de pousser.

### Publier sur Apps Script avec clasp (recommandé)

**⚠️ Il existe DEUX déploiements distincts, avec deux URL `/exec` différentes
— chacun doit être déployé séparément, `clasp push` seul ne met à jour
QUE le code source (HEAD), jamais un déploiement existant :**

- Lien de test : `AKfycbzMKFFsTKEgMHtorg5MVhN8zcCLNkvWrC77OwCPFR_dJiw6hjyn3_GQBPFTXqAYSMnBng`
- Lien officiel (celui utilisé par l'équipe) : `AKfycbz3AIVzpaMXtiZQsBezw4AvxsDXlgx5immgJSbwskY_JUeRr1mJB8wBUyagsZsJOYmxAw`

Oublier l'un des deux donne l'impression trompeuse qu'un changement est en
ligne alors qu'il ne l'est que sur l'autre lien (vécu le 11 sept. 2026 :
changement de couleur déployé sur le lien de test uniquement, "toujours vert"
sur le lien officiel pendant plusieurs échanges avant d'être repéré).

**Toujours utiliser `node deploy.mjs "description courte"` depuis
`apps-script/`** plutôt que les commandes clasp à la main : ce script
régénère `Index.html`, vérifie que le JavaScript généré est syntaxiquement
valide, puis déploie sur LES DEUX liens dans le bon ordre — impossible
d'oublier l'un des deux ou de pousser du JS cassé.

Détail de ce que fait le script (pour dépannage manuel si besoin) :
```
node build-appsscript.mjs
node --check <script extrait de Index.html>
clasp push --force
clasp deploy -i AKfycbzMKFFsTKEgMHtorg5MVhN8zcCLNkvWrC77OwCPFR_dJiw6hjyn3_GQBPFTXqAYSMnBng -d "description"
clasp deploy -i AKfycbz3AIVzpaMXtiZQsBezw4AvxsDXlgx5immgJSbwskY_JUeRr1mJB8wBUyagsZsJOYmxAw -d "description"
```

Piège rencontré une fois : `clasp deploy -i` sans le bloc `"webapp"` explicite
dans `appsscript.json` peut faire basculer le déploiement en type
**Bibliothèque** au lieu d'**Application Web**, cassant l'URL `/exec`
(« Impossible d'ouvrir le fichier »). Le manifeste de ce dossier contient donc
toujours :
```json
"webapp": { "access": "ANYONE", "executeAs": "USER_DEPLOYING" }
```
Si l'URL casse après un déploiement, vérifier dans **Déployer > Gérer les
déploiements** que la section affichée est bien « Application Web » et pas
« Bibliothèque ».

`clasp` doit être connecté au compte `baptiste.guilmain@bmggroupe.fr` (pas un
Gmail personnel) — vérifier avec `clasp show-authorized-user`, et l'API
Google Apps Script doit être activée sur CE compte précis (bien vérifier
lequel des comptes est actif avant de toucher à
`script.google.com/home/usersettings`, le compte par défaut du navigateur
est souvent le mauvais).

### Publier manuellement (sans clasp)

1. Créer un projet sur https://script.new avec le compte Workspace choisi.
2. Ajouter ou remplacer `Code.gs`, `Index.html` et le manifeste
   `appsscript.json` par les fichiers de ce dossier.
3. Dans **Déployer > Gérer les déploiements > icône crayon**, choisir
   « Nouvelle version », puis Déployer.
