// =============================================================================
// BMG — Préparation Pennylane
// Plan du fichier (sections repérables en cherchant "// ===" dans l'éditeur) :
//   1. Setup / état global
//   2. Formulaire (dépôt de fichiers, sélection société/période)
//   3. Lecture des fichiers Uber (CSV/XLSX)
//   4. Moteur de lecture XLSX générique (partagé par tous les parseurs caisse)
//   5. Moteurs de caisse par société (un par format de rapport POS)
//   6. Construction de l'écriture comptable (lignes débit/crédit)
//   7. Affichage des résultats (contrôles, aperçu, erreurs)
//   8. Envoi direct à Pennylane (bêta, lecture seule + confirmation explicite)
//   9. Export Excel (écriture comptable téléchargeable)
// =============================================================================

// --- 1. Setup / état global -------------------------------------------------
import * as pdfjsLib from './vendor/pdf.min.mjs';
import { getProfile, profiles } from './profiles.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs';

const $ = (s) => document.querySelector(s);
const money = new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'});
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u00a0/g,' ').replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase();
// Declare ici (pas en section 8, malgre le sujet) car setProfile()/
// resetPennylanePanel() y accedent des le premier appel de setProfile()
// plus bas dans cette section - le declarer plus loin dans le fichier
// provoquait un `ReferenceError: Cannot access 'PENNYLANE_AVAILABLE' before
// initialization` qui interrompait TOUT le reste du script (sections 3 a 9
// jamais executees, donc "Generer l'apercu" totalement inerte), trouve le
// 11 sept. 2026 en testant HAGTACOS avec de vrais fichiers d'aout.
const PENNYLANE_AVAILABLE=typeof google!=='undefined'&&!!google.script&&!!google.script.run;
// Même raison qu'au-dessus : utilisé par refreshChecklist(), appelée dès la
// fin de la section 2, avant que la section 8 (où cette variable vivait
// avant) ne s'exécute.
let checklistToken=0;

let profile = getProfile('strasgame');
let state={files:{uber:null,cash:null,operations:null}, rows:[], allShown:false, valid:false};
let pennylanePayload=null;

// --- 2. Formulaire (dépôt de fichiers, sélection société/période) ----------
function bindFile(inputSel,zoneSel,key){
  const input=$(inputSel), zone=$(zoneSel);
  input.addEventListener('change',()=>setFile(input.files[0],zone,key));
  ['dragenter','dragover'].forEach(e=>zone.addEventListener(e,x=>{x.preventDefault();zone.classList.add('drag')}));
  ['dragleave','drop'].forEach(e=>zone.addEventListener(e,x=>{x.preventDefault();zone.classList.remove('drag')}));
  zone.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f){input.files=e.dataTransfer.files;setFile(f,zone,key)}});
}
function setFile(file,zone,key){
  if(!file)return; const box=zone.querySelector('.chosen'); state.files[key]=file; zone.classList.add('has-file'); box.hidden=false;
  const label=key==='uber'?'Import Uber':key==='operations'?'Opérations quotidiennes':'Import caisse';
  box.innerHTML=`<span class="file-icon ${key==='cash'?'pdf':''}">${key==='cash'?'P':'X'}</span><strong>${esc(file.name)}</strong><span>✓ ${label} reçu · ${formatBytes(file.size)} · cliquer pour remplacer</span>`;
  updatePreflight();
}
function setStep(n){document.querySelectorAll('.steps .step').forEach((el,i)=>el.classList.toggle('active',i<n))}
function updatePreflight(){
  const uberReady=Boolean(state.files.uber),cashReady=Boolean(state.files.cash),operationsReady=Boolean(state.files.operations),needsCash=profile.mode==='uber-and-cash',otacosCash=profile.cashAdapter==='otacos-taxes',cashInputsReady=otacosCash?cashReady&&operationsReady:cashReady,ready=uberReady&&(!needsCash||cashInputsReady);
  $('#process').disabled=!ready; $('.status-dot').classList.toggle('ready',ready);
  let title=needsCash?(otacosCash?`Trois imports obligatoires pour ${profile.name}`:`Deux imports obligatoires pour ${profile.name}`):`Import Uber obligatoire pour ${profile.name}`;
  let help=needsCash?(otacosCash?"Ajoutez l'export Uber, le fichier Taxes et les Opérations quotidiennes.":"Ajoutez l'import Uber et l'import caisse avant de créer l'écriture comptable."):"Ajoutez l'export Uber pour créer l'écriture comptable.";
  if(needsCash&&uberReady&&!cashInputsReady){title='Import Uber reçu';help=otacosCash?"Ajoutez maintenant les fichiers Taxes et Opérations quotidiennes.":"Ajoutez maintenant l'import caisse pour créer l'écriture comptable."}
  if(needsCash&&!uberReady&&cashInputsReady){title='Imports caisse reçus';help="Ajoutez maintenant l'import Uber pour créer l'écriture comptable."}
  if(ready){title=needsCash?'Les imports sont prêts':'Import Uber prêt';help="Vous pouvez créer l'écriture comptable."}
  $('#preflight strong').textContent=title; $('#preflight small').textContent=help;
  setStep(ready?2:1);
}
function formatBytes(n){return n>1048576?`${(n/1048576).toFixed(1)} Mo`:`${Math.ceil(n/1024)} Ko`}
bindFile('#uber-file','#uber-zone','uber'); bindFile('#cash-file','#cash-zone','cash'); bindFile('#operations-file','#operations-zone','operations');
function clearFile(key){const zone=$(`#${key}-zone`),input=$(`#${key}-file`),box=zone.querySelector('.chosen');state.files[key]=null;input.value='';zone.classList.remove('has-file');box.hidden=true}
function setProfile(id){
  profile=getProfile(id); const needsCash=profile.mode==='uber-and-cash',otacosCash=profile.cashAdapter==='otacos-taxes',dozCash=profile.cashAdapter==='doz-taxes',aldnCash=profile.cashAdapter==='aldn-taxes',strasgameCash=profile.cashAdapter==='strasgame-retraitements';
  clearFile('uber'); clearFile('cash'); clearFile('operations'); $('#cash-zone').hidden=!needsCash; $('#operations-zone').hidden=!otacosCash;
  $('.drop-grid').classList.toggle('triple',otacosCash);
  const pending=profile.status==='pending';$('.profile-pill').classList.toggle('pending',pending);
  $('#profile-state').textContent=(needsCash?`${profile.name} · Uber + caisse validés`:`${profile.name} · Uber validé`)+(pending?' · en attente de confirmation':'');
  $('#profile-help').textContent=needsCash?(otacosCash?'Profil caisse : TVA 5,5 % / 10 % × sur place/à emporter':dozCash?'Profil caisse : TVA 5,5 % / 10 %':aldnCash?'Profil caisse : TVA 5,5 % / 10 % / 20 % × sur place/à emporter':strasgameCash?'Profil caisse : TVA 5,5 % / 10 % × sur place/à emporter':'Profil caisse : CA Liquide / Solide'):(profile.vatBreakdown?'Profil actif : Uber seul · TVA 5,5 % et 10 %':'Profil actif : Uber seul');
  $('#intro-note').textContent=needsCash?(otacosCash?"Déposez l'export Uber, le rapport Taxes et les Opérations quotidiennes du mois. Uber et Deliveroo sont retirés de la caisse ; aucune écriture Deliveroo n'est créée ici.":"Déposez les deux justificatifs du mois. L'outil applique les règles de la société et vérifie l'écriture avant génération."):`Déposez l'export Uber du mois. L'outil applique les règles ${profile.name} et vérifie l'écriture avant génération.`;
  $('#uber-help').textContent=`Excel ou CSV · obligatoire pour ${profile.name}`;
  $('#cash-help').textContent=(otacosCash||dozCash||aldnCash||strasgameCash)?`Excel (.xlsx) · obligatoire pour ${profile.name}`:`PDF, Excel ou CSV · obligatoire pour ${profile.name}`;
  $('#cash-title').textContent=otacosCash?'Fichier Taxes':dozCash?'Rapport de taxes':aldnCash?'Répartition des taux de TVA':strasgameCash?'Retraitements caisse':'Rapport de caisse';
  $('#cash-zone em').textContent=otacosCash?"Le rapport Excel brut « Taxes » du logiciel de caisse, feuille « Reports », pour le mois concerné":dozCash?"Le rapport de taxes du logiciel de caisse (export Excel avec les onglets Revenus/TVA), pour le mois concerné":aldnCash?"Le rapport Excel « Répartition des taux de TVA par emplacement » du logiciel de caisse, pour le mois concerné":strasgameCash?"Le rapport Excel « RETRAITEMENTS » du logiciel de caisse (Zelty), pour le mois concerné":"Le récapitulatif des ventes en caisse du mois (souvent nommé « Opérations quotidiennes »)";
  $('#results').hidden=true; state.valid=false; setStep(1); updatePreflight(); resetPennylanePanel();
}
$('#company').addEventListener('change',e=>setProfile(e.target.value));
setProfile('strasgame');
// Suivi du mois : lu depuis Pennylane (et notre Drive) à chaque changement de
// période, pas depuis le navigateur — donc valable pour tout le monde quand
// plusieurs personnes saisissent en parallèle, voir refreshChecklist en
// section 8 (dépend de scriptRun/PENNYLANE_AVAILABLE, définis plus bas).
$('#period').addEventListener('change',refreshChecklist);
refreshChecklist();

