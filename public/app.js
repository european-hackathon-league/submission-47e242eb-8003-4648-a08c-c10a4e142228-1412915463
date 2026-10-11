import { isDiaryEvent, diaryEntries, dayKey, diaryRange, eventsInRange } from '../src/project-diary.mjs';
import { buildModel, departmentOptions, draftEmail, gmailComposeUrl, validateCitations } from './engine.js';
import { DECISION_EVENT_TYPES, decisionReason, isRecordedDecision } from '../src/decision-memory.mjs';
import { createReportPdf } from './pdf-report.js';
import { enhanceSelect } from './select.js';
import { UPLOAD_TYPES, parseInput, suggestFeature, templateCsv, toKnowledge } from '../src/uploads.mjs';
import { mergeReportAudienceAssignments, partitionReportRequirements } from '../src/report-routing.mjs';

const storedDecisions=JSON.parse(localStorage.getItem('decision-events')||'[]').filter(isDiaryEvent);
localStorage.setItem('decision-events',JSON.stringify(storedDecisions));
const state = { evidence: [], context: null, historical: [], groups: [], selected: 0, config: null, statuses: JSON.parse(localStorage.getItem('requirement-statuses') || '{}'), overrides: JSON.parse(localStorage.getItem('requirement-overrides') || '{}'), events: storedDecisions, activeRequirement: null, openAIConfigured:false, wordingError:'', reportRouting:null };
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

