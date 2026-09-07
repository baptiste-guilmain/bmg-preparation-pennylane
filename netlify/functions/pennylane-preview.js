// Lecture seule : résout les comptes et le journal réels (sans jamais écrire
// dans Pennylane), pour que l'écran d'aperçu montre exactement ce qui sera
// posté avant que l'utilisateur ne confirme l'envoi.
const { resolveEntries, PennylaneRequestError } = require('./_pennylane');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Méthode non autorisée.' };
  }
  try {
    const { companyId, entries } = JSON.parse(event.body || '{}');
    if (!companyId || !Array.isArray(entries) || !entries.length) {
      return { statusCode: 400, body: JSON.stringify({ error: 'companyId et entries sont requis.' }) };
    }
    const { resolved } = await resolveEntries(companyId, entries);
    const preview = resolved.map(e => ({
      label: e.label, date: e.date, journalId: e.journal_id,
      debitTotal: e._debitTotal, creditTotal: e._creditTotal,
      lines: e.ledger_entry_lines.map(l => ({
        accountNumber: l._accountNumber, accountLabel: l._accountLabel,
        ledgerAccountId: l.ledger_account_id, label: l.label, debit: l.debit, credit: l.credit,
      })),
    }));
    return { statusCode: 200, body: JSON.stringify({ preview }) };
  } catch (e) {
    const status = e instanceof PennylaneRequestError ? e.status : 500;
    return { statusCode: status, body: JSON.stringify({ error: e.message || 'Erreur inconnue.' }) };
  }
};
