import { buildModel, draftEmail, gmailComposeUrl, validateCitations } from './engine.js';

const state = { evidence: [], context: null, historical: [], groups: [], selected: 0, config: null, statuses: JSON.parse(localStorage.getItem('requirement-statuses') || '{}'), overrides: JSON.parse(localStorage.getItem('requirement-overrides') || '{}'), events: JSON.parse(localStorage.getItem('decision-events') || '[]'), activeRequirement: null, openAIConfigured:false, marketInsights:null };
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const statusKey = feature => `${state.config.vehicle}|${state.config.market}|${feature}`;
const statusMap = () => Object.fromEntries(Object.entries(state.statuses).filter(([key]) => key.startsWith(`${state.config.vehicle}|${state.config.market}|`)).map(([key,value]) => [key.split('|').slice(2).join('|'),value==='awaiting'?'not-checked':value]));
const overrideMap = () => Object.fromEntries(Object.entries(state.overrides).filter(([key]) => key.startsWith(`${state.config.vehicle}|${state.config.market}|`)).map(([key,value]) => [key.split('|').slice(2).join('|'),value]));

async function init() {
  initOrbitSweepGradient();
  $('importance').addEventListener('input', e => $('importance-output').value = `${e.target.value} / 10`);
  $('vehicle').addEventListener('change', populateMarkets);
  $('config-form').addEventListener('submit', event => { event.preventDefault(); if (state.evidence.length) generate(); });
  $('edit-config').addEventListener('click', () => { $('setup').classList.remove('hidden'); $('workspace').classList.add('hidden'); });
  $('rename-group').addEventListener('click', renameGroup);
  $('recalibrate-group').addEventListener('click', () => recalibrateGroup(state.groups[state.selected]?.name, 'PM requested a fresh ranking'));
  $('split-group').addEventListener('click', splitGroup);
  $('merge-group').addEventListener('click', mergeGroup);
  document.querySelectorAll('.nav').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('[data-report]').forEach(b=>b.addEventListener('click',()=>downloadReport(b.dataset.report)));
  $('memory-search').addEventListener('input',e=>renderMemory(e.target.value));
  $('generate-market-insights').addEventListener('click',generateMarketInsights);
  await loadDecisionEvents();
  renderMemory();
  await checkOpenAIStatus();
  const [response,contextResponse,historyResponse] = await Promise.all([fetch('../data/evidence.json'),fetch('../data/context.json'),fetch('../data/historical-decisions.json')]);
  if (!response.ok || !contextResponse.ok || !historyResponse.ok) throw new Error(`Evidence stores failed to load. Start PM with “node server.mjs” from the repository root.`);
  const [payload,context,history] = await Promise.all([response.json(),contextResponse.json(),historyResponse.json()]);
  state.evidence = payload.records;
  state.context = context;
  state.historical = history.decisions.map(decision=>({id:decision.id,type:'historical-decision',title:decision.requirement,description:`${decision.productCycle} · ${decision.decisionStatus}. ${decision.pmReasoning}`,data:decision,actor:'Prior-cycle PM',at:decision.timestamp,provenance:decision.provenance}));
  renderMemory();
  populateMarkets();
  $('generate-button').disabled = false;
  $('generate-button').innerHTML = '<span class="shiny-label">Generate evidence-backed requirements <span class="shiny-arrow" aria-hidden="true">→</span></span>';
  if(!$('market').classList.contains('hidden'))renderMarketView();
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
    if(status.apiVersion!=='pm-api-2')throw new Error('An outdated PM server is running. Stop it and restart “node server.mjs”.');
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
  try{const response=await fetch('/api/decision-events'),payload=await readApiResponse(response);const known=new Set(state.events.map(event=>event.id));state.events.push(...payload.events.filter(event=>!known.has(event.id)))}catch{}
}

