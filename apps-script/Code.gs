/** Point d'entrée de l'outil interne BMG. L'accès est défini au déploiement :
 * uniquement les utilisateurs du domaine Google Workspace. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Import CA Pennylane')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// =============================================================================
// Envoi direct à Pennylane (bêta) — port de netlify/functions/_pennylane.js.
// Les jetons API restent ici, côté serveur Apps Script (Script Properties),
// jamais transmis au navigateur. Deux fonctions appelées depuis app.js via
// google.script.run : pennylanePreview (lecture seule) et pennylanePost
// (écriture réelle, appelée uniquement après confirmation explicite côté
// navigateur). Chaque société a son propre jeton, dans une propriété de script
// PENNYLANE_TOKEN_<ID EN MAJUSCULES> (Extensions > Apps Script > Paramètres du
// projet > Propriétés du script — ex. PENNYLANE_TOKEN_HAGTACOS).
// =============================================================================

var PENNYLANE_BASE_URL = 'https://app.pennylane.com/api/external/v2';

// Liste blanche : évite qu'un appel forgé sonde des propriétés arbitraires.
// Doit rester alignée avec les ids de public/profiles.js.
var PENNYLANE_KNOWN_COMPANIES = {
  pdfk: 1, strasgame: 1,
  hagtacos: 1, colmios: 1, fartacos: 1, epios: 1, geipios: 1, sarios: 1, hautios: 1,
  mulios: 1, arios: 1, vinios: 1, aldn: 1,
  colmardoz: 1, strasdoz: 1,
};

function pennylaneGetToken_(companyId) {
  if (!PENNYLANE_KNOWN_COMPANIES[companyId]) {
    throw new Error('Société inconnue : ' + companyId);
  }
  var propName = 'PENNYLANE_TOKEN_' + companyId.toUpperCase();
  var token = PropertiesService.getScriptProperties().getProperty(propName);
  if (!token) {
    throw new Error(
      'Aucun jeton API configuré pour ' + companyId + ' (propriété de script ' + propName + ' absente). ' +
      'Ajoutez-la dans Apps Script > Paramètres du projet > Propriétés du script.'
    );
  }
  return token;
}

function pennylaneFetch_(token, path, options) {
  options = options || {};
  var params = {
    method: options.method || 'get',
    headers: Object.assign({ Authorization: 'Bearer ' + token, Accept: 'application/json' }, options.headers || {}),
    muteHttpExceptions: true,
  };
  if (options.body) {
    params.contentType = 'application/json';
    params.payload = options.body;
  }
  var resp = UrlFetchApp.fetch(PENNYLANE_BASE_URL + path, params);
  var code = resp.getResponseCode();
  var text = resp.getContentText();
  var body = null;
  try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
  if (code < 200 || code >= 300) {
    var detail = body && body.message ? body.message : (typeof body === 'string' ? body : JSON.stringify(body));
    throw new Error('Pennylane a répondu ' + code + ' sur ' + path + ' : ' + detail);
  }
  return body;
}

function pennylaneItems_(payload) {
  return Array.isArray(payload) ? payload : (payload.items || payload.data || []);
}

// Corrigé le 11 sept. 2026 : l'API Pennylane 2026 n'accepte plus de filtrer
// /journals par `field:"code"` ("Field \"code\" is not allowed for filter.
// Allowed fields are \"type\"."). Solution retenue (la plus simple des deux
// envisagées, pas besoin de connaître la valeur attendue par l'API pour
// `type`) : lister tous les journaux de la société (une société n'en a
// qu'une poignée, jamais assez pour justifier la pagination) et filtrer
// côté script sur `j.code === code`. Voir la doc citée par l'erreur :
// https://pennylane.readme.io/docs/2026-api-changes-guide
function pennylaneResolveJournalId_(token, code, cache) {
  if (cache.journals[code]) return cache.journals[code];
  var payload = pennylaneFetch_(token, '/journals?limit=100');
  var items = pennylaneItems_(payload);
  var found = items.filter(function (j) { return j.code === code; })[0];
  if (!found) throw new Error('Journal "' + code + '" introuvable dans Pennylane pour cette société.');
  cache.journals[code] = found.id;
  return found.id;
}

function pennylaneResolveAccountId_(token, number, cache) {
  if (cache.accounts[number]) return cache.accounts[number];
  var filter = JSON.stringify([{ field: 'number', operator: 'eq', value: String(number) }]);
  var payload = pennylaneFetch_(token, '/ledger_accounts?filter=' + encodeURIComponent(filter) + '&limit=5');
  var items = pennylaneItems_(payload);
  var found = items.filter(function (a) { return a.number === String(number); })[0] || items[0];
  if (!found) throw new Error('Compte "' + number + '" introuvable dans le plan comptable Pennylane de cette société.');
  cache.accounts[number] = { id: found.id, label: found.label };
  return cache.accounts[number];
}

function pennylaneMoney_(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

// Garde-fou anti-doublon : avant de résoudre/poster quoi que ce soit, vérifie
// qu'aucune écriture portant le même libellé (ex. "UBEREATS 08.2026") n'existe
// déjà à cette date dans Pennylane. Demandé explicitement par Baptiste le
// 10 sept. 2026 pour éviter une double saisie de CA sur un même mois — bloquant,
// pas un simple avertissement (l'utilisateur doit supprimer l'écriture existante
// dans Pennylane lui-même s'il veut vraiment reposter).
function pennylaneCheckDuplicates_(token, entries) {
  var dates = [];
  entries.forEach(function (e) { if (dates.indexOf(e.date) < 0) dates.push(e.date); });
  var conflicts = [];
  dates.forEach(function (date) {
    var filter = JSON.stringify([{ field: 'date', operator: 'eq', value: date }]);
    var payload = pennylaneFetch_(token, '/ledger_entries?filter=' + encodeURIComponent(filter) + '&limit=100');
    var items = pennylaneItems_(payload);
    entries.filter(function (e) { return e.date === date; }).forEach(function (entry) {
      var existing = items.filter(function (it) { return it.label === entry.label; })[0];
      if (existing) conflicts.push({ label: entry.label, date: entry.date, existingId: existing.id });
    });
  });
  if (conflicts.length) {
    throw new Error(
      'Écriture déjà présente dans Pennylane pour cette période : ' +
      conflicts.map(function (c) { return c.label + ' (' + c.date + ')'; }).join(', ') +
      '. Pour éviter un doublon de CA, l\'envoi est bloqué — vérifiez/supprimez l\'écriture existante directement dans Pennylane si vous voulez vraiment la remplacer.'
    );
  }
}

// entries: [{label, date, journalCode, lines:[{accountNumber, debit, credit, label}]}]
function pennylaneResolveEntries_(companyId, entries) {
  var token = pennylaneGetToken_(companyId);
  pennylaneCheckDuplicates_(token, entries);
  var cache = { journals: {}, accounts: {} };
  var resolved = [];
  entries.forEach(function (entry) {
    var journalId = pennylaneResolveJournalId_(token, entry.journalCode || 'VT', cache);
    var lines = [];
    var debitTotal = 0, creditTotal = 0;
    entry.lines.forEach(function (line) {
      var acc = pennylaneResolveAccountId_(token, line.accountNumber, cache);
      var debit = pennylaneMoney_(line.debit || 0), credit = pennylaneMoney_(line.credit || 0);
      debitTotal = pennylaneMoney_(debitTotal + debit); creditTotal = pennylaneMoney_(creditTotal + credit);
      lines.push({
        debit: debit.toFixed(2), credit: credit.toFixed(2),
        ledger_account_id: acc.id, label: line.label || entry.label,
        _accountNumber: line.accountNumber, _accountLabel: acc.label,
      });
    });
    if (Math.abs(pennylaneMoney_(debitTotal - creditTotal)) > 0.01) {
      throw new Error('Écriture "' + entry.label + '" déséquilibrée : débit ' + debitTotal.toFixed(2) + ' ≠ crédit ' + creditTotal.toFixed(2) + '.');
    }
    resolved.push({
      date: entry.date, label: entry.label, journal_id: journalId,
      ledger_entry_lines: lines, _debitTotal: debitTotal, _creditTotal: creditTotal,
    });
  });
  return { token: token, resolved: resolved };
}

/** Appelée depuis le navigateur (google.script.run) : résout comptes/journal
 * réels et vérifie l'absence de doublon, sans jamais écrire dans Pennylane. */
