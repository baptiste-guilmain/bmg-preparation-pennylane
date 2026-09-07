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

// Profil générique DOZ (marque distincte d'O'Tacos) : Uber seul, TVA 5,5 % et 10 %,
// mais avec une ventilation INVERSE de celle d'O'Tacos (la part 10 % est l'ancre,
// calculée depuis la TVA 2 brute ; la part 5,5 % est le reliquat) et un traitement
// séparé des frais d'offre Uber (repris tels quels, sans re-répartition à 20 %).
// Voir la formule dans app.js (vatBreakdown 'doz-5.5-and-10', marketingSplit),
// validée cellule par cellule sur le modèle DOZ - Colmar de juillet 2026.
function dozProfile({ id, name, label, establishmentId, accounts }) {
  return {
    id,
    name,
    label,
    mode: 'uber-only',
    uberJournal: '',
    vatBreakdown: 'doz-5.5-and-10',
    marketingSplit: true,
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
  }),
  // Les 8 sociétés ci-dessous ont leurs comptes confirmés le 4 sept. 2026 via
  // l'API Pennylane de chaque dossier, sur l'écriture RÉELLEMENT posée en
  // juillet 2026 (GET /ledger_entry_lines puis /ledger_entries) — pas une
  // supposition ni une copie d'HAGTACOS. Activées sans identifiant Uber
  // (établissementId vide) à la demande de Baptiste le 4 sept. 2026 : l'outil
  // ne pourra donc pas vérifier que le fichier déposé correspond bien à la
  // société sélectionnée pour celles-ci — à surveiller à l'usage.
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
  // ARIOS : écriture Uber Eats de juillet 2026 confirmée (comme les 7 autres), avec
  // une différence réelle sur le compte de versement : 580009 et non 580006.
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
  } }),
  // ALDN — enseigne IT TRATTORIA (pas O'Tacos, mais même moteur Uber/TVA que la
  // famille O'Tacos). Seule société avec une part de ventes Uber à 20 % (alcool,
  // colonne Uber "TVA 3 sur les ventes") : comptes uberSales20/vat20 dédiés.
  // Formule et TOUS les comptes confirmés le 7 sept. 2026 contre l'écriture
  // RÉELLEMENT postée dans Pennylane de juillet 2026 (API), exacts au centime près.
  aldn: otacosProfile({ id: 'aldn', name: 'ALDN', label: 'IT TRATTORIA', establishmentId: '', accounts: {
    uberSales55: ['70114', 'VENTES UBEREATS 5,5%'], vat55: ['44571006', 'TVA collectée à 5,5%'],
    uberSales10: ['70113', 'VENTES UBEREATS 10%'], vat10: ['44571008', 'TVA collectée à 10%'],
    uberSales20: ['70116', 'VENTES UBEREATS 20%'], vat20: ['44571009', 'TVA collectée à 20%'],
    commission: ['6222', 'COMMISSIONS UBEREATS'], deductibleVat: ['44566', 'TVA sur autres biens et services'],
    marketing: ['623205', 'MARKETING UBER EATS'], mealVoucher: ['580004', 'VERSEMENT TR'], uberSettlement: ['580006', 'UBEREAT']
  } }),
  // DOZ - Colmar : formule confirmée le 4 sept. 2026 par reconstitution du modèle
  // de l'expert-comptable, MAIS comptes corrigés le 7 sept. 2026 après croisement
  // avec l'écriture RÉELLEMENT postée dans Pennylane (API) : le tableur de l'expert
  // notait 44571500/44571100/62220000/44566020/62320500, Pennylane a en réalité
  // utilisé 44571006/44571008/62222/44566/623204 ci-dessous — même piège que HAGTACOS.
  colmardoz: dozProfile({
    id: 'colmardoz',
    name: 'COLMARDOZ',
    label: 'DOZ Colmar',
    establishmentId: '6a09a19a61bc6e0023ac2480',
    accounts: {
      uberSales55: ['70114000', 'VENTES 5,5% UBEREATS'],
      vat55: ['44571006', 'TVA collectée à 5,5%'],
      uberSales10: ['70113000', 'VENTES 10% UBEREATS'],
      vat10: ['44571008', 'TVA collectée à 10%'],
      commission: ['62222', 'COMMISSIONS UBEREATS'],
      deductibleVat: ['44566', 'TVA sur autres biens et services'],
      marketing: ['623204', 'DEPENSES MARKETING UBEREATS'],
      mealVoucher: ['58000400', 'VERSEMENT TR'],
      uberSettlement: ['58000600', 'UBEREAT']
    }
  }),
  // DOZ - Strasbourg : formule et comptes confirmés le 7 sept. 2026 contre
  // l'écriture RÉELLEMENT postée dans Pennylane de juillet 2026 (API), exacts au
  // centime près sur toutes les lignes.
  strasdoz: dozProfile({
    id: 'strasdoz',
    name: 'STRASDOZ',
    label: 'DOZ Strasbourg',
    establishmentId: '6a2bbe3c10196600236e7b2e',
    accounts: {
      uberSales55: ['701141', 'VENTES 5,5% UBEREATS'],
      vat55: ['44571006', 'TVA collectée à 5,5%'],
      uberSales10: ['70113', 'VENTES 10% UBEREATS'],
      vat10: ['44571008', 'TVA collectée à 10%'],
      commission: ['622221', 'COMMISSIONS UBEREATS'],
      deductibleVat: ['44566', 'TVA sur autres biens et services'],
      marketing: ['6232041', 'DEPENSES MARKETING UBEREATS'],
      mealVoucher: ['5800042', 'VERSEMENT TR'],
      uberSettlement: ['58000602', 'UBEREAT']
    }
  })
};

export const getProfile = id => profiles[id] || null;
