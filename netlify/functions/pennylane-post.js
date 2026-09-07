// Écriture réelle dans Pennylane. N'est jamais appelée automatiquement : le
// frontend exige un aperçu (pennylane-preview.js) confirmé explicitement par
// l'utilisateur avant d'appeler cette fonction. Voir app.js (bouton "Envoyer
// à Pennylane").
const { postEntries, PennylaneRequestError } = require('./_pennylane');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Méthode non autorisée.' };
  }
  try {
    const { companyId, entries, confirm } = JSON.parse(event.body || '{}');
    if (!companyId || !Array.isArray(entries) || !entries.length) {
      return { statusCode: 400, body: JSON.stringify({ error: 'companyId et entries sont requis.' }) };
    }
    if (confirm !== true) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Confirmation manquante (confirm doit être true).' }) };
    }
    const created = await postEntries(companyId, entries);
    return { statusCode: 200, body: JSON.stringify({ created }) };
  } catch (e) {
    const status = e instanceof PennylaneRequestError ? e.status : 500;
    return { statusCode: status, body: JSON.stringify({ error: e.message || 'Erreur inconnue.' }) };
  }
};
