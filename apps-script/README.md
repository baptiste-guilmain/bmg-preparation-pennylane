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

## Mise à jour

Après une modification de `public/`, exécuter `node apps-script/build-appsscript.mjs`,
puis créer une nouvelle version du déploiement Apps Script. Tester l'URL `/dev`
avant de publier l'URL `/exec`.
