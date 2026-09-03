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
    // Comptes confirmés le 4 sept. 2026 sur l'écriture RÉELLEMENT posée dans
    // Pennylane pour juillet 2026 (via l'API /ledger_entries), pas seulement
    // sur le tableur de travail de l'expert-comptable : celui-ci notait
    // 44571100/44571500/44566020, mais Pennylane a en réalité utilisé les
    // comptes génériques 44571008/44571006/44566 ci-dessous.
    accounts: {
      uberSales55: ['70113500', 'VENTES 5,5% UBEREATS'],
      vat55: ['44571006', 'TVA collectée à 5,5%'],
      uberSales10: ['70112100', 'VENTES 10% UBEREATS'],
      vat10: ['44571008', 'TVA collectée à 10%'],
      commission: ['62220000', 'COMMISSIONS UBEREATS'],
      deductibleVat: ['44566', 'TVA sur autres biens et services'],
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

// Sociétés O'Tacos restantes : moteur identique à HAGTACOS/COLMIOS. Comptes
// retrouvés le 4 sept. 2026 via l'API Pennylane de chaque dossier, sur l'écriture
// RÉELLEMENT posée en juillet 2026 (GET /ledger_entry_lines puis /ledger_entries) —
// pas une supposition ni une copie d'HAGTACOS. Il manque encore à chacune son
// identifiant Uber (établissementId), qui ne peut venir que d'un vrai export Uber
// de la société. Volontairement absentes de public/index.html tant que ce dernier
// point n'est pas réglé et qu'un mois n'a pas été comparé de bout en bout.
export const otacosDraftProfiles = {
  fartacos: otacosProfile({ id: 'fartacos', name: 'FARTACOS', label: "O'Tacos Strasbourg", establishmentId: '', accounts: {
    uberSales55: ['70114', 'VENTES UBEREATS 5,5%'], vat55: ['44571006', 'TVA collectée à 5,5%'],
    uberSales10: ['70113', 'VENTES UBEREATS 10%'], vat10: ['44571008', 'TVA collectée à 10%'],
    commission: ['6222', 'COMMISSIONS UBEREATS'], deductibleVat: ['44566', 'TVA sur autres biens et services'],
    marketing: ['623204', 'DEPENSES MARKETING UBEREATS'], mealVoucher: ['580004', 'VERSEMENT TR'], uberSettlement: ['580006', 'UBEREAT']
  } }),
  epios: otacosProfile({ id: 'epios', name: 'EPIOS', label: "O'Tacos", establishmentId: '', accounts: {
    uberSales55: ['70114', 'VENTES UBEREATS 5,5%'], vat55: ['44571006', 'TVA collectée à 5,5%'],
    uberSales10: ['70113', 'VENTES UBEREATS 10%'], vat10: ['44571008', 'TVA collectée à 10%'],
    commission: ['6222', 'COMMISSIONS UBEREATS'], deductibleVat: ['44566', 'TVA sur autres biens et services'],
    marketing: ['623204', 'DEPENSES MARKETING UBEREATS'], mealVoucher: ['580004', 'VERSEMENT TR'], uberSettlement: ['580006', 'UBEREAT']
  } }),
  geipios: otacosProfile({ id: 'geipios', name: 'GEIPIOS', label: "O'Tacos", establishmentId: '', accounts: {
    uberSales55: ['70114', 'VENTES UBEREATS 5,5%'], vat55: ['44571006', 'TVA collectée à 5,5%'],
    uberSales10: ['70113', 'VENTES UBEREATS 10%'], vat10: ['44571008', 'TVA collectée à 10%'],
    commission: ['6222', 'COMMISSIONS UBEREATS'], deductibleVat: ['44566', 'TVA sur autres biens et services'],
    marketing: ['623204', 'DEPENSES MARKETING UBEREATS'], mealVoucher: ['580004', 'VERSEMENT TR'], uberSettlement: ['580006', 'UBEREAT']
  } }),
  sarios: otacosProfile({ id: 'sarios', name: 'SARIOS', label: "O'Tacos", establishmentId: '', accounts: {
    uberSales55: ['70114', 'VENTES UBEREATS 5,5%'], vat55: ['44571006', 'TVA collectée à 5,5%'],
    uberSales10: ['70113', 'VENTES UBEREATS 10%'], vat10: ['44571008', 'TVA collectée à 10%'],
    commission: ['6222', 'COMMISSIONS UBEREATS'], deductibleVat: ['44566', 'TVA sur autres biens et services'],
    marketing: ['623205', 'MARKETING UBER EATS'], mealVoucher: ['580004', 'VERSEMENT TR'], uberSettlement: ['580006', 'UBEREAT']
  } }),
  hautios: otacosProfile({ id: 'hautios', name: 'HAUTIOS', label: "O'Tacos", establishmentId: '', accounts: {
    uberSales55: ['70114', 'VENTES UBEREATS 5,5%'], vat55: ['44571006', 'TVA collectée à 5,5%'],
    uberSales10: ['70113', 'VENTES UBEREATS 10%'], vat10: ['44571008', 'TVA collectée à 10%'],
    commission: ['6222', 'COMMISSIONS UBEREATS'], deductibleVat: ['44566', 'TVA sur autres biens et services'],
    marketing: ['623205', 'MARKETING UBER EATS'], mealVoucher: ['580004', 'VERSEMENT TR'], uberSettlement: ['580006', 'UBEREAT']
  } }),
  mulios: otacosProfile({ id: 'mulios', name: 'MULIOS', label: "O'Tacos Mulhouse", establishmentId: '', accounts: {
    uberSales55: ['70114', 'VENTES UBEREATS 5,5%'], vat55: ['44571006', 'TVA collectée à 5,5%'],
    uberSales10: ['70113', 'VENTES UBEREATS 10%'], vat10: ['44571008', 'TVA collectée à 10%'],
    commission: ['6222', 'COMMISSIONS UBEREATS'], deductibleVat: ['44566', 'TVA sur autres biens et services'],
    marketing: ['623205', 'MARKETING UBER EATS'], mealVoucher: ['580004', 'VERSEMENT TR'], uberSettlement: ['580006', 'UBEREAT']
  } }),
  // ARIOS : pas d'écriture Uber Eats de juillet 2026 retrouvée dans son plan comptable
  // (la dernière date de janvier 2026, mélangée avec Deliveroo, structure différente :
  // compte "401OTACOS" en versement, "623201" en marketing). Comptes ci-dessous = ceux
  // des autres sociétés, à considérer comme une simple hypothèse de départ pour ARIOS,
  // plus incertaine que pour ses 7 sœurs — à vérifier en priorité avant toute activation.
  arios: otacosProfile({ id: 'arios', name: 'ARIOS', label: "O'Tacos", establishmentId: '', accounts: {
    uberSales55: ['70114', 'VENTES UBEREATS 5,5%'], vat55: ['44571006', 'TVA collectée à 5,5%'],
    uberSales10: ['70113', 'VENTES UBEREATS 10%'], vat10: ['44571008', 'TVA collectée à 10%'],
    commission: ['6222', 'COMMISSIONS UBEREATS'], deductibleVat: ['44566', 'TVA sur autres biens et services'],
    marketing: ['623204', 'DEPENSES MARKETING UBEREATS'], mealVoucher: ['580004', 'VERSEMENT TR'], uberSettlement: ['580009', 'UBEREAT']
  } }),
  vinios: otacosProfile({ id: 'vinios', name: 'VINIOS', label: "O'Tacos", establishmentId: '', accounts: {
    uberSales55: ['70114', 'VENTES UBEREATS 5,5%'], vat55: ['44571006', 'TVA collectée à 5,5%'],
    uberSales10: ['70113', 'VENTES UBEREATS 10%'], vat10: ['44571008', 'TVA collectée à 10%'],
    commission: ['6222', 'COMMISSIONS UBEREATS'], deductibleVat: ['44566', 'TVA sur autres biens et services'],
    marketing: ['623205', 'MARKETING UBER EATS'], mealVoucher: ['580004', 'VERSEMENT TR'], uberSettlement: ['580006', 'UBEREAT']
  } })
};

export const getProfile = id => profiles[id] || null;