// --- 3. Lecture des fichiers Uber (CSV/XLSX) --------------------------------
async function parseUber(file){
  const ext=file.name.split('.').pop().toLowerCase();
  let records;
  if(ext==='csv'){
    const buffer=await file.arrayBuffer();let text=new TextDecoder('utf-8').decode(buffer);
    // Les exports Uber français sont parfois encodés en Windows-1252. Une
    // seconde lecture évite que « rétrofacturation » ou « marché » deviennent
    // illisibles et que des colonnes comptables soient alors ignorées.
    if(text.includes('\uFFFD')) text=new TextDecoder('windows-1252').decode(buffer);
    records=parseDelimited(text);
  }
  else if(ext==='xlsx') records=await parseXlsx(file);
  else throw new Error("Le fichier Uber doit être un Excel (.xlsx) ou un CSV.");
  const headerIndex=records.findIndex(r=>r.some(v=>normalize(v)==='id de la commande'));
  if(headerIndex<0) throw new Error("Colonnes Uber non reconnues. Vérifiez qu'il s'agit de l'export détaillé Uber Eats.");
  const headers=records[headerIndex].map(normalize), rawData=records.slice(headerIndex+1).filter(r=>r.some(v=>v!==''&&v!=null));
  const col=(aliases)=>{for(const a of aliases){const i=headers.findIndex(h=>h===normalize(a)||h.includes(normalize(a)));if(i>=0)return i}return -1};
  const ix={currency:col(['Code de devise']),establishment:col(["Identifiant de l’établissement externe","Identifiant de l'etablissement externe","Identifiant externe du commerce"]),orderDate:col(['Date de la commande']),orderId:col(['Id. de la commande','Id de la commande']),sales:col(['Ventes (TVA incluse)','Total des ventes d articles TVA incluse','Ventes (incluant la TVA)']),refund:col(['Montant de la facturation rétroactive (TVA incluse)','Montant de la facturation retroactive TVA incluse','Montant de la rétrofacturation (TVA comprise)']),promo:col(['Offres sur les articles (TVA incluse)','Promotions du commerçant appliquées aux plats articles TVA incluse','Offres sur des articles (TVA comprise)']),vat1:col(['TVA 1 sur les ventes','TVA 1','Montant TVA 1','TVA 1 (montant)']),vat2:col(['TVA 2 sur les ventes','TVA 2','Montant TVA 2','TVA 2 (montant)']),
    // "TVA 3 sur les ventes" (20 %) : colonne Uber presente uniquement chez les
    // etablissements avec de l'alcool au menu (ALDN/IT TRATTORIA, juillet 2026).
    // Absente => 0, jamais bloquant, comme vat1/vat2.
    vat3:col(['TVA 3 sur les ventes','TVA 3','Montant TVA 3']),
    // Colonnes de TVA 1/2 séparées sur les ajustements (rétrofacturation) et les
    // offres/rabais : présentes chez certaines sociétés (COLMIOS, DOZ) mais pas
    // d'autres (HAGTACOS, STRASGAME, PDFK). Absentes => 0, jamais bloquant.
    vat1Adjustment:col(['TVA 1 sur les ajustements','TVA1 sur les ajustements']),vat2Adjustment:col(['TVA 2 sur les ajustements','TVA2 sur les ajustements']),
    vat1Offer:col(['TVA 1 sur les offres','TVA 1 sur les rabais']),vat2Offer:col(['TVA 2 sur les offres','TVA 2 sur les rabais']),
    offerFee:col(["Frais d'utilisation de l'offre"]),offerVat:col(["TVA sur les frais d'utilisation de l'offre"]),marketingAdjustment:col(['Ajustement marketing (TVA incluse)','Ajustement de marketing (TVA comprise)']),voucher:col(['Titre-restaurant','Bon de réduction-restaurant']),commission:col(['Frais de service de la Marketplace / frais de mise en relation après promotion (hors TVA)','Frais de service Uber facturés au commerçant après application de la réduction','Frais de mise en marché après rabais (TVA en sus)']),commissionVat:col(['TVA sur les frais de service de la Marketplace / frais de mise en relation après offre','TVA sur les frais de service Uber','TVA sur les frais de mise en marché après rabais']),other:col(['Autres paiements (TVA incluse)','Paiements divers (TVA comprise)']),total:col(['Montant total','Versement total']),payout:col(['Date du versement'])};
  // "Titre-restaurant" est absent de l'export Uber quand l'établissement n'accepte
  // pas les titres-restaurant dématérialisés (constaté sur VINIOS, juillet 2026) :
  // colonne optionnelle, jamais bloquante, comme les autres colonnes ci-dessus.
  const missing=Object.entries(ix).filter(([k,v])=>v<0&&!['offerFee','offerVat','vat1','vat2','vat3','vat1Adjustment','vat2Adjustment','vat1Offer','vat2Offer','marketingAdjustment','voucher'].includes(k)).map(([k])=>k);
  if(profile.vatBreakdown==='5.5-and-10'&&(ix.vat1<0||ix.vat2<0)) missing.push('TVA 1 / TVA 2');
  if(missing.length) throw new Error(`Export Uber incomplet : ${missing.length} colonne(s) indispensable(s) absente(s).`);
  const data=rawData.filter(r=>normalize(r[ix.currency])==='eur');
  if(!data.length) throw new Error("Aucune ligne de transaction en EUR n'a été trouvée dans l'export Uber.");
  const sum=k=>round(data.reduce((a,r)=>a+amount(r[ix[k]]),0));
  const payouts=new Map(); data.forEach(r=>{const v=amount(r[ix.total]);const d=dateValue(r[ix.payout]);const key=d||'À venir';payouts.set(key,round((payouts.get(key)||0)+v))});
  const establishments=[...new Set(data.map(r=>String(r[ix.establishment]||'').trim()).filter(Boolean))];
  // Un export mensuel peut contenir des remboursements contestés de commandes
  // antérieures, mais comptabilisés dans le règlement du mois courant. La
  // période majoritaire identifie donc le fichier sans écarter ces ajustements.
  const periodCounts=new Map();data.forEach(r=>{const p=monthValue(r[ix.orderDate]);if(p)periodCounts.set(p,(periodCounts.get(p)||0)+1)});
  const periods=[...periodCounts.keys()],primaryPeriod=[...periodCounts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
  const vatSum=k=>ix[k]<0?0:sum(k);
  // Sur certains exports Uber (constaté sur STRASGAME, août 2026), la colonne visée par
  // l'alias "TVA X sur les ajustements" est en réalité « TVA X sur les ajustements liés
  // à des erreurs de commande » — c'est-à-dire la TVA sur les REMBOURSEMENTS, pas un
  // vrai ajustement de prix commerçant. L'inclure fausse la ventilation 5,5 %/10 % de
  // plusieurs dizaines d'euros. profile.rawVatOnly (activé uniquement pour STRASGAME
  // pour l'instant, pour ne pas risquer de régresser COLMIOS/DOZ dont le format de
  // colonne diffère) utilise vat1/vat2 tels quels, sans Adjustment ni Offer.
  const vat1Extra=profile.rawVatOnly?0:vatSum('vat1Adjustment')+vatSum('vat1Offer');
  const vat2Extra=profile.rawVatOnly?0:vatSum('vat2Adjustment')+vatSum('vat2Offer');
  return {sales:sum('sales'),refund:sum('refund'),promo:sum('promo'),
    vat3:vatSum('vat3'),
    vat1:round(vatSum('vat1')+vat1Extra),
    vat2:round(vatSum('vat2')+vat2Extra),
    offerFee:sum('offerFee'),offerVat:sum('offerVat'),marketingAdjustment:ix.marketingAdjustment<0?0:sum('marketingAdjustment'),voucher:sum('voucher'),commission:sum('commission'),commissionVat:sum('commissionVat'),other:sum('other'),total:sum('total'),payouts:[...payouts].filter(([,v])=>Math.abs(v)>.004),establishments,periods,primaryPeriod,rowCount:data.length};
}
function amount(v){
  if(v==null||v==='')return 0;
  if(v&&typeof v==='object'&&'excel' in v){const d=excelDate(v.excel),m=d.getUTCMonth()+1,decimals=m>=10?2:v.decimals;return d.getUTCDate()+m/(10**decimals)}
  if(v instanceof Date){const m=v.getUTCMonth()+1;return v.getUTCDate()+(m<10?m/10:m/100)}
  if(typeof v==='number'){if(v>30000){const d=excelDate(v);const m=d.getUTCMonth()+1;return d.getUTCDate()+(m<10?m/10:m/100)}return v}
  const s=String(v).replace(/\s/g,'').replace(',','.').replace(/[^0-9.\-]/g,''); return Number(s)||0;
}
function dateValue(v){
  if(v==null||v==='')return '';
  if(v&&typeof v==='object'&&'excel' in v)return frDate(excelDate(v.excel));
  if(v instanceof Date)return frDate(v);
  if(typeof v==='number'&&v>30000)return frDate(excelDate(v));
  const s=String(v),iso=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s|T|$)/);if(iso)return `${iso[3].padStart(2,'0')}/${iso[2].padStart(2,'0')}/${iso[1]}`;
  const m=s.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);return m?`${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[3].length===2?'20'+m[3]:m[3]}`:'';
}
function excelDate(v){return new Date(Date.UTC(1899,11,30)+Math.round(v)*86400000)}
function frDate(d){return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`}
function monthValue(v){const d=dateValue(v),m=d.match(/\d{2}\/(\d{2})\/(\d{4})/);return m?`${m[2]}-${m[1]}`:''}

// --- 4. Moteur de lecture XLSX générique (partagé par les parseurs caisse) -
function parseDelimited(text){
  const sep=(text.split('\n')[0].match(/;/g)||[]).length>(text.split('\n')[0].match(/,/g)||[]).length?';':','; const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){cell+='"';i++}else q=!q}else if(c===sep&&!q){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell=''}else cell+=c} if(cell||row.length){row.push(cell);rows.push(row)}return rows;
}
async function parseXlsxWorkbook(file){
  const zip=await JSZip.loadAsync(await file.arrayBuffer());
  const xml=async p=>new DOMParser().parseFromString(await zip.file(p).async('text'),'application/xml');
  const shared=[];if(zip.file('xl/sharedStrings.xml')){const d=await xml('xl/sharedStrings.xml');d.querySelectorAll('si').forEach(si=>shared.push([...si.querySelectorAll('t')].map(x=>x.textContent).join('')))}
  const styleFormats=[];if(zip.file('xl/styles.xml')){const sd=await xml('xl/styles.xml'),custom={};sd.querySelectorAll('numFmt').forEach(n=>custom[n.getAttribute('numFmtId')]=n.getAttribute('formatCode'));sd.querySelectorAll('cellXfs > xf').forEach(x=>styleFormats.push(custom[x.getAttribute('numFmtId')]||''))}
  const wb=await xml('xl/workbook.xml'),rels=await xml('xl/_rels/workbook.xml.rels');
  const sheetEls=[...wb.querySelectorAll('sheet')];
  const readSheet=async sheetEl=>{
    const rid=sheetEl.getAttribute('r:id');const rel=[...rels.querySelectorAll('Relationship')].find(x=>x.getAttribute('Id')===rid);let target=rel.getAttribute('Target').replace(/^\//,'');if(!target.startsWith('xl/'))target='xl/'+target.replace(/^\.\//,'');const sheet=await xml(target);
    const rows=[]; sheet.querySelectorAll('row').forEach(rx=>{const row=[];rx.querySelectorAll('c').forEach(c=>{const ref=c.getAttribute('r'),col=lettersToIndex(ref.match(/[A-Z]+/)[0]),t=c.getAttribute('t'),raw=c.querySelector('v')?.textContent??'',inline=c.querySelector('is t')?.textContent??'',fmt=styleFormats[+(c.getAttribute('s')||0)]||'';let val=t==='s'?shared[+raw]:(t==='inlineStr'?inline:(t==='str'?raw:(raw===''?'':Number(raw))));if(typeof val==='number'&&/^d{1,2}\.m{1,2}$/i.test(fmt))val={excel:val,decimals:fmt.toLowerCase()==='d.m'?1:2};row[col]=val});rows.push(row)});
    return rows;
  };
  return {sheetEls,readSheet};
}
async function parseXlsx(file,sheetNameMatch){
  const {sheetEls,readSheet}=await parseXlsxWorkbook(file);
  // Par defaut le 1er onglet (comportement historique). Certains rapports (DOZ)
  // ont plusieurs onglets : sheetNameMatch permet de cibler celui voulu par un
  // fragment de nom normalise, avec repli sur le 1er onglet si non trouve.
  const sheetEl=sheetNameMatch?(sheetEls.find(s=>normalize(s.getAttribute('name')).indexOf(sheetNameMatch)>=0)||sheetEls[0]):sheetEls[0];
  return readSheet(sheetEl);
}
// Lit TOUS les onglets d'un classeur (contrairement a parseXlsx qui n'en lit
// qu'un). Utilise quand la section recherchee peut se trouver sur un onglet
// dont le nom n'est pas previsible d'un mois sur l'autre (ex. STRASGAME).
async function parseXlsxAllSheets(file){
  const {sheetEls,readSheet}=await parseXlsxWorkbook(file);
  const out=[];for(const sheetEl of sheetEls) out.push({name:sheetEl.getAttribute('name'),rows:await readSheet(sheetEl)});
  return out;
}
function lettersToIndex(s){let n=0;for(const c of s)n=n*26+c.charCodeAt(0)-64;return n-1}

// --- 5. Moteurs de caisse par société (un par format de rapport POS) -------
async function parseCash(file,operationsFile){
  if(profile.cashAdapter==='otacos-taxes') return parseCashOtacos(file,operationsFile);
  if(profile.cashAdapter==='doz-taxes') return parseCashDoz(file);
  if(profile.cashAdapter==='aldn-taxes') return parseCashAldn(file);
  if(profile.cashAdapter==='strasgame-retraitements') return parseCashStrasgame(file);
  const ext=file.name.split('.').pop().toLowerCase();
  if(ext==='pdf'){
    const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;let text='';for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i),content=await p.getTextContent();text+=' '+content.items.map(x=>x.str).join(' ')}return parseCashText(text);
  }
  const records=ext==='xlsx'?await parseXlsx(file):parseDelimited(await file.text());return parseCashText(records.flat().join(' '));
}
function parseCashText(text){
  const clean=text.replace(/[\u00a0\u202f\uFFFD]/g,' ').replace(/€/g,' '); const find=(label,rate)=>{
    // Le rapport PDF émet une ligne sous la forme : « HT Libellé TTC TVA Taux ».
    // Cette forme exacte est prioritaire : les titres et les totaux contiennent aussi
    // les mots « Liquide » et « Solide » et ne doivent jamais servir de source.
    const exact=new RegExp(`([0-9 .]+[,\\.]\\d{2})\\s+${label}\\s+([0-9 .]+[,\\.]\\d{2})\\s+([0-9 .]+[,\\.]\\d{2})\\s*${rate}`,'i');
    const m=clean.match(exact);if(m){const [ht,ttc,vat]=m.slice(1,4).map(amount);return {ht,ttc,vat}}
    return null};
  const liquid=find('Liquide','10[,\\.]0%'),solid=find('Solide','10[,\\.]0%'),alcohol=find('Alcool','20[,\\.]0%');
  if(!liquid||!solid||!alcohol) throw new Error("Les lignes Liquide 10 %, Solide 10 % et Alcool 20 % n'ont pas toutes été trouvées dans le rapport de caisse.");
  const pm=clean.match(/Du\s+\d{1,2}[\/.](\d{1,2})[\/.](\d{2,4})\s+au/i);const period=pm?`${pm[2].length===2?'20'+pm[2]:pm[2]}-${pm[1].padStart(2,'0')}`:'';
  const totalMatch=clean.match(/([0-9 .]+[,\.]\d{2})\s+([0-9 .]+[,\.]\d{2})\s+CA HT\s+CA TTC/i);const declaredTotal=totalMatch?amount(totalMatch[2]):null;
  return {liquid,solid,alcohol,total:round(liquid.ttc+solid.ttc+alcohol.ttc),declaredTotal,period};
}
async function parseCashOtacos(file,operationsFile){
  const ext=file.name.split('.').pop().toLowerCase(),operationsExt=operationsFile?.name.split('.').pop().toLowerCase();
  if(ext!=='xlsx'||operationsExt!=='xlsx') throw new Error('Pour O’Tacos, fournissez les deux fichiers Excel bruts : « Taxes » et « Opérations quotidiennes ».');
  const [rows,operationsRows]=await Promise.all([parseXlsx(file),parseXlsx(operationsFile)]);
  // Les rapports bruts de caisse incluent Uber Eats et Deliveroo. Ces deux canaux
  // sont comptabilisés séparément : Uber via son export détaillé, Deliveroo
  // manuellement hors de cet outil. Pour la CAISSE, la base à retirer est le total
  // Uber enregistré par le logiciel de caisse dans « Opérations quotidiennes ».
  // Il peut différer du total de l'export Uber (promotions et ajustements) : cette
  // distinction est confirmée par l'expert-comptable sur HAGTACOS, août 2026.
  const num=v=>typeof v==='number'?v:0;
  const found={};
  // Certains rapports Taxes contiennent DEUX tableaux TVA identiques à la suite
  // (le second, pré-calculé par le logiciel de caisse hors Uber Eats). On garde
  // la PREMIÈRE occurrence (le total brut, plateformes incluses) : c'est celle-ci
  // que soustrait la ligne « Uber/Deliveroo » plus bas (rawAe10 - platformsTtc,
  // voir le garde-fou juste en dessous qui n'a de sens que si rawAe10 est le total
  // brut). Garder la DERNIÈRE occurrence par erreur revient à soustraire Uber Eats
  // deux fois (une fois via le second tableau du logiciel, une fois via la
  // soustraction manuelle) — bug trouvé le 11 sept. 2026 sur HAGTACOS août 2026
  // (écart de 23 113,70 €, exactement le total Uber Eats du mois).
  rows.forEach(r=>{const label=normalize(r&&r[0]);if(label.indexOf('t v a')===0&&!found[label]) found[label]={ttc:num(r[1]),ht:num(r[4]),tax:num(r[2])}});
  const sp55=found['t v a 5 5 sp'],ae55=found['t v a 5 5 ae'],sp10=found['t v a 10 sp'],rawAe10=found['t v a 10 ae'];
  if(!sp55||!ae55||!sp10||!rawAe10) throw new Error("Les lignes TVA 5,5 % et 10 % (SP/AE) n'ont pas toutes été trouvées dans le fichier Taxes.");
  const rawTotal=round(sp55.ttc+ae55.ttc+sp10.ttc+rawAe10.ttc);
  const operationHt=operationsRows.find(r=>normalize(r&&r[0])==='ventes nettes de tva'),operationTax=operationsRows.find(r=>normalize(r&&r[0])==='taxes recouvrees');
  if(!operationHt||!operationTax) throw new Error('Les totaux « Ventes nettes de TVA » et « Taxes recouvrées » sont introuvables dans les Opérations quotidiennes.');
  const operationsTotal=round(num(operationHt[1])+num(operationTax[1]));
  if(Math.abs(rawTotal-operationsTotal)>.02) throw new Error(`Les rapports Taxes et Opérations quotidiennes ne concordent pas (${money.format(rawTotal)} contre ${money.format(operationsTotal)} TTC).`);
  // Le rapport comporte plusieurs lignes candidates pour « UBER EATS »/« DELIVEROO » :
  // une répartition par canal de commande (montant HT-like, table du haut) et le
  // dernier tableau du rapport, « Exécuter le rapport sur le sujet Moyen de paiement/
  // support » (montant TTC réellement encaissé). Seul CE DERNIER TABLEAU fait foi —
  // consigne explicite de l'expert-comptable (Marion, 10 sept. 2026) : « Faut prendre
  // toujours le dernier tableau », après une écriture fausse sur FARTACOS où le montant
  // Uber exclu venait de la mauvaise ligne. On prend donc systématiquement la DERNIÈRE
  // occurrence de la ligne dans le fichier, telle quelle en TTC (jamais x1,10 — piège
  // similaire trouvé et corrigé le 9 sept. 2026 sur COLMIOS juillet).
  const cashPaymentTotal=label=>{
    const matches=operationsRows.filter(r=>String(r&&r[0]||'').trim()===label&&num(r[1])>0);
    if(!matches.length) return undefined;
    return round(num(matches[matches.length-1][1]));
  };
  const uberTtc=cashPaymentTotal('UBER EATS');
  if(uberTtc==null) throw new Error('Le total « UBER EATS » est introuvable dans les Opérations quotidiennes.');
  const deliverooTtc=cashPaymentTotal('DELIVEROO')||0,platformsTtc=round(uberTtc+deliverooTtc);
  if(uberTtc<0||platformsTtc>rawAe10.ttc+.02) throw new Error(`Uber et Deliveroo (${money.format(platformsTtc)}) ne peuvent pas être retirés de la ligne 10 % à emporter (${money.format(rawAe10.ttc)}).`);
  const ae10Ttc=round(rawAe10.ttc-platformsTtc),ae10={ttc:ae10Ttc,ht:round(ae10Ttc/1.10),tax:round(ae10Ttc-round(ae10Ttc/1.10))};
  const total=round(sp55.ttc+ae55.ttc+sp10.ttc+ae10.ttc);
  const extractPeriod=sourceRows=>{const row=sourceRows.find(r=>normalize(r&&r[0])==='dates d operation'),m=row&&String(row[1]||'').match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})\s*-/);return m?`${m[3].length===2?'20'+m[3]:m[3]}-${m[2].padStart(2,'0')}`:''};
  const period=extractPeriod(rows),operationsPeriod=extractPeriod(operationsRows);
  if(!period||!operationsPeriod||period!==operationsPeriod) throw new Error(`Les périodes Taxes et Opérations quotidiennes ne concordent pas (${period||'inconnue'} contre ${operationsPeriod||'inconnue'}).`);
  return {sp55,ae55,sp10,ae10,total,period,rawTotal,operationsTotal,uberExcluded:uberTtc,deliverooExcluded:deliverooTtc,kind:'otacos-taxes'};
}
async function parseCashDoz(file){
  const ext=file.name.split('.').pop().toLowerCase();
  if(ext!=='xlsx') throw new Error('Le rapport caisse DOZ doit être un fichier Excel (.xlsx).');
  const rows=await parseXlsx(file,'repartition du montant');
  // Deux formats existent dans les exports DOZ :
  // - complet : Taux de TVA | Montant TVA | | HT | | TTC ;
  // - brut : Taux de TVA | Montant TVA uniquement.
  // Dans le format brut, le CA est nécessairement reconstitué depuis la TVA.
  // Pas de découpage sur place/à emporter chez DOZ (POS différent des O'Tacos),
  // juste les deux taux. Validé cellule par cellule contre l'écriture RÉELLEMENT
  // postée dans Pennylane ("RECETTES 07.2026", comptes 701021/7010255, comptes
  // TVA 44571008/44571006 déjà connus, compte caisse 530) pour COLMARDOZ et
  // STRASDOZ en juillet 2026 — trouvée sous une écriture dont TOUTES les lignes
  // ont un libellé de ligne vide (seul le libellé d'écriture est renseigné), ce
  // qui explique pourquoi elle n'apparaissait pas dans une recherche par libellé
  // de ligne "RECETTES".
  const num=v=>typeof v==='number'?v:0;
  // "Taux de TVA" est stocké en texte ("1000"/"550") dans ce classeur, pas en
  // nombre : on le parse explicitement plutôt que via num() (réservé aux
  // colonnes montant, toujours numériques ici).
  let ht10=null,vat10=null,ht55=null,vat55=null;
  rows.forEach(r=>{
    const rate=Math.round(parseFloat(r&&r[0])||0);
    if(rate===1000){
      vat10=num(r[1]);
      ht10=typeof r[3]==='number'&&r[3]!==0?num(r[3]):round(vat10/.10);
    }
    else if(rate===550){
      vat55=num(r[1]);
      ht55=typeof r[3]==='number'&&r[3]!==0?num(r[3]):round(vat55/.055);
    }
  });
  if(ht10==null||ht55==null) throw new Error('Les lignes TVA 10 % et 5,5 % sont introuvables dans l\'onglet "TVA - Répartition du montant de".');
  const total=round(ht10+vat10+ht55+vat55);
  return {ht10:round(ht10),vat10:round(vat10),ht55:round(ht55),vat55:round(vat55),total,period:'',kind:'doz-taxes'};
}
const ALDN_MONTHS={janv:1,fevr:2,mars:3,avr:4,mai:5,juin:6,juil:7,aout:8,sept:9,oct:10,nov:11,dec:12};
function extractAldnPeriod(text){
  const m=text&&text.match(/au\s+\d{1,2}\s+([a-zà-ÿ]+)\.?\s+(\d{4})/i);if(!m)return '';
  const num=ALDN_MONTHS[normalize(m[1]).slice(0,4)];return num?`${m[2]}-${String(num).padStart(2,'0')}`:'';
}
async function parseCashAldn(file){
  // Rapport ALDN "Répartition des taux de TVA par emplacement" : un seul fichier,
  // 6 canaux en colonnes (A Emporter, BàE, BSP, Deliveroo, Sur Place, UberEats) x
  // 3 taux en lignes (5,5 / 10 / 20 %). Confirmé le 8 sept. 2026 contre l'écriture
  // "RECETTES 07.2026" RÉELLEMENT postée (API) : le compte "AE" réel additionne
  // A Emporter + BàE, le compte "SP" réel additionne BSP + Sur Place, Deliveroo et
  // UberEats sont entièrement exclus de la caisse (UberEats a sa propre écriture,
  // Deliveroo reste hors outil). Comptes de TVA partagés entre SP et AE pour
  // chaque taux, comme le moteur otacos-taxes.
  const ext=file.name.split('.').pop().toLowerCase();
  if(ext!=='xlsx') throw new Error('Le rapport de caisse ALDN doit être un fichier Excel (.xlsx).');
  const num=v=>typeof v==='number'?v:0;
  // L'export brut du logiciel de caisse regroupe PLUSIEURS rapports "Répartition
  // des taux de TVA..." dans un même classeur (par type, par date, par
  // emplacement...) : impossible de viser un nom d'onglet fixe. On cherche donc,
  // sur tous les onglets, celui qui a une ligne "Taux" ET une colonne
  // "A Emporter" (seul le rapport "par emplacement" a cette colonne).
  const sheets=await parseXlsxAllSheets(file);
  let rows=null,headerRowIndex=null,groupStarts=null;
  for(const sheet of sheets){
    const idx=sheet.rows.findIndex(r=>normalize(r&&r[0])==='taux');
    if(idx<0)continue;
    const headerRow=sheet.rows[idx],starts={};
    headerRow.forEach((cell,i)=>{const n=normalize(cell);
      if(n==='a emporter')starts.ae1=i;else if(n==='bae')starts.ae2=i;
      else if(n==='bsp')starts.sp1=i;else if(n==='sur place')starts.sp2=i;});
    if([starts.ae1,starts.ae2,starts.sp1,starts.sp2].every(v=>v!=null)){rows=sheet.rows;headerRowIndex=idx;groupStarts=starts;break;}
  }
  if(rows==null) throw new Error('Rapport "Répartition des taux de TVA par emplacement" introuvable dans le classeur de caisse ALDN.');
  if([groupStarts.ae1,groupStarts.ae2,groupStarts.sp1,groupStarts.sp2].some(v=>v==null))
    throw new Error('Colonnes "A Emporter" / "BàE" / "BSP" / "Sur Place" introuvables dans le rapport de caisse ALDN.');
  const rates={};
  for(let i=headerRowIndex+2;i<rows.length;i++){
    const row=rows[i];if(!row)continue;
    if(normalize(row[0])==='total')break;
    const rate=Math.round(parseFloat(row[0])*10)/10;if(!Number.isFinite(rate))continue;
    const ht=c=>num(row[c]),tax=c=>num(row[c+1]);
    rates[rate]={aeHt:round(ht(groupStarts.ae1)+ht(groupStarts.ae2)),aeTax:round(tax(groupStarts.ae1)+tax(groupStarts.ae2)),
      spHt:round(ht(groupStarts.sp1)+ht(groupStarts.sp2)),spTax:round(tax(groupStarts.sp1)+tax(groupStarts.sp2))};
  }
  const r55=rates[5.5],r10=rates[10],r20=rates[20];
  if(!r55||!r10) throw new Error('Les taux 5,5 % et 10 % sont introuvables dans le rapport de caisse ALDN.');
  const total=round(r55.aeHt+r55.aeTax+r55.spHt+r55.spTax+r10.aeHt+r10.aeTax+r10.spHt+r10.spTax+(r20?r20.aeHt+r20.aeTax+r20.spHt+r20.spTax:0));
  const periodCell=rows.flat().find(v=>typeof v==='string'&&/p.riode du/i.test(v));
  return {sp55:r55.spHt,ae55:r55.aeHt,vat55:round(r55.spTax+r55.aeTax),
    sp10:r10.spHt,ae10:r10.aeHt,vat10:round(r10.spTax+r10.aeTax),
    sp20:r20?r20.spHt:0,ae20:r20?r20.aeHt:0,vat20:r20?round(r20.spTax+r20.aeTax):0,
    total,period:extractAldnPeriod(periodCell),kind:'aldn-taxes'};
}

async function parseCashStrasgame(file){
  const ext=file.name.split('.').pop().toLowerCase();
  if(ext!=='xlsx') throw new Error('Le rapport de caisse STRASGAME doit être un fichier Excel (.xlsx).');
  const sheets=await parseXlsxAllSheets(file);
  const num=v=>typeof v==='number'?v:0;
  const parseRate=v=>{const s=String(v||'').replace(',','.').replace('%','').trim();const f=parseFloat(s);return Number.isFinite(f)?Math.round(f*10)/10:null};
  for(const sheet of sheets){
    const originIdx=sheet.rows.findIndex(r=>normalize(r&&r[0])==='origine de la commande');
    if(originIdx<0)continue;
    // Nouveau rapport caisse "CA Strasgame" (à partir d'août 2026, remplace le
    // rapport "RETRAITEMENTS"/section "Ecritures" — Baptiste confirmé le 10 sept.
    // 2026 que ce sera désormais le SEUL format fourni). Deux tableaux : « Origine
    // de la commande » (Belorder/Uber Eats/Deliveroo/Zelty Caisse × taux) et « Mode
    // de consommation » (Livraison/Sur place/À emporter × taux). Aucun des deux ne
    // donne directement « caisse hors plateformes, ventilée Sur place/À emporter » :
    // les bornes Belorder sont un mélange des deux modes (confirmé par Baptiste,
    // c'est aussi tout ce dont disposait l'expert-comptable pour construire le
    // rapport "RETRAITEMENTS" de juillet). On calcule donc le total hors Uber
    // Eats/Deliveroo par taux via « Origine » (Belorder + Zelty Caisse — la seule
    // donnée exacte disponible), puis on le répartit Sur place/À emporter au
    // prorata du ratio du tableau « Mode de consommation » hors Livraison — la
    // meilleure approximation possible avec les données fournies.
    const originByRate={};
    for(let i=originIdx+1;i<sheet.rows.length;i++){
      const row=sheet.rows[i];if(!row||!row[0])break;
      const label=normalize(row[0]),rate=parseRate(row[1]);if(rate==null)continue;
      if(label==='belorder'||label==='zelty caisse'){
        const o=originByRate[rate]||(originByRate[rate]={ht:0,tax:0});
        o.ht=round(o.ht+num(row[2]));o.tax=round(o.tax+num(row[4]));
      }
    }
    const modeIdx=sheet.rows.findIndex(r=>normalize(r&&r[0])==='mode de consommation');
    if(modeIdx<0)continue;
    const modeByRate={};
    for(let i=modeIdx+1;i<sheet.rows.length;i++){
      const row=sheet.rows[i];if(!row||!row[0])break;
      const label=normalize(row[0]),rate=parseRate(row[1]);if(rate==null)continue;
      if(label==='sur place'||label==='a emporter'){
        const m=modeByRate[rate]||(modeByRate[rate]={sp:0,ae:0});
        if(label==='sur place')m.sp=round(m.sp+num(row[2]));else m.ae=round(m.ae+num(row[2]));
      }
    }
    const o55=originByRate[5.5],o10=originByRate[10],m55=modeByRate[5.5],m10=modeByRate[10];
    if(!o55||!o10||!m55||!m10) continue;
    const split=(origin,mode)=>{
      const ratio=(mode.sp+mode.ae)>.004?mode.sp/(mode.sp+mode.ae):.5;
      const spHt=round(origin.ht*ratio),aeHt=round(origin.ht-spHt);
      const spTax=round(origin.tax*ratio),aeTax=round(origin.tax-spTax);
      return {spHt,aeHt,spTax,aeTax};
    };
    const s55=split(o55,m55),s10=split(o10,m10);
    const total=round(s55.spHt+s55.spTax+s55.aeHt+s55.aeTax+s10.spHt+s10.spTax+s10.aeHt+s10.aeTax);
    return {sp55:s55.spHt,ae55:s55.aeHt,vat55:round(s55.spTax+s55.aeTax),
      sp10:s10.spHt,ae10:s10.aeHt,vat10:round(s10.spTax+s10.aeTax),
      total,period:'',kind:'strasgame-retraitements'};
  }
  // Ancien rapport Zelty "RETRAITEMENTS" (section "Ecritures", Sur place/A emporter
  // déjà calculés) — gardé en repli si jamais ce format était encore fourni un mois.
  let rows=null,startIdx=null;
  for(const sheet of sheets){
    const idx=sheet.rows.findIndex(r=>normalize(r&&r[0])==='ecritures');
    if(idx>=0){rows=sheet.rows;startIdx=idx;break;}
  }
  if(rows==null) throw new Error('Rapport de caisse STRASGAME non reconnu (ni « Origine de la commande », ni section « Ecritures »).');
  const values={};let mode=null;
  for(let i=startIdx+1;i<rows.length;i++){
    const row=rows[i];if(!row)continue;
    const rate=typeof row[1]==='number'?row[1]:null;if(rate==null)continue;
    const label=normalize(row[0]);
    if(label==='sur place')mode='sp';else if(label==='a emporter')mode='ae';else if(row[0])break;
    const ht=num(row[2]),tax=num(row[4]);
    if(Math.abs(rate-.055)<.001){if(mode==='sp'){values.spHt55=ht;values.spTax55=tax}else if(mode==='ae'){values.aeHt55=ht;values.aeTax55=tax}}
    else if(Math.abs(rate-.1)<.001){if(mode==='sp'){values.spHt10=ht;values.spTax10=tax}else if(mode==='ae'){values.aeHt10=ht;values.aeTax10=tax}}
    if([values.spHt55,values.aeHt55,values.spHt10,values.aeHt10].every(v=>v!=null))break;
  }
  if([values.spHt55,values.aeHt55,values.spHt10,values.aeHt10].some(v=>v==null))
    throw new Error('Les lignes Sur place/A emporter (5,5 % et 10 %) sont introuvables dans la section "Ecritures".');
  const total=round(values.spHt55+values.spTax55+values.aeHt55+values.aeTax55+values.spHt10+values.spTax10+values.aeHt10+values.aeTax10);
  return {sp55:values.spHt55,ae55:values.aeHt55,vat55:round(values.spTax55+values.aeTax55),
    sp10:values.spHt10,ae10:values.aeHt10,vat10:round(values.spTax10+values.aeTax10),
    total,period:'',kind:'strasgame-retraitements'};
}

// --- 6. Construction de l'écriture comptable (lignes débit/crédit) ---------
function periodInfo(){const [y,m]=$('#period').value.split('-').map(Number);return {y,m,last:new Date(Date.UTC(y,m,0)),label:`${String(m).padStart(2,'0')}.${y}`}}
function line(date,journal,account,label,debit=null,credit=null,vat=null){return {date,journal,account:account[0],accountLabel:account[1],label,debit,credit,vat}}
function buildRows(uber,cash){
  const p=periodInfo(),date=frDate(p.last),ul=`UBEREAT ${p.label}`,cl=`RECETTES ${p.label}`,a=profile.accounts,journal=profile.uberJournal||'';const revenue=round(uber.sales+uber.refund+uber.promo),commission=Math.abs(uber.commission),commissionVat=Math.abs(uber.commissionVat);
  let salesHt,salesVat,marketingHt,marketingVat,marketingTtc,rows=[];
  if(profile.vatBreakdown==='5.5-and-10'||profile.vatBreakdown==='otacos-5.5-and-10'||profile.vatBreakdown==='doz-5.5-and-10'){
    const vat55=Math.abs(uber.vat1),vat10raw=Math.abs(uber.vat2);let sales55,ht10,vat10;
    // Compte Uber optionnel "TVA 3 sur les ventes" (20 %) : present uniquement chez
    // les etablissements qui vendent de l'alcool via Uber (constate sur ALDN/IT
    // TRATTORIA, juillet 2026 - PDFK aussi concerne mais pas d'alcool livre via Uber
    // ce mois-la). Absent ou nul => aucune ligne generee, jamais bloquant. Isolee en
    // priorite comme la part 5,5 %, avant le calcul du reliquat 10 %.
    const vat20raw=Math.abs(uber.vat3||0),sales20=vat20raw>.004?vat20raw/.2:0,ttc20=round(sales20*1.2);
    if(profile.vatBreakdown==='otacos-5.5-and-10'){
      // Ventilation validée sur le modèle HAGTACOS de juillet 2026 : la colonne
      // "TVA 2" brute d'Uber ne redonne pas la TVA 10 % réellement due (écarts
      // d'arrondi par commande) ; on isole donc la part 5,5 % via sa propre TVA,
      // puis la part 10 % par différence sur le total TTC (ventes + rétro + offres),
      // apres avoir retire la part 20 % le cas echeant.
      sales55=vat55/.055;const ttc55=sales55*1.055,ttc10=revenue-ttc55-ttc20;ht10=ttc10/1.10;vat10=ttc10-ht10;
    }else if(profile.vatBreakdown==='doz-5.5-and-10'){
      // Ventilation validée sur le modèle DOZ - Colmar de juillet 2026 (méthode
      // inverse de l'otacos) : la part 10 % s'obtient proprement depuis la TVA 2
      // brute (ventes + rétro + offres), la part 5,5 % est le reliquat du total
      // TTC une fois la part 10 % retirée. Donne les montants exacts du modèle,
      // à 10 décimales près.
      ht10=vat10raw/.1;const ttc10=ht10+vat10raw,ttc55=revenue-ttc10;sales55=ttc55/1.055;vat10=vat10raw;const vat55b=ttc55-sales55;
      salesHt=round(sales55+ht10);salesVat=round(vat55b+vat10);
      rows=[line(date,journal,a.uberSales55,ul,null,round(sales55),.055),line(date,journal,a.vat55,ul,null,round(vat55b)),line(date,journal,a.uberSales10,ul,null,round(ht10),.10),line(date,journal,a.vat10,ul,null,round(vat10))];
    }else{
      sales55=round(vat55/.055);ht10=round((revenue-vat55-vat10raw)-sales55);vat10=vat10raw;
    }
    if(profile.vatBreakdown!=='doz-5.5-and-10'){
      salesHt=round(sales55+ht10+sales20);salesVat=round(vat55+vat10+vat20raw);
      rows=[line(date,journal,a.uberSales55,ul,null,round(sales55),.055),line(date,journal,a.vat55,ul,null,round(vat55)),line(date,journal,a.uberSales10,ul,null,round(ht10),.10),line(date,journal,a.vat10,ul,null,round(vat10))];
      if(vat20raw>.004) rows.push(line(date,journal,a.uberSales20,ul,null,round(sales20),.20),line(date,journal,a.vat20,ul,null,round(vat20raw)));
    }
    if(profile.marketingSplit){
      // DOZ : les frais d'offre Uber (déjà ventilés HT/TVA par Uber) sont repris
      // tels quels, sans re-répartition ; seuls les "paiements divers" sont
      // regroupés puis reventilés à 20 %. Mélanger les deux (comme pour O'Tacos)
      // décale le résultat de plusieurs centimes — écart réel constaté et à éviter.
      const otherTtc=Math.abs(uber.other),otherHt=round(otherTtc/(1+profile.expenseVat)),otherVat=round(otherTtc-otherHt);
      const offerHt=round(Math.abs(uber.offerFee)),offerVat=round(Math.abs(uber.offerVat));
      marketingHt=otherHt;marketingVat=otherVat;marketingTtc=round(otherHt+otherVat+offerHt+offerVat);
      rows.push(line(date,journal,a.marketing,ul,offerHt,null,profile.expenseVat),line(date,journal,a.deductibleVat,ul,offerVat));
    }else{
      marketingTtc=round(Math.abs(uber.offerFee)+Math.abs(uber.offerVat)+Math.abs(uber.other));marketingHt=round(marketingTtc/(1+profile.expenseVat));marketingVat=round(marketingTtc-marketingHt);
    }
  }else{
    salesHt=round(revenue/(1+profile.uberVat));salesVat=round(revenue-salesHt);const otherTtc=Math.abs(uber.other),otherHt=round(otherTtc/(1+profile.expenseVat));marketingHt=round(Math.abs(uber.offerFee)+otherHt);marketingVat=round(Math.abs(uber.offerVat)+(otherTtc-otherHt));marketingTtc=round(marketingHt+marketingVat);
    rows=[line(date,journal,a.uberSales,ul,null,salesHt,profile.uberVat),line(date,journal,a.vat10,ul,null,salesVat)];
  }
  rows.push(line(date,journal,a.commission,ul,commission,null,profile.expenseVat),line(date,journal,a.deductibleVat,ul,commissionVat),line(date,journal,a.marketing,ul,marketingHt,null,profile.expenseVat),line(date,journal,a.deductibleVat,ul,marketingVat),line(date,journal,a.mealVoucher,`${ul} - PAIEMENT TIERS`,Math.abs(uber.voucher)));
  if(Math.abs(uber.marketingAdjustment)>.004){
    // Colonne Uber "Ajustement marketing" : absente chez PDFK/STRASGAME, mais
    // indispensable chez O'Tacos pour équilibrer l'écriture (constaté sur HAGTACOS :
    // sans cette ligne, débit et crédit diffèrent du montant exact de l'ajustement).
    const adjTtc=Math.abs(uber.marketingAdjustment),adjHt=round(adjTtc/(1+profile.expenseVat)),adjVat=round(adjTtc-adjHt),isCredit=uber.marketingAdjustment>0;
    rows.push(line(date,journal,a.marketing,ul,isCredit?null:adjHt,isCredit?adjHt:null,profile.expenseVat),line(date,journal,a.deductibleVat,ul,isCredit?null:adjVat,isCredit?adjVat:null));
  }
  uber.payouts.sort((x,y)=>x[0]==='À venir'?1:y[0]==='À venir'?-1:x[0].split('/').reverse().join('').localeCompare(y[0].split('/').reverse().join(''))).forEach(([d,v])=>rows.push(line(date,journal,a.uberSettlement,`${ul} ${d==='À venir'?'a venir':d}`,Math.abs(v))));
  // Les exports Uber peuvent inclure de petits écarts de règlement qui ne sont
  // pas ventilés par colonne. HAGTACOS a une règle validée par l'expert pour un
  // écart significatif ; sur les autres O'Tacos, seuls les écarts d'arrondi
  // inférieurs ou égaux à 1 EUR sont automatiquement rapprochés.
  const uberDebit=round(rows.reduce((sum,r)=>sum+(r.debit||0),0)),uberCredit=round(rows.reduce((sum,r)=>sum+(r.credit||0),0)),settlementGap=round(uberCredit-uberDebit);
  // Seuil de rapprochement automatique relevé de 1 € à 10 € le 11 sept. 2026 à la
  // demande de Baptiste, sur toutes les sociétés O'Tacos (pas seulement HAGTACOS) :
  // reprend le seuil de tolérance qu'il avait déjà validé avec l'expert-comptable
  // le 7 sept. 2026 pour les écarts d'arrondi Uber cumulés.
  const isOtacos=profile.vatBreakdown==='otacos-5.5-and-10',canReconcileGap=profile.id==='hagtacos'||(isOtacos&&Math.abs(settlementGap)<=10);
  // Seuil > .005 (pas > .01) : un écart de tout juste 1 centime (settlementGap
  // exactement égal à .01) doit être rapproché comme les autres, sinon il passe
  // sous le tolérance de notre propre contrôle d'équilibre (également > .01),
  // mais PAS sous celui - strict, zéro tolérance - de Pennylane, qui rejette
  // l'écriture ("Entry lines are not balanced") sans que rien ne l'ait annoncé
  // avant l'envoi réel. Bug trouvé le 11 sept. 2026 sur VINIOS août 2026 (envoi
  // réel échoué chez Baptiste ET un collaborateur, aperçu pourtant jugé "ok").
  if(canReconcileGap&&Math.abs(settlementGap)>.005){
    // L'écart est communiqué TTC. Il est ventilé à 20 % entre marketing et TVA
    // déductible afin de préserver la base HT et l'équilibre de l'écriture.
    const gapTtc=Math.abs(settlementGap),gapHt=round(gapTtc/(1+profile.expenseVat)),gapVat=round(gapTtc-gapHt),isDebit=settlementGap>0;
    const gapLabel=profile.id==='hagtacos'?'Écart de règlement non significatif':'Écart d’arrondi de règlement Uber';
    rows.push(line(date,journal,a.marketing,gapLabel,isDebit?gapHt:null,isDebit?null:gapHt,profile.expenseVat),line(date,journal,a.deductibleVat,gapLabel,isDebit?gapVat:null,isDebit?null:gapVat));
  }
  if(profile.mode==='uber-and-cash'){
    if(profile.cashAdapter==='otacos-taxes'){
      rows.push(line(date,'VT',a.salesSP55,cl,null,round(cash.sp55.ht),.055),line(date,'VT',a.salesAE55,cl,null,round(cash.ae55.ht),.055),line(date,'VT',a.vat55,cl,null,round(cash.sp55.tax+cash.ae55.tax)),
        line(date,'VT',a.salesSP10,cl,null,round(cash.sp10.ht),.10),line(date,'VT',a.salesAE10,cl,null,round(cash.ae10.ht),.10),line(date,'VT',a.vat10,cl,null,round(cash.sp10.tax+cash.ae10.tax)),
        line(date,'VT',a.cash,cl,cash.total));
    }else if(profile.cashAdapter==='doz-taxes'){
      rows.push(line(date,'VT',a.salesHt55,cl,null,round(cash.ht55),.055),line(date,'VT',a.vat55,cl,null,round(cash.vat55)),
        line(date,'VT',a.salesHt10,cl,null,round(cash.ht10),.10),line(date,'VT',a.vat10,cl,null,round(cash.vat10)),
        line(date,'VT',a.cash,cl,cash.total));
    }else if(profile.cashAdapter==='aldn-taxes'){
      rows.push(line(date,'VT',a.salesSP55,cl,null,round(cash.sp55),.055),line(date,'VT',a.salesAE55,cl,null,round(cash.ae55),.055),line(date,'VT',a.vat55,cl,null,round(cash.vat55)),
        line(date,'VT',a.salesSP10,cl,null,round(cash.sp10),.10),line(date,'VT',a.salesAE10,cl,null,round(cash.ae10),.10),line(date,'VT',a.vat10,cl,null,round(cash.vat10)));
      if(cash.sp20>.004||cash.ae20>.004) rows.push(line(date,'VT',a.salesSP20,cl,null,round(cash.sp20),.20),line(date,'VT',a.salesAE20,cl,null,round(cash.ae20),.20),line(date,'VT',a.cashVat20,cl,null,round(cash.vat20)));
      rows.push(line(date,'VT',a.cash,cl,cash.total));
    }else if(profile.cashAdapter==='strasgame-retraitements'){
      rows.push(line(date,'VT',a.salesSP55,cl,null,round(cash.sp55),.055),line(date,'VT',a.salesAE55,cl,null,round(cash.ae55),.055),line(date,'VT',a.vat55,cl,null,round(cash.vat55)),
        line(date,'VT',a.salesSP10,cl,null,round(cash.sp10),.10),line(date,'VT',a.salesAE10,cl,null,round(cash.ae10),.10),line(date,'VT',a.vat10,cl,null,round(cash.vat10)),
        line(date,'VT',a.cash,cl,cash.total));
    }else{
      rows.push(line(date,'VT',a.liquid,cl,null,cash.liquid.ht,profile.uberVat),line(date,'VT',a.vat10,cl,null,cash.liquid.vat),line(date,'VT',a.solid,cl,null,cash.solid.ht,profile.uberVat),line(date,'VT',a.vat10,cl,null,cash.solid.vat),line(date,'VT',a.alcohol,cl,null,cash.alcohol.ht,.20),line(date,'VT',a.vat20,cl,null,cash.alcohol.vat),line(date,'VT',a.cash,cl,cash.total));
    }
  }
  return {rows,revenue,salesHt,salesVat,marketingTtc};
}

$('#process').addEventListener('click',async()=>{
  const btn=$('#process');btn.disabled=true;btn.querySelector('span').textContent="Génération de l'aperçu…";const errors=[];resetPennylanePanel();
  try{
    if(!$('#period').value)throw new Error('Sélectionnez une période.');if(state.files.uber.size>25e6||(state.files.cash&&state.files.cash.size>25e6)||(state.files.operations&&state.files.operations.size>25e6))throw new Error('Un fichier dépasse la limite de 25 Mo.');
    const uber=await parseUber(state.files.uber),cash=profile.mode==='uber-and-cash'?await parseCash(state.files.cash,state.files.operations):null,built=buildRows(uber,cash);state.rows=built.rows;
    const debit=round(state.rows.reduce((s,r)=>s+(r.debit||0),0)),credit=round(state.rows.reduce((s,r)=>s+(r.credit||0),0)),diff=round(debit-credit);
    const selected=$('#period').value;
    if(uber.primaryPeriod!==selected)errors.push(`La période principale Uber détectée (${uber.primaryPeriod||'inconnue'}) ne correspond pas à ${selected}.`);
    if(cash&&cash.period&&cash.period!==selected)errors.push(`La période du rapport de caisse (${cash.period}) ne correspond pas à ${selected}.`);
    const unknown=profile.uberEstablishments.length?uber.establishments.filter(x=>!profile.uberEstablishments.includes(x)):[];if(unknown.length)errors.push(`Établissement Uber non reconnu pour ${profile.name} : ${unknown.join(', ')}.`);
    if(Math.abs(diff)>.005)errors.push(`Écriture déséquilibrée de ${money.format(Math.abs(diff))}.`);
    if(Math.abs(round(uber.total-(uber.payouts.reduce((s,[,v])=>s+v,0))))>.01)errors.push('Le total Uber ne correspond pas à la somme des versements.');
    if(cash&&cash.kind!=='otacos-taxes'&&cash.kind!=='doz-taxes'&&cash.kind!=='aldn-taxes'&&cash.kind!=='strasgame-retraitements'){if(Math.abs(round((cash.liquid.ht+cash.liquid.vat)-cash.liquid.ttc))>.02)errors.push('La ligne caisse Liquide ne se recalcule pas.');if(Math.abs(round((cash.solid.ht+cash.solid.vat)-cash.solid.ttc))>.02)errors.push('La ligne caisse Solide ne se recalcule pas.');if(Math.abs(round((cash.alcohol.ht+cash.alcohol.vat)-cash.alcohol.ttc))>.02)errors.push('La ligne caisse Alcool ne se recalcule pas.');if(cash.declaredTotal!=null&&Math.abs(round(cash.total-cash.declaredTotal))>.02)errors.push(`Le total des trois lignes caisse (${money.format(cash.total)}) ne correspond pas au total TTC du PDF (${money.format(cash.declaredTotal)}).`)}
    renderResults(uber,cash,built,debit,credit,errors);
  }catch(e){errors.push(e.message||'Erreur inconnue.');renderErrors(errors)}finally{btn.querySelector('span').textContent="Générer l'aperçu";btn.disabled=!(state.files.uber&&(profile.mode==='uber-only'||(state.files.cash&&(profile.cashAdapter!=='otacos-taxes'||state.files.operations))))}
});
// --- 7. Affichage des résultats (contrôles, aperçu, erreurs) ---------------
function renderResults(uber,cash,built,debit,credit,errors){
  $('#results').hidden=false;$('#result-period').textContent=`${profile.name} · ${periodInfo().label}`;$('#cash-kpi').hidden=!cash;if(cash){$('#cash-total').textContent=money.format(cash.total);$('#cash-detail').textContent=cash.kind==='otacos-taxes'?`HT ${money.format(cash.sp55.ht+cash.ae55.ht+cash.sp10.ht+cash.ae10.ht)} · TVA ${money.format(cash.sp55.tax+cash.ae55.tax+cash.sp10.tax+cash.ae10.tax)}`:cash.kind==='doz-taxes'?`HT ${money.format(cash.ht55+cash.ht10)} · TVA ${money.format(cash.vat55+cash.vat10)}`:cash.kind==='aldn-taxes'?`HT ${money.format(cash.sp55+cash.ae55+cash.sp10+cash.ae10+cash.sp20+cash.ae20)} · TVA ${money.format(cash.vat55+cash.vat10+cash.vat20)}`:cash.kind==='strasgame-retraitements'?`HT ${money.format(cash.sp55+cash.ae55+cash.sp10+cash.ae10)} · TVA ${money.format(cash.vat55+cash.vat10)}`:`HT ${money.format(cash.liquid.ht+cash.solid.ht+cash.alcohol.ht)} · TVA ${money.format(cash.liquid.vat+cash.solid.vat+cash.alcohol.vat)}`};$('#uber-revenue').textContent=money.format(built.revenue);$('#entry-total').textContent=money.format(debit);
  const checks=[['Structure Uber reconnue',`${uber.rowCount} lignes · ${uber.payouts.length} versements`],['Société et période cohérentes',`${uber.establishments.join(', ')} · ${periodInfo().label}`]];
  if(profile.vatBreakdown==='5.5-and-10')checks.push(['TVA Uber ventilée',`5,5 % : ${money.format(Math.abs(uber.vat1))} · 10 % : ${money.format(Math.abs(uber.vat2))}`]);
  if(profile.vatBreakdown==='otacos-5.5-and-10'){const vat20=Math.abs(uber.vat3||0);checks.push(['TVA Uber ventilée',`5,5 % : ${money.format(Math.abs(uber.vat1))} · 10 % (par différence) : ${money.format(round(built.salesVat-Math.abs(uber.vat1)-vat20))}`+(vat20>.004?` · 20 % : ${money.format(vat20)}`:'')]);}
  if(profile.vatBreakdown==='doz-5.5-and-10')checks.push(['TVA Uber ventilée',`10 % : ${money.format(Math.abs(uber.vat2))} · 5,5 % (par différence) : ${money.format(round(built.salesVat-Math.abs(uber.vat2)))}`]);
  if(cash&&cash.kind==='otacos-taxes'){checks.push(['Taxes et opérations quotidiennes rapprochées',`${money.format(cash.rawTotal)} TTC`],['Uber retiré de la caisse (Opérations quotidiennes)',money.format(cash.uberExcluded)],['Deliveroo retiré de la caisse',money.format(cash.deliverooExcluded)],['Caisse - 5,5 % (SP + AE)',`${money.format(cash.sp55.ht+cash.ae55.ht)} HT · TVA ${money.format(cash.sp55.tax+cash.ae55.tax)}`],['Caisse - 10 % (SP + AE)',`${money.format(cash.sp10.ht+cash.ae10.ht)} HT · TVA ${money.format(cash.sp10.tax+cash.ae10.tax)}`],['Total caisse hors Uber et Deliveroo',money.format(cash.total)]);}
  else if(cash&&cash.kind==='doz-taxes'){checks.push(['Caisse - 5,5 %',`${money.format(cash.ht55)} HT · TVA ${money.format(cash.vat55)}`],['Caisse - 10 %',`${money.format(cash.ht10)} HT · TVA ${money.format(cash.vat10)}`],['Total caisse (hors plateformes de livraison)',`${money.format(cash.total)} calculé sur le rapport de caisse`]);}
  else if(cash&&cash.kind==='aldn-taxes'){checks.push(['Caisse - 5,5 % (SP + AE)',`${money.format(cash.sp55+cash.ae55)} HT · TVA ${money.format(cash.vat55)}`],['Caisse - 10 % (SP + AE)',`${money.format(cash.sp10+cash.ae10)} HT · TVA ${money.format(cash.vat10)}`]);if(cash.sp20>.004||cash.ae20>.004)checks.push(['Caisse - 20 % (SP + AE)',`${money.format(cash.sp20+cash.ae20)} HT · TVA ${money.format(cash.vat20)}`]);checks.push(['Total caisse hors Deliveroo et UberEats',`${money.format(cash.total)} calculé sur le rapport de caisse`]);}
  else if(cash&&cash.kind==='strasgame-retraitements'){checks.push(['Caisse - 5,5 % (SP + AE)',`${money.format(cash.sp55+cash.ae55)} HT · TVA ${money.format(cash.vat55)}`],['Caisse - 10 % (SP + AE)',`${money.format(cash.sp10+cash.ae10)} HT · TVA ${money.format(cash.vat10)}`],['Total caisse hors Deliveroo et UberEats',`${money.format(cash.total)} calculé sur la section « Ecritures »`]);}
  else if(cash)checks.push(['Caisse - Liquide 10 %',`${money.format(cash.liquid.ht)} HT · ${money.format(cash.liquid.ttc)} TTC`],['Caisse - Solide 10 %',`${money.format(cash.solid.ht)} HT · ${money.format(cash.solid.ttc)} TTC`],['Caisse - Alcool 20 %',`${money.format(cash.alcohol.ht)} HT · ${money.format(cash.alcohol.ttc)} TTC`],['Total caisse rapproché',cash.declaredTotal!=null?`${money.format(cash.total)} = ${money.format(cash.declaredTotal)}`:`${money.format(cash.total)} calculé sur les trois lignes`]);
  checks.push(['TVA recalculée',profile.vatBreakdown==='5.5-and-10'?'Uber 5,5 % / 10 % · Frais 20 %':'Uber 10 % · Frais 20 %'],['Équilibre Débit = Crédit',`${money.format(debit)} = ${money.format(credit)}`]);
  $('#check-list').innerHTML=checks.map(x=>`<div class="check-row"><b>✓</b><strong>${x[0]}</strong><span>${x[1]}</span></div>`).join('');$('#check-badge').textContent=errors.length?'À corriger':`${checks.length} contrôles validés`;state.valid=!errors.length;renderRows();renderErrors(errors);$('#download').disabled=!state.valid;$('#download-status').textContent=state.valid?'Aperçu validé — fichier Excel prêt':'Création bloquée';$('#download-help').textContent=state.valid?`${state.rows.length} lignes comptables · à envoyer à l’expert-comptable ou à importer dans Pennylane`:'Corrigez les erreurs signalées puis régénérez l’aperçu.';setStep(state.valid?4:3);$('#results').scrollIntoView({behavior:'smooth',block:'start'});
  $('#pennylane-preview-btn').disabled=!state.valid;
}
function renderRows(){const shown=state.allShown?state.rows:state.rows.slice(0,8);$('#rows').innerHTML=shown.map(r=>`<tr><td>${r.date}</td><td>${r.journal||'—'}</td><td>${r.account}</td><td>${esc(r.label)}</td><td class="num">${r.debit!=null?money.format(r.debit):'—'}</td><td class="num">${r.credit!=null?money.format(r.credit):'—'}</td></tr>`).join('');$('#toggle-rows').textContent=state.allShown?'Réduire':`Afficher les ${state.rows.length} lignes`}
$('#toggle-rows').addEventListener('click',()=>{state.allShown=!state.allShown;renderRows()});
function renderErrors(errors){const box=$('#error-log');box.hidden=!errors.length;box.querySelector('ul').innerHTML=errors.map(e=>`<li>${esc(e)}</li>`).join('');if(errors.length){$('#results').hidden=false;$('#download').disabled=true}}

$('#download').addEventListener('click',async()=>{
  if(!state.valid)return;
  const blob=await makeXlsx(state.rows);
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${profile.name}_CA_UBER_${$('#period').value.replace('-','_')}_Pennylane.xlsx`;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  if(PENNYLANE_AVAILABLE){
    const help=$('#download-help');
    try{
      const base64=await makeXlsx(state.rows,'base64');
      const res=await scriptRun('saveEntryToDrive',profile.id,$('#period').value,base64,`${profile.name}.xlsx`);
      help.textContent=`Vérifiez l'aperçu ci-dessus avant de télécharger l'écriture comptable. Archivé dans Drive : ${res.folder}/${res.filename}.`;
      refreshChecklist();
    }catch(e){
      help.textContent=`Vérifiez l'aperçu ci-dessus avant de télécharger l'écriture comptable. Échec de l'archivage Drive : ${e.message||e}.`;
    }
  }
});