// Plain-language reasoning shared by the requirement card and the detail drawer.
function reasoningHtml(r){
  const x=r.explanation;if(!x)return `<p>${escapeHtml(r.whyExists)}</p><p>${escapeHtml(r.whyRanked)}</p>`;
  const parts=r.scoreParts||{},rejected=['not-feasible','pm-rejected'].includes(r.status);
  const segments=[['demand','Customer demand'],['timeline','Timeline fit'],['market','Market evidence'],['memory','Past decisions']].filter(([key])=>parts[key]>0);
  const total=segments.reduce((sum,[key])=>sum+parts[key],0)||1;
  const bullets=items=>`<ul>${items.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  return `<div class="why-panel">
    <div class="why-head"><span class="signal signal-${x.signal.tone}"><i aria-hidden="true"></i>${escapeHtml(x.signal.label)}</span>${rejected?'':`<span class="why-score"><strong>${r.score}</strong>/100 priority score</span>`}</div>
    ${x.caveat?`<p class="why-caveat"><strong>Honest caveat</strong>${escapeHtml(x.caveat)}</p>`:''}
    ${x.added?.length?`<section class="why-added"><h4><span class="cite-upload">Your data</span>Based on evidence you added</h4><ul>${x.added.map(item=>`<li class="added-${item.kind}">${escapeHtml(item.text)}</li>`).join('')}</ul></section>`:''}
    <div class="why-cols"><section><h4>Why it exists</h4>${bullets(x.exists)}</section><section><h4>Why rank #${r.rank}</h4>${bullets(x.rank)}</section></div>
    ${rejected||!segments.length?'':`<div class="score-mix"><h4>What makes up the score</h4><div class="mix-bar" role="img" aria-label="${segments.map(([key,label])=>`${label} ${parts[key]} points`).join(', ')}">${segments.map(([key])=>`<span class="mix-${key}" style="flex:${parts[key]/total}"></span>`).join('')}</div><ul class="mix-legend">${segments.map(([key,label])=>`<li class="mix-${key}"><i aria-hidden="true"></i>${label} <strong>${parts[key]}</strong></li>`).join('')}</ul></div>`}
  </div>`;
}

const SOURCE_GROUPS=[
  ['customer_feedback','What customers said'],['market_study','Customer study'],
  ['competitor','Competitors'],['pm_market_data','Your market data'],['pm_global_trend','Global trends you added'],['external_web','Web research'],['sales_volume','Sales planning']
];
const sourceGroupFor=c=>['pm_market_data','pm_global_trend'].includes(c.sourceType)?c.sourceType:c.sourceType==='customer_feedback'?'customer_feedback':c.sourceType==='market_study'?'market_study':c.sourceType==='sales_volume'?'sales_volume':c.sourceType==='external_web'?'external_web':'competitor';
const friendlyFile=file=>{
  const name=String(file).split('/').pop();
  if(/feedback_hackathon/i.test(name))return `${name.split('_')[0]} customer feedback`;
  if(/customer_studies/i.test(name))return 'Customer studies';
  if(/competitor/i.test(name))return 'Competitor workbook';
  if(/sales_volumes/i.test(name))return 'Sales volumes';
  return name.replace(/\.[a-z0-9]+$/i,'').replaceAll('_',' ');
};
function citationHtml(c){
  const local=!/^https?:\/\//i.test(c.file),external=c.url&&/^https?:\/\//i.test(c.url);
  const where=c.uploaded?`<span class="cite-upload">Your data</span><span>${escapeHtml(c.file.replace(/^PM upload · /,''))} · row ${escapeHtml(c.row)}${c.note&&!external?` · ${escapeHtml(c.note)}`:''}</span>`:local?`<a href="/sources/${encodeURIComponent(c.file)}" target="_blank" rel="noopener" title="${escapeHtml(`${c.file} › ${c.sheet} › row ${c.row}`)}">${escapeHtml(friendlyFile(c.file))} · row ${escapeHtml(c.row)}</a>`:`<a href="${escapeHtml(c.file)}" target="_blank" rel="noopener">${escapeHtml(new URL(c.file).hostname)}</a>`;
  const text=String(c.excerpt||''),long=text.length>260;
  return `<li class="cite"><blockquote class="${long?'long':''}">${long?`<details><summary>“${escapeHtml(text.slice(0,240).trimEnd())}…” <span>Read full text</span></summary>“${escapeHtml(text)}”</details>`:escapeHtml(text)}</blockquote><div class="cite-source">${where}${external&&local?`<a class="cite-external" href="${escapeHtml(c.url)}" target="_blank" rel="noopener">Original source ↗</a>`:''}</div></li>`;
}
function citationsHtml(citations){
  return SOURCE_GROUPS.map(([key,label])=>{
    const items=citations.filter(c=>sourceGroupFor(c)===key);if(!items.length)return '';
    const first=items.slice(0,4),rest=items.slice(4);
    return `<section class="cite-group"><h4>${label} <span>${items.length}</span></h4><ul>${first.map(citationHtml).join('')}</ul>${rest.length?`<details class="cite-more"><summary>Show ${rest.length} more</summary><ul>${rest.map(citationHtml).join('')}</ul></details>`:''}</section>`;
  }).join('');
}
const statusKey = feature => `${state.config.vehicle}|${state.config.market}|${feature}`;
const statusMap = () => Object.fromEntries(Object.entries(state.statuses).filter(([key]) => key.startsWith(`${state.config.vehicle}|${state.config.market}|`)).map(([key,value]) => [key.split('|').slice(2).join('|'),value==='awaiting'?'not-checked':value]));
const overrideMap = () => Object.fromEntries(Object.entries(state.overrides).filter(([key]) => key.startsWith(`${state.config.vehicle}|${state.config.market}|`)).map(([key,value]) => [key.split('|').slice(2).join('|'),value]));

async function init() {
  $('new-feature-button').addEventListener('click',()=>showView('diary'));
  $('diary-date').addEventListener('change',()=>{state.diarySummary=null;renderDiary()});
  $('diary-all').addEventListener('click',()=>{$('diary-date').value='';state.diarySummary=null;renderDiary()});
  $('diary-scope').addEventListener('change',()=>{state.diarySummary=null;renderDiary()});
  $('diary-summarize').addEventListener('click',summarizeSelectedDay);
  $('diary-period').addEventListener('change',()=>{state.diarySummary=null;renderDiary()});
  ['diary-start','diary-end'].forEach(id=>$(id).addEventListener('change',()=>{$('diary-period').value='custom';state.diarySummary=null;renderDiary()}));
  $('diary-story').addEventListener('click',()=>summarizeSelectedDay(true));
  $('importance').addEventListener('input', e => $('importance-output').value = `${e.target.value} / 10`);
  $('vehicle').addEventListener('change', populateMarkets);
  enhanceSelect($('vehicle'));enhanceSelect($('market'));
  $('config-form').addEventListener('submit', event => { event.preventDefault(); if (state.evidence.length) generate(); });
  $('edit-config').addEventListener('click', () => showView('overview'));
  document.querySelector('[data-home]').addEventListener('click', event => { event.preventDefault(); showView('overview'); });
  $('rename-group').addEventListener('click', renameGroup);
  $('recalibrate-group').addEventListener('click', () => recalibrateGroup(state.groups[state.selected]?.name, 'PM requested a fresh ranking'));
  $('split-group').addEventListener('click', splitGroup);
  $('merge-group').addEventListener('click', mergeGroup);
  document.querySelectorAll('.nav').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('[data-report]').forEach(button=>button.addEventListener('click',()=>downloadReport(button.dataset.report,button)));
  $('memory-search').addEventListener('input',e=>renderMemory(e.target.value));
  await loadDecisionEvents();
  renderMemory();
  await checkOpenAIStatus();
  const [response,contextResponse,historyResponse] = await Promise.all([fetch('../data/evidence.json'),fetch('../data/context.json'),fetch('../data/historical-decisions.json')]);
  if (!response.ok || !contextResponse.ok || !historyResponse.ok) throw new Error(`Evidence stores failed to load. Start PM with “node server.mjs” from the repository root.`);
  const [payload,context,history] = await Promise.all([response.json(),contextResponse.json(),historyResponse.json()]);
  state.baseEvidence = payload.records;
  state.context = context;
  state.demoHistorical = history.decisions.filter(decision=>/^(approved|rejected)/i.test(decision.decisionStatus)&&String(decision.pmReasoning||'').trim()).map(decision=>({id:decision.id,type:'historical-decision',title:decision.requirement,description:`${decision.productCycle} · ${decision.decisionStatus}. ${decision.pmReasoning}`,data:decision,actor:'Prior-cycle PM',at:decision.timestamp,provenance:decision.provenance}));
  await loadUploads();
  initUploadPanel();
  populateMarkets();
  $('generate-button').disabled = false;
  $('generate-button').innerHTML = '<span class="shiny-label">Generate requirements <span class="shiny-arrow" aria-hidden="true">→</span></span>';
}

// ---------- PM-supplied evidence ----------
const uploadState={type:'customer_feedback',mode:'paste',fileName:'',fileText:'',rows:[]};
const UPLOAD_PLACEHOLDERS={
  customer_feedback:'One comment per line, for example:\nThe rear seats feel cramped on long trips.\nMy phone keeps disconnecting from CarPlay.',
  market_data:'One finding per line, for example:\nMercedes E-Class 2027 makes ventilated seats standard in the US.',
  global_trend:'One trend per line, for example:\nWireless charging with active cooling is becoming expected in premium sedans.',
  past_decision:''
};
const PREVIEW_LIMIT=100;

async function loadUploads(){
  try{const response=await fetch('/api/uploads');state.uploads=response.ok?(await response.json()).batches:[]}catch{state.uploads=[]}
  applyUploads();
}

// Merge stored uploads into the evidence, market signals and Decision Memory the app already uses.
function applyUploads(){
  const knowledge=toKnowledge(state.uploads||[]);
  state.evidence=state.baseEvidence.concat(knowledge.records);
  state.context.uploads=knowledge.signals;
  state.uploadedDecisions=knowledge.decisions;
  state.historical=[...state.demoHistorical,...knowledge.decisions.map(decision=>({id:decision.id,type:'historical-decision',title:decision.requirement,description:`${decision.productCycle} · ${decision.decisionStatus}. ${decision.pmReasoning}`,data:decision,actor:'Prior-cycle PM · uploaded',at:decision.timestamp,provenance:decision.provenance}))];
  renderMemory();
  renderUploadList();
}

function uploadFeatures(){
  const vehicle=$('vehicle').value,market=$('market').value,counts=new Map();
  const count=records=>{for(const record of records)if(record.feature&&record.quality!=='low'&&!/^(no_class_found|other|none|n\/a|unknown)?$/i.test(record.feature))counts.set(record.feature,(counts.get(record.feature)||0)+1)};
  count(state.baseEvidence.filter(record=>record.vehicle===vehicle&&record.market===market));
  if(!counts.size)count(state.baseEvidence.filter(record=>record.vehicle===vehicle));
  return [...counts].sort((a,b)=>b[1]-a[1]).map(([feature])=>feature);
}

const weightHint=weight=>weight===5?'5 counts the same as BMW data.':`${weight} counts ${weight/5}× as much as BMW data.`;
const marketLabel=code=>({US:'United States',GB:'United Kingdom',DE:'Germany',CN:'China',JP:'Japan',KR:'South Korea',FR:'France',IT:'Italy',ES:'Spain',CA:'Canada'})[code]||code;

function initUploadPanel(){
  $('upload-types').innerHTML=Object.entries(UPLOAD_TYPES).map(([key,spec])=>`<button type="button" role="radio" class="upload-type" data-upload-type="${key}" aria-checked="${key===uploadState.type}"><strong>${escapeHtml(spec.label)}</strong><span>${escapeHtml(spec.help)}</span></button>`).join('');
  $('upload-types').addEventListener('click',event=>{const tile=event.target.closest('[data-upload-type]');if(tile)setUploadType(tile.dataset.uploadType)});
  $('upload-types').addEventListener('keydown',event=>{
    if(!['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(event.key))return;event.preventDefault();
    const keys=Object.keys(UPLOAD_TYPES),next=(keys.indexOf(uploadState.type)+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1)+keys.length)%keys.length;
    setUploadType(keys[next]);document.querySelector(`[data-upload-type="${keys[next]}"]`).focus();
  });
  $('upload-weight').addEventListener('input',event=>{const weight=Number(event.target.value);$('upload-weight-output').value=`${weight} / 10`;$('upload-weight-hint').textContent=weightHint(weight)});
  document.querySelectorAll('[data-upload-mode]').forEach(tab=>tab.addEventListener('click',()=>setUploadMode(tab.dataset.uploadMode)));
  $('upload-file').addEventListener('change',event=>readUploadFile(event.target.files[0]));
  const drop=$('upload-drop');
  drop.addEventListener('dragover',event=>{event.preventDefault();drop.classList.add('dragging')});
  drop.addEventListener('dragleave',()=>drop.classList.remove('dragging'));
  drop.addEventListener('drop',event=>{event.preventDefault();drop.classList.remove('dragging');readUploadFile(event.dataTransfer.files[0])});
  $('upload-preview-button').addEventListener('click',previewUpload);
  const scopeChanged=()=>{$('upload-scope').textContent=`BMW ${$('vehicle').selectedOptions[0]?.textContent.split(' · ')[0].replace(/^BMW /,'')||$('vehicle').value} · ${marketLabel($('market').value)}`;closePreview();renderUploadList()};
  $('vehicle').addEventListener('change',()=>setTimeout(scopeChanged));$('market').addEventListener('change',scopeChanged);
  scopeChanged();setUploadType(uploadState.type);
  ['months','people','importance'].forEach(id=>$(id).addEventListener('input',renderGenerateSummary));
}

// One line above the Generate button that restates what will be generated.
function renderGenerateSummary(){
  const target=$('generate-summary');if(!target)return;
  const vehicle=$('vehicle').value,market=$('market').value,uploads=(state.uploads||[]).filter(batch=>batch.vehicle===vehicle&&batch.market===market);
  const rows=uploads.reduce((sum,batch)=>sum+batch.rows.length,0);
  target.innerHTML=`<strong>${escapeHtml($('vehicle').selectedOptions[0]?.textContent.split(' · ')[0]||vehicle)} · ${escapeHtml(marketLabel(market))}</strong><span>${escapeHtml($('months').value)} months · ${escapeHtml($('people').value)} people · deadline ${escapeHtml($('importance').value)}/10</span><em class="${rows?'with-uploads':''}">${rows?`Includes ${rows} row${rows===1?'':'s'} of your evidence`:'BMW data only · no evidence of your own added'}</em>`;
}

function setUploadType(type){
  uploadState.type=type;
  document.querySelectorAll('[data-upload-type]').forEach(tile=>{const on=tile.dataset.uploadType===type;tile.setAttribute('aria-checked',String(on));tile.tabIndex=on?0:-1});
  const template=$('upload-template');template.href=`data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv(type))}`;template.download=`${type.replaceAll('_','-')}-template.csv`;
  $('upload-text').placeholder=UPLOAD_PLACEHOLDERS[type];
  const pasteTab=document.querySelector('[data-upload-mode="paste"]');pasteTab.disabled=type==='past_decision';
  setUploadMode(type==='past_decision'?'csv':uploadState.mode);
  closePreview();
}

function setUploadMode(mode){
  uploadState.mode=mode;
  document.querySelectorAll('[data-upload-mode]').forEach(tab=>tab.setAttribute('aria-selected',String(tab.dataset.uploadMode===mode)));
  $('upload-text').hidden=mode!=='paste';$('upload-drop').hidden=mode!=='csv';
}

async function readUploadFile(file){
  if(!file)return;
  if(!/\.csv$/i.test(file.name)&&file.type!=='text/csv'){showUploadMessage('error','Please choose a .csv file. In Excel use File › Save As › CSV.');return}
  uploadState.fileName=file.name;uploadState.fileText=await file.text();
  $('upload-file-name').textContent=`${file.name} · ${(file.size/1024).toFixed(1)} KB`;showUploadMessage('', '');
}

function showUploadMessage(kind,html){$('upload-errors').className=`upload-errors ${kind}`;$('upload-errors').innerHTML=html}

function previewUpload(){
  const csv=uploadState.mode==='csv',input=csv?uploadState.fileText:$('upload-text').value;
  if(!input.trim()){showUploadMessage('error',csv?'Choose a CSV file first.':'Paste at least one line first.');return}
  const {rows,errors}=parseInput(uploadState.type,input,{csv});
  showUploadMessage(errors.length?'error':'',errors.map(escapeHtml).join('<br>'));
  if(!rows.length)return;
  const features=uploadFeatures();
  uploadState.rows=rows.map(row=>({...row,feature:suggestFeature(row,features)}));
  uploadState.features=features;
  renderPreview();
}

function renderPreview(){
  const rows=uploadState.rows,assigned=rows.filter(row=>row.feature).length,spec=UPLOAD_TYPES[uploadState.type];
  const content=row=>uploadState.type==='past_decision'
    ?`<strong>${escapeHtml(row.requirement)}</strong><span class="preview-decision">${escapeHtml(row.decision)}</span><small>${escapeHtml(row.reasoning)}</small>`
    :`<span>${escapeHtml(row.text.length>220?`${row.text.slice(0,220)}…`:row.text)}</span>${row.source||row.source_url?`<small>${escapeHtml(row.source||row.source_url)}</small>`:''}`;
  const options=selected=>`<option value="">Choose a feature…</option>${uploadState.features.map(feature=>`<option value="${escapeHtml(feature)}" ${feature===selected?'selected':''}>${escapeHtml(feature)}</option>`).join('')}`;
  const shown=rows.slice(0,PREVIEW_LIMIT);
  $('upload-preview').hidden=false;
  $('upload-preview').innerHTML=`<div class="preview-head"><div><h3>Check the rows before they are added</h3><p>${escapeHtml(spec.label)} · weight ${$('upload-weight').value}/10 · ${escapeHtml($('upload-scope').textContent)}. Features were matched automatically; correct any that are wrong.</p></div><p class="preview-count"><strong>${assigned}</strong> of ${rows.length} rows have a feature${assigned<rows.length?`<span>Rows without a feature are left out.</span>`:''}</p></div>
  <table class="preview-table"><thead><tr><th scope="col">Row</th><th scope="col">${uploadState.type==='past_decision'?'Decision':'Evidence'}</th><th scope="col">Feature</th><th scope="col"><span class="visually-hidden">Remove</span></th></tr></thead><tbody>${shown.map((row,index)=>`<tr class="${row.feature?'':'unassigned'}"><td class="num">${row.row}</td><td class="preview-content">${content(row)}</td><td><select data-preview-row="${index}" aria-label="Feature for row ${row.row}">${options(row.feature)}</select></td><td><button type="button" class="preview-remove" data-drop-row="${index}" aria-label="Remove row ${row.row}">×</button></td></tr>`).join('')}</tbody></table>
  ${rows.length>PREVIEW_LIMIT?`<p class="preview-more">Showing the first ${PREVIEW_LIMIT} of ${rows.length} rows. The rest keep their suggested feature.</p>`:''}
  <div class="preview-actions"><button type="button" id="upload-cancel" class="secondary">Cancel</button><button type="button" id="upload-commit" class="primary" ${assigned?'':'disabled'}>Add ${assigned} row${assigned===1?'':'s'} to the knowledge base <span aria-hidden="true">→</span></button></div>`;
  document.querySelectorAll('[data-preview-row]').forEach(select=>{enhanceSelect(select);select.addEventListener('change',()=>{uploadState.rows[Number(select.dataset.previewRow)].feature=select.value;renderPreview()})});
  document.querySelectorAll('[data-drop-row]').forEach(button=>button.addEventListener('click',()=>{uploadState.rows.splice(Number(button.dataset.dropRow),1);uploadState.rows.length?renderPreview():closePreview()}));
  $('upload-cancel').onclick=closePreview;
  $('upload-commit').onclick=commitUpload;
}

function closePreview(){uploadState.rows=[];$('upload-preview').hidden=true;$('upload-preview').innerHTML=''}

async function commitUpload(){
  const button=$('upload-commit'),rows=uploadState.rows.filter(row=>row.feature);
  button.disabled=true;button.textContent='Adding…';
  try{
    const response=await fetch('/api/uploads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:uploadState.type,vehicle:$('vehicle').value,market:$('market').value,weight:Number($('upload-weight').value),fileName:uploadState.mode==='csv'?uploadState.fileName:'Pasted text',rows})});
    const batch=await readApiResponse(response);
    state.uploads.push(batch);applyUploads();closePreview();
    $('upload-text').value='';$('upload-file').value='';uploadState.fileText='';uploadState.fileName='';$('upload-file-name').textContent='The template shows the expected columns.';
    addEvent('evidence-uploaded','PM added evidence',`${batch.rows.length} ${UPLOAD_TYPES[batch.type].label.toLowerCase()} rows for ${batch.vehicle} · ${batch.market}, weight ${batch.weight}/10.`,{batchId:batch.batchId,type:batch.type},'PM');
    showUploadMessage('success',`Added ${batch.rows.length} row${batch.rows.length===1?'':'s'}.${state.config?' <button type="button" id="upload-regenerate" class="secondary">Regenerate requirements to include them</button>':' They are included when you generate requirements.'}`);
    if(state.config)$('upload-regenerate').onclick=()=>$('config-form').requestSubmit();
  }catch(error){showUploadMessage('error',`Could not add the rows: ${escapeHtml(error.message)}`);button.disabled=false;button.textContent='Try again'}
}

function renderUploadList(){
  renderGenerateSummary();
  const target=$('upload-list');if(!target)return;
  const vehicle=$('vehicle').value,market=$('market').value,batches=[...(state.uploads||[])].sort((a,b)=>(b.vehicle===vehicle&&b.market===market)-(a.vehicle===vehicle&&a.market===market)||new Date(b.uploadedAt)-new Date(a.uploadedAt));
  if(!batches.length){target.innerHTML='';return}
  target.innerHTML=`<h3>Your evidence in the knowledge base</h3><ul>${batches.map(batch=>`<li class="${batch.vehicle===vehicle&&batch.market===market?'':'other-scope'}"><div><strong>${escapeHtml(UPLOAD_TYPES[batch.type]?.label||batch.type)}</strong><span>${batch.rows.length} row${batch.rows.length===1?'':'s'} · weight ${batch.weight}/10 · ${escapeHtml(batch.vehicle)} · ${escapeHtml(marketLabel(batch.market))}</span><small>${escapeHtml(batch.fileName)} · added ${new Date(batch.uploadedAt).toLocaleString()}</small></div><button type="button" class="secondary" data-remove-upload="${escapeHtml(batch.batchId)}">Remove</button></li>`).join('')}</ul>`;
  target.querySelectorAll('[data-remove-upload]').forEach(button=>button.onclick=()=>removeUpload(button.dataset.removeUpload));
}

async function removeUpload(batchId){
  const batch=state.uploads.find(item=>item.batchId===batchId);
  if(!batch||!confirm(`Remove ${batch.rows.length} uploaded ${UPLOAD_TYPES[batch.type]?.label.toLowerCase()||''} rows from the knowledge base?`))return;
  try{
    await readApiResponse(await fetch(`/api/uploads/${encodeURIComponent(batchId)}`,{method:'DELETE'}));
    state.uploads=state.uploads.filter(item=>item.batchId!==batchId);applyUploads();
    addEvent('evidence-removed','PM removed uploaded evidence',`${batch.rows.length} ${UPLOAD_TYPES[batch.type]?.label.toLowerCase()||''} rows removed.`,{batchId},'PM');
    showUploadMessage('success',`Removed.${state.config?' <button type="button" id="upload-regenerate" class="secondary">Regenerate requirements</button>':''}`);
    if(state.config)$('upload-regenerate').onclick=()=>$('config-form').requestSubmit();
  }catch(error){showUploadMessage('error',`Could not remove it: ${escapeHtml(error.message)}`)}
}

function initOrbitSweepGradient(){
  const target=document.querySelector('.app-main');
  if(!target)return;
  const angle=159,centerX=46,centerY=55,amt=0.29,dir=-1;
  const draw=currentAngle=>{
    target.style.backgroundColor='#E9EEF5';
    target.style.backgroundImage=`radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0) 52%, rgba(0, 0, 0, 0.08000000000000002) 100%), conic-gradient(from ${currentAngle}deg at ${centerX}% ${centerY}%, #E9EEF5 0%, #8FA3C0 23%, #3B4A66 49%, #8FA3C0 73%, #E9EEF5 100%)`;
  };
  draw(angle);
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  const startedAt=performance.now();
  const animate=now=>{
    const t=(now-startedAt)/1000;
    const ph=t*0.25;
    const spin=ph*dir;
    draw(angle+spin*60*amt);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

async function checkOpenAIStatus(){
  try{
    const response=await fetch('/api/health');
    const status=await readApiResponse(response);
    if(status.apiVersion!=='pm-api-6')throw new Error('An outdated PM server is running. Stop it and restart “node server.mjs”.');
    state.openAIConfigured=Boolean(status.openaiConfigured);
    $('ai-status').innerHTML=`<span></span> ${status.openaiConfigured?`OpenAI ready · ${escapeHtml(status.model)}`:'OpenAI key required'}`;
    $('ai-status').classList.toggle('offline',!status.openaiConfigured);
  }catch(error){state.openAIConfigured=false;$('ai-status').innerHTML=`<span></span> ${escapeHtml(error.message)}`;$('ai-status').classList.add('offline')}
}

async function readApiResponse(response){
  const type=response.headers.get('content-type')||'';
  const text=await response.text();
  if(!type.includes('application/json')){
    if(response.status===404||/^Not found/i.test(text))throw new Error('PM API route not found. Stop the old/static server and start this app with “node server.mjs”.');
    throw new Error(`PM API returned ${response.status} ${type||'without a content type'}.`);
  }
  let payload;try{payload=JSON.parse(text)}catch{throw new Error('PM API returned malformed JSON.')}
  if(!response.ok)throw new Error(payload.error||`PM API request failed (${response.status}).`);
  return payload;
}

function populateMarkets(){
  const names={US:'United States',GB:'United Kingdom',DE:'Germany',CN:'China',JP:'Japan',KR:'South Korea',FR:'France',IT:'Italy',ES:'Spain',CA:'Canada'};
  const previous=$('market').value;
  const counts=new Map();
  for(const record of state.evidence){if(record.vehicle===$('vehicle').value)counts.set(record.market,(counts.get(record.market)||0)+1)}
  const markets=[...counts].filter(([code])=>code).sort((a,b)=>(a[0]==='US'?-1:b[0]==='US'?1:b[1]-a[1]));
  $('market').innerHTML=markets.map(([code,count])=>`<option value="${escapeHtml(code)}">${escapeHtml(names[code]||code)} · ${count.toLocaleString()} records</option>`).join('');
  if(markets.some(([code])=>code===previous))$('market').value=previous;
}

async function loadDecisionEvents(){
  try{const response=await fetch('/api/project-diary'),payload=await readApiResponse(response);const known=new Set(state.events.map(event=>event.id));state.events.push(...payload.events.filter(event=>isDiaryEvent(event)&&!known.has(event.id)))}catch{}
}

function addEvent(type, title, description, data={},actor='PM') {
  if(!DIARY_EVENT_ALLOWED(type))return;
  data={...data,project:state.config?{vehicle:state.config.vehicle,market:state.config.market}:null};
  const event={ id: crypto.randomUUID(), type, title, description, data, actor, at: new Date().toISOString(), provenance:'Append-only application event' };
  state.events.unshift(event);
  localStorage.setItem('decision-events', JSON.stringify(state.events));
  fetch('/api/decision-events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event)}).then(readApiResponse).then(()=>{$('diary-save-status').textContent=''}).catch(error=>{$('diary-save-status').textContent=`Saved in this browser; server save failed: ${error.message}`});
  renderMemory();
  renderDiary();
}

function groundingEvidence(requirement){
  const feedback=requirement.citations.filter(citation=>citation.sourceType==='customer_feedback').slice(0,3),market=requirement.citations.filter(citation=>citation.sourceType!=='customer_feedback').slice(0,3),selected=[...feedback,...market];
  for(const citation of requirement.citations){if(selected.length>=6)break;if(!selected.includes(citation))selected.push(citation)}
  return selected.map(citation=>({evidence_id:citation.evidenceId,source_type:citation.sourceType,excerpt:String(citation.excerpt||'').slice(0,280)}));
}

async function synthesizeGroundedWording(groups){
  if(!state.openAIConfigured)return 0;
  const overrides=overrideMap(),requirements=groups.flatMap(group=>group.requirements.filter(requirement=>!overrides[requirement.feature]&&requirement.wordingSource!=='openai-grounded').map(requirement=>({id:requirement.id,feature:requirement.feature,group:group.name,outcome:requirement.outcome,fallback_statement:requirement.statement,evidence:groundingEvidence(requirement)}))).filter(requirement=>requirement.evidence.length);
  if(!requirements.length)return 0;
  const response=await fetch('/api/synthesize-requirements',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productContext:state.config,requirements})}),result=await readApiResponse(response),byId=new Map(result.requirements.map(requirement=>[requirement.requirementId,requirement]));
  let applied=0;
  for(const requirement of groups.flatMap(group=>group.requirements)){
    const wording=byId.get(requirement.id);if(!wording||overrides[requirement.feature])continue;
    requirement.statement=wording.statement;requirement.wordingSource='openai-grounded';requirement.wordingEvidenceIds=wording.evidenceIds;requirement.wordingModel=result.model;requirement.wordingResponseId=result.responseId;applied+=1;
  }
  return applied;
}

