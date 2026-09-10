// Profil générique O'Tacos : Uber seul, TVA 5,5 % et 10 %, comptes propres à
// chaque société. Voir la formule dans app.js (vatBreakdown 'otacos-5.5-and-10'),
// validée cellule par cellule sur le modèle HAGTACOS de juillet 2026.
// `cashAccounts`, quand fourni, active le mode caisse O'Tacos (exports bruts
// « Taxes » et « Opérations quotidiennes » : TVA 5,5 %/10 % x SP/AE). L'outil
// retire les totaux Uber et Deliveroo enregistrés dans les Opérations quotidiennes
// avant de générer la caisse ; l'écriture Uber reste calculée depuis son export
// détaillé. Voir cashAdapter 'otacos-taxes' dans app.js.
function otacosProfile({ id, name, label, establishmentId, accounts, cashAccounts }) {
  return {
    id,
    name,
    label,
    mode: cashAccounts ? 'uber-and-cash' : 'uber-only',
    cashAdapter: cashAccounts ? 'otacos-taxes' : undefined,
    uberJournal: '',
    vatBreakdown: 'otacos-5.5-and-10',
    expenseVat: 0.20,
    uberEstablishments: establishmentId ? [establishmentId] : [],
    accounts: cashAccounts ? { ...accounts, ...cashAccounts } : accounts
  };
}