function addEvent(type, title, description, data={},actor='PM') {
  const event={ id: crypto.randomUUID(), type, title, description, data, actor, at: new Date().toISOString(), provenance:'Append-only application event' };
  state.events.unshift(event);
  localStorage.setItem('decision-events', JSON.stringify(state.events));
  fetch('/api/decision-events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event)}).catch(()=>{});
  renderMemory();
}

function generate(event) {
  event?.preventDefault();
  state.config = { vehicle:$('vehicle').value, market:$('market').value, months:Number($('months').value), people:Number($('people').value), importance:Number($('importance').value) };
  const historicalEvidenceIds=state.historical.filter(event=>event.data.vehicle===state.config.vehicle&&event.data.market===state.config.market).flatMap(event=>event.data.supportingEvidence||[]);
  state.config.historyFeatures=[...new Set(historicalEvidenceIds.map(id=>state.evidence.find(record=>record.evidenceId===id)?.feature).filter(Boolean))];
  state.groups = buildModel(state.evidence, state.config, statusMap(), state.context, overrideMap());
  state.selected = 0;
  addEvent('project-created', 'Product context evaluated', `${state.config.vehicle} · ${state.config.market} · ${state.config.months} months · ${state.config.people} people · deadline importance ${state.config.importance}/10`, state.config);
  addEvent('ranking-calculated', 'Requirements generated and ranked', `${state.groups.length} groups created from customer feedback, market studies, sales intelligence, and PM delivery constraints.`,{groups:state.groups.map(group=>({name:group.name,requirements:group.requirements.map(requirement=>({id:requirement.id,statement:requirement.statement,rank:requirement.rank,score:requirement.score,citations:requirement.citations.map(citation=>citation.evidenceId)}))}))});
  showView('workspace');
  render();
}

function showView(view) {
  ['setup','workspace','memory','market'].forEach(id=>$(id).classList.add('hidden'));
  if(view==='memory'){$('memory').classList.remove('hidden');setTimeout(()=>$('memory-search').focus(),0)}
  else if(view==='market'){$('market').classList.remove('hidden');renderMarketView()}
  else if(state.config){$('workspace').classList.remove('hidden')}
  else{$('setup').classList.remove('hidden')}
  document.querySelectorAll('.nav').forEach(n => n.classList.toggle('active', n.dataset.view === view));
}

function render() {
  const c=state.config, group=state.groups[state.selected];
  $('project-title').textContent = `${c.vehicle} requirement strategy · ${c.market}`;
  $('context-chips').innerHTML = `<div class="context-metric"><small>Time to market</small><strong>${c.months}<span> months</span></strong></div><div class="context-metric"><small>Team</small><strong>${c.people}<span> people</span></strong></div><div class="context-metric"><small>Deadline</small><strong>${c.importance}<span>/10</span></strong></div>`;
  const relevant=state.evidence.filter(r=>r.vehicle===c.vehicle&&r.market===c.market), low=relevant.filter(r=>r.quality==='low').length;
  const sources=state.context?.manifest?.length||0,marketCitations=state.groups.flatMap(item=>item.requirements).flatMap(requirement=>requirement.citations).filter(citation=>citation.sourceType!=='customer_feedback'),studySignals=new Set(marketCitations.filter(citation=>citation.sourceType==='market_study').map(citation=>citation.evidenceId)).size,salesSignals=new Set(marketCitations.filter(citation=>citation.sourceType==='sales_volume').map(citation=>citation.evidenceId)).size;
  $('integrity').innerHTML = `<span class="status-dot"></span><strong>Citations verified</strong><span>${relevant.length.toLocaleString()} contextual feedback rows</span><span>${low.toLocaleString()} low-quality excluded</span><span>${studySignals} market-study signals used</span><span>${salesSignals} sales plans used</span><span>${sources} source files</span><span>Frequency deduplicated</span>`;
  $('group-list').innerHTML = state.groups.map((g,i)=>`<button class="group-button ${i===state.selected?'active':''}" data-group="${i}"><strong>${escapeHtml(g.name)}</strong><span>${g.requirements.length} supported requirement${g.requirements.length===1?'':'s'}</span></button>`).join('');
  document.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{state.selected=Number(b.dataset.group);render()});
  if (!group) { $('group-title').textContent='No supported groups'; $('group-description').textContent='Try another vehicle or market.'; $('requirements').innerHTML=''; return; }
  const linkedEvidence=group.requirements.reduce((sum,r)=>sum+r.evidenceCount,0),marketLinks=group.requirements.reduce((sum,r)=>sum+r.marketEvidenceCount,0),outcomeCount=new Set(group.requirements.map(r=>r.outcome)).size;
  $('group-title').textContent=group.name; $('group-description').innerHTML=`<div><small>Outcome clusters</small><strong>${outcomeCount}</strong></div><div><small>Cited evidence</small><strong>${linkedEvidence}</strong></div><div><small>Market-intelligence links</small><strong>${marketLinks}</strong></div>`; $('req-count').textContent=group.requirements.length;
  $('requirements').innerHTML=group.requirements.map(r=>{const approved=['approved','approved-conditional'].includes(r.status),statusBadge=['not-checked','awaiting'].includes(r.status)?'':`<span class="badge ${r.status}">${r.status.replaceAll('-',' ')}</span>`;return `<article class="requirement"><div class="rank"><span>${r.rank}</span></div><div class="requirement-main"><span class="outcome">${escapeHtml(r.outcome)}</span><h3>${escapeHtml(r.statement)}</h3><div class="meta"><span><strong>${r.evidenceCount}</strong> cited records</span><span><strong>${r.marketEvidenceCount}</strong> market signals</span><span>TTM <strong>${r.fitScore}/100</strong></span><span>${escapeHtml(r.owner.name)}</span>${statusBadge}</div><details class="card-reasoning"><summary>Why this exists · Why this rank</summary><p>${escapeHtml(r.whyExists)}</p><p>${escapeHtml(r.whyRanked)}</p></details></div><div class="actions"><button class="evidence-link" data-detail="${r.id}">Evidence & reasoning</button><button class="primary-card-action" data-validate="${r.id}">Check feasibility</button>${approved?`<button class="approval-state" disabled>✓ Approved</button>`:`<button class="decision-action approve-action" data-approve="${r.id}">Approve</button>`}<button class="decision-action reject-action" data-reject="${r.id}">Reject</button><button class="icon-action" data-delete="${r.id}" title="Delete requirement" aria-label="Delete requirement">×</button><button class="icon-action" data-up="${r.id}" title="Move up" aria-label="Move requirement up">↑</button><button class="icon-action" data-down="${r.id}" title="Move down" aria-label="Move requirement down">↓</button><button class="move-action" data-move="${r.id}">Move</button></div></article>`}).join('');
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
  $('detail-content').innerHTML=`<div class="dialog-body"><p class="eyebrow">RANK #${r.rank} · ${escapeHtml(r.group)} · ${escapeHtml(r.outcome)}</p><h2>${escapeHtml(r.statement)}</h2><div class="edit-requirement"><textarea id="requirement-edit">${escapeHtml(r.statement)}</textarea><button id="save-requirement" class="secondary">Save edited wording</button></div><div class="evidence-box"><h3>WHY THIS REQUIREMENT EXISTS</h3><p>${escapeHtml(r.problem)}</p><p>${escapeHtml(r.whyExists)}</p><p><strong>Evidence confidence:</strong> ${escapeHtml(r.confidence)} · feedback quality ${Object.entries(r.evidenceQuality).map(([key,value])=>`${key}: ${value}`).join(', ')||'market-intelligence requirement'}</p></div><div class="evidence-box"><h3>WHY THIS REQUIREMENT HAS THIS RANK</h3><p>${escapeHtml(r.whyRanked)}</p></div><h3>Verifiable source evidence</h3>${r.citations.map(c=>`<div class="citation"><a href="/sources/${encodeURIComponent(c.file)}" target="_blank" rel="noopener"><code>${escapeHtml(c.file)} › ${escapeHtml(c.sheet)} › row ${c.row} · ${escapeHtml(c.column)}</code></a><p>${escapeHtml(c.excerpt)}</p></div>`).join('')}<div class="decision-box ${intent?'decision-intent':''}"><h3>Decision note · saved to Decision Memory</h3><p class="decision-help">${escapeHtml(decisionPrompt)} This records your reasoning; it is not asking another PM for approval.</p><textarea id="pm-rationale" placeholder="Write a short decision note..."></textarea><div class="decision-actions"><button id="record-rationale" class="secondary">🎙 Dictate note</button><button id="delete-requirement" class="secondary ${intent==='delete'?'intent-action':''}">Delete</button><button id="reject-requirement" class="secondary ${intent==='reject'?'intent-action':''}">Reject & recalibrate group</button><button id="approve-requirement" class="primary ${intent==='approve'?'intent-action':''}">${r.status==='conditional'?'Approve with conditions':'Approve requirement'} <span>→</span></button></div></div></div>`;
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
  const rationale=$('pm-rationale').value.trim()||`PM ${status.startsWith('approved')?'approved':status==='deleted'?'deleted':'rejected'} this requirement directly.`;
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
  const rebuilt=buildModel(state.evidence,state.config,statusMap(),state.context,overrideMap());
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

function openValidationLegacy(r){
  state.activeRequirement=r;
  const contacts=JSON.parse(localStorage.getItem('stakeholder-contacts')||'{}'),recipient=contacts[r.owner.name]||'';
  const aiSetup=state.openAIConfigured?'':`<div class="api-setup"><strong>OpenAI processing is not configured</strong><p>Restart the PM server from PowerShell with:</p><code>$env:OPENAI_API_KEY="your-key"<br>node server.mjs</code><p>Then refresh this page. The key remains on the server and is never stored in the browser.</p></div>`;
  $('validation-content').innerHTML=`<div class="dialog-body"><p class="eyebrow">STAKEHOLDER VALIDATION · NOT AUTOMATICALLY SENT</p><h2>${escapeHtml(r.statement)}</h2><label class="owner-field"><strong>Responsible department · PM editable</strong><input id="owner-edit" value="${escapeHtml(r.owner.name)}"><small>${escapeHtml(r.owner.confidence)}-confidence routing suggestion. Alternative: ${escapeHtml(r.owner.alternative)}. ${escapeHtml(r.owner.reason)}</small></label><div class="validation-grid"><div><h3>Editable draft email</h3><textarea id="email-draft">${escapeHtml(draftEmail(r,state.config))}</textarea><div class="gmail-actions"><label><span>Relevant stakeholder email</span><input id="stakeholder-email" type="email" placeholder="name@bmwgroup.com" value="${escapeHtml(recipient)}"></label><a id="gmail-draft" class="primary gmail-link" target="_blank" rel="noopener">Open draft in Gmail <span>↗</span></a></div></div><div><h3>Paste or transcribe engineering response</h3><textarea id="stakeholder-response" placeholder="Paste the received response here. Nothing changes until you confirm the interpretation."></textarea>${aiSetup}<div class="feedback-actions"><button id="transcribe-response" class="secondary">🎙 Transcribe response</button><button id="interpret" class="primary confirm" ${state.openAIConfigured?'':'disabled'}>${state.openAIConfigured?'Process Feedback & Recalibrate':'OpenAI key required'}</button></div><div id="interpretation"></div></div></div></div>`;
  $('validation-dialog').showModal();
  const syncGmail=()=>{$('gmail-draft').href=gmailComposeUrl($('stakeholder-email').value,$('email-draft').value)};
  syncGmail();$('email-draft').oninput=syncGmail;$('stakeholder-email').oninput=syncGmail;
  $('stakeholder-email').onchange=()=>{const email=$('stakeholder-email').value.trim();if(email){contacts[$('owner-edit').value.trim()||r.owner.name]=email;localStorage.setItem('stakeholder-contacts',JSON.stringify(contacts))}};
  $('owner-edit').onchange=()=>{const owner=$('owner-edit').value.trim();if(owner&&owner!==r.owner.name){const before=r.owner.name;r.owner.name=owner;$('stakeholder-email').value=contacts[owner]||'';syncGmail();addEvent('responsible-entity-corrected','PM corrected requirement ownership',`${r.feature}: ${before} → ${owner}`)}};
  $('transcribe-response').onclick=()=>transcribeResponse();
  if(state.openAIConfigured)$('interpret').onclick=()=>interpretStakeholderResponse(r);
  addEvent('validation-draft-opened','Feasibility draft prepared',`${r.feature} routed to ${r.owner.name}; email remains unsent.`,{requirementId:r.id,responsibleEntity:r.owner.name},'PM');
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
  const contacts=JSON.parse(localStorage.getItem('stakeholder-contacts')||'{}'),recipient=contacts[r.owner.name]||'';
  const aiSetup=state.openAIConfigured?'':`<div class="api-setup"><strong>OpenAI tools are not configured</strong><p>The default draft and Gmail link still work. To create an email from notes or interpret a reply, restart the PM server from PowerShell with:</p><code>$env:OPENAI_API_KEY="your-key"<br>node server.mjs</code><p>Refresh this page afterward. The key remains server-side.</p></div>`;
  $('validation-content').innerHTML=`<div class="dialog-body"><p class="eyebrow">STAKEHOLDER VALIDATION · NOT AUTOMATICALLY SENT</p><h2>${escapeHtml(r.statement)}</h2><label class="owner-field"><strong>Responsible department · PM editable</strong><input id="owner-edit" value="${escapeHtml(r.owner.name)}"><small>${escapeHtml(r.owner.confidence)}-confidence routing suggestion. Alternative: ${escapeHtml(r.owner.alternative)}. ${escapeHtml(r.owner.reason)}</small></label><div class="validation-grid"><div><h3>Editable draft email</h3><textarea id="email-draft">${escapeHtml(draftEmail(r,state.config))}</textarea><div class="email-composer"><label><strong>Rough email notes · optional</strong><textarea id="email-notes" placeholder="Type or dictate the points you want added to the email. The default draft above remains available."></textarea></label><div class="email-compose-actions"><button id="transcribe-email-notes" class="secondary">🎙 Transcribe notes</button><button id="create-email" class="primary" ${state.openAIConfigured?'':'disabled'}>${state.openAIConfigured?'Create email from notes':'OpenAI key required'}</button></div><div id="email-generation-status"></div></div><div class="gmail-actions"><label><span>Relevant stakeholder email</span><input id="stakeholder-email" type="email" placeholder="name@bmwgroup.com" value="${escapeHtml(recipient)}"></label><a id="gmail-draft" class="primary gmail-link" target="_blank" rel="noopener">Open draft in Gmail <span>↗</span></a></div></div><div><h3>Paste engineering response</h3><p class="decision-help">Paste the reply exactly as received. OpenAI proposes an interpretation; nothing changes until you confirm it.</p><textarea id="stakeholder-response" placeholder="Paste the engineering response here."></textarea>${aiSetup}<div class="feedback-actions"><button id="interpret" class="primary confirm" ${state.openAIConfigured?'':'disabled'}>${state.openAIConfigured?'Process feedback & recalibrate':'OpenAI key required'}</button></div><div id="interpretation"></div></div></div></div>`;
  $('validation-dialog').showModal();
  const syncGmail=()=>{$('gmail-draft').href=gmailComposeUrl($('stakeholder-email').value,$('email-draft').value)};
  syncGmail();$('email-draft').oninput=syncGmail;$('stakeholder-email').oninput=syncGmail;
  $('stakeholder-email').onchange=()=>{const email=$('stakeholder-email').value.trim();if(email){contacts[$('owner-edit').value.trim()||r.owner.name]=email;localStorage.setItem('stakeholder-contacts',JSON.stringify(contacts))}};
  $('owner-edit').onchange=()=>{const owner=$('owner-edit').value.trim();if(owner&&owner!==r.owner.name){const before=r.owner.name;r.owner.name=owner;$('stakeholder-email').value=contacts[owner]||'';syncGmail();addEvent('responsible-entity-corrected','PM corrected requirement ownership',`${r.feature}: ${before} → ${owner}`)}};
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
    $('interpretation').innerHTML=`<div class="evidence-box"><h3>OPENAI INTERPRETATION · YOUR CONFIRMATION REQUIRED</h3><p>Status: <strong>${escapeHtml(result.status.replaceAll('-',' '))}</strong> · ${Math.round(result.confidence*100)}% confidence</p><p>${escapeHtml(result.summary)}</p>${detail}<p class="model-trace">Model: ${escapeHtml(result.model)} · Response: ${escapeHtml(result.responseId||'not returned')}</p>${approvable?'<label class="approval-rationale"><strong>Decision note · saved to Decision Memory</strong><textarea id="approval-rationale" placeholder="Why are you approving this requirement?"></textarea></label>':''}<div class="interpret-actions"><button id="confirm-response" class="secondary" ${result.status==='unclear'?'disabled':''}>${result.status==='unclear'?'Clarification required':result.status==='not-feasible'?'Confirm rejection & recalibrate group':'Confirm feasibility only'}</button>${approvable?'<button id="confirm-approve" class="primary">Approve requirement <span>→</span></button>':''}</div></div>`;
    if(approvable)$('approval-rationale').placeholder='Optional decision note…';
    if(result.status!=='unclear')$('confirm-response').onclick=()=>confirmResponse(r,result);
    if(approvable)$('confirm-approve').onclick=()=>{const rationale=$('approval-rationale').value.trim()||'PM approved this requirement after reviewing the interpreted engineering response.';confirmResponse(r,result,{approve:true,rationale})};
  }catch(error){$('interpretation').innerHTML=`<div class="api-error"><strong>OpenAI interpretation failed.</strong><br>${escapeHtml(error.message)}</div>`}
  finally{button.disabled=false;button.textContent='Process Feedback & Recalibrate'}
}

