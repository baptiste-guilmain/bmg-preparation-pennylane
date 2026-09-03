import * as pdfjsLib from './vendor/pdf.min.mjs';
import { getProfile } from './profiles.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs';

const $ = (s) => document.querySelector(s);
const money = new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'});
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u00a0/g,' ').replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase();

let profile = getProfile('pdfk');
let state={files:{uber:null,cash:null}, rows:[], allShown:false, valid:false};

function bindFile(inputSel,zoneSel,key){
  const input=$(inputSel), zone=$(zoneSel);
  input.addEventListener('change',()=>setFile(input.files[0],zone,key));
  ['dragenter','dragover'].forEach(e=>zone.addEventListener(e,x=>{x.preventDefault();zone.classList.add('drag')}));
  ['dragleave','drop'].forEach(e=>zone.addEventListener(e,x=>{x.preventDefault();zone.classList.remove('drag')}));
  zone.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f){input.files=e.dataTransfer.files;setFile(f,zone,key)}});
}
function setFile(file,zone,key){
  if(!file)return; const box=zone.querySelector('.chosen'); state.files[key]=file; zone.classList.add('has-file'); box.hidden=false;
  box.innerHTML=`<span class="file-icon ${key==='cash'?'pdf':''}">${key==='cash'?'P':'X'}</span><strong>${esc(file.name)}</strong><span>✓ ${formatBytes(file.size)} · cliquer pour remplacer</span>`;
  const ready=state.files.uber&&state.files.cash; $('#process').disabled=!ready; $('.status-dot').classList.toggle('ready',!!ready);
  $('#preflight strong').textContent=ready?'Deux fichiers prêts':'Prêt à recevoir les fichiers';
  $('#preflight small').textContent=ready?'Vous pouvez lancer le traitement.':'Les documents restent dans votre navigateur.';
}
function formatBytes(n){return n>1048576?`${(n/1048576).toFixed(1)} Mo`:`${Math.ceil(n/1024)} Ko`}
bindFile('#uber-file','#uber-zone','uber'); bindFile('#cash-file','#cash-zone','cash');
$('#company').addEventListener('change',e=>{profile=getProfile(e.target.value)});

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
  const ix={currency:col(['Code de devise']),establishment:col(["Identifiant de l’établissement externe","Identifiant de l'etablissement externe"]),orderDate:col(['Date de la commande']),orderId:col(['Id. de la commande','Id de la commande']),sales:col(['Ventes (TVA incluse)','Total des ventes d articles TVA incluse']),refund:col(['Montant de la facturation rétroactive (TVA incluse)','Montant de la facturation retroactive TVA incluse']),promo:col(['Offres sur les articles (TVA incluse)','Promotions du commerçant appliquées aux plats articles TVA incluse']),offerFee:col(["Frais d'utilisation de l'offre"]),offerVat:col(["TVA sur les frais d'utilisation de l'offre"]),voucher:col(['Titre-restaurant']),commission:col(['Frais de service de la Marketplace / frais de mise en relation après promotion (hors TVA)','Frais de service Uber facturés au commerçant après application de la réduction']),commissionVat:col(['TVA sur les frais de service de la Marketplace / frais de mise en relation après offre','TVA sur les frais de service Uber']),other:col(['Autres paiements (TVA incluse)']),total:col(['Montant total']),payout:col(['Date du versement'])};
  const missing=Object.entries(ix).filter(([k,v])=>v<0&&!['offerFee','offerVat'].includes(k)).map(([k])=>k);
  if(missing.length) throw new Error(`Export Uber incomplet : ${missing.length} colonne(s) indispensable(s) absente(s).`);
  const data=rawData.filter(r=>normalize(r[ix.currency])==='eur');
  if(!data.length) throw new Error("Aucune ligne de transaction en EUR n'a été trouvée dans l'export Uber.");
  const sum=k=>round(data.reduce((a,r)=>a+amount(r[ix[k]]),0));
  const payouts=new Map(); data.forEach(r=>{const v=amount(r[ix.total]);const d=dateValue(r[ix.payout]);const key=d||'À venir';payouts.set(key,round((payouts.get(key)||0)+v))});
  const establishments=[...new Set(data.map(r=>String(r[ix.establishment]||'').trim()).filter(Boolean))];
  const periods=[...new Set(data.map(r=>monthValue(r[ix.orderDate])).filter(Boolean))];
  return {sales:sum('sales'),refund:sum('refund'),promo:sum('promo'),offerFee:sum('offerFee'),offerVat:sum('offerVat'),voucher:sum('voucher'),commission:sum('commission'),commissionVat:sum('commissionVat'),other:sum('other'),total:sum('total'),payouts:[...payouts].filter(([,v])=>Math.abs(v)>.004),establishments,periods,rowCount:data.length};
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