function pennylanePreview(companyId, entries) {
  var result = pennylaneResolveEntries_(companyId, entries);
  return result.resolved.map(function (e) {
    return {
      label: e.label, date: e.date, journalId: e.journal_id,
      debitTotal: e._debitTotal, creditTotal: e._creditTotal,
      lines: e.ledger_entry_lines.map(function (l) {
        return { accountNumber: l._accountNumber, accountLabel: l._accountLabel, ledgerAccountId: l.ledger_account_id, label: l.label, debit: l.debit, credit: l.credit };
      }),
    };
  });
}

/** Appelée depuis le navigateur (google.script.run) : écrit RÉELLEMENT dans
 * Pennylane. confirm doit valoir true (garde-fou en plus de la popup de
 * confirmation côté navigateur). Re-vérifie l'absence de doublon (défense en
 * profondeur : l'état a pu changer entre l'aperçu et l'envoi). */
// =============================================================================
// Archivage Drive — conserve chaque écriture générée (bouton "Télécharger
// l'écriture Excel") dans le Drive de la personne qui a déployé l'outil, pour
// garder un historique et permettre un import manuel ultérieur si besoin.
// Un dossier racine, un sous-dossier par mois (ex. "2026-08"), un fichier par
// société dedans (ex. "HAGTACOS.xlsx") — écrase le fichier existant du même
// nom plutôt que d'empiler des doublons si l'écriture est régénérée.
// =============================================================================