async function generate(event) {
  event?.preventDefault();
  const button=$('generate-button');button.disabled=true;button.innerHTML='<span class="shiny-label">Grounding requirement wording…</span>';state.wordingError='';
  state.config = { vehicle:$('vehicle').value, market:$('market').value, months:Number($('months').value), people:Number($('people').value), importance:Number($('importance').value) };
  const historicalEvidenceIds=state.historical.filter(event=>event.data.vehicle===state.config.vehicle&&event.data.market===state.config.market).flatMap(event=>event.data.supportingEvidence||[]);
  state.config.historyFeatures=[...new Set(historicalEvidenceIds.map(id=>state.evidence.find(record=>record.evidenceId===id)?.feature).filter(Boolean))];
  state.config.historyBonus=Object.fromEntries(state.config.historyFeatures.map(feature=>[feature,5]));
  state.config.pastDecisions=(state.uploadedDecisions||[]).filter(decision=>decision.vehicle===state.config.vehicle&&decision.market===state.config.market);
  state.groups = buildModel(state.evidence, state.config, statusMap(), state.context, overrideMap());
  state.selected = 0;
  try{await synthesizeGroundedWording(state.groups)}catch(error){state.wordingError=error.message}
  addEvent('project-created', 'Product context evaluated', `${state.config.vehicle} · ${state.config.market} · ${state.config.months} months · ${state.config.people} people · deadline importance ${state.config.importance}/10`, state.config);
  addEvent('ranking-calculated', 'Requirements generated and ranked', `${state.groups.length} groups created from customer feedback, market studies, sales planning, cited competitor evidence, and PM delivery constraints.`,{groups:state.groups.map(group=>({name:group.name,requirements:group.requirements.map(requirement=>({id:requirement.id,statement:requirement.statement,rank:requirement.rank,score:requirement.score,citations:requirement.citations.map(citation=>citation.evidenceId)}))}))});
  showView('workspace');
  render();
  button.disabled=false;button.innerHTML='<span class="shiny-label">Generate requirements <span class="shiny-arrow" aria-hidden="true">→</span></span>';
}