function periodInfo(){const [y,m]=$('#period').value.split('-').map(Number);return {y,m,last:new Date(Date.UTC(y,m,0)),label:`${String(m).padStart(2,'0')}.${y}`}}
function line(date,journal,account,label,debit=null,credit=null,vat=null){return {date,journal,account:account[0],accountLabel:account[1],label,debit,credit,vat}}
function buildRows(uber,cash){
  const p=periodInfo(),date=frDate(p.last),ul=`UBEREAT ${p.label}`,cl=`RECETTES ${p.label}`,a=profile.accounts;const revenue=round(uber.sales+uber.refund+uber.promo),salesHt=round(revenue/(1+profile.uberVat)),salesVat=round(revenue-salesHt),commission=Math.abs(uber.commission),commissionVat=Math.abs(uber.commissionVat),otherTtc=Math.abs(uber.other),otherHt=round(otherTtc/(1+profile.expenseVat)),marketingHt=round(Math.abs(uber.offerFee)+otherHt),marketingVat=round(Math.abs(uber.offerVat)+(otherTtc-otherHt)),marketingTtc=round(marketingHt+marketingVat);
  const rows=[line(date,'',a.uberSales,ul,null,salesHt,profile.uberVat),line(date,'',a.vat10,ul,null,salesVat),line(date,'',a.commission,ul,commission,null,profile.expenseVat),line(date,'',a.deductibleVat,ul,commissionVat),line(date,'',a.marketing,ul,marketingHt,null,profile.expenseVat),line(date,'',a.deductibleVat,ul,marketingVat),line(date,'',a.mealVoucher,`${ul} - PAIEMENT TIERS`,Math.abs(uber.voucher))];
  uber.payouts.sort((x,y)=>x[0]==='À venir'?1:y[0]==='À venir'?-1:x[0].split('/').reverse().join('').localeCompare(y[0].split('/').reverse().join(''))).forEach(([d,v])=>rows.push(line(date,'',a.uberSettlement,`${ul} ${d==='À venir'?'a venir':d}`,Math.abs(v))));
  rows.push(line(date,'VT',a.liquid,cl,null,cash.liquid.ht,profile.uberVat),line(date,'VT',a.vat10,cl,null,cash.liquid.vat),line(date,'VT',a.solid,cl,null,cash.solid.ht,profile.uberVat),line(date,'VT',a.vat10,cl,null,cash.solid.vat),line(date,'VT',a.alcohol,cl,null,cash.alcohol.ht,.20),line(date,'VT',a.vat20,cl,null,cash.alcohol.vat),line(date,'VT',a.cash,cl,cash.total));
  return {rows,revenue,salesHt,salesVat,marketingTtc};
}

