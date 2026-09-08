# Déploiement Workspace

Cette version fournit l'outil en Web App Google Apps Script. Les fichiers
importés restent dans le navigateur : aucune donnée de caisse ou Uber n'est
envoyée à Drive ni à Apps Script. L'envoi direct Pennylane bêta est volontairement
retiré ; l'équipe télécharge le fichier Excel validé.

## Compte de déploiement

Utiliser un compte du domaine Google Workspace BMG, idéalement un compte
technique pérenne. Ne pas déployer depuis un compte Gmail personnel.

## Publication

1. Créer un projet sur https://script.new avec le compte Workspace choisi.
2. Ajouter ou remplacer `Code.gs`, `Index.html` et le manifeste
   `appsscript.json` par les fichiers de ce dossier.
3. Dans **Déployer > Nouveau déploiement > Application Web**, choisir :
   - Exécuter en tant que : **moi** (le compte Workspace de déploiement) ;
   - Accès : **toute personne de l'organisation BMG**.
4. Autoriser le projet, puis diffuser l'URL `/exec` aux membres de l'équipe
   comptable.

Le script ne requiert pas de permission Drive ou Pennylane. Les restrictions
d'accès Workspace sont la barrière d'accès à l'outil.

## Vérification d'accès

L'accès « toute personne de l'organisation BMG » se base sur le domaine
`@bmggroupe.fr`, pas sur la licence : les comptes Cloud Identity Free
(Virgile, Théo, Amélie) doivent donc pouvoir ouvrir l'URL `/exec` sans
licence Workspace payante. À confirmer en se connectant avec un de ces
comptes après le premier déploiement.

## Mise à jour

Après une modification de `public/`, exécuter `node apps-script/build-appsscript.mjs`
pour régénérer `Index.html`. Une vérification GitHub Actions
(`.github/workflows/apps-script-check.yml`) échoue si `Index.html` n'a pas été
régénéré après un changement dans `public/` — un rappel pour ne pas oublier
cette étape avant de pousser.

### Publier sur Apps Script avec clasp (recommandé)

Le dossier est relié au projet existant via `apps-script/.clasp.json`
(le fichier ne contient que l'ID du script, pas de secret). Depuis
`apps-script/` :

```
clasp push --force
clasp deploy -i AKfycbz3AIVzpaMXtiZQsBezw4AvxsDXlgx5immgJSbwskY_JUeRr1mJB8wBUyagsZsJOYmxAw -d "description courte"
```

`clasp push` envoie `Code.gs`, `Index.html` et `appsscript.json`. `clasp deploy -i`
crée une nouvelle version sur le déploiement EXISTANT (même URL `/exec`, ne pas
omettre `-i` sinon un nouveau déploiement avec une nouvelle URL est créé).

Piège rencontré une fois : `clasp deploy -i` sans le bloc `"webapp"` explicite
dans `appsscript.json` peut faire basculer le déploiement en type
**Bibliothèque** au lieu d'**Application Web**, cassant l'URL `/exec`
(« Impossible d'ouvrir le fichier »). Le manifeste de ce dossier contient donc
toujours :
```json
"webapp": { "access": "DOMAIN", "executeAs": "USER_DEPLOYING" }
```
Si l'URL casse après un `clasp deploy`, vérifier dans **Déployer > Gérer les
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
