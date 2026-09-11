import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = name => readFile(resolve(root, 'public', name), 'utf8');
const [html, styles, clarity, profiles, app] = await Promise.all([
  source('index.html'), source('styles.css'), source('clarity.css'), source('profiles.js'), source('app.js')
]);
const css = `${styles}\n${clarity}`;

const body = html.match(/<body>([\s\S]*)<\/body>/i)?.[1];
if (!body) throw new Error('Corps HTML introuvable.');

// Depuis le 10 sept. 2026, le panneau "Envoi direct à Pennylane" (bêta) est
// INCLUS tel quel dans le bundle Apps Script — c'est le seul environnement où
// il fonctionne réellement (google.script.run appelle Code.gs). Sur le lien
// de test GitHub Pages, app.js détecte l'absence de google.script.run et
// cache le panneau tout seul (voir PENNYLANE_AVAILABLE) : rien à retirer ici.

const cleanBody = body
  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
// `export`/`import` retirés par regex générique (pas par des chaînes exactes
// codées en dur) : un remplacement littéral oublie tout nouvel `export const`
// ajouté plus tard dans profiles.js — ce qui a réellement cassé tout le JS du
// bundle Apps Script en production le 10 sept. 2026 (export const PROFILE_STATUS
// non neutralisé -> SyntaxError, écouteurs jamais posés, outil inerte y compris
// sur le lien officiel de l'équipe). Voir apps-script/apps-script-check pour le
// garde-fou qui doit désormais empêcher ce type de régression silencieuse.
const workspaceProfiles = profiles.replace(/^export\s+/gm, '');
const workspaceApp = app
  .replace(/^import\s+.*$/gm, '')
  .replace("pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs';", "pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';");

const output = `<!doctype html>
<html lang="fr"><head><base target="_top"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${css}</style></head>
<body>${cleanBody}
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>${workspaceProfiles}\n${workspaceApp}</script>
</body></html>`;
await writeFile(resolve(import.meta.dirname, 'Index.html'), output);