function confirmResponse(r,result,{approve=false,rationale=''}={}){
  if(result.status==='unclear'){alert('The response is unclear. Ask the stakeholder for a feasibility conclusion before confirming.');return}
  const before=state.groups.map(g=>({group:g.name,requirements:g.requirements.map(x=>({feature:x.feature,rank:x.rank,score:x.score,status:x.status}))}));
  const finalStatus=approve?(result.status==='conditional'?'approved-conditional':'approved'):result.status;
  state.statuses[statusKey(r.feature)]=finalStatus;
  localStorage.setItem('requirement-statuses',JSON.stringify(state.statuses));
  recalibrateGroup(r.group,result.status==='not-feasible'?`Stakeholder rejection confirmed: ${r.feature}`:`Stakeholder feasibility updated: ${r.feature}`,result.status==='not-feasible'?r.feature:'');
  const after=state.groups.map(g=>({group:g.name,requirements:g.requirements.map(x=>({feature:x.feature,rank:x.rank,score:x.score,status:x.status}))}));
  addEvent('interpretation-confirmed',`PM confirmed: ${result.status.replaceAll('-',' ')}`,`${r.feature}. Stakeholder response: ${result.summary}`,{before,after,model:result.model,responseId:result.responseId,confidence:result.confidence,stakeholderResponse:result.stakeholderResponse,supportingQuotes:result.supporting_quotes,conditions:result.conditions,constraints:result.constraints,timeImpact:result.time_impact,suggestedModification:result.suggested_modification},'Engineering response · OpenAI interpretation · PM confirmation');
  addEvent('requirements-recalculated','Affected group ranking recalculated','The previous group ranking remains preserved in this event. No requirement was silently replaced.',{before,after});
  if(approve)addEvent(finalStatus==='approved-conditional'?'requirement-approved-with-conditions':'requirement-approved',finalStatus==='approved-conditional'?'Requirement approved with conditions':'Requirement approved',`${r.feature}: ${rationale}`,{requirementId:r.id,citations:r.citations.map(c=>c.evidenceId),humanDecision:true});
  $('validation-dialog').close();render();
  if(!approve&&['feasible','conditional'].includes(result.status)){
    const updated=state.groups.flatMap(g=>g.requirements).find(item=>item.feature===r.feature);
    if(updated)setTimeout(()=>openDetail(updated),0);
  }
}