function showView(view) {
  ['setup','workspace','memory','project-diary'].forEach(id=>$(id).classList.add('hidden'));
  let activeView=view;
  if(view==='diary'){$('project-diary').classList.remove('hidden');renderDiary()}
  else if(view==='overview')$('setup').classList.remove('hidden');
  else if(view==='memory'){$('memory').classList.remove('hidden');setTimeout(()=>$('memory-search').focus(),0)}
  else if(state.config)$('workspace').classList.remove('hidden');
  else{$('setup').classList.remove('hidden');activeView='overview'}
  document.querySelectorAll('.nav').forEach(n => n.classList.toggle('active', n.dataset.view === activeView));
}

function render() {
  const c=state.config, group=state.groups[state.selected];
  const marketLabel=({US:'United States',GB:'United Kingdom',DE:'Germany',CN:'China'})[c.market]||c.market;
  $('project-title').textContent = `${c.vehicle} requirement strategy · ${marketLabel}`;
  $('context-chips').innerHTML = `<div class="context-metric"><small>Time to market</small><strong>${c.months}<span> months</span></strong></div><div class="context-metric"><small>Team</small><strong>${c.people}<span> people</span></strong></div><div class="context-metric"><small>Deadline</small><strong>${c.importance}<span>/10</span></strong></div>`;
  const relevant=state.evidence.filter(r=>r.vehicle===c.vehicle&&r.market===c.market), low=relevant.filter(r=>r.quality==='low').length;
  const uploadedHere=relevant.filter(r=>r.uploaded).length+(state.context.uploads||[]).filter(signal=>signal.vehicle===c.vehicle&&signal.market===c.market).length;
  const sources=state.context?.manifest?.length||0,marketCitations=state.groups.flatMap(item=>item.requirements).flatMap(requirement=>requirement.citations).filter(citation=>citation.sourceType!=='customer_feedback'),studySignals=new Set(marketCitations.filter(citation=>citation.sourceType==='market_study').map(citation=>citation.evidenceId)).size,salesSignals=new Set(marketCitations.filter(citation=>citation.sourceType==='sales_volume').map(citation=>citation.evidenceId)).size,competitorSignals=new Set(marketCitations.filter(citation=>['competitor_feedback','competitor_equipment','industry_study'].includes(citation.sourceType)).map(citation=>citation.evidenceId)).size;
  const wordingState=state.wordingError?`<span class="wording-warning" title="${escapeHtml(state.wordingError)}">Deterministic wording fallback</span>`:state.openAIConfigured?'<span>Grounded wording validated</span>':'';
  $('integrity').innerHTML = `<span class="status-dot"></span><strong>Evidence workspace</strong><span>${relevant.length.toLocaleString()} contextual feedback records</span><span>${studySignals+salesSignals} market signals</span><span>${competitorSignals} competitor signals</span><span>${sources} source files</span><span>${low.toLocaleString()} low-quality excluded</span>${uploadedHere?`<span>${uploadedHere.toLocaleString()} rows from your uploads</span>`:''}${wordingState}`;
  $('group-list').innerHTML = state.groups.map((g,i)=>`<button class="group-button ${i===state.selected?'active':''}" data-group="${i}"><strong>${escapeHtml(g.name)}</strong><span>${g.requirements.length} supported requirement${g.requirements.length===1?'':'s'}</span></button>`).join('');
  document.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{state.selected=Number(b.dataset.group);render()});
  if (!group) { $('group-title').textContent='No supported groups'; $('group-description').textContent='Try another vehicle or market.'; $('requirements').innerHTML=''; return; }
  const linkedEvidence=group.requirements.reduce((sum,r)=>sum+r.evidenceCount,0),marketLinks=group.requirements.reduce((sum,r)=>sum+r.marketEvidenceCount,0);
  $('group-title').textContent=group.name;
  $('group-description').innerHTML=`<span>Ranked by customer impact</span><span title="${linkedEvidence} cited records · ${marketLinks} market signals">Evidence-led priority</span>`;
  $('req-count').textContent=String(group.requirements.length).padStart(2,'0');
  $('requirements').innerHTML=group.requirements.map((r,index)=>{const approved=['approved','approved-conditional'].includes(r.status),statusBadge=['not-checked','awaiting'].includes(r.status)?'':`<span class="badge ${r.status}">${r.status.replaceAll('-',' ')}</span>`;return `<article class="requirement"><div class="rank"><span>${String(r.rank).padStart(2,'0')}</span></div><div class="requirement-main"><div class="requirement-label"><span class="outcome">${escapeHtml(r.outcome)}</span>${statusBadge}</div><h3>${escapeHtml(r.statement)}</h3><div class="meta"><span>${r.evidenceCount} cited records</span><span>${r.marketEvidenceCount} market signals</span><span>Priority ${r.score}/100</span>${r.explanation?`<span class="signal signal-${r.explanation.signal.tone}"><i aria-hidden="true"></i>${escapeHtml(r.explanation.signal.label)}</span>`:''}${r.explanation?.added?.length?`<span class="has-upload">Includes your data</span>`:''}<span>${escapeHtml(r.owner.name)}</span></div></div><div class="actions"><button class="primary-card-action" data-validate="${r.id}">Check feasibility</button>${approved?`<button class="approval-state" disabled title="Approved" aria-label="Approved">✓</button>`:`<button class="decision-action approve-action" data-approve="${r.id}" title="Approve requirement" aria-label="Approve requirement">Approve</button>`}<button class="decision-action reject-action" data-reject="${r.id}" title="Reject requirement" aria-label="Reject requirement">Reject</button></div><details class="card-reasoning"><summary><span>Evidence & reasoning</span><i aria-hidden="true"></i></summary><div class="reasoning-panel">${reasoningHtml(r)}<div class="reasoning-tools"><button class="evidence-link" data-detail="${r.id}">View cited sources</button><button data-up="${r.id}">Move up</button><button data-down="${r.id}">Move down</button><button data-move="${r.id}">Move group</button><button class="delete-action" data-delete="${r.id}">Delete</button></div></div></details></article>`}).join('');
  document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>openDetail(findRequirement(b.dataset.detail)));
  document.querySelectorAll('[data-validate]').forEach(b=>b.onclick=()=>openValidation(findRequirement(b.dataset.validate)));
  document.querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>openDetail(findRequirement(b.dataset.approve),'approve'));
  document.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>openDetail(findRequirement(b.dataset.reject),'reject'));
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>openDetail(findRequirement(b.dataset.delete),'delete'));
  document.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>reorderRequirement(b.dataset.up,-1));
  document.querySelectorAll('[data-down]').forEach(b=>b.onclick=()=>reorderRequirement(b.dataset.down,1));
  document.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>moveRequirement(b.dataset.move));
  $('integrity').classList.toggle('error', !validateCitations(state.groups,state.evidence,state.context));
}

