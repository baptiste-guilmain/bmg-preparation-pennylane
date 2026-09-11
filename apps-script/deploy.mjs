// Déploiement unique : régénère Index.html, vérifie qu'il est syntaxiquement
// valide, puis déploie sur LES DEUX liens (test ET officiel). Créé le 11 sept.
// 2026 après un oubli réel : un changement déployé sur le lien de test
// uniquement, pris pour "en ligne" sur le lien officiel pendant plusieurs
// échanges. Utilisation : node deploy.mjs "description courte du changement"
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname);
const label = process.argv.slice(2).join(' ');
if (!label) {
  console.error('Usage : node deploy.mjs "description courte du changement"');
  process.exit(1);
}

const TEST_DEPLOYMENT_ID = 'AKfycbzMKFFsTKEgMHtorg5MVhN8zcCLNkvWrC77OwCPFR_dJiw6hjyn3_GQBPFTXqAYSMnBng';
const PROD_DEPLOYMENT_ID = 'AKfycbz3AIVzpaMXtiZQsBezw4AvxsDXlgx5immgJSbwskY_JUeRr1mJB8wBUyagsZsJOYmxAw';

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: root, stdio: 'inherit' });
}

run('node build-appsscript.mjs');

// Vérifie que le JS généré est syntaxiquement valide AVANT de rien pousser —
// c'est exactement le bug qui a rendu tout l'outil inerte en production le
// 10 sept. 2026 (Index.html avait bien été régénéré, mais le JS qu'il
// contenait était invalide, et rien ne le vérifiait avant déploiement).
const html = readFileSync(resolve(root, 'Index.html'), 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (!match) {
  console.error('Balise <script> introuvable dans Index.html — build cassé, déploiement annulé.');
  process.exit(1);
}
const tmpFile = resolve(tmpdir(), `apps-script-bundle-check-${Date.now()}.js`);
writeFileSync(tmpFile, match[1]);
try {
  run(`node --check "${tmpFile}"`);
} finally {
  unlinkSync(tmpFile);
}

run('clasp push --force');
run(`clasp deploy -i ${TEST_DEPLOYMENT_ID} -d "${label}"`);
run(`clasp deploy -i ${PROD_DEPLOYMENT_ID} -d "${label}"`);

console.log('\n✅ Déployé sur le lien de test ET le lien officiel.');