$('#process').addEventListener('click',async()=>{
  const btn=$('#process');btn.disabled=true;btn.querySelector('span').textContent='Traitement en cours…';const errors=[];
  try{
    if(!$('#period').value)throw new Error('Sélectionnez une période.');if(state.files.uber.size>25e6||state.files.cash.size>25e6)throw new Error('Un fichier dépasse la limite de 25 Mo.');
    const [uber,cash]=await Promise.all([parseUber(state.files.uber),parseCash(state.files.cash)]);const built=buildRows(uber,cash);state.rows=built.rows;
    const debit=round(state.rows.reduce((s,r)=>s+(r.debit||0),0)),credit=round(state.rows.reduce((s,r)=>s+(r.credit||0),0)),diff=round(debit-credit);
    const selected=$('#period').value;
    if(uber.periods.length!==1||uber.periods[0]!==selected)errors.push(`La période Uber détectée (${uber.periods.join(', ')||'inconnue'}) ne correspond pas à ${selected}.`);
    if(cash.period&&cash.period!==selected)errors.push(`La période du rapport de caisse (${cash.period}) ne correspond pas à ${selected}.`);
    const unknown=uber.establishments.filter(x=>!profile.uberEstablishments.includes(x));if(unknown.length)errors.push(`Établissement Uber non reconnu pour PDFK : ${unknown.join(', ')}.`);
    if(Math.abs(diff)>.01)errors.push(`Écriture déséquilibrée de ${money.format(Math.abs(diff))}.`);
    if(Math.abs(round(uber.total-(uber.payouts.reduce((s,[,v])=>s+v,0))))>.01)errors.push('Le total Uber ne correspond pas à la somme des versements.');
    if(Math.abs(round((cash.liquid.ht+cash.liquid.vat)-cash.liquid.ttc))>.02)errors.push('La ligne caisse Liquide ne se recalcule pas.');
    if(Math.abs(round((cash.solid.ht+cash.solid.vat)-cash.solid.ttc))>.02)errors.push('La ligne caisse Solide ne se recalcule pas.');
    if(Math.abs(round((cash.alcohol.ht+cash.alcohol.vat)-cash.alcohol.ttc))>.02)errors.push('La ligne caisse Alcool ne se recalcule pas.');
    if(cash.declaredTotal!=null&&Math.abs(round(cash.total-cash.declaredTotal))>.02)errors.push(`Le total des trois lignes caisse (${money.format(cash.total)}) ne correspond pas au total TTC du PDF (${money.format(cash.declaredTotal)}).`);
    renderResults(uber,cash,built,debit,credit,errors);
  }catch(e){errors.push(e.message||'Erreur inconnue.');renderErrors(errors)}finally{btn.disabled=false;btn.querySelector('span').textContent='Traiter les fichiers'}
});
function renderResults(uber,cash,built,debit,credit,errors){
  $('#results').hidden=false;$('#result-period').textContent=`PDFK · ${periodInfo().label}`;$('#cash-total').textContent=money.format(cash.total);$('#cash-detail').textContent=`HT ${money.format(cash.liquid.ht+cash.solid.ht+cash.alcohol.ht)} · TVA ${money.format(cash.liquid.vat+cash.solid.vat+cash.alcohol.vat)}`;$('#uber-revenue').textContent=money.format(built.revenue);$('#entry-total').textContent=money.format(debit);
  const checks=[['Structure Uber reconnue',`${uber.rowCount} lignes · ${uber.payouts.length} versements`],['Société et période cohérentes',`${uber.establishments.join(', ')} · ${periodInfo().label}`],['Caisse - Liquide 10 %',`${money.format(cash.liquid.ht)} HT · ${money.format(cash.liquid.ttc)} TTC`],['Caisse - Solide 10 %',`${money.format(cash.solid.ht)} HT · ${money.format(cash.solid.ttc)} TTC`],['Caisse - Alcool 20 %',`${money.format(cash.alcohol.ht)} HT · ${money.format(cash.alcohol.ttc)} TTC`],['Total caisse rapproché',cash.declaredTotal!=null?`${money.format(cash.total)} = ${money.format(cash.declaredTotal)}`:`${money.format(cash.total)} calculé sur les trois lignes`],['TVA recalculée',`Uber 10 % · Frais 20 %`],['Équilibre Débit = Crédit',`${money.format(debit)} = ${money.format(credit)}`]];
  $('#check-list').innerHTML=checks.map(x=>`<div class="check-row"><b>✓</b><strong>${x[0]}</strong><span>${x[1]}</span></div>`).join('');$('#check-badge').textContent=errors.length?'À corriger':`${checks.length} contrôles validés`;state.valid=!errors.length;renderRows();renderErrors(errors);$('#download').disabled=!state.valid;$('#download-status').textContent=state.valid?'Fichier validé et prêt':'Génération bloquée';$('#download-help').textContent=state.valid?`${state.rows.length} lignes comptables · format Excel Pennylane`:'Corrigez les erreurs signalées puis relancez le traitement.';$('#results').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderRows(){const shown=state.allShown?state.rows:state.rows.slice(0,8);$('#rows').innerHTML=shown.map(r=>`<tr><td>${r.date}</td><td>${r.journal||'—'}</td><td>${r.account}</td><td>${esc(r.label)}</td><td class="num">${r.debit!=null?money.format(r.debit):'—'}</td><td class="num">${r.credit!=null?money.format(r.credit):'—'}</td></tr>`).join('');$('#toggle-rows').textContent=state.allShown?'Réduire':`Afficher les ${state.rows.length} lignes`}
$('#toggle-rows').addEventListener('click',()=>{state.allShown=!state.allShown;renderRows()});
function renderErrors(errors){const box=$('#error-log');box.hidden=!errors.length;box.querySelector('ul').innerHTML=errors.map(e=>`<li>${esc(e)}</li>`).join('');if(errors.length){$('#results').hidden=false;$('#download').disabled=true}}

$('#download').addEventListener('click',async()=>{if(!state.valid)return;const blob=await makeXlsx(state.rows);const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`PDFK_CA_UBER_${$('#period').value.replace('-','_')}_Pennylane.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});
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
