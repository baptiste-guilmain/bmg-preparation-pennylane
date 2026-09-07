import * as pdfjsLib from './vendor/pdf.min.mjs';
import { getProfile } from './profiles.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs';

const $ = (s) => document.querySelector(s);
const money = new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'});
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u00a0/g,' ').replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase();

let profile = getProfile('strasgame');
let state={files:{uber:null,cash:null}, rows:[], allShown:false, valid:false};
let pennylanePayload=null;

function bindFile(inputSel,zoneSel,key){
  const input=$(inputSel), zone=$(zoneSel);
  input.addEventListener('change',()=>setFile(input.files[0],zone,key));
  ['dragenter','dragover'].forEach(e=>zone.addEventListener(e,x=>{x.preventDefault();zone.classList.add('drag')}));
  ['dragleave','drop'].forEach(e=>zone.addEventListener(e,x=>{x.preventDefault();zone.classList.remove('drag')}));
  zone.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f){input.files=e.dataTransfer.files;setFile(f,zone,key)}});
}
function setFile(file,zone,key){
  if(!file)return; const box=zone.querySelector('.chosen'); state.files[key]=file; zone.classList.add('has-file'); box.hidden=false;
  const label=key==='uber'?'Import Uber':'Import caisse';
  box.innerHTML=`<span class="file-icon ${key==='cash'?'pdf':''}">${key==='cash'?'P':'X'}</span><strong>${esc(file.name)}</strong><span>✓ ${label} reçu · ${formatBytes(file.size)} · cliquer pour remplacer</span>`;
  updatePreflight();
}
function setStep(n){document.querySelectorAll('.steps .step').forEach((el,i)=>el.classList.toggle('active',i<n))}
function updatePreflight(){
  const uberReady=Boolean(state.files.uber),cashReady=Boolean(state.files.cash),needsCash=profile.mode==='uber-and-cash',ready=uberReady&&(!needsCash||cashReady);
  $('#process').disabled=!ready; $('.status-dot').classList.toggle('ready',ready);
  let title=needsCash?`Deux imports obligatoires pour ${profile.name}`:`Import Uber obligatoire pour ${profile.name}`;
  let help=needsCash?"Ajoutez l'import Uber et l'import caisse avant de créer l'écriture comptable.":"Ajoutez l'export Uber pour créer l'écriture comptable.";
  if(needsCash&&uberReady&&!cashReady){title='Import Uber reçu';help="Ajoutez maintenant l'import caisse pour créer l'écriture comptable."}
  if(needsCash&&!uberReady&&cashReady){title='Import caisse reçu';help="Ajoutez maintenant l'import Uber pour créer l'écriture comptable."}
  if(ready){title=needsCash?'Les deux imports sont prêts':'Import Uber prêt';help="Vous pouvez créer l'écriture comptable."}
  $('#preflight strong').textContent=title; $('#preflight small').textContent=help;
  setStep(ready?2:1);
}
function formatBytes(n){return n>1048576?`${(n/1048576).toFixed(1)} Mo`:`${Math.ceil(n/1024)} Ko`}
bindFile('#uber-file','#uber-zone','uber'); bindFile('#cash-file','#cash-zone','cash');
function clearFile(key){const zone=$(`#${key}-zone`),input=$(`#${key}-file`),box=zone.querySelector('.chosen');state.files[key]=null;input.value='';zone.classList.remove('has-file');box.hidden=true}
function setProfile(id){
  profile=getProfile(id); const needsCash=profile.mode==='uber-and-cash',otacosCash=profile.cashAdapter==='otacos-taxes';
  clearFile('uber'); clearFile('cash'); $('#cash-zone').hidden=!needsCash;
  $('#profile-state').textContent=needsCash?`${profile.name} · Uber + caisse validés`:`${profile.name} · Uber validé`;
  $('#profile-help').textContent=needsCash?(otacosCash?'Profil caisse : TVA 5,5 % / 10 % × sur place/à emporter':'Profil caisse : CA Liquide / Solide'):(profile.vatBreakdown?'Profil actif : Uber seul · TVA 5,5 % et 10 %':'Profil actif : Uber seul');
  $('#intro-note').textContent=needsCash?"Déposez les deux justificatifs du mois. L'outil applique les règles de la société et vérifie l'écriture avant génération.":`Déposez l'export Uber du mois. L'outil applique les règles ${profile.name} et vérifie l'écriture avant génération.`;
  $('#uber-help').textContent=`Excel ou CSV · obligatoire pour ${profile.name}`;
  $('#cash-help').textContent=otacosCash?`Excel (.xlsx) · obligatoire pour ${profile.name}`:`PDF, Excel ou CSV · obligatoire pour ${profile.name}`;
  $('#cash-zone em').textContent=otacosCash?"Le rapport de taxes du logiciel de caisse (export Excel, feuille « Reports »), pour le mois concerné":"Le récapitulatif des ventes en caisse du mois (souvent nommé « Opérations quotidiennes »)";
  $('#results').hidden=true; state.valid=false; setStep(1); updatePreflight(); resetPennylanePanel();
}
$('#company').addEventListener('change',e=>setProfile(e.target.value));
setProfile('strasgame');