function marketContext(){
  return state.config||{vehicle:$('vehicle').value,market:$('market').value,months:Number($('months').value),importance:Number($('importance').value)};
}

const intelligenceMarket=market=>['GB','DE'].includes(market)?'EU':market;
const studyAppliesToMarket=(row,market)=>String(row.sheet||'').toUpperCase().split(/[_-]/).includes(intelligenceMarket(market));
const isStudyMeasure=row=>{const keys=Object.keys(row.cells||{});return keys.length===1&&keys[0]==='A'&&String(row.cells.A||'').length>3&&!/sample|base|total|mean|median|standard|percent/i.test(row.cells.A)};
const sourceHref=file=>`/sources/${encodeURIComponent(file)}`;

function internalMarketSnapshot(context){
  const relevantFeedback=state.evidence.filter(row=>row.vehicle===context.vehicle&&row.market===context.market&&row.quality!=='low');
  const uniqueFeedback=[...new Map(relevantFeedback.map(row=>[row.feedbackId,row])).values()];
  const studies=(state.context?.studies||[]).filter(row=>studyAppliesToMarket(row,context.market)&&isStudyMeasure(row));
  const sales=(state.context?.sales||[]).find(row=>String(row.vehicle||'').split('_').includes(context.vehicle)&&row.market===intelligenceMarket(context.market));
  const byFeature=new Map();
  for(const row of uniqueFeedback){
    if(!row.feature)continue;
    if(!byFeature.has(row.feature))byFeature.set(row.feature,[]);
    byFeature.get(row.feature).push(row);
  }
  const themes=[...byFeature].sort((a,b)=>b[1].length-a[1].length).slice(0,6);
  return {uniqueFeedback,studies,sales,themes};
}

