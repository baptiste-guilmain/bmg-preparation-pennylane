/** Point d'entrée de l'outil interne BMG. L'accès est défini au déploiement :
 * uniquement les utilisateurs du domaine Google Workspace. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('BMG — Préparation Pennylane')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