var DRIVE_ARCHIVE_ROOT = 'BMG - Écritures Pennylane';

function driveGetOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function saveEntryToDrive(companyId, period, base64Content, filename) {
  if (!PENNYLANE_KNOWN_COMPANIES[companyId]) {
    throw new Error('Société inconnue : ' + companyId);
  }
  var root = driveGetOrCreateFolder_(DriveApp.getRootFolder(), DRIVE_ARCHIVE_ROOT);
  var monthFolder = driveGetOrCreateFolder_(root, period);
  var existing = monthFolder.getFilesByName(filename);
  while (existing.hasNext()) { existing.next().setTrashed(true); }
  var blob = Utilities.newBlob(
    Utilities.base64Decode(base64Content),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename
  );
  var file = monthFolder.createFile(blob);
  return { fileId: file.getId(), url: file.getUrl(), folder: DRIVE_ARCHIVE_ROOT + '/' + period, filename: filename };
}

function pennylanePost(companyId, entries, confirm) {
  if (confirm !== true) throw new Error('Confirmation manquante.');
  var result = pennylaneResolveEntries_(companyId, entries);
  var created = [];
  result.resolved.forEach(function (entry) {
    var payload = {
      date: entry.date, label: entry.label, journal_id: entry.journal_id,
      ledger_entry_lines: entry.ledger_entry_lines.map(function (l) {
        return { debit: l.debit, credit: l.credit, ledger_account_id: l.ledger_account_id, label: l.label };
      }),
    };
    var res = pennylaneFetch_(result.token, '/ledger_entries', { method: 'post', body: JSON.stringify(payload) });
    created.push(res);
  });
  return created;
}