const findRequirement=id=>state.groups.flatMap(g=>g.requirements).find(r=>r.id===id);
function openDetail(r,intent=''){
  const decisionPrompt=intent==='approve'?'Optionally record why you approved this requirement.':intent==='reject'?'Optionally record why you rejected this requirement.':intent==='delete'?'Optionally record why you removed this requirement.':'An optional note can add context to the audit trail.';
  $('detail-content').innerHTML=`<div class="dialog-body"><p class="eyebrow">RANK #${r.rank} · ${escapeHtml(r.group)} · ${escapeHtml(r.outcome)}</p><h2>${escapeHtml(r.statement)}</h2><div class="edit-requirement"><textarea id="requirement-edit">${escapeHtml(r.statement)}</textarea><button id="save-requirement" class="secondary">Save edited wording</button></div><div class="evidence-box drawer-reasoning">${reasoningHtml(r)}</div><h3 class="sources-title">Sources behind this requirement</h3><p class="sources-help">Every point links to its original source. Your uploads are marked.</p>${citationsHtml(r.citations)}<div class="decision-box ${intent?'decision-intent':''}"><h3>Decision note · saved to Decision Memory</h3><p class="decision-help">${escapeHtml(decisionPrompt)} This records your reasoning; it is not asking another PM for approval.</p><textarea id="pm-rationale" placeholder="Write a short decision note..."></textarea><div class="decision-actions"><button id="record-rationale" class="secondary">🎙 Dictate note</button><button id="delete-requirement" class="secondary ${intent==='delete'?'intent-action':''}">Delete</button><button id="reject-requirement" class="secondary ${intent==='reject'?'intent-action':''}">Reject & recalibrate group</button><button id="approve-requirement" class="primary ${intent==='approve'?'intent-action':''}">${r.status==='conditional'?'Approve with conditions':'Approve requirement'} <span>→</span></button></div></div></div>`;
  $('detail-dialog').showModal();
  $('pm-rationale').placeholder='Optional decision note…';
  $('save-requirement').onclick=()=>editRequirement(r);
  $('record-rationale').onclick=()=>recordRationale();
  $('reject-requirement').onclick=()=>saveDecision(r,'pm-rejected');
  $('delete-requirement').onclick=()=>saveDecision(r,'deleted');
  $('approve-requirement').onclick=()=>saveDecision(r,r.status==='conditional'?'approved-conditional':'approved');
  if(intent)setTimeout(()=>{$('pm-rationale').scrollIntoView({block:'center'});$('pm-rationale').focus()},0);
}

function editRequirement(r){
  const wording=$('requirement-edit').value.trim();if(!wording||wording===r.statement)return;
  const before=r.statement;r.statement=wording;
  state.overrides[statusKey(r.feature)]=wording;localStorage.setItem('requirement-overrides',JSON.stringify(state.overrides));
  addEvent('requirement-edited','PM edited requirement wording',`${r.feature}: “${before}” → “${wording}”`,{requirementId:r.id,before,after:wording,citations:r.citations.map(c=>c.evidenceId)});
  $('detail-dialog').close();render();
}

function recordRationale(){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition){alert('Voice transcription is not supported in this browser. Type the rationale instead.');return}
  const recognition=new Recognition();recognition.lang='en-US';recognition.interimResults=false;
  $('record-rationale').textContent='Listening…';
  recognition.onresult=e=>$('pm-rationale').value=[...e.results].map(x=>x[0].transcript).join(' ');
  recognition.onend=()=>$('record-rationale').textContent='🎙 Record rationale';recognition.start();
}

function saveDecision(r,status){
  const rationale=$('pm-rationale').value.trim();
  commitDecision(r,status,rationale);$('detail-dialog').close();render();
}

function commitDecision(r,status,rationale){
  state.statuses[statusKey(r.feature)]=status;
  localStorage.setItem('requirement-statuses',JSON.stringify(state.statuses));
  const approved=status.startsWith('approved');
  const deleted=status==='deleted',type=approved?(status==='approved-conditional'?'requirement-approved-with-conditions':'requirement-approved'):deleted?'requirement-deleted':'requirement-rejected';
  const title=approved?(status==='approved-conditional'?'Requirement approved with conditions':'Requirement approved'):deleted?'Requirement deleted':'Requirement rejected';
  addEvent(type,title,`${r.feature}: ${rationale}`,{requirementId:r.id,before:{rank:r.rank,score:r.score,status:r.status,statement:r.statement},after:{status},citations:r.citations.map(c=>c.evidenceId),rationale});
  if(status==='pm-rejected'||status==='deleted')recalibrateGroup(r.group,`${deleted?'Requirement deleted':'Requirement rejected'}: ${r.feature}`,r.feature);
  else recalibrateGroup(r.group,`Human decision recorded: ${r.feature}`);
}

function recalibrateGroup(groupName,reason='PM requested a fresh ranking',rejectedFeature=''){
  const index=state.groups.findIndex(group=>group.name===groupName);if(index<0)return;
  const current=state.groups[index],before=current.requirements.map(r=>({id:r.id,feature:r.feature,rank:r.rank,score:r.score,status:r.status}));
  const knownWording=new Map(state.groups.flatMap(group=>group.requirements).filter(requirement=>requirement.wordingSource==='openai-grounded').map(requirement=>[requirement.id,{statement:requirement.statement,wordingSource:requirement.wordingSource,wordingEvidenceIds:requirement.wordingEvidenceIds,wordingModel:requirement.wordingModel,wordingResponseId:requirement.wordingResponseId}]));
  const rebuilt=buildModel(state.evidence,state.config,statusMap(),state.context,overrideMap());
  for(const requirement of rebuilt.flatMap(group=>group.requirements)){const wording=knownWording.get(requirement.id);if(wording&&!state.overrides[statusKey(requirement.feature)])Object.assign(requirement,wording)}
  let replacement=rebuilt.find(group=>group.name===groupName);
  if(!replacement){
    const remainingFeatures=new Set(current.requirements.map(r=>r.feature).filter(feature=>feature!==rejectedFeature));
    const requirements=rebuilt.flatMap(group=>group.requirements).filter(r=>remainingFeatures.has(r.feature)).sort((a,b)=>b.score-a.score).slice(0,10);
    if(requirements.length)replacement={...current,requirements:requirements.map((r,position)=>({...r,group:groupName,rank:position+1}))};
  }
  if(replacement)state.groups.splice(index,1,replacement);else state.groups.splice(index,1);
  state.selected=Math.min(index,Math.max(0,state.groups.length-1));
  const after=replacement?.requirements.map(r=>({id:r.id,feature:r.feature,rank:r.rank,score:r.score,status:r.status}))||[];
  addEvent('group-recalibrated','Requirement group recalibrated',`${groupName}: ${reason}. ${before.length} → ${after.length} ranked requirements.`,{group:groupName,rejectedFeature,before,after});
  render();
  if(replacement&&state.openAIConfigured)synthesizeGroundedWording([replacement]).then(applied=>{if(applied){state.wordingError='';render()}}).catch(error=>{state.wordingError=error.message;render()});
}

function renameGroup(){
  const group=state.groups[state.selected];if(!group)return;
  const name=prompt('Rename this feature group',group.name)?.trim();if(!name||name===group.name)return;
  const before=group.name;group.name=name;group.requirements=group.requirements.map(r=>({...r,group:name}));
  addEvent('group-renamed','PM renamed a feature group',`${before} → ${name}`);render();
}

function rerankGroup(group){group.requirements=group.requirements.map((r,index)=>({...r,group:group.name,rank:index+1}))}
function reorderRequirement(id,direction){
  const group=state.groups[state.selected],index=group.requirements.findIndex(r=>r.id===id),next=index+direction;
  if(index<0||next<0||next>=group.requirements.length)return;
  const before=group.requirements.map(r=>({id:r.id,rank:r.rank}));
  [group.requirements[index],group.requirements[next]]=[group.requirements[next],group.requirements[index]];rerankGroup(group);
  addEvent('ranking-changed','PM manually reordered requirements',`${group.requirements[next].feature} moved from #${index+1} to #${next+1}.`,{before,after:group.requirements.map(r=>({id:r.id,rank:r.rank}))});render();
}
function moveRequirement(id){
  const source=state.groups.find(g=>g.requirements.some(r=>r.id===id)),requirement=source?.requirements.find(r=>r.id===id);if(!requirement)return;
  const choices=state.groups.filter(g=>g!==source).map(g=>g.name).join('\n');
  const targetName=prompt(`Move to an existing or new group:\n${choices}`)?.trim();if(!targetName)return;
  let target=state.groups.find(g=>g.name.toLowerCase()===targetName.toLowerCase());
  if(!target){target={name:targetName,description:'PM-created feature group.',evidenceSummary:'PM-created grouping; requirement evidence remains unchanged.',requirements:[]};state.groups.push(target)}
  if(target.requirements.length>=10){alert('A feature group cannot contain more than 10 requirements.');return}
  source.requirements=source.requirements.filter(r=>r.id!==id);target.requirements.push({...requirement,group:target.name});rerankGroup(source);rerankGroup(target);
  if(!source.requirements.length)state.groups=state.groups.filter(g=>g!==source);
  state.selected=state.groups.indexOf(target);addEvent('requirement-grouped','PM moved a requirement',`${requirement.feature}: ${source.name} → ${target.name}`);render();
}
function splitGroup(){
  const source=state.groups[state.selected];if(!source||source.requirements.length<2){alert('This group does not contain enough requirements to split.');return}
  const ranks=prompt(`Enter the ranks to move into a new group (for example: 3,4,5).\n${source.requirements.map(r=>`${r.rank}. ${r.feature}`).join('\n')}`);if(!ranks)return;
  const selected=new Set(ranks.split(',').map(Number).filter(n=>n>=1&&n<=source.requirements.length));if(!selected.size||selected.size===source.requirements.length){alert('Select some, but not all, requirements.');return}
  const name=prompt('Name the new feature group')?.trim();if(!name)return;
  const moved=source.requirements.filter(r=>selected.has(r.rank)),remaining=source.requirements.filter(r=>!selected.has(r.rank));
  source.requirements=remaining;rerankGroup(source);const group={name,description:'PM-created split from an evidence-derived BMW domain.',evidenceSummary:'Source citations remain attached to every moved requirement.',requirements:moved};rerankGroup(group);state.groups.splice(state.selected+1,0,group);
  addEvent('group-split','PM split a feature group',`${source.name} → ${source.name} and ${name}`,{moved:moved.map(r=>r.id)});render();
}
function mergeGroup(){
  const source=state.groups[state.selected];if(!source||state.groups.length<2)return;
  const name=prompt(`Merge “${source.name}” into:\n${state.groups.filter(g=>g!==source).map(g=>g.name).join('\n')}`)?.trim();if(!name)return;
  const target=state.groups.find(g=>g!==source&&g.name.toLowerCase()===name.toLowerCase());if(!target){alert('Select an existing group name.');return}
  if(source.requirements.length+target.requirements.length>10){alert('Merge blocked: the result would exceed the maximum of 10 requirements. Move or reject requirements first.');return}
  target.requirements.push(...source.requirements.map(r=>({...r,group:target.name})));rerankGroup(target);state.groups=state.groups.filter(g=>g!==source);state.selected=state.groups.indexOf(target);
  addEvent('group-merged','PM merged feature groups',`${source.name} → ${target.name}`);render();
}