async function parseUber(file){
  const ext=file.name.split('.').pop().toLowerCase();
  let records;
  if(ext==='csv') records=parseDelimited(await file.text());
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
    offerFee:col(["Frais d'utilisation de l'offre"]),offerVat:col(["TVA sur les frais d'utilisation de l'offre"]),marketingAdjustment:col(['Ajustement marketing (TVA incluse)']),voucher:col(['Titre-restaurant','Bon de réduction-restaurant']),commission:col(['Frais de service de la Marketplace / frais de mise en relation après promotion (hors TVA)','Frais de service Uber facturés au commerçant après application de la réduction','Frais de mise en marché après rabais (TVA en sus)']),commissionVat:col(['TVA sur les frais de service de la Marketplace / frais de mise en relation après offre','TVA sur les frais de service Uber','TVA sur les frais de mise en marché après rabais']),other:col(['Autres paiements (TVA incluse)','Paiements divers (TVA comprise)']),total:col(['Montant total','Versement total']),payout:col(['Date du versement'])};
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
  const periods=[...new Set(data.map(r=>monthValue(r[ix.orderDate])).filter(Boolean))];
  const vatSum=k=>ix[k]<0?0:sum(k);
  return {sales:sum('sales'),refund:sum('refund'),promo:sum('promo'),
    vat3:vatSum('vat3'),
    vat1:round(vatSum('vat1')+vatSum('vat1Adjustment')+vatSum('vat1Offer')),
    vat2:round(vatSum('vat2')+vatSum('vat2Adjustment')+vatSum('vat2Offer')),
    offerFee:sum('offerFee'),offerVat:sum('offerVat'),marketingAdjustment:ix.marketingAdjustment<0?0:sum('marketingAdjustment'),voucher:sum('voucher'),commission:sum('commission'),commissionVat:sum('commissionVat'),other:sum('other'),total:sum('total'),payouts:[...payouts].filter(([,v])=>Math.abs(v)>.004),establishments,periods,rowCount:data.length};
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
  const s=String(v); const m=s.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);return m?`${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[3].length===2?'20'+m[3]:m[3]}`:'';
}
function excelDate(v){return new Date(Date.UTC(1899,11,30)+Math.round(v)*86400000)}
function frDate(d){return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`}
function monthValue(v){const d=dateValue(v),m=d.match(/\d{2}\/(\d{2})\/(\d{4})/);return m?`${m[2]}-${m[1]}`:''}

function parseDelimited(text){
  const sep=(text.split('\n')[0].match(/;/g)||[]).length>(text.split('\n')[0].match(/,/g)||[]).length?';':','; const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){cell+='"';i++}else q=!q}else if(c===sep&&!q){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell=''}else cell+=c} if(cell||row.length){row.push(cell);rows.push(row)}return rows;
}
async function parseXlsx(file){
  const zip=await JSZip.loadAsync(await file.arrayBuffer());
  const xml=async p=>new DOMParser().parseFromString(await zip.file(p).async('text'),'application/xml');
  const shared=[];if(zip.file('xl/sharedStrings.xml')){const d=await xml('xl/sharedStrings.xml');d.querySelectorAll('si').forEach(si=>shared.push([...si.querySelectorAll('t')].map(x=>x.textContent).join('')))}
  const styleFormats=[];if(zip.file('xl/styles.xml')){const sd=await xml('xl/styles.xml'),custom={};sd.querySelectorAll('numFmt').forEach(n=>custom[n.getAttribute('numFmtId')]=n.getAttribute('formatCode'));sd.querySelectorAll('cellXfs > xf').forEach(x=>styleFormats.push(custom[x.getAttribute('numFmtId')]||''))}
  const wb=await xml('xl/workbook.xml'),rels=await xml('xl/_rels/workbook.xml.rels');const rid=wb.querySelector('sheet').getAttribute('r:id');const rel=[...rels.querySelectorAll('Relationship')].find(x=>x.getAttribute('Id')===rid);let target=rel.getAttribute('Target').replace(/^\//,'');if(!target.startsWith('xl/'))target='xl/'+target.replace(/^\.\//,'');const sheet=await xml(target);
  const rows=[]; sheet.querySelectorAll('row').forEach(rx=>{const row=[];rx.querySelectorAll('c').forEach(c=>{const ref=c.getAttribute('r'),col=lettersToIndex(ref.match(/[A-Z]+/)[0]),t=c.getAttribute('t'),raw=c.querySelector('v')?.textContent??'',inline=c.querySelector('is t')?.textContent??'',fmt=styleFormats[+(c.getAttribute('s')||0)]||'';let val=t==='s'?shared[+raw]:(t==='inlineStr'?inline:(t==='str'?raw:(raw===''?'':Number(raw))));if(typeof val==='number'&&/^d{1,2}\.m{1,2}$/i.test(fmt))val={excel:val,decimals:fmt.toLowerCase()==='d.m'?1:2};row[col]=val});rows.push(row)});return rows;
}
function lettersToIndex(s){let n=0;for(const c of s)n=n*26+c.charCodeAt(0)-64;return n-1}

async function parseCash(file){
  if(profile.cashAdapter==='otacos-taxes') return parseCashOtacos(file);
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
async function parseCashOtacos(file){
  const ext=file.name.split('.').pop().toLowerCase();
  if(ext!=='xlsx') throw new Error('Le rapport caisse doit être le fichier Excel "Reports" exporté du logiciel de caisse.');
  const rows=await parseXlsx(file);
  // Le classeur du logiciel de caisse liste d'abord un tableau "Toutes plateformes"
  // (Uber Eats et Deliveroo inclus dans les ventes), puis un second tableau
  // identique mais hors plateformes de livraison (parfois intitulé "Retraitement
  // plat. Livr.") : c'est ce SECOND tableau qu'il faut utiliser, sinon le CA Uber
  // Eats serait compté deux fois (une fois ici, une fois dans l'écriture UBEREAT).
  // On garde donc la DERNIÈRE occurrence de chaque ligne "T.V.A. ..." rencontrée.
  // Validé cellule par cellule contre l'écriture RÉELLEMENT postée dans Pennylane
  // pour 7 sociétés en juillet 2026 (HAGTACOS, COLMIOS, EPIOS, FARTACOS, GEIPIOS,
  // HAUTIOS, MULIOS, SARIOS).
  // Lecture directe des valeurs numériques (PAS via amount()) : ce rapport contient
  // des totaux mensuels qui dépassent souvent 30 000, seuil que amount() interprète
  // à tort comme une date Excel (heuristique pensée pour les lignes Uber, où un tel
  // montant par commande ne se produit jamais). Ici les cellules sont déjà des
  // nombres natifs du tableur, aucune conversion de format n'est nécessaire.
  const num=v=>typeof v==='number'?v:0;
  const found={};
  rows.forEach(r=>{const label=normalize(r&&r[0]);if(label.indexOf('t v a')===0) found[label]={ht:num(r[4]),tax:num(r[2])}});
  const sp55=found['t v a 5 5 sp'],ae55=found['t v a 5 5 ae'],sp10=found['t v a 10 sp'],ae10=found['t v a 10 ae'];
  if(!sp55||!ae55||!sp10||!ae10) throw new Error("Les lignes TVA 5,5 % et 10 % (SP/AE) n'ont pas toutes été trouvées dans le rapport de caisse.");
  const total=round(sp55.ht+sp55.tax+ae55.ht+ae55.tax+sp10.ht+sp10.tax+ae10.ht+ae10.tax);
  const dateRow=rows.find(r=>normalize(r&&r[0])==='dates d operation');
  let period='';
  if(dateRow){const m=String(dateRow[1]||'').match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})\s*-/);if(m)period=`${m[3].length===2?'20'+m[3]:m[3]}-${m[2].padStart(2,'0')}`}
  return {sp55,ae55,sp10,ae10,total,period,kind:'otacos-taxes'};
}

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
  if(profile.mode==='uber-and-cash'){
    if(profile.cashAdapter==='otacos-taxes'){
      rows.push(line(date,'VT',a.salesSP55,cl,null,round(cash.sp55.ht),.055),line(date,'VT',a.salesAE55,cl,null,round(cash.ae55.ht),.055),line(date,'VT',a.vat55,cl,null,round(cash.sp55.tax+cash.ae55.tax)),
        line(date,'VT',a.salesSP10,cl,null,round(cash.sp10.ht),.10),line(date,'VT',a.salesAE10,cl,null,round(cash.ae10.ht),.10),line(date,'VT',a.vat10,cl,null,round(cash.sp10.tax+cash.ae10.tax)),
        line(date,'VT',a.cash,cl,cash.total));
    }else{
      rows.push(line(date,'VT',a.liquid,cl,null,cash.liquid.ht,profile.uberVat),line(date,'VT',a.vat10,cl,null,cash.liquid.vat),line(date,'VT',a.solid,cl,null,cash.solid.ht,profile.uberVat),line(date,'VT',a.vat10,cl,null,cash.solid.vat),line(date,'VT',a.alcohol,cl,null,cash.alcohol.ht,.20),line(date,'VT',a.vat20,cl,null,cash.alcohol.vat),line(date,'VT',a.cash,cl,cash.total));
    }
  }
  return {rows,revenue,salesHt,salesVat,marketingTtc};
}

$('#process').addEventListener('click',async()=>{
  const btn=$('#process');btn.disabled=true;btn.querySelector('span').textContent="Création de l'écriture…";const errors=[];resetPennylanePanel();
  try{
    if(!$('#period').value)throw new Error('Sélectionnez une période.');if(state.files.uber.size>25e6||(state.files.cash&&state.files.cash.size>25e6))throw new Error('Un fichier dépasse la limite de 25 Mo.');
    const uber=await parseUber(state.files.uber),cash=profile.mode==='uber-and-cash'?await parseCash(state.files.cash):null,built=buildRows(uber,cash);state.rows=built.rows;
    const debit=round(state.rows.reduce((s,r)=>s+(r.debit||0),0)),credit=round(state.rows.reduce((s,r)=>s+(r.credit||0),0)),diff=round(debit-credit);
    const selected=$('#period').value;
    if(uber.periods.length!==1||uber.periods[0]!==selected)errors.push(`La période Uber détectée (${uber.periods.join(', ')||'inconnue'}) ne correspond pas à ${selected}.`);
    if(cash&&cash.period&&cash.period!==selected)errors.push(`La période du rapport de caisse (${cash.period}) ne correspond pas à ${selected}.`);
    const unknown=profile.uberEstablishments.length?uber.establishments.filter(x=>!profile.uberEstablishments.includes(x)):[];if(unknown.length)errors.push(`Établissement Uber non reconnu pour ${profile.name} : ${unknown.join(', ')}.`);
    if(Math.abs(diff)>.01)errors.push(`Écriture déséquilibrée de ${money.format(Math.abs(diff))}.`);
    if(Math.abs(round(uber.total-(uber.payouts.reduce((s,[,v])=>s+v,0))))>.01)errors.push('Le total Uber ne correspond pas à la somme des versements.');
    if(cash&&cash.kind!=='otacos-taxes'){if(Math.abs(round((cash.liquid.ht+cash.liquid.vat)-cash.liquid.ttc))>.02)errors.push('La ligne caisse Liquide ne se recalcule pas.');if(Math.abs(round((cash.solid.ht+cash.solid.vat)-cash.solid.ttc))>.02)errors.push('La ligne caisse Solide ne se recalcule pas.');if(Math.abs(round((cash.alcohol.ht+cash.alcohol.vat)-cash.alcohol.ttc))>.02)errors.push('La ligne caisse Alcool ne se recalcule pas.');if(cash.declaredTotal!=null&&Math.abs(round(cash.total-cash.declaredTotal))>.02)errors.push(`Le total des trois lignes caisse (${money.format(cash.total)}) ne correspond pas au total TTC du PDF (${money.format(cash.declaredTotal)}).`)}
    renderResults(uber,cash,built,debit,credit,errors);
  }catch(e){errors.push(e.message||'Erreur inconnue.');renderErrors(errors)}finally{btn.querySelector('span').textContent="Créer l'écriture comptable";btn.disabled=!(state.files.uber&&(profile.mode==='uber-only'||state.files.cash))}
});
function renderResults(uber,cash,built,debit,credit,errors){
  $('#results').hidden=false;$('#result-period').textContent=`${profile.name} · ${periodInfo().label}`;$('#cash-kpi').hidden=!cash;if(cash){$('#cash-total').textContent=money.format(cash.total);$('#cash-detail').textContent=cash.kind==='otacos-taxes'?`HT ${money.format(cash.sp55.ht+cash.ae55.ht+cash.sp10.ht+cash.ae10.ht)} · TVA ${money.format(cash.sp55.tax+cash.ae55.tax+cash.sp10.tax+cash.ae10.tax)}`:`HT ${money.format(cash.liquid.ht+cash.solid.ht+cash.alcohol.ht)} · TVA ${money.format(cash.liquid.vat+cash.solid.vat+cash.alcohol.vat)}`};$('#uber-revenue').textContent=money.format(built.revenue);$('#entry-total').textContent=money.format(debit);
  const checks=[['Structure Uber reconnue',`${uber.rowCount} lignes · ${uber.payouts.length} versements`],['Société et période cohérentes',`${uber.establishments.join(', ')} · ${periodInfo().label}`]];
  if(profile.vatBreakdown==='5.5-and-10')checks.push(['TVA Uber ventilée',`5,5 % : ${money.format(Math.abs(uber.vat1))} · 10 % : ${money.format(Math.abs(uber.vat2))}`]);
  if(profile.vatBreakdown==='otacos-5.5-and-10'){const vat20=Math.abs(uber.vat3||0);checks.push(['TVA Uber ventilée',`5,5 % : ${money.format(Math.abs(uber.vat1))} · 10 % (par différence) : ${money.format(round(built.salesVat-Math.abs(uber.vat1)-vat20))}`+(vat20>.004?` · 20 % : ${money.format(vat20)}`:'')]);}
  if(profile.vatBreakdown==='doz-5.5-and-10')checks.push(['TVA Uber ventilée',`10 % : ${money.format(Math.abs(uber.vat2))} · 5,5 % (par différence) : ${money.format(round(built.salesVat-Math.abs(uber.vat2)))}`]);
  if(cash&&cash.kind==='otacos-taxes'){checks.push(['Caisse - 5,5 % (SP + AE)',`${money.format(cash.sp55.ht+cash.ae55.ht)} HT · TVA ${money.format(cash.sp55.tax+cash.ae55.tax)}`],['Caisse - 10 % (SP + AE)',`${money.format(cash.sp10.ht+cash.ae10.ht)} HT · TVA ${money.format(cash.sp10.tax+cash.ae10.tax)}`],['Total caisse (hors plateformes de livraison)',`${money.format(cash.total)} calculé sur le rapport de caisse`]);}
  else if(cash)checks.push(['Caisse - Liquide 10 %',`${money.format(cash.liquid.ht)} HT · ${money.format(cash.liquid.ttc)} TTC`],['Caisse - Solide 10 %',`${money.format(cash.solid.ht)} HT · ${money.format(cash.solid.ttc)} TTC`],['Caisse - Alcool 20 %',`${money.format(cash.alcohol.ht)} HT · ${money.format(cash.alcohol.ttc)} TTC`],['Total caisse rapproché',cash.declaredTotal!=null?`${money.format(cash.total)} = ${money.format(cash.declaredTotal)}`:`${money.format(cash.total)} calculé sur les trois lignes`]);
  checks.push(['TVA recalculée',profile.vatBreakdown==='5.5-and-10'?'Uber 5,5 % / 10 % · Frais 20 %':'Uber 10 % · Frais 20 %'],['Équilibre Débit = Crédit',`${money.format(debit)} = ${money.format(credit)}`]);
  $('#check-list').innerHTML=checks.map(x=>`<div class="check-row"><b>✓</b><strong>${x[0]}</strong><span>${x[1]}</span></div>`).join('');$('#check-badge').textContent=errors.length?'À corriger':`${checks.length} contrôles validés`;state.valid=!errors.length;renderRows();renderErrors(errors);$('#download').disabled=!state.valid;$('#download-status').textContent=state.valid?'Fichier validé et prêt':'Génération bloquée';$('#download-help').textContent=state.valid?`${state.rows.length} lignes comptables · format Excel Pennylane`:'Corrigez les erreurs signalées puis relancez le traitement.';setStep(state.valid?4:3);$('#results').scrollIntoView({behavior:'smooth',block:'start'});
  $('#pennylane-preview-btn').disabled=!state.valid;
}
function renderRows(){const shown=state.allShown?state.rows:state.rows.slice(0,8);$('#rows').innerHTML=shown.map(r=>`<tr><td>${r.date}</td><td>${r.journal||'—'}</td><td>${r.account}</td><td>${esc(r.label)}</td><td class="num">${r.debit!=null?money.format(r.debit):'—'}</td><td class="num">${r.credit!=null?money.format(r.credit):'—'}</td></tr>`).join('');$('#toggle-rows').textContent=state.allShown?'Réduire':`Afficher les ${state.rows.length} lignes`}
$('#toggle-rows').addEventListener('click',()=>{state.allShown=!state.allShown;renderRows()});
function renderErrors(errors){const box=$('#error-log');box.hidden=!errors.length;box.querySelector('ul').innerHTML=errors.map(e=>`<li>${esc(e)}</li>`).join('');if(errors.length){$('#results').hidden=false;$('#download').disabled=true}}

$('#download').addEventListener('click',async()=>{if(!state.valid)return;const blob=await makeXlsx(state.rows);const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${profile.name}_CA_UBER_${$('#period').value.replace('-','_')}_Pennylane.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});

// Envoi direct à Pennylane (bêta) : le navigateur ne voit jamais les jetons API,
// tout passe par des fonctions Netlify côté serveur (netlify/functions/). Un
// aperçu (lecture seule) est obligatoire avant tout envoi réel, et toute
// régénération de l'écriture (nouveau traitement, changement de société) annule
// l'aperçu en cours pour éviter d'envoyer des données périmées.
function resetPennylanePanel(){
  pennylanePayload=null;
  const box=$('#pennylane-preview');box.hidden=true;box.innerHTML='';
  $('#pennylane-send-btn').disabled=true;
  $('#pennylane-status').textContent='Aucun aperçu généré';
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
$('#pennylane-preview-btn').addEventListener('click',async()=>{
  if(!state.valid)return;
  const btn=$('#pennylane-preview-btn'),prev=btn.textContent;btn.disabled=true;btn.textContent="Génération de l'aperçu…";$('#pennylane-status').textContent='';
  try{
    const entries=groupRowsForPennylane();
    const resp=await fetch('/.netlify/functions/pennylane-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:profile.id,entries})});
    const data=await resp.json();
    if(!resp.ok)throw new Error(data.error||`Erreur ${resp.status}`);
    pennylanePayload={companyId:profile.id,entries};
    renderPennylanePreview(data.preview);
    $('#pennylane-send-btn').disabled=false;
    $('#pennylane-status').textContent='Aperçu généré — vérifiez les comptes et montants avant de confirmer.';
  }catch(e){
    resetPennylanePanel();
    $('#pennylane-status').textContent=`Erreur : ${e.message}`;
  }finally{btn.disabled=!state.valid;btn.textContent=prev}
});
$('#pennylane-send-btn').addEventListener('click',async()=>{
  if(!pennylanePayload)return;
  if(!confirm(`Confirmer l'envoi réel de ${pennylanePayload.entries.length} écriture(s) dans Pennylane pour ${profile.name} ? Cette action crée l'écriture directement et n'est pas réversible depuis cet outil.`))return;
  const btn=$('#pennylane-send-btn'),prev=btn.textContent;btn.disabled=true;btn.textContent='Envoi en cours…';
  try{
    const resp=await fetch('/.netlify/functions/pennylane-post',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...pennylanePayload,confirm:true})});
    const data=await resp.json();
    if(!resp.ok)throw new Error(data.error||`Erreur ${resp.status}`);
    $('#pennylane-status').textContent=`${data.created.length} écriture(s) créée(s) dans Pennylane.`;
    $('#pennylane-preview-btn').disabled=true;pennylanePayload=null;btn.disabled=true;
  }catch(e){
    $('#pennylane-status').textContent=`Échec de l'envoi : ${e.message}`;
    btn.disabled=false;
  }finally{btn.textContent=prev}
});
async function makeXlsx(rows){
  const headers=['Date','Code Journal','Numéro de compte','Libellé de compte','Libellé de ligne','Taux de TVA du compte','Code pays du compte','Débit et/ou Crédit','Crédit'];const data=[headers,...rows.map(r=>[r.date,r.journal,r.account,r.accountLabel,r.label,r.vat??'', '',r.debit??'',r.credit??''])];
  const cell=(v,ref,row,col)=>{if(row&&col===0)return `<c r="${ref}" s="4"><v>${excelSerialFromFr(v)}</v></c>`;if(typeof v==='number')return `<c r="${ref}" s="${row?2:0}"><v>${v}</v></c>`;return `<c r="${ref}" t="inlineStr" s="${row?1:3}"><is><t>${xmlEsc(v)}</t></is></c>`};
  const sheet=data.map((r,ri)=>`<row r="${ri+1}">${r.map((v,ci)=>cell(v,colName(ci)+(ri+1),ri>0,ci)).join('')}</row>`).join('');const zip=new JSZip();
  zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');zip.folder('_rels').file('.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.folder('xl').file('workbook.xml','<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Import Pennylane" sheetId="1" r:id="rId1"/></sheets></workbook>').folder('_rels').file('workbook.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  zip.folder('xl').file('styles.xml','<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F7254"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/></cellXfs></styleSheet>');zip.folder('xl').folder('worksheets').file('sheet1.xml',`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="13" customWidth="1"/><col min="2" max="3" width="18" customWidth="1"/><col min="4" max="5" width="32" customWidth="1"/><col min="6" max="9" width="19" customWidth="1"/></cols><sheetData>${sheet}</sheetData><autoFilter ref="A1:I${data.length}"/></worksheet>`);return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function excelSerialFromFr(v){const [d,m,y]=String(v).split('/').map(Number);return Math.round((Date.UTC(y,m-1,d)-Date.UTC(1899,11,30))/86400000)}
function colName(i){let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s}function xmlEsc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}
