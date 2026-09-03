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
  }
};

export const getProfile = id => profiles[id] || null;