// Envoi direct à Pennylane (bêta) : le navigateur ne voit jamais les jetons
// API, tout passe par des fonctions Apps Script côté serveur (Code.gs), jamais
// exposées en HTTP public — appelées via google.script.run, disponible
// uniquement quand la page tourne réellement dans Apps Script (pas sur le
// lien de test GitHub Pages, où le panneau reste donc caché : voir
// PENNYLANE_AVAILABLE). Un aperçu (lecture seule) est obligatoire avant tout
// envoi réel, et toute régénération de l'écriture (nouveau traitement,
// changement de société) annule l'aperçu en cours pour éviter d'envoyer des
// données périmées. Un garde-fou côté serveur bloque aussi l'envoi si une
// écriture du même libellé existe déjà pour la période (anti-doublon de CA).
// --- 8. Envoi direct à Pennylane (bêta) -------------------------------------
// PENNYLANE_AVAILABLE est déclaré en section 1, voir le commentaire là-bas.
if(!PENNYLANE_AVAILABLE) $('#pennylane-bar').hidden=true;
function scriptRun(fnName,...args){
  return new Promise((resolve,reject)=>{
    google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[fnName](...args);
  });
}
function resetPennylanePanel(){
  pennylanePayload=null;
  if(!PENNYLANE_AVAILABLE)return;
  const box=$('#pennylane-preview');box.hidden=true;box.innerHTML='';
  $('#pennylane-send-btn').disabled=true;
  $('#pennylane-status').textContent='Aucun aperçu généré';
}
// Suivi du mois : dérivé de Pennylane (source de vérité, valable pour tout
// le monde) et de notre Drive (fichier généré mais pas forcément envoyé),
// jamais du navigateur — voir checklistStatus dans Code.gs. Demandé par
// Baptiste le 11 sept. 2026 pour ne pas se perdre entre les 15 sociétés
// quand plusieurs personnes saisissent en parallèle. checklistToken est
// déclaré en section 1 (voir le commentaire là-bas).
async function refreshChecklist(){
  const panel=$('#checklist-panel');
  if(!PENNYLANE_AVAILABLE){panel.hidden=true;return;}
  const period=$('#period').value;
  if(!period){panel.hidden=true;return;}
  const myToken=++checklistToken;
  panel.hidden=false;
  $('#checklist-count').textContent='Vérification…';
  try{
    const status=await scriptRun('checklistStatus',period);
    if(myToken!==checklistToken)return;
    const items=Object.values(profiles);
    const done=items.filter(p=>status[p.id]&&status[p.id].inPennylane).length;
    $('#checklist-count').textContent=`${done} / ${items.length} déjà dans Pennylane`;
    $('#checklist-grid').innerHTML=items.map(p=>{
      const s=status[p.id]||{};
      const cls=s.inPennylane?'done':s.archived?'draft':'';
      const title=s.inPennylane?'Déjà dans Pennylane':s.archived?'Fichier généré, pas encore envoyé':s.error==='jeton absent'?'Jeton API absent':'Rien fait pour ce mois';
      const mark=s.inPennylane?'✓':s.archived?'●':'○';
      return `<div class="checklist-item ${cls}" title="${esc(title)}"><span class="check">${mark}</span>${esc(p.name)}</div>`;
    }).join('');
  }catch(e){
    if(myToken!==checklistToken)return;
    $('#checklist-count').textContent=`Suivi indisponible : ${e.message||e}`;
    $('#checklist-grid').innerHTML='';
  }
}
function groupRowsForPennylane(){
  const groups=new Map();
  state.rows.forEach(r=>{const key=r.label.indexOf('RECETTES')===0?'RECETTES':'UBEREATS';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)});
  const p=periodInfo(),isoDate=p.last.toISOString().slice(0,10);
  return [...groups.entries()].map(([key,lines])=>({
    label:`${key} ${p.label}`,date:isoDate,journalCode:'VT',
    lines:lines.map(l=>({accountNumber:l.account,debit:l.debit,credit:l.credit,label:l.label}))
  }));
}
function renderPennylanePreview(preview){
  const box=$('#pennylane-preview');box.hidden=false;
  box.innerHTML=preview.map(e=>{
    const rows=e.lines.map(l=>`<tr><td>${esc(l.accountNumber)}</td><td>${esc(l.accountLabel||'')}</td><td>${esc(l.label)}</td><td class="num">${l.debit!=='0.00'?money.format(+l.debit):'—'}</td><td class="num">${l.credit!=='0.00'?money.format(+l.credit):'—'}</td></tr>`).join('');
    return `<div class="entry-title">${esc(e.label)} · débit ${money.format(e.debitTotal)} = crédit ${money.format(e.creditTotal)}</div><table><thead><tr><th>Compte</th><th>Libellé compte</th><th>Libellé ligne</th><th class="num">Débit</th><th class="num">Crédit</th></tr></thead><tbody>${rows}</tbody></table>`;
  }).join('');
}
if(PENNYLANE_AVAILABLE)$('#pennylane-preview-btn').addEventListener('click',async()=>{
  if(!state.valid)return;
  const btn=$('#pennylane-preview-btn'),prev=btn.textContent;btn.disabled=true;btn.textContent="Génération de l'aperçu…";$('#pennylane-status').textContent='';
  try{
    const entries=groupRowsForPennylane();
    const preview=await scriptRun('pennylanePreview',profile.id,entries);
    pennylanePayload={companyId:profile.id,entries};
    renderPennylanePreview(preview);
    $('#pennylane-send-btn').disabled=false;
    $('#pennylane-status').textContent='Aperçu généré — vérifiez les comptes et montants avant de confirmer.';
  }catch(e){
    resetPennylanePanel();
    $('#pennylane-status').textContent=`Erreur : ${e.message||e}`;
  }finally{btn.disabled=!state.valid;btn.textContent=prev}
});
if(PENNYLANE_AVAILABLE)$('#pennylane-send-btn').addEventListener('click',async()=>{
  if(!pennylanePayload)return;
  if(!confirm(`Confirmer l'envoi réel de ${pennylanePayload.entries.length} écriture(s) dans Pennylane pour ${profile.name} ? Cette action crée l'écriture directement et n'est pas réversible depuis cet outil.`))return;
  const btn=$('#pennylane-send-btn'),prev=btn.textContent;btn.disabled=true;btn.textContent='Envoi en cours…';
  try{
    const created=await scriptRun('pennylanePost',pennylanePayload.companyId,pennylanePayload.entries,true);
    $('#pennylane-status').textContent=`${created.length} écriture(s) créée(s) dans Pennylane.`;
    $('#pennylane-preview-btn').disabled=true;pennylanePayload=null;btn.disabled=true;
    refreshChecklist();
  }catch(e){
    $('#pennylane-status').textContent=`Échec de l'envoi : ${e.message||e}`;
    btn.disabled=false;
  }finally{btn.textContent=prev}
});
// --- 9. Export Excel (écriture comptable téléchargeable) -------------------
async function makeXlsx(rows,type='blob'){
  const headers=['Date','Code Journal','Numéro de compte','Libellé de compte','Libellé de ligne','Taux de TVA du compte','Code pays du compte','Débit et/ou Crédit','Crédit'];const data=[headers,...rows.map(r=>[r.date,r.journal,r.account,r.accountLabel,r.label,r.vat??'', '',r.debit??'',r.credit??''])];
  const cell=(v,ref,row,col)=>{if(row&&col===0)return `<c r="${ref}" s="4"><v>${excelSerialFromFr(v)}</v></c>`;if(typeof v==='number')return `<c r="${ref}" s="${row?2:0}"><v>${v}</v></c>`;return `<c r="${ref}" t="inlineStr" s="${row?1:3}"><is><t>${xmlEsc(v)}</t></is></c>`};
  const sheet=data.map((r,ri)=>`<row r="${ri+1}">${r.map((v,ci)=>cell(v,colName(ci)+(ri+1),ri>0,ci)).join('')}</row>`).join('');const zip=new JSZip();
  zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');zip.folder('_rels').file('.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.folder('xl').file('workbook.xml','<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Import Pennylane" sheetId="1" r:id="rId1"/></sheets></workbook>').folder('_rels').file('workbook.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  zip.folder('xl').file('styles.xml','<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F7254"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/></cellXfs></styleSheet>');zip.folder('xl').folder('worksheets').file('sheet1.xml',`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="13" customWidth="1"/><col min="2" max="3" width="18" customWidth="1"/><col min="4" max="5" width="32" customWidth="1"/><col min="6" max="9" width="19" customWidth="1"/></cols><sheetData>${sheet}</sheetData><autoFilter ref="A1:I${data.length}"/></worksheet>`);return zip.generateAsync({type,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function excelSerialFromFr(v){const [d,m,y]=String(v).split('/').map(Number);return Math.round((Date.UTC(y,m-1,d)-Date.UTC(1899,11,30))/86400000)}
function colName(i){let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s}function xmlEsc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}