function transcribeResponse(){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition,button=$('transcribe-response');
  if(!Recognition){alert('Voice transcription is not supported in this browser. Paste or type the response instead.');return}
  const recognition=new Recognition();recognition.lang='en-US';recognition.interimResults=false;button.textContent='Listening…';button.disabled=true;
  recognition.onresult=event=>{$('stakeholder-response').value=[...event.results].map(result=>result[0].transcript).join(' ')};
  recognition.onend=()=>{button.textContent='🎙 Transcribe response';button.disabled=false};recognition.start();
}

function openValidation(r){
  state.activeRequirement=r;
  const departments=departmentOptions(r.feature),suggested=departments.find(d=>d.suggested);
  const ownerHint=name=>name===suggested.name?`Suggested for this requirement: ${r.owner.reason} Pick another department to reroute; the draft updates.`:`Rerouted by the PM. Suggested department: ${suggested.name}.`;
  const contacts=JSON.parse(localStorage.getItem('stakeholder-contacts')||'{}'),recipient=contacts[r.owner.name]||'';
  const aiSetup=state.openAIConfigured?'':`<div class="api-setup"><strong>OpenAI tools are not configured</strong><p>The default draft and Gmail link still work. To create an email from notes or interpret a reply, restart the PM server from PowerShell with:</p><code>$env:OPENAI_API_KEY="your-key"<br>node server.mjs</code><p>Refresh this page afterward. The key remains server-side.</p></div>`;
  $('validation-content').innerHTML=`<div class="dialog-body"><p class="eyebrow">STAKEHOLDER VALIDATION · NOT AUTOMATICALLY SENT</p><h2>${escapeHtml(r.statement)}</h2><label class="owner-field"><strong>Send this question to</strong><select id="owner-edit">${departments.map(d=>`<option value="${escapeHtml(d.name)}" ${d.suggested?'data-badge="Suggested"':''} ${d.name===r.owner.name?'selected':''}>${escapeHtml(d.name)}</option>`).join('')}</select><small id="owner-hint">${escapeHtml(ownerHint(r.owner.name))}</small></label><div class="validation-grid"><div><h3>Editable draft email</h3><textarea id="email-draft">${escapeHtml(draftEmail(r,state.config,r.owner.name))}</textarea><div class="email-composer"><label><strong>Rough email notes · optional</strong><textarea id="email-notes" placeholder="Type or dictate the points you want added to the email. The default draft above remains available."></textarea></label><div class="email-compose-actions"><button id="transcribe-email-notes" class="secondary">🎙 Transcribe notes</button><button id="create-email" class="primary" ${state.openAIConfigured?'':'disabled'}>${state.openAIConfigured?'Create email from notes':'OpenAI key required'}</button></div><div id="email-generation-status"></div></div><div class="gmail-actions"><label><span>Relevant stakeholder email</span><input id="stakeholder-email" type="email" placeholder="name@bmwgroup.com" value="${escapeHtml(recipient)}"></label><a id="gmail-draft" class="primary gmail-link" target="_blank" rel="noopener">Open draft in Gmail <span>↗</span></a></div></div><div><h3>Paste engineering response</h3><p class="decision-help">Paste the reply exactly as received. OpenAI proposes an interpretation; nothing changes until you confirm it.</p><textarea id="stakeholder-response" placeholder="Paste the engineering response here."></textarea>${aiSetup}<div class="feedback-actions"><button id="interpret" class="primary confirm" ${state.openAIConfigured?'':'disabled'}>${state.openAIConfigured?'Process feedback & recalibrate':'OpenAI key required'}</button></div><div id="interpretation"></div></div></div></div>`;
  $('validation-dialog').showModal();
  enhanceSelect($('owner-edit'));
  const syncGmail=()=>{$('gmail-draft').href=gmailComposeUrl($('stakeholder-email').value,$('email-draft').value)};
  syncGmail();$('email-draft').oninput=syncGmail;$('stakeholder-email').oninput=syncGmail;
  $('stakeholder-email').onchange=()=>{const email=$('stakeholder-email').value.trim();if(email){contacts[$('owner-edit').value.trim()||r.owner.name]=email;localStorage.setItem('stakeholder-contacts',JSON.stringify(contacts))}};
  let autoDraft=$('email-draft').value;
  $('owner-edit').onchange=()=>{
    const owner=$('owner-edit').value;if(!owner||owner===r.owner.name)return;
    const before=r.owner.name,edited=$('email-draft').value!==autoDraft;
    if(!edited||confirm(`Replace your edited draft with the default draft for ${owner}?`)){autoDraft=draftEmail(r,state.config,owner);$('email-draft').value=autoDraft}
    r.owner.name=owner;$('owner-hint').textContent=ownerHint(owner);$('stakeholder-email').value=contacts[owner]||'';syncGmail();
    addEvent('responsible-entity-corrected','PM rerouted feasibility question',`${r.feature}: ${before} → ${owner}`,{requirementId:r.id,before,after:owner});
  };
  $('transcribe-email-notes').onclick=transcribeEmailNotes;
  if(state.openAIConfigured){$('create-email').onclick=()=>createEmailDraft(r,syncGmail);$('interpret').onclick=()=>interpretStakeholderResponse(r)}
  addEvent('validation-draft-opened','Feasibility draft prepared',`${r.feature} routed to ${r.owner.name}; email remains unsent.`,{requirementId:r.id,responsibleEntity:r.owner.name},'PM');
}

function transcribeEmailNotes(){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition,button=$('transcribe-email-notes');
  if(!Recognition){alert('Voice transcription is not supported in this browser. Type the email notes instead.');return}
  const recognition=new Recognition();recognition.lang='en-US';recognition.interimResults=false;button.textContent='Listening…';button.disabled=true;
  recognition.onresult=event=>{$('email-notes').value=[...event.results].map(result=>result[0].transcript).join(' ')};
  recognition.onend=()=>{button.textContent='🎙 Transcribe notes';button.disabled=false};recognition.start();
}

