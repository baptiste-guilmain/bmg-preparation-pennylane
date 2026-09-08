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

const cleanBody = body
  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<div id="pennylane-bar"[\s\S]*?<\/div>\s*<\/section>/i, '</section>');
const workspaceProfiles = profiles.replace('export const profiles', 'const profiles').replace('export const getProfile', 'const getProfile');
const workspaceApp = app
  .replace("import * as pdfjsLib from './vendor/pdf.min.mjs';\n", '')
  .replace("import { getProfile } from './profiles.js';\n", '')
  .replace("pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs';", "pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';")
  .replace("  $('#pennylane-preview-btn').disabled=!state.valid;\n", '')
  .replace(/\/\/ Envoi direct à Pennylane \(bêta\)[\s\S]*?(?=async function makeXlsx\()/, 'function resetPennylanePanel(){}\n');

const output = `<!doctype html>
<html lang="fr"><head><base target="_top"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${css}</style></head>
<body>${cleanBody}
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>${workspaceProfiles}\n${workspaceApp}</script>
</body></html>`;
await writeFile(resolve(import.meta.dirname, 'Index.html'), output);