// Profil générique DOZ (marque distincte d'O'Tacos) : Uber seul, TVA 5,5 % et 10 %,
// mais avec une ventilation INVERSE de celle d'O'Tacos (la part 10 % est l'ancre,
// calculée depuis la TVA 2 brute ; la part 5,5 % est le reliquat) et un traitement
// séparé des frais d'offre Uber (repris tels quels, sans re-répartition à 20 %).
// Voir la formule dans app.js (vatBreakdown 'doz-5.5-and-10', marketingSplit),
// validée cellule par cellule sur le modèle DOZ - Colmar de juillet 2026.
// `cashAccounts`, quand fourni, active le mode caisse (rapport POS à onglets
// "Revenus - Indicateurs" / "TVA - Répartition du montant de" / "TVA - TVA par
// taux" — voir cashAdapter 'doz-taxes' dans app.js, pas de découpage sur
// place/à emporter chez DOZ, juste 2 taux), validé cellule par cellule contre
// l'écriture RÉELLEMENT postée dans Pennylane pour COLMARDOZ et STRASDOZ en
// juillet 2026.
function dozProfile({ id, name, label, establishmentId, accounts, cashAccounts }) {
  return {
    id,
    name,
    label,
    mode: cashAccounts ? 'uber-and-cash' : 'uber-only',
    cashAdapter: cashAccounts ? 'doz-taxes' : undefined,
    uberJournal: '',
    vatBreakdown: 'doz-5.5-and-10',
    marketingSplit: true,
    expenseVat: 0.20,
    uberEstablishments: establishmentId ? [establishmentId] : [],
    accounts: cashAccounts ? { ...accounts, ...cashAccounts } : accounts
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
  // STRASGAME = SAINTIOS (même société, confirmé par Baptiste). Comptes Uber
  // CORRIGÉS le 8 sept. 2026 contre l'écriture UBEREATS 07.2026 RÉELLEMENT
  // postée (API, jeton obtenu ce jour-là — jamais vérifié avant, seul
  // l'équilibre débit=crédit avait été contrôlé, ce qui ne suffit pas : deux
  // comptes étaient réellement faux (pas juste du padding de zéros comme sur
  // HAGTACOS/COLMARDOZ) : vat55 notait 445710055 au lieu de 44571006, et
  // uberSettlement notait 580009 au lieu de 580006. Les 7 autres comptes
  // n'avaient que le padding habituel, retiré ici aussi.
  //
  // Caisse (cashAdapter 'strasgame-retraitements', voir app.js) : rapport
  // Zelty "RETRAITEMENTS", section "Ecritures" (Sur place/A emporter x
  // 5,5 %/10 %, bornes Belorder incluses, Livraison — Uber Eats + Deliveroo —
  // exclue). Comptes identiques au schéma O'Tacos/ALDN (701051/701052/70111/
  // 70112/44571006/44571008/531), confirmés exacts au centime contre
  // l'écriture RECETTES 07.2026 réellement postée le 8 sept. 2026.
  strasgame: {
    id: 'strasgame',
    name: 'STRASGAME',
    label: 'Crousty Game — Strasbourg',
    mode: 'uber-and-cash',
    cashAdapter: 'strasgame-retraitements',
    uberJournal: 'VT',
    vatBreakdown: '5.5-and-10',
    expenseVat: 0.20,
    uberEstablishments: [],
    accounts: {
      uberSales55: ['70114', 'VENTES 5,5% UBEREATS'],
      vat55: ['44571006', 'TVA collectée à 5,5%'],
      uberSales10: ['70113', 'VENTES 10% UBEREATS'],
      vat10: ['44571008', 'TVA collectée à 10%'],
      commission: ['6222', 'COMMISSIONS UBEREATS'],
      deductibleVat: ['44566', 'TVA sur autres biens et services'],
      marketing: ['623204', 'DEPENSES MARKETING UBEREATS'],
      mealVoucher: ['580004', 'VERSEMENT TR'],
      uberSettlement: ['580006', 'UBEREAT'],
      salesSP55: ['701051', 'VENTES 5,5% SUR PLACE'],
      salesAE55: ['701052', 'VENTES 5,5% A EMPORTER'],
      salesSP10: ['70111', 'VENTES 10% SUR PLACE'],
      salesAE10: ['70112', 'VENTES 10% A EMPORTER'],
      cash: ['531', 'CAISSE']
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
    // Numéros re-corrigés le 7 sept. 2026 (retrait des zéros de padding qui ne
    // correspondaient pas au numéro RÉEL stocké côté Pennylane — l'import Excel
    // manuel tolérait l'écart, l'écriture directe par API ne le tolère pas).
    accounts: {
      uberSales55: ['701135', 'VENTES 5,5% UBEREATS'],
      vat55: ['44571006', 'TVA collectée à 5,5%'],
      uberSales10: ['701121', 'VENTES 10% UBEREATS'],
      vat10: ['44571008', 'TVA collectée à 10%'],
      commission: ['6222', 'COMMISSIONS UBEREATS'],
      deductibleVat: ['44566', 'TVA sur autres biens et services'],
      marketing: ['623204', 'DEPENSES MARKETING UBEREATS'],
      mealVoucher: ['580004', 'VERSEMENT TR'],
      uberSettlement: ['580006', 'UBEREAT']
    },
    // Caisse (rapport POS "Reports", table hors plateformes) : comptes confirmés
    // le 7 sept. 2026 contre l'écriture RÉELLEMENT postée dans Pennylane de
    // juillet 2026, exacts au centime. HAGTACOS est la seule société du groupe à
    // utiliser le compte générique 7011 (et non 70111) pour la vente 10 % SP.
    cashAccounts: {
      salesSP55: ['701051', 'VENTES 5,5% SUR PLACE'],
      salesAE55: ['701052', 'VENTES 5,5% A EMPORTER'],
      salesSP10: ['7011', 'VENTES 10% SUR PLACE'],
      salesAE10: ['70112', 'VENTES 10% A EMPORTER'],
      cash: ['531', 'CAISSE']
    }
  }),
  colmios: otacosProfile({
    id: 'colmios',
    name: 'COLMIOS',
    label: "O'Tacos Colmar",
    establishmentId: '401010401',
    // Numéros re-corrigés le 7 sept. 2026 (mêmes zéros de padding erronés que sur
    // HAGTACOS, retirés après nouveau croisement avec l'écriture réelle de juillet).
    accounts: {
      uberSales55: ['701135', 'VENTES 5,5% UBEREATS'],
      vat55: ['44571006', 'TVA collectée à 5,5%'],
      uberSales10: ['70113', 'VENTES 10% UBEREATS'],
      vat10: ['44571008', 'TVA collectée à 10%'],
      commission: ['6222', 'COMMISSIONS UBEREATS'],
      deductibleVat: ['44566', 'TVA sur autres biens et services'],
      marketing: ['623205', 'DEPENSES MARKETING UBEREATS'],
      mealVoucher: ['580004', 'VERSEMENT TR'],
      uberSettlement: ['580006', 'UBEREAT']
    },
    // Caisse : comptes confirmés le 7 sept. 2026 contre l'écriture réelle de
    // juillet 2026 (exacts au centime).
    cashAccounts: {
      salesSP55: ['701051', 'VENTES 5,5% SUR PLACE'],
      salesAE55: ['701052', 'VENTES 5,5% A EMPORTER'],
      salesSP10: ['70111', 'VENTES 10% SUR PLACE'],
      salesAE10: ['70112', 'VENTES 10% A EMPORTER'],
      cash: ['531', 'CAISSE']
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
  }, cashAccounts: {
    salesSP55: ['701051', 'VENTES 5,5% SUR PLACE'], salesAE55: ['701052', 'VENTES 5,5% A EMPORTER'],
    salesSP10: ['70111', 'VENTES 10% SUR PLACE'], salesAE10: ['70112', 'VENTES 10% A EMPORTER'], cash: ['531', 'CAISSE']
  } }),
  epios: otacosProfile({ id: 'epios', name: 'EPIOS', label: "O'Tacos", establishmentId: '', accounts: {
    uberSales55: ['70114', 'VENTES UBEREATS 5,5%'], vat55: ['44571006', 'TVA collectée à 5,5%'],
    uberSales10: ['70113', 'VENTES UBEREATS 10%'], vat10: ['44571008', 'TVA collectée à 10%'],
    commission: ['6222', 'COMMISSIONS UBEREATS'], deductibleVat: ['44566', 'TVA sur autres biens et services'],
    marketing: ['623204', 'DEPENSES MARKETING UBEREATS'], mealVoucher: ['580004', 'VERSEMENT TR'], uberSettlement: ['580006', 'UBEREAT']
  }, cashAccounts: {
    salesSP55: ['701051', 'VENTES 5,5% SUR PLACE'], salesAE55: ['701052', 'VENTES 5,5% A EMPORTER'],
    salesSP10: ['70111', 'VENTES 10% SUR PLACE'], salesAE10: ['70112', 'VENTES 10% A EMPORTER'], cash: ['531', 'CAISSE']
  } }),
  geipios: otacosProfile({ id: 'geipios', name: 'GEIPIOS', label: "O'Tacos", establishmentId: '', accounts: {
    uberSales55: ['70114', 'VENTES UBEREATS 5,5%'], vat55: ['44571006', 'TVA collectée à 5,5%'],
    uberSales10: ['70113', 'VENTES UBEREATS 10%'], vat10: ['44571008', 'TVA collectée à 10%'],
    commission: ['6222', 'COMMISSIONS UBEREATS'], deductibleVat: ['44566', 'TVA sur autres biens et services'],
    marketing: ['623204', 'DEPENSES MARKETING UBEREATS'], mealVoucher: ['580004', 'VERSEMENT TR'], uberSettlement: ['580006', 'UBEREAT']
  }, cashAccounts: {
    salesSP55: ['701051', 'VENTES 5,5% SUR PLACE'], salesAE55: ['701052', 'VENTES 5,5% A EMPORTER'],
    salesSP10: ['70111', 'VENTES 10% SUR PLACE'], salesAE10: ['70112', 'VENTES 10% A EMPORTER'], cash: ['531', 'CAISSE']
  } }),
  sarios: otacosProfile({ id: 'sarios', name: 'SARIOS', label: "O'Tacos", establishmentId: '', accounts: {
    uberSales55: ['70114', 'VENTES UBEREATS 5,5%'], vat55: ['44571006', 'TVA collectée à 5,5%'],
    uberSales10: ['70113', 'VENTES UBEREATS 10%'], vat10: ['44571008', 'TVA collectée à 10%'],
    commission: ['6222', 'COMMISSIONS UBEREATS'], deductibleVat: ['44566', 'TVA sur autres biens et services'],
    marketing: ['623205', 'MARKETING UBER EATS'], mealVoucher: ['580004', 'VERSEMENT TR'], uberSettlement: ['580006', 'UBEREAT']
  }, cashAccounts: {
    salesSP55: ['701051', 'VENTES 5,5% SUR PLACE'], salesAE55: ['701052', 'VENTES 5,5% A EMPORTER'],
    salesSP10: ['70111', 'VENTES 10% SUR PLACE'], salesAE10: ['70112', 'VENTES 10% A EMPORTER'], cash: ['531', 'CAISSE']
  } }),
  hautios: otacosProfile({ id: 'hautios', name: 'HAUTIOS', label: "O'Tacos", establishmentId: '', accounts: {
    uberSales55: ['70114', 'VENTES UBEREATS 5,5%'], vat55: ['44571006', 'TVA collectée à 5,5%'],
    uberSales10: ['70113', 'VENTES UBEREATS 10%'], vat10: ['44571008', 'TVA collectée à 10%'],
    commission: ['6222', 'COMMISSIONS UBEREATS'], deductibleVat: ['44566', 'TVA sur autres biens et services'],
    marketing: ['623205', 'MARKETING UBER EATS'], mealVoucher: ['580004', 'VERSEMENT TR'], uberSettlement: ['580006', 'UBEREAT']
  }, cashAccounts: {
    salesSP55: ['701051', 'VENTES 5,5% SUR PLACE'], salesAE55: ['701052', 'VENTES 5,5% A EMPORTER'],
    salesSP10: ['70111', 'VENTES 10% SUR PLACE'], salesAE10: ['70112', 'VENTES 10% A EMPORTER'], cash: ['531', 'CAISSE']
  } }),
  mulios: otacosProfile({ id: 'mulios', name: 'MULIOS', label: "O'Tacos Mulhouse", establishmentId: '', accounts: {
    uberSales55: ['70114', 'VENTES UBEREATS 5,5%'], vat55: ['44571006', 'TVA collectée à 5,5%'],
    uberSales10: ['70113', 'VENTES UBEREATS 10%'], vat10: ['44571008', 'TVA collectée à 10%'],
    commission: ['6222', 'COMMISSIONS UBEREATS'], deductibleVat: ['44566', 'TVA sur autres biens et services'],
    marketing: ['623205', 'MARKETING UBER EATS'], mealVoucher: ['580004', 'VERSEMENT TR'], uberSettlement: ['580006', 'UBEREAT']
  }, cashAccounts: {
    // MULIOS est la seule société du groupe dont le compte de caisse est 530 et
    // non 531 (confirmé sur l'écriture RECETTES réelle de juillet 2026).
    salesSP55: ['701051', 'VENTES 5,5% SUR PLACE'], salesAE55: ['701052', 'VENTES 5,5% A EMPORTER'],
    salesSP10: ['70111', 'VENTES 10% SUR PLACE'], salesAE10: ['70112', 'VENTES 10% A EMPORTER'], cash: ['530', 'CAISSE']
  } }),
  // ARIOS : écriture Uber Eats de juillet 2026 confirmée (comme les 7 autres), avec
  // une différence réelle sur le compte de versement : 580009 et non 580006.
  arios: otacosProfile({ id: 'arios', name: 'ARIOS', label: "O'Tacos", establishmentId: '', accounts: {
    uberSales55: ['70114', 'VENTES UBEREATS 5,5%'], vat55: ['44571006', 'TVA collectée à 5,5%'],
    uberSales10: ['70113', 'VENTES UBEREATS 10%'], vat10: ['44571008', 'TVA collectée à 10%'],
    commission: ['6222', 'COMMISSIONS UBEREATS'], deductibleVat: ['44566', 'TVA sur autres biens et services'],
    marketing: ['623204', 'DEPENSES MARKETING UBEREATS'], mealVoucher: ['580004', 'VERSEMENT TR'], uberSettlement: ['580009', 'UBEREAT']
  }, cashAccounts: {
    // Caisse : comptes confirmés le 8 sept. 2026 contre l'écriture RECETTES
    // réellement postée (exacts au centime, même schéma que les 8 autres).
    salesSP55: ['701051', 'VENTES 5,5% SUR PLACE'], salesAE55: ['701052', 'VENTES 5,5% A EMPORTER'],
    salesSP10: ['70111', 'VENTES 10% SUR PLACE'], salesAE10: ['70112', 'VENTES 10% A EMPORTER'], cash: ['531', 'CAISSE']
  } }),
  // Uber + Caisse confirmés le 10 sept. 2026 contre les écritures RÉELLEMENT postées
  // (UBEREATS 07.2026 et RECETTES 07.2026) : tous les comptes collent exactement,
  // schéma caisse standard O'Tacos. L'écart de 23,34 € vu en juillet (signalé comme
  // anomalie non expliquée) n'en est pas une : l'expert-comptable a simplement posté
  // deux lignes sur le même compte marketing (623205 : 246,58 € + 23,34 €) au lieu
  // d'une seule — le total du compte correspond exactement à notre calcul.
  vinios: otacosProfile({ id: 'vinios', name: 'VINIOS', label: "O'Tacos", establishmentId: '401010879', accounts: {
    uberSales55: ['70114', 'VENTES UBEREATS 5,5%'], vat55: ['44571006', 'TVA collectée à 5,5%'],
    uberSales10: ['70113', 'VENTES UBEREATS 10%'], vat10: ['44571008', 'TVA collectée à 10%'],
    commission: ['6222', 'COMMISSIONS UBEREATS'], deductibleVat: ['44566', 'TVA sur autres biens et services'],
    marketing: ['623205', 'MARKETING UBER EATS'], mealVoucher: ['580004', 'VERSEMENT TR'], uberSettlement: ['580006', 'UBEREAT']
  }, cashAccounts: {
    salesSP55: ['701051', 'VENTES 5,5% SUR PLACE'],
    salesAE55: ['701052', 'VENTES 5,5% A EMPORTER'],
    salesSP10: ['70111', 'VENTES 10% SUR PLACE'],
    salesAE10: ['70112', 'VENTES 10% A EMPORTER'],
    cash: ['531', 'CAISSE']
  } }),
  // ALDN — enseigne IT TRATTORIA (pas O'Tacos, mais même moteur Uber/TVA que la
  // famille O'Tacos). Seule société avec une part de ventes Uber à 20 % (alcool,
  // colonne Uber "TVA 3 sur les ventes") : comptes uberSales20/vat20 dédiés.
  // Formule et TOUS les comptes Uber confirmés le 7 sept. 2026 contre l'écriture
  // RÉELLEMENT postée dans Pennylane de juillet 2026 (API), exacts au centime près.
  //
  // Caisse (cashAdapter 'aldn-taxes', voir app.js) : un seul fichier "Répartition
  // des taux de TVA par emplacement", 3 taux x 6 canaux (A Emporter/BàE/BSP/
  // Deliveroo/Sur Place/UberEats). Comptes confirmés le 8 sept. 2026 contre
  // l'écriture "RECETTES 07.2026" RÉELLEMENT postée (API, pas le tableur — celui-ci
  // affiche les comptes avec des zéros de padding qui ne correspondent à aucun
  // compte réel, même piège que HAGTACOS/COLMARDOZ) : le compte "AE" réel
  // additionne A Emporter + BàE, le compte "SP" réel additionne BSP + Sur Place ;
  // Deliveroo et UberEats sont entièrement exclus de la caisse. Pas de moteur
  // 'otacos-taxes' ici : ALDN n'a pas de fichier "Opérations quotidiennes" séparé,
  // tout est dans le seul rapport Taxes, d'où un adaptateur dédié.
  // Piège trouvé en croisant l'API : le compte de TVA collectée à 20 % de la
  // caisse (445712001) est DIFFÉRENT de celui d'Uber (44571009) — deux comptes
  // distincts pour le même taux selon le canal, d'où la clé cashVat20 séparée.
  aldn: {
    id: 'aldn',
    name: 'ALDN',
    label: 'IT TRATTORIA',
    mode: 'uber-and-cash',
    cashAdapter: 'aldn-taxes',
    uberJournal: '',
    vatBreakdown: 'otacos-5.5-and-10',
    expenseVat: 0.20,
    uberEstablishments: [],
    accounts: {
      uberSales55: ['70114', 'VENTES UBEREATS 5,5%'], vat55: ['44571006', 'TVA collectée à 5,5%'],
      uberSales10: ['70113', 'VENTES UBEREATS 10%'], vat10: ['44571008', 'TVA collectée à 10%'],
      uberSales20: ['70116', 'VENTES UBEREATS 20%'], vat20: ['44571009', 'TVA collectée à 20%'],
      commission: ['6222', 'COMMISSIONS UBEREATS'], deductibleVat: ['44566', 'TVA sur autres biens et services'],
      marketing: ['623205', 'MARKETING UBER EATS'], mealVoucher: ['580004', 'VERSEMENT TR'], uberSettlement: ['580006', 'UBEREAT'],
      salesSP55: ['701051', 'VENTES 5,5% SUR PLACE'], salesAE55: ['701052', 'VENTES 5,5% A EMPORTER'],
      salesSP10: ['70111', 'VENTES 10% SUR PLACE'], salesAE10: ['70112', 'VENTES 10% A EMPORTER'],
      salesSP20: ['701021', 'VENTES 20% SUR PLACE'], salesAE20: ['70102', 'VENTES 20% A EMPORTER'],
      cashVat20: ['445712001', 'TVA collectée à 20% (caisse)'],
      cash: ['531', 'CAISSE']
    }
  },
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
      uberSales55: ['70114', 'VENTES 5,5% UBEREATS'],
      vat55: ['44571006', 'TVA collectée à 5,5%'],
      uberSales10: ['70113', 'VENTES 10% UBEREATS'],
      vat10: ['44571008', 'TVA collectée à 10%'],
      commission: ['62222', 'COMMISSIONS UBEREATS'],
      deductibleVat: ['44566', 'TVA sur autres biens et services'],
      marketing: ['623204', 'DEPENSES MARKETING UBEREATS'],
      mealVoucher: ['580004', 'VERSEMENT TR'],
      uberSettlement: ['580006', 'UBEREAT']
    },
    // Caisse : comptes confirmés le 7 sept. 2026 contre l'écriture "RECETTES
    // 07.2026" réellement postée dans Pennylane (trouvée avec des libellés de
    // ligne vides — seul le libellé d'écriture est renseigné), exacts au centime.
    cashAccounts: {
      salesHt55: ['7010255', 'VENTES 5,5% CAISSE'],
      salesHt10: ['701021', 'VENTES 10% CAISSE'],
      cash: ['530', 'CAISSE']
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
    },
    // Caisse : comptes confirmés le 7 sept. 2026 contre l'écriture "RECETTES
    // 07.2026" réellement postée (mêmes comptes 7010255/701021/530 que
    // COLMARDOZ — cohérent, "idem à COLMARDOZ" comme annoncé par Baptiste).
    cashAccounts: {
      salesHt55: ['7010255', 'VENTES 5,5% CAISSE'],
      salesHt10: ['701021', 'VENTES 10% CAISSE'],
      cash: ['530', 'CAISSE']
    }
  })
};

export const getProfile = id => profiles[id] || null;