async function createEmailDraft(r,syncGmail){
  const notes=$('email-notes').value.trim(),button=$('create-email'),status=$('email-generation-status');
  if(!notes){status.innerHTML='<div class="api-error">Add or transcribe rough notes first. The default draft is still ready to use.</div>';return}
  button.disabled=true;button.textContent='Creating draft…';status.innerHTML='<div class="api-progress">OpenAI is turning the PM notes into a grounded email draft…</div>';
  try{
    const response=await fetch('/api/draft-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requirement:r.statement,featureGroup:r.group,responsibleEntity:$('owner-edit').value.trim()||r.owner.name,productContext:state.config,whyItExists:r.whyExists,evidenceSummary:`${r.evidenceCount} cited records`,roughNotes:notes,currentDraft:$('email-draft').value})});
    const result=await readApiResponse(response);$('email-draft').value=`Subject: ${result.subject}\n\n${result.body}`;syncGmail();status.innerHTML=`<div class="api-progress">Draft updated · ${escapeHtml(result.model)}</div>`;
    addEvent('email-draft-created','OpenAI-assisted feasibility email drafted',`${r.feature}: PM notes were converted into an editable draft.`,{requirementId:r.id,model:result.model,responseId:result.responseId},'PM · OpenAI drafting');
  }catch(error){status.innerHTML=`<div class="api-error"><strong>Email drafting failed.</strong><br>${escapeHtml(error.message)}</div>`}
  finally{button.disabled=false;button.textContent='Create email from notes'}
}

async function interpretStakeholderResponse(r){
  if(!state.openAIConfigured){$('interpretation').innerHTML='<div class="api-error">OpenAI is not configured on the PM server. Follow the setup instruction above and restart the server.</div>';return}
  const responseText=$('stakeholder-response').value.trim();
  if(!responseText){$('interpretation').innerHTML='<div class="api-error">Paste a stakeholder response before interpreting it.</div>';return}
  const button=$('interpret');button.disabled=true;button.textContent='Checking with OpenAI…';
  $('interpretation').innerHTML='<div class="api-progress">OpenAI is checking feasibility, stated constraints, and timing…</div>';
  try{
    const responsibleEntity=$('owner-edit').value.trim()||r.owner.name;
    const response=await fetch('/api/interpret-stakeholder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requirement:r.statement,featureGroup:r.group,responsibleEntity,productContext:state.config,stakeholderResponse:responseText})});
    const result=await readApiResponse(response);
    result.stakeholderResponse=responseText;
    const detail=[result.conditions?.length?`<p><strong>Conditions:</strong> ${escapeHtml(result.conditions.join('; '))}</p>`:'',result.constraints?.length?`<p><strong>Constraints:</strong> ${escapeHtml(result.constraints.join('; '))}</p>`:'',result.time_impact?`<p><strong>Timing:</strong> ${escapeHtml(result.time_impact)}</p>`:'',result.suggested_modification?`<p><strong>Suggested change:</strong> ${escapeHtml(result.suggested_modification)}</p>`:''].join('');
    const approvable=['feasible','conditional'].includes(result.status);
    const rejectionNote=result.status==='not-feasible'?'<label class="approval-rationale"><strong>Rejection reason · saved to Decision Memory</strong><textarea id="rejection-rationale" placeholder="Why is this requirement being rejected?"></textarea></label>':'';
    $('interpretation').innerHTML=`<div class="evidence-box"><h3>OPENAI INTERPRETATION · YOUR CONFIRMATION REQUIRED</h3><p>Status: <strong>${escapeHtml(result.status.replaceAll('-',' '))}</strong> · ${Math.round(result.confidence*100)}% confidence</p><p>${escapeHtml(result.summary)}</p>${detail}<p class="model-trace">Model: ${escapeHtml(result.model)} · Response: ${escapeHtml(result.responseId||'not returned')}</p>${approvable?'<label class="approval-rationale"><strong>Approval reason · saved to Decision Memory</strong><textarea id="approval-rationale" placeholder="Why are you approving this requirement?"></textarea></label>':rejectionNote}<div class="interpret-actions"><button id="confirm-response" class="secondary" ${result.status==='unclear'?'disabled':''}>${result.status==='unclear'?'Clarification required':result.status==='not-feasible'?'Confirm rejection & recalibrate group':'Confirm feasibility only'}</button>${approvable?'<button id="confirm-approve" class="primary">Approve requirement <span>→</span></button>':''}</div></div>`;
    if(approvable)$('approval-rationale').placeholder='Optional decision note…';
    if(result.status==='not-feasible')$('confirm-response').onclick=()=>{const rationale=$('rejection-rationale').value.trim()||`PM rejected this requirement after confirming the stakeholder response: ${result.summary}`;confirmResponse(r,result,{rationale})};
    else if(result.status!=='unclear')$('confirm-response').onclick=()=>confirmResponse(r,result);
    if(approvable)$('confirm-approve').onclick=()=>{const rationale=$('approval-rationale').value.trim()||'PM approved this requirement after reviewing the interpreted engineering response.';confirmResponse(r,result,{approve:true,rationale})};
  }catch(error){$('interpretation').innerHTML=`<div class="api-error"><strong>OpenAI interpretation failed.</strong><br>${escapeHtml(error.message)}</div>`}
  finally{button.disabled=false;button.textContent='Process Feedback & Recalibrate'}
}

function confirmResponse(r,result,{approve=false,rationale=''}={}){
  if(result.status==='unclear'){alert('The response is unclear. Ask the stakeholder for a feasibility conclusion before confirming.');return}
  if(!approve&&result.status==='not-feasible'&&!rationale)rationale=`PM rejected this requirement after confirming the stakeholder response: ${result.summary}`;
  const before=state.groups.map(g=>({group:g.name,requirements:g.requirements.map(x=>({feature:x.feature,rank:x.rank,score:x.score,status:x.status}))}));
  const finalStatus=approve?(result.status==='conditional'?'approved-conditional':'approved'):result.status;
  state.statuses[statusKey(r.feature)]=finalStatus;
  localStorage.setItem('requirement-statuses',JSON.stringify(state.statuses));
  recalibrateGroup(r.group,result.status==='not-feasible'?`Stakeholder rejection confirmed: ${r.feature}`:`Stakeholder feasibility updated: ${r.feature}`,result.status==='not-feasible'?r.feature:'');
  const after=state.groups.map(g=>({group:g.name,requirements:g.requirements.map(x=>({feature:x.feature,rank:x.rank,score:x.score,status:x.status}))}));
  addEvent('interpretation-confirmed',`PM confirmed: ${result.status.replaceAll('-',' ')}`,`${r.feature}. Stakeholder response: ${result.summary}`,{before,after,model:result.model,responseId:result.responseId,confidence:result.confidence,stakeholderResponse:result.stakeholderResponse,supportingQuotes:result.supporting_quotes,conditions:result.conditions,constraints:result.constraints,timeImpact:result.time_impact,suggestedModification:result.suggested_modification},'Engineering response · OpenAI interpretation · PM confirmation');
  addEvent('requirements-recalculated','Affected group ranking recalculated','The previous group ranking remains preserved in this event. No requirement was silently replaced.',{before,after});
  if(approve)addEvent(finalStatus==='approved-conditional'?'requirement-approved-with-conditions':'requirement-approved',finalStatus==='approved-conditional'?'Requirement approved with conditions':'Requirement approved',`${r.feature}: ${rationale}`,{requirementId:r.id,statement:r.statement,status:finalStatus,citations:r.citations.map(c=>c.evidenceId),humanDecision:true,rationale});
  else if(result.status==='not-feasible')addEvent('requirement-rejected','Requirement rejected',`${r.feature}: ${rationale}`,{requirementId:r.id,statement:r.statement,status:'not-feasible',citations:r.citations.map(c=>c.evidenceId),humanDecision:true,rationale,stakeholderResponse:result.stakeholderResponse});
  $('validation-dialog').close();render();
  if(!approve&&['feasible','conditional'].includes(result.status)){
    const updated=state.groups.flatMap(g=>g.requirements).find(item=>item.feature===r.feature);
    if(updated)setTimeout(()=>openDetail(updated),0);
  }
}

function renderMemory(query=$('memory-search')?.value||''){
  const all=[...state.events.filter(isRecordedDecision),...state.historical].sort((a,b)=>new Date(b.at)-new Date(a.at)),needle=query.trim().toLowerCase();
  const events=needle?all.filter(event=>JSON.stringify(event).toLowerCase().includes(needle)):all;
  $('event-count').textContent=all.length;
  $('timeline').innerHTML=events.length?events.map(e=>{const historical=e.type==='historical-decision',status=historical?e.data.decisionStatus:e.type==='requirement-rejected'?'Rejected':e.type==='requirement-approved-with-conditions'?'Approved with conditions':'Approved',requirement=e.data.statement||e.data.before?.statement||e.data.requirement||e.title,reason=decisionReason(e),audit=e.data?.citations||e.data?.supportingEvidence?`<details><summary>Inspect supporting evidence</summary><pre>${escapeHtml(JSON.stringify({citations:e.data.citations||e.data.supportingEvidence,provenance:e.provenance},null,2))}</pre></details>`:'';return `<div class="event"><time>${new Date(e.at).toLocaleString()}</time><div class="event-dot"></div><article><p class="eyebrow">${escapeHtml(status)} · ${escapeHtml(e.actor||'PM')}</p><h3>${escapeHtml(requirement)}</h3><p><strong>Reason:</strong> ${escapeHtml(reason)}</p>${audit}</article></div>`}).join(''):`<p>${needle?'No approved or rejected requirements match this search.':'No requirements have been approved or rejected yet.'}</p>`;
}

async function classifyRequirementsForReports(requirements){
  const signature=JSON.stringify(requirements.map(requirement=>[requirement.id,requirement.statement,requirement.owner?.name,requirement.status]));
  if(state.reportRouting?.signature===signature)return state.reportRouting;
  let assignments=[],model='Deterministic fallback',responseId=null,fallback=true;
  if(state.openAIConfigured){
    try{
      const response=await fetch('/api/classify-report-audiences',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          productContext:state.config,
          requirements:requirements.map(requirement=>({requirement_id:requirement.id,feature:requirement.feature,group:requirement.group,outcome:requirement.outcome,statement:requirement.statement,responsible_entity:requirement.owner.name}))
        })
      });
      const result=await readApiResponse(response);
      assignments=result.assignments||[];model=result.model||'OpenAI';responseId=result.responseId||null;fallback=assignments.length!==requirements.length;
    }catch(error){console.warn('OpenAI report routing failed; using deterministic fallback.',error)}
  }
  const routing=mergeReportAudienceAssignments(requirements,assignments);
  state.reportRouting={signature,routing,model,responseId,fallback};
  return state.reportRouting;
}

