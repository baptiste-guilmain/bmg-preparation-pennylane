// Profil générique O'Tacos : Uber seul, TVA 5,5 % et 10 %, comptes propres à
// chaque société. Voir la formule dans app.js (vatBreakdown 'otacos-5.5-and-10'),
// validée cellule par cellule sur le modèle HAGTACOS de juillet 2026.
function otacosProfile({ id, name, label, establishmentId, accounts }) {
  return {
    id,
    name,
    label,
    mode: 'uber-only',
    uberJournal: '',
    vatBreakdown: 'otacos-5.5-and-10',
    expenseVat: 0.20,
    uberEstablishments: establishmentId ? [establishmentId] : [],
    accounts
  };
}

export const profiles = {
  pdfk: {
    id: 'pdfk',
    name: 'PDFK',
    label: 'Paradis du Fruit Strasbourg Kléber',
    mode: 'uber-and-cash',
    uberJournal: '',
    cashAdapter: 'liquide-solide-pdf',
    uberVat: 0.10,
    expenseVat: 0.20,
    uberEstablishments: ['BYS00443'],
    accounts: {
      uberSales: ['701130000', 'VENTES 10% UBEREATS'],
      vat10: ['445710080', 'TVA collectée à 10%'],
      commission: ['622200000', 'COMMISSIONS UBEREATS'],
      deductibleVat: ['445660000', 'TVA sur autres biens et services'],
      marketing: ['623204000', 'DEPENSES MARKETING UBEREATS'],
      mealVoucher: ['580004000', 'VERSEMENT TR'],
      uberSettlement: ['580009000', 'UBEREAT'],
      liquid: ['701110000', 'VENTES 10% LIQUIDE'],
      solid: ['701120000', 'VENTES 10% SOLIDE'],
      alcohol: ['701200000', 'VENTES 20% ALCOOL'],
      vat20: ['445710090', 'TVA collectée à 20%'],
      cash: ['531000000', 'CAISSE']
    }
  },
  strasgame: {
    id: 'strasgame',
    name: 'STRASGAME',
    label: 'Crousty Game — Strasbourg',
    mode: 'uber-only',
    uberJournal: 'VT',
    vatBreakdown: '5.5-and-10',
    expenseVat: 0.20,
    uberEstablishments: [],
    accounts: {
      uberSales55: ['701140000', 'VENTES 5,5% UBEREATS'],
      vat55: ['445710055', 'TVA collectée à 5,5%'],
      uberSales10: ['701130000', 'VENTES 10% UBEREATS'],
      vat10: ['445710080', 'TVA collectée à 10%'],
      commission: ['622200000', 'COMMISSIONS UBEREATS'],
      deductibleVat: ['445660000', 'TVA sur autres biens et services'],
      marketing: ['623204000', 'DEPENSES MARKETING UBEREATS'],
      mealVoucher: ['580004000', 'VERSEMENT TR'],
      uberSettlement: ['580009000', 'UBEREAT']
    }
  },
  hagtacos: otacosProfile({
    id: 'hagtacos',
    name: 'HAGTACOS',
    label: "O'Tacos Haguenau",
    establishmentId: '401010310',
    accounts: {
      uberSales55: ['70113500', 'VENTES 5,5% UBEREATS'],
      vat55: ['44571500', 'TVA collectée à 5,5%'],
      uberSales10: ['70112100', 'VENTES 10% UBEREATS'],
      vat10: ['44571100', 'TVA collectée à 10%'],
      commission: ['62220000', 'COMMISSIONS UBEREATS'],
      deductibleVat: ['44566020', 'TVA sur autres biens et services'],
      marketing: ['62320400', 'DEPENSES MARKETING UBEREATS'],
      mealVoucher: ['58000400', 'VERSEMENT TR'],
      uberSettlement: ['58000600', 'UBEREAT']
    }
  }),
  colmios: otacosProfile({
    id: 'colmios',
    name: 'COLMIOS',
    label: "O'Tacos Colmar",
    establishmentId: '401010401',
    accounts: {
      uberSales55: ['70113500', 'VENTES 5,5% UBEREATS'],
      vat55: ['44571006', 'TVA collectée à 5,5%'],
      uberSales10: ['70113000', 'VENTES 10% UBEREATS'],
      vat10: ['44571008', 'TVA collectée à 10%'],
      commission: ['62220000', 'COMMISSIONS UBEREATS'],
      deductibleVat: ['44566000', 'TVA sur autres biens et services'],
      marketing: ['62320500', 'DEPENSES MARKETING UBEREATS'],
      mealVoucher: ['58000400', 'VERSEMENT TR'],
      uberSettlement: ['58000600', 'UBEREAT']
    }
  })
};

// Sociétés O'Tacos restantes : moteur identique à HAGTACOS/COLMIOS, mais comptes
// et identifiant Uber COPIÉS depuis HAGTACOS à titre de brouillon, NON vérifiés.
// HAGTACOS et COLMIOS ont déjà 4 comptes sur 7 différents l'un de l'autre : rien ne
// garantit que ces 8 sociétés partagent les mêmes numéros. Volontairement absentes
// de public/index.html tant que chacune n'a pas son propre modèle mensuel signé
// (ou son plan comptable réel via l'API Pennylane du dossier) pour corriger ce qui
// diffère. Ne jamais les activer dans l'interface sans être passé par cette étape.
export const otacosDraftProfiles = {
  fartacos: otacosProfile({ id: 'fartacos', name: 'FARTACOS', label: "O'Tacos Strasbourg", establishmentId: '', accounts: { ...profiles.hagtacos.accounts } }),
  epios: otacosProfile({ id: 'epios', name: 'EPIOS', label: "O'Tacos", establishmentId: '', accounts: { ...profiles.hagtacos.accounts } }),
  geipios: otacosProfile({ id: 'geipios', name: 'GEIPIOS', label: "O'Tacos", establishmentId: '', accounts: { ...profiles.hagtacos.accounts } }),
  sarios: otacosProfile({ id: 'sarios', name: 'SARIOS', label: "O'Tacos", establishmentId: '', accounts: { ...profiles.hagtacos.accounts } }),
  hautios: otacosProfile({ id: 'hautios', name: 'HAUTIOS', label: "O'Tacos", establishmentId: '', accounts: { ...profiles.hagtacos.accounts } }),
  mulios: otacosProfile({ id: 'mulios', name: 'MULIOS', label: "O'Tacos Mulhouse", establishmentId: '', accounts: { ...profiles.hagtacos.accounts } }),
  arios: otacosProfile({ id: 'arios', name: 'ARIOS', label: "O'Tacos", establishmentId: '', accounts: { ...profiles.hagtacos.accounts } }),
  vinios: otacosProfile({ id: 'vinios', name: 'VINIOS', label: "O'Tacos", establishmentId: '', accounts: { ...profiles.hagtacos.accounts } })
};

export const getProfile = id => profiles[id] || null;
