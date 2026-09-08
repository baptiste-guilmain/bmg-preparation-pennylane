/** Point d'entrée de l'outil interne BMG. L'accès est défini au déploiement :
 * uniquement les utilisateurs du domaine Google Workspace. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Import CA Pennylane')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