async function downloadReport(kind,button){
  if(!state.config||!state.groups.length){alert('Generate a product cycle before exporting a report.');return}
  const originalLabel=button?.textContent;
  if(button){button.disabled=true;button.textContent='PREPARING PDF...'}
  try{
    const all=state.groups.flatMap(group=>group.requirements.map(requirement=>({...requirement,group:group.name})));
    const routingResult=await classifyRequirementsForReports(all),audiences=partitionReportRequirements(all,routingResult.routing);
    const market=({US:'United States',GB:'United Kingdom',DE:'Germany',CN:'China'})[state.config.market]||state.config.market;
    const humanStatus=status=>status.replaceAll('-',' ').replace(/\b\w/g,letter=>letter.toUpperCase());
    const sources=requirement=>{const unique=[...new Set(requirement.citations.map(c=>`${c.file} / ${c.sheet}`))],shown=unique.slice(0,4);return `${shown.join('; ')}${unique.length>shown.length?` (+${unique.length-shown.length} more sources)`:''}`};
    const routingFor=requirement=>routingResult.routing.get(requirement.id);
    const audienceLabel=requirement=>routingFor(requirement).technical?'Technical':'GTM';
    const item=(requirement,detailType='pm')=>{
      const route=routingFor(requirement),details=[`Status: ${humanStatus(requirement.status)}  |  Priority: ${requirement.score}/100  |  Owner: ${requirement.owner.name}`,`Audience: ${audienceLabel(requirement)}. ${route.rationale}`];
      if(detailType==='technical')details.push(`Evidence basis: ${requirement.evidenceCount} cited records and ${requirement.marketEvidenceCount} market signals.`,`Representative sources: ${sources(requirement)}`);
      else if(detailType==='gtm')details.push(`Customer evidence: ${requirement.evidenceCount} cited records. Market intelligence: ${requirement.marketEvidenceCount} signals for ${market}.`,`Representative sources: ${sources(requirement)}`);
      else details.push(`Evidence: ${requirement.evidenceCount} cited records, including ${requirement.marketEvidenceCount} market signals.`);
      return {kicker:`#${requirement.rank} - ${requirement.group} - ${requirement.outcome}`,title:requirement.statement,details};
    };
    let title,subtitle,sections,scopeValue;
    if(kind==='technical'){
      title='TECHNICAL REQUIREMENT REPORT';subtitle='Implementation and validation requirements routed to technical teams';scopeValue=`${audiences.technical.length} technical requirements`;
      sections=state.groups.map(group=>({title:group.name,items:audiences.technical.filter(requirement=>requirement.group===group.name).map(requirement=>item(requirement,'technical'))})).filter(section=>section.items.length);
      if(!sections.length)sections=[{title:'Technical scope',empty:'No requirements were routed to Technical.',items:[]}];
    }else if(kind==='gtm'){
      title='GO-TO-MARKET REQUIREMENT REPORT';subtitle=`Customer proposition and launch requirements routed to GTM for ${market}`;scopeValue=`${audiences.gtm.length} GTM requirements`;
      sections=state.groups.map(group=>({title:group.name,items:audiences.gtm.filter(requirement=>requirement.group===group.name).map(requirement=>item(requirement,'gtm'))})).filter(section=>section.items.length);
      if(!sections.length)sections=[{title:'GTM scope',empty:'No requirements were routed to GTM.',items:[]}];
    }else{
      title='PM REQUIREMENT REPORT';subtitle='Complete requirement portfolio, primary department routing, and recorded decisions';scopeValue=`${audiences.technical.length} Technical / ${audiences.gtm.length} GTM`;
      sections=[
        {title:'Technical',items:audiences.technical.map(requirement=>item(requirement))},
        {title:'Go-to-market',items:audiences.gtm.map(requirement=>item(requirement))}
      ].filter(section=>section.items.length);
      const decisions=[...state.events.filter(isRecordedDecision),...state.historical].sort((a,b)=>new Date(b.at)-new Date(a.at));
      sections.push({title:'Decision record',items:decisions.map(event=>({kicker:`${event.actor||'PM'} - ${new Date(event.at).toLocaleDateString()}`,title:event.data.statement||event.data.requirement||event.title,details:[`Decision: ${event.type==='requirement-rejected'||/rejected/i.test(event.data?.decisionStatus||'')?'Rejected':'Approved'}`,`Reason: ${decisionReason(event)}`]})),empty:'No requirements have been approved or rejected yet.'});
    }
    const routingSource=routingResult.fallback?(routingResult.responseId?`OpenAI + deterministic fallback - ${routingResult.model}`:'Deterministic routing'):`OpenAI routing - ${routingResult.model}`;
    const pdf=createReportPdf({title,subtitle,metadata:[{label:'Vehicle',value:state.config.vehicle},{label:'Market',value:market},{label:'Delivery context',value:`${state.config.months} months / ${state.config.people} people`},{label:'Report scope',value:scopeValue}],sections:[{title:'Report methodology',items:[{kicker:routingSource,title:`${all.length} ranked requirements evaluated for report distribution`,details:[`PM includes all ${all.length} requirements. Each requirement has one primary audience and appears in exactly one departmental export.`]}]},...sections]}),blob=new Blob([pdf],{type:'application/pdf'}),url=URL.createObjectURL(blob),anchor=document.createElement('a'),safe=value=>String(value).replace(/[<>:"/\\|?*\u0000-\u001F]/g,'-').replace(/\s+/g,'-');
    anchor.href=url;anchor.download=`PM-${kind}-${safe(state.config.vehicle)}-${safe(state.config.market)}.pdf`;anchor.click();URL.revokeObjectURL(url);
    addEvent('report-generated',`${kind.toUpperCase()} report generated`,`${kind==='pm'?all.length:kind==='technical'?audiences.technical.length:audiences.gtm.length} routed requirements included.`);
  }catch(error){alert(`The PDF could not be generated: ${error.message}`)}finally{if(button){button.disabled=false;button.textContent=originalLabel}}
}
init().catch(error=>{document.body.innerHTML=`<main class="memory"><h1>Unable to load evidence</h1><p>${escapeHtml(error.message)}</p></main>`});

function DIARY_EVENT_ALLOWED(type){return isDiaryEvent({id:'check',type,at:new Date().toISOString()})}
function diaryProject(){return state.config||{vehicle:$('vehicle').value,market:$('market').value}}
function diaryProjectLabel(){const project=diaryProject();const vehicles={G60:'BMW 5 Series · G60',F70:'BMW 1 Series · F70',G70:'BMW 7 Series · G70'},markets={US:'United States',GB:'United Kingdom',DE:'Germany',CN:'China'};return `${vehicles[project.vehicle]||project.vehicle} · ${markets[project.market]||project.market}`}
function scopedDiary(){return diaryEntries([...state.events,...state.historical.map(event=>({...event,type:event.data?.decisionStatus?.toLowerCase().includes('reject')?'requirement-rejected':'requirement-approved',data:{...event.data,rationale:event.data.pmReasoning}}))],$('diary-scope').value==='current'?diaryProject():null)}
function renderDiary(){
  if(!$('diary-timeline'))return;
  $('diary-scope').querySelector('[value=current]').textContent=diaryProjectLabel();
  const events=scopedDiary(),day=$('diary-date').value;
  $('diary-context').textContent=$('diary-scope').value==='current'?diaryProjectLabel():'All recorded projects (older records may have no project context).';
  const counts=new Map();for(const event of events){const key=dayKey(event.at);counts.set(key,(counts.get(key)||0)+1)}
  const end=new Date();end.setHours(12,0,0,0);const start=new Date(end);start.setDate(start.getDate()-364);
  if(events.length){const oldest=new Date(events[events.length-1].at);oldest.setHours(12,0,0,0);if(oldest<start)start.setTime(oldest.getTime())}
  start.setDate(start.getDate()-start.getDay());
  const cells=[];let index=0,lastMonth='';
  for(const date=new Date(start);date<=end;date.setDate(date.getDate()+1),index++){
    const key=dayKey(date),count=counts.get(key)||0,week=Math.floor(index/7)+1;
    if(index%7===0){const labelDate=new Date(date);labelDate.setDate(labelDate.getDate()+Math.min(6,Math.round((end-date)/86400000)));const month=`${labelDate.getFullYear()}-${labelDate.getMonth()}`;const label=month!==lastMonth?labelDate.toLocaleDateString(undefined,{month:'short',year:'numeric'}):'';cells.push(`<span class="diary-month" style="grid-column:${week};grid-row:1">${escapeHtml(label)}</span>`);lastMonth=month}
    const readable=date.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
    cells.push(`<button type="button" style="grid-column:${week};grid-row:${date.getDay()+2}" class="diary-day level-${Math.min(4,count)} ${key===day?'selected':''}" data-day="${key}" title="${readable}: ${count} changes" aria-label="${readable}: ${count} changes" aria-pressed="${key===day}"></button>`);
  }
  $('diary-graph').innerHTML=cells.join('');$('diary-graph').querySelectorAll('[data-day]').forEach(button=>button.onclick=()=>{$('diary-date').value=$('diary-date').value===button.dataset.day?'':button.dataset.day;state.diarySummary=null;renderDiary()});
  const selected=diaryEntries(events,null,day);
  $('diary-timeline').innerHTML=selected.length?selected.map(event=>`<article class="diary-entry"><time>${escapeHtml(new Date(event.at).toLocaleString())}</time><h3>${escapeHtml(event.title)}</h3><p>${escapeHtml(event.description)}</p><p class="diary-reason">${escapeHtml(event.data?.rationale?`PM reason: ${event.data.rationale}`:'No written PM rationale recorded.')}</p><details><summary>Recorded details</summary><pre>${escapeHtml(JSON.stringify(event.data,null,2))}</pre></details></article>`).join(''):'<p>No recorded changes for this selection.</p>';
  $('diary-summarize').disabled=!day||!selected.length||!state.openAIConfigured||state.diaryBusy;
  $('diary-summarize').title=!state.openAIConfigured?'Configure OPENAI_API_KEY on the server to enable summaries.':'Analyze all recorded changes for the selected day';
  if($('diary-period').value!=='custom'){const range=diaryRange($('diary-period').value,events);$('diary-start').value=range.start;$('diary-end').value=range.end}
  const from=$('diary-start').value,to=$('diary-end').value,valid=from&&to&&from<=to,rangeEvents=valid?eventsInRange(events,from,to):[];
  $('diary-range-status').textContent=valid?`${from} – ${to} · ${rangeEvents.length} recorded changes`:'Choose a valid start and end date.';
  $('diary-story').disabled=!valid||!rangeEvents.length||!state.openAIConfigured||state.diaryBusy;
  $('diary-story').title=state.openAIConfigured?'Summarize all recorded changes in this period':'Configure OPENAI_API_KEY to enable storylines.';
  $('diary-summary').innerHTML=state.diarySummary||'';
}
async function summarizeSelectedDay(story=false){
  story=story===true;
  const day=$('diary-date').value,start=$('diary-start').value,end=$('diary-end').value,events=story?eventsInRange(scopedDiary(),start,end):diaryEntries(scopedDiary(),null,day);if((!story&&!day)||!events.length)return;
  const label=story?`${start} – ${end}`:day;
  state.diaryBusy=true;state.diarySummary='<p>Analyzing the selected day…</p>';renderDiary();
  try{
    const response=await fetch('/api/project-diary/summary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({day:story?undefined:day,start:story?start:undefined,end:story?end:undefined,events,project:diaryProject(),onboarding:story&&$('diary-period').value==='onboarding'})});const result=await readApiResponse(response);
    state.diarySummary=`<section class="diary-summary-card"><h2>${story?'Project storyline':'Biggest decisions'} · ${escapeHtml(label)}</h2>${result.storyline?`<p>${escapeHtml(result.storyline)}</p>`:''}<ol>${result.decisions.map(item=>`<li><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.significance)}</p><small>Recorded events: ${item.eventIds.map(escapeHtml).join(', ')}</small></li>`).join('')}</ol><small>AI summary of ${events.length} recorded changes · ${escapeHtml(result.model)}. Review against the diary below.</small></section>`;
  }catch(error){state.diarySummary=`<p role="alert">${escapeHtml(error.message)}</p>`}
  finally{state.diaryBusy=false;renderDiary()}
}