function renderInternalMarketSnapshot(context){
  const {uniqueFeedback,studies,sales,themes}=internalMarketSnapshot(context);
  const studyItems=studies.slice(0,8).map(row=>`<li><span>${escapeHtml(row.cells.A)}</span><a href="${sourceHref(row.sourceFile)}" target="_blank" rel="noopener">${escapeHtml(row.sourceFile)} · ${escapeHtml(row.sheet)} · row ${row.row}</a></li>`).join('');
  const themeItems=themes.map(([feature,rows])=>{const row=rows[0];return `<li><span><strong>${escapeHtml(feature)}</strong><em>${rows.length} unique feedback record${rows.length===1?'':'s'}</em></span><a href="${sourceHref(row.sourceFile)}" target="_blank" rel="noopener">${escapeHtml(row.sourceFile)} · ${escapeHtml(row.sheet)} · row ${row.row}</a></li>`}).join('');
  const salesDelta=sales&&Number(sales.volume2025)?Math.round((Number(sales.volume2030)-Number(sales.volume2025))/Number(sales.volume2025)*100):null;
  const salesValue=sales?`${Number(sales.volume2025).toLocaleString()} → ${Number(sales.volume2030).toLocaleString()}`:'No matching plan';
  const salesDetail=sales?`2025 to 2030 planned volume${salesDelta===null?'':` · ${salesDelta>=0?'+':''}${salesDelta}%`}`:'No vehicle-and-market sales row was found.';
  const salesCitation=sales?`<a href="${sourceHref(sales.sourceFile)}" target="_blank" rel="noopener">${escapeHtml(sales.sourceFile)} · ${escapeHtml(sales.sheet)} · row ${sales.row}</a>`:'<span class="market-no-source">No citation available</span>';
  return `<section class="internal-market" aria-label="Ingested market evidence">
    <div class="market-section-title"><div><p class="eyebrow">INGESTED MARKET EVIDENCE</p><h2>Current evidence snapshot</h2></div><span>Available without OpenAI</span></div>
    <div class="market-kpis">
      <article><small>Customer feedback</small><strong>${uniqueFeedback.length.toLocaleString()}</strong><p>Unique, relevant records for this vehicle and market</p></article>
      <article><small>Study measures</small><strong>${studies.length.toLocaleString()}</strong><p>Market-matched customer-study topics</p></article>
      <article><small>Sales plan</small><strong>${salesValue}</strong><p>${escapeHtml(salesDetail)}</p>${salesCitation}</article>
    </div>
    <div class="market-evidence-grid">
      <article><h3>Most frequent customer themes</h3><p>Deduplicated feedback signals already used in requirement generation.</p>${themeItems?`<ol>${themeItems}</ol>`:'<div class="market-no-data">No contextual customer-feedback records were found.</div>'}</article>
      <article><h3>Customer-study signals</h3><p>Market-matched measures available to requirement ranking, each linked to its exact source location.</p>${studyItems?`<ol>${studyItems}</ol>`:'<div class="market-no-data">No customer-study measures matched this market.</div>'}</article>
    </div>
  </section>`;
}

