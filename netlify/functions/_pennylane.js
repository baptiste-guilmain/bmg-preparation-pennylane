// Aide partagée entre pennylane-preview.js (lecture seule) et pennylane-post.js
// (écriture réelle). Les jetons API restent ici, côté serveur : jamais transmis
// au navigateur. Chaque société a son propre jeton, dans une variable
// d'environnement Netlify PENNYLANE_TOKEN_<ID EN MAJUSCULES> (ex. PENNYLANE_TOKEN_HAGTACOS).

const BASE_URL = 'https://app.pennylane.com/api/external/v2';

// Liste blanche : évite qu'une requête forgée sonde des variables d'environnement
// arbitraires. Doit rester alignée avec les ids de public/profiles.js.
const KNOWN_COMPANIES = new Set([
  'pdfk', 'strasgame',
  'hagtacos', 'colmios', 'fartacos', 'epios', 'geipios', 'sarios', 'hautios',
  'mulios', 'arios', 'vinios', 'aldn',
  'colmardoz', 'strasdoz',
]);

class PennylaneRequestError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status || 400;
  }
}

function getToken(companyId) {
  if (!KNOWN_COMPANIES.has(companyId)) {
    throw new PennylaneRequestError(`Société inconnue : ${companyId}`, 400);
  }
  const envName = `PENNYLANE_TOKEN_${companyId.toUpperCase()}`;
  const token = process.env[envName];
  if (!token) {
    throw new PennylaneRequestError(
      `Aucun jeton API configuré pour ${companyId} (variable Netlify ${envName} absente). ` +
      `Ajoutez-la dans Netlify > Site configuration > Environment variables.`,
      412
    );
  }
  return token;
}

async function pennylaneFetch(token, path, options = {}) {
  const resp = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await resp.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!resp.ok) {
    const detail = body && body.message ? body.message : (typeof body === 'string' ? body : JSON.stringify(body));
    throw new PennylaneRequestError(`Pennylane a répondu ${resp.status} sur ${path} : ${detail}`, resp.status === 401 || resp.status === 403 ? resp.status : 502);
  }
  return body;
}

async function resolveJournalId(token, code, cache) {
  if (cache.journals.has(code)) return cache.journals.get(code);
  const filter = JSON.stringify([{ field: 'code', operator: 'eq', value: code }]);
  const payload = await pennylaneFetch(token, `/journals?filter=${encodeURIComponent(filter)}&per_page=5`);
  const items = Array.isArray(payload) ? payload : (payload.items || payload.data || []);
  const found = items.find(j => j.code === code) || items[0];
  if (!found) throw new PennylaneRequestError(`Journal "${code}" introuvable dans Pennylane pour cette société.`, 422);
  cache.journals.set(code, found.id);
  return found.id;
}

async function resolveAccountId(token, number, cache) {
  if (cache.accounts.has(number)) return cache.accounts.get(number);
  const filter = JSON.stringify([{ field: 'number', operator: 'eq', value: String(number) }]);
  const payload = await pennylaneFetch(token, `/ledger_accounts?filter=${encodeURIComponent(filter)}&per_page=5`);
  const items = Array.isArray(payload) ? payload : (payload.items || payload.data || []);
  const found = items.find(a => a.number === String(number)) || items[0];
  if (!found) throw new PennylaneRequestError(`Compte "${number}" introuvable dans le plan comptable Pennylane de cette société.`, 422);
  cache.accounts.set(number, { id: found.id, label: found.label });
  return cache.accounts.get(number);
}

const money = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// entries: [{label, date, journalCode, lines:[{accountNumber, debit, credit, label}]}]
async function resolveEntries(companyId, entries) {
  const token = getToken(companyId);
  const cache = { journals: new Map(), accounts: new Map() };
  const resolved = [];
  for (const entry of entries) {
    const journalId = await resolveJournalId(token, entry.journalCode || 'VT', cache);
    const lines = [];
    let debitTotal = 0, creditTotal = 0;
    for (const line of entry.lines) {
      const acc = await resolveAccountId(token, line.accountNumber, cache);
      const debit = money(line.debit || 0), credit = money(line.credit || 0);
      debitTotal = money(debitTotal + debit); creditTotal = money(creditTotal + credit);
      lines.push({
        debit: debit.toFixed(2), credit: credit.toFixed(2),
        ledger_account_id: acc.id, label: line.label || entry.label,
        _accountNumber: line.accountNumber, _accountLabel: acc.label,
      });
    }
    if (Math.abs(money(debitTotal - creditTotal)) > 0.01) {
      throw new PennylaneRequestError(
        `Écriture "${entry.label}" déséquilibrée : débit ${debitTotal.toFixed(2)} ≠ crédit ${creditTotal.toFixed(2)}.`, 422
      );
    }
    resolved.push({
      date: entry.date, label: entry.label, journal_id: journalId,
      ledger_entry_lines: lines, _debitTotal: debitTotal, _creditTotal: creditTotal,
    });
  }
  return { token, resolved };
}

async function postEntries(companyId, entries) {
  const { token, resolved } = await resolveEntries(companyId, entries);
  const created = [];
  for (const entry of resolved) {
    const { _debitTotal, _creditTotal, ...payload } = entry;
    payload.ledger_entry_lines = payload.ledger_entry_lines.map(({ _accountNumber, _accountLabel, ...l }) => l);
    const result = await pennylaneFetch(token, '/ledger_entries', { method: 'POST', body: JSON.stringify(payload) });
    created.push(result);
  }
  return created;
}

module.exports = { PennylaneRequestError, resolveEntries, postEntries, KNOWN_COMPANIES };