function renderCitedReport(report,citations){
  const usable=[...(citations||[])].filter(c=>Number.isInteger(c.startIndex)&&Number.isInteger(c.endIndex)&&c.startIndex>=0&&c.endIndex>c.startIndex&&c.endIndex<=report.length&&/^https?:\/\//i.test(c.url)).sort((a,b)=>a.startIndex-b.startIndex);
  let html='',cursor=0;
  for(const citation of usable){if(citation.startIndex<cursor)continue;html+=escapeHtml(report.slice(cursor,citation.startIndex));html+=`<a class="inline-citation" href="${escapeHtml(citation.url)}" target="_blank" rel="noopener">${escapeHtml(report.slice(citation.startIndex,citation.endIndex)||citation.title)}</a>`;cursor=citation.endIndex}
  html+=escapeHtml(report.slice(cursor));return html.replace(/\n/g,'<br>');
}

function renderMarketView(){
  const context=marketContext(),marketNames={US:'United States',GB:'United Kingdom',DE:'Germany',CN:'China'};
  $('market-context').textContent=`${context.vehicle} · ${marketNames[context.market]||context.market} · ingested evidence and current external research`;
  const button=$('generate-market-insights');button.disabled=!state.openAIConfigured;button.innerHTML=state.openAIConfigured?'Research current market <span>→</span>':'OpenAI key required';
  $('market-status').innerHTML=state.openAIConfigured?'<span class="status-dot"></span><strong>Internal evidence ready.</strong> Live web research is configured and will be shown separately with URL citations.':'<span class="status-dot status-dot-muted"></span><strong>Internal evidence ready.</strong> Add OPENAI_API_KEY on the PM server to enable cited competitor web research.';
  if(!state.context){$('market-results').innerHTML='<div class="market-loading"><span></span><h2>Loading market evidence</h2><p>The ingested customer studies and sales plans are being prepared.</p></div>';return}
  const internalSnapshot=renderInternalMarketSnapshot(context);
  const matchesContext=state.marketInsights?.context?.vehicle===context.vehicle&&state.marketInsights?.context?.market===context.market;
  if(!matchesContext){$('market-results').innerHTML=internalSnapshot+`<section class="external-market-empty"><div><p class="eyebrow">LIVE EXTERNAL RESEARCH</p><h2>No external report for this context yet</h2><p>${state.openAIConfigured?'Run current-market research to add competitor analysis and cited web signals.':'The internal market evidence above remains available. Configure the server API key when live competitor research is needed.'}</p></div></section>`;return}
  const insight=state.marketInsights,uniqueSources=[...new Map(insight.citations.map(source=>[source.url,source])).values()];
  $('market-results').innerHTML=internalSnapshot+`<article class="market-report"><div class="market-report-meta"><span>Live web intelligence</span><span>${new Date(insight.researchedAt).toLocaleString()}</span><span>${escapeHtml(insight.model)}</span><span>${(insight.candidates||[]).length} requirement candidates applied</span></div><div class="market-report-copy">${renderCitedReport(insight.report,insight.citations)}</div><div class="market-sources"><h2>Verified web sources</h2>${uniqueSources.map((source,index)=>`<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener"><span>${String(index+1).padStart(2,'0')}</span><strong>${escapeHtml(source.title)}</strong><small>${escapeHtml(new URL(source.url).hostname)}</small></a>`).join('')}</div></article>`;
}

async function generateMarketInsights(){
  if(!state.openAIConfigured)return;
  const button=$('generate-market-insights'),context=marketContext();button.disabled=true;button.textContent='Researching the current market…';
  $('market-results').innerHTML='<div class="market-loading"><span></span><h2>Searching current competitor and market sources</h2><p>Claims without verifiable URL citations will not be accepted.</p></div>';
  try{
    const response=await fetch('/api/market-intelligence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(context)});
    state.marketInsights=await readApiResponse(response);state.marketInsights.context={...context};
    state.context={...(state.context||{}),external:(state.marketInsights.candidates||[])};
    if(state.config?.vehicle===context.vehicle&&state.config?.market===context.market){state.groups=buildModel(state.evidence,state.config,statusMap(),state.context,overrideMap());state.selected=Math.min(state.selected,Math.max(0,state.groups.length-1));render()}
    renderMarketView();
    addEvent('market-intelligence-researched','External market intelligence refreshed',`${context.vehicle} · ${context.market}: ${state.marketInsights.citations.length} cited web references produced ${(state.marketInsights.candidates||[]).length} grounded requirement candidates and recalibrated the matching product cycle.`,{vehicle:context.vehicle,market:context.market,model:state.marketInsights.model,responseId:state.marketInsights.responseId,extractionResponseId:state.marketInsights.extractionResponseId,candidates:state.marketInsights.candidates,citations:state.marketInsights.citations.map(c=>({title:c.title,url:c.url}))},'PM · OpenAI web search');
  }catch(error){$('market-results').innerHTML=renderInternalMarketSnapshot(context)+`<div class="api-error market-error"><strong>Live market research failed.</strong><br>${escapeHtml(error.message)}<br><small>The ingested market evidence above is still available.</small></div>`}
  finally{button.disabled=false;button.innerHTML='Research current market <span>→</span>'}
}

function renderMemory(query=$('memory-search')?.value||''){
  const all=[...state.events,...state.historical].sort((a,b)=>new Date(b.at)-new Date(a.at)),needle=query.trim().toLowerCase();
  const events=needle?all.filter(event=>JSON.stringify(event).toLowerCase().includes(needle)):all;
  $('event-count').textContent=all.length;
  $('timeline').innerHTML=events.length?events.map(e=>{const audit=e.data&&(e.data.before||e.data.after||e.data.groups||e.data.model||e.data.citations||e.type==='historical-decision')?`<details><summary>Inspect before / after and source data</summary><pre>${escapeHtml(JSON.stringify(e.data,null,2))}</pre></details>`:'';return `<div class="event"><time>${new Date(e.at).toLocaleString()}</time><div class="event-dot"></div><article><p class="eyebrow">${escapeHtml(e.type.replaceAll('-',' '))} · ${escapeHtml(e.actor||'Historical record')}</p><h3>${escapeHtml(e.title)}</h3><p>${escapeHtml(e.description)}</p>${audit}</article></div>`}).join(''):`<p>${needle?'No decision-memory events match this search.':'No decisions recorded yet. Generate a product cycle to begin the audit trail.'}</p>`;
}

function downloadReport(kind){
  if(!state.config||!state.groups.length){alert('Generate a product cycle before exporting a report.');return}
  const all=state.groups.flatMap(group=>group.requirements.map(requirement=>({...requirement,group:group.name}))),approved=all.filter(r=>['approved','approved-conditional'].includes(r.status));
  const header=`PM · ${kind.toUpperCase()} REPORT\n${state.config.vehicle} · ${state.config.market}\nTarget: ${state.config.months} months · ${state.config.people} people · deadline importance ${state.config.importance}/10\nGenerated: ${new Date().toISOString()}\n\n`;
  let body;
  if(kind==='technical')body=approved.length?approved.map(r=>`${r.group} / ${r.feature}\nRequirement: ${r.statement}\nResponsible entity: ${r.owner.name}\nDecision status: ${r.status}\nEvidence: ${r.citations.map(c=>`${c.file}, ${c.sheet}, row ${c.row}`).join('; ')}\n`).join('\n'):'No requirements have received PM approval.';
  else if(kind==='gtm')body=approved.length?approved.map(r=>`${r.outcome}: ${r.statement}\nSupported by ${r.evidenceCount} cited feedback and market-intelligence records for ${state.config.market}.\n`).join('\n'):'No approved requirements are available for GTM reporting.';
  else body=state.groups.map(g=>`${g.name}\n${g.requirements.map(r=>`#${r.rank} [${r.status}] ${r.statement} — score ${r.score}, ${r.evidenceCount} cited records`).join('\n')}`).join('\n\n')+`\n\nDECISION EVENTS\n${state.events.map(e=>`${e.at} · ${e.actor||'PM'} · ${e.type} · ${e.title}: ${e.description}`).join('\n')}`;
  const blob=new Blob([header+body],{type:'text/plain'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=`PM-${kind}-${state.config.vehicle}-${state.config.market}.txt`;anchor.click();URL.revokeObjectURL(url);
  addEvent('report-generated',`${kind.toUpperCase()} report generated`,`${approved.length} approved requirements included.`);
}
init().catch(error=>{document.body.innerHTML=`<main class="memory"><h1>Unable to load evidence</h1><p>${escapeHtml(error.message)}</p></main>`});
