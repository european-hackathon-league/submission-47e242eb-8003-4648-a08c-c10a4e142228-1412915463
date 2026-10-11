const DOMAIN_RULES = [
  ['Interior & Comfort', /seat|comfort|lumbar|climat|blower|acoustic|noise|audio|sound|belt|mirror|console|storage|interior|cabin|cupholder|ambient|spatial|roominess|wellbeing|air conditioning|sun protection|glove box|headrest|armrest|floor mat|grab handle/i],
  ['Exterior & Utility', /exterior|roof|trunk|tailgate|door|headlight|taillight|paint|wheel|tire|luggage|cargo|compartment|fold|body equipment|window|windshield|wiper|frunk|welcome light|access and exit|filler flap|socket cover/i],
  ['Digital Experience & Controls', /digital|app|bluetooth|carplay|android|connected|remote|mobile|phone|operat|control|touch|display|cluster|parking|automatic-hold|speed limit|button|owner's manual|camera|infotainment|idrive|navigation|wifi|hotspot|esim|usb|radio|personal assistant|activation word|voice|speech|driver profile|vehicle key|lock \/ unlock|surround view|all-round view|drive recorder|back-up assistant|emergency request|instrument panel/i]
];

const OUTCOME_RULES = [
  ['Seating comfort', /seat|lumbar|belt/i], ['Cabin climate', /climat|blower|heating|ventilation/i],
  ['Cabin refinement', /acoustic|noise|audio|sound|interior design|comfort/i], ['Storage usability', /console|storage|cupholder|compartment/i],
  ['Cargo access', /trunk|tailgate|luggage|cargo|fold/i], ['Exterior expression', /exterior|paint|wheel|roof/i],
  ['Visibility & lighting', /light|mirror|camera|visibility/i], ['Connected access', /digital key|app|mobile|phone|bluetooth/i],
  ['Infotainment usability', /carplay|android|infotainment|idrive|touch|display|operating system|navigation/i],
  ['Parking confidence', /parking|park distance|camera/i], ['Driver controls', /control|button|cluster|speed limit|owner's manual|automatic-hold/i],
  ['Ride & handling', /handling|riding|chassis|steer|suspension|stability/i], ['Powertrain performance', /drivetrain|transmission|engine|range|charging|battery|efficiency/i],
  ['Braking confidence', /brake|pedal/i]
];

// Departments a PM can route a feasibility question to. Order matters for suggestions:
// more specific owners are checked first; Product Integration is the cross-domain fallback.
export const DEPARTMENTS = [
  { name:'Driver Assistance & Automated Driving', rule:/assist|cruise control|lane|collision|blind spot|cross traffic|fatigue|surround view|all-round view|parking|back-up|high-beam|automated|rear view camera|impression of safety/i,
    focus:'the sensor, software and homologation implications' },
  { name:'E-Mobility Engineering', rule:/electric|high.voltage|(?<!wireless )charging|charge|battery|\brange\b|recuperation|regenerat|wallbox|preconditioning/i,
    focus:'the high-voltage, charging-hardware and range implications' },
  { name:'Powertrain Engineering', rule:/drivetrain|transmission|engine|start-stop|\(msa\)|4wd|awd|fuel|exhaust/i,
    focus:'the drivetrain hardware and calibration effort, and any effect on efficiency targets' },
  { name:'Chassis & Vehicle Dynamics', rule:/handling|riding|chassis|suspension|damping|cushioning|stability|brak|ground clearance|tire|^steering$|driving dynamics/i,
    focus:'the chassis tuning, component changes and validation effort' },
  { name:'Software & Connected Services', rule:/\bapps?\b|digital|bluetooth|carplay|android|connected|remote|operating|controller|instrument panel|owner's manual|display|touch|navigation|infotainment|idrive|traffic|rtti|my modes|driver profile|voice|speech|personal assistant|wifi|hotspot|esim|radio|camera|update|usb/i,
    focus:'the software effort, release timing and backend dependencies' },
  { name:'Electrical/Electronic Engineering', rule:/exterior lighting|headlight|taillight|light carpet|wireless charging|vehicle key|lock \/ unlock|comfort access|anti-theft|alarm|socket|wiper|vehicle battery/i,
    focus:'the wiring, control-unit and electrical-architecture implications' },
  { name:'Interior Engineering', rule:/seat|comfort|lumbar|climat|air conditioning|blower|console|storage|belt|audio|sound|acoustic|interior|ambient|cabin|armrest|headrest|glove box|steering wheel|cupholder|sun protection|floor mat|spatial/i,
    focus:'the packaging, material and supplier implications' },
  { name:'Body Engineering', rule:/exterior|body|roof|trunk|tailgate|door|luggage|cargo|compartment|frunk|window|windshield|mirror|paint|bumper|space|access and exit/i,
    focus:'the body-structure, tooling and design-freeze implications' },
  { name:'Product Integration', rule:null,
    focus:'which domain should own this and the cross-domain integration effort' },
  { name:'Manufacturing & Quality', rule:/squeak|rattle|fault|reliab|quality|fit and finish/i,
    focus:'the production-process, quality-target and tooling implications' },
  { name:'Purchasing & Cost Controlling', rule:null,
    focus:'the cost, sourcing and supplier implications' },
  { name:'Product Marketing & Sales', rule:/value for money|price|pricing|brand|dealer/i,
    focus:'the market positioning, pricing and launch-communication implications' }
];
const FALLBACK_DEPARTMENT='Product Integration';
// Source labels sometimes contain non-breaking spaces; match on normalised text.
const normalizeLabel=value=>String(value).replace(/\s+/g,' ').trim();
const departmentByName=name=>DEPARTMENTS.find(department=>department.name===name);

// All departments, best match for this feature first.
export function departmentOptions(feature) {
  const matches=DEPARTMENTS.filter(department=>department.rule?.test(normalizeLabel(feature)));
  const suggested=matches[0]?.name||FALLBACK_DEPARTMENT;
  return [departmentByName(suggested),...DEPARTMENTS.filter(department=>department.name!==suggested)].map(department=>({name:department.name,focus:department.focus,suggested:department.name===suggested,matches:matches.includes(department)}));
}

const SIGNALS = {
  strong: { label: 'Strong customer signal', tone: 'strong' },
  solid: { label: 'Solid customer signal', tone: 'solid' },
  limited: { label: 'Limited customer signal', tone: 'limited' },
  weak: { label: 'Weak customer signal', tone: 'weak' },
  market: { label: 'Market evidence only', tone: 'weak' }
};
export function signalFor(frequency, confidence) {
  if (!frequency) return 'market';
  if (confidence === 'low' || frequency < 10) return 'weak';
  if (frequency < 25) return 'limited';
  if (frequency < 100 || confidence !== 'high') return 'solid';
  return 'strong';
}
const plural = (n, word, many = `${word}s`) => `${n.toLocaleString()} ${n === 1 ? word : many}`;
const listJoin = items => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
const DRIVER_LABELS = { demand: 'customer demand', timeline: 'fitting the timeline', market: 'market and competitor evidence' };

// Short, readable reasons derived only from the requirement's own numbers.
export function explainRequirement(r, config, previous, next) {
  const signalKey = signalFor(r.frequency, r.confidence), signal = { key: signalKey, ...SIGNALS[signalKey] };
  const parts = r.scoreParts, studies = r.citations.filter(c => c.sourceType === 'market_study').length;
  const competitors = r.citations.filter(c => /competitor|industry/.test(c.sourceType || '')).length;
  const web = r.citations.filter(c => c.sourceType === 'external_web').length;
  const pmMarket = r.citations.filter(c => c.sourceType === 'pm_market_data').length, pmTrends = r.citations.filter(c => c.sourceType === 'pm_global_trend').length;
  const exists = [];
  exists.push(r.frequency ? `${plural(r.frequency, 'customer')} raised this (duplicates and low-quality feedback removed)${r.uploadedFeedback ? `, ${r.uploadedFeedback} of them from your uploads` : ''}` : 'No direct customer feedback; based on market evidence only');
  const market = [studies && plural(studies, 'customer-study measure'), competitors && plural(competitors, 'competitor signal'), web && plural(web, 'web source'), pmMarket && `${plural(pmMarket, 'row')} of your market data`, pmTrends && plural(pmTrends, 'global trend', 'global trends') + ' you added'].filter(Boolean);
  exists.push(market.length ? `Also backed by ${listJoin(market)}` : 'No customer-study or competitor evidence attached');
  if (['not-feasible', 'pm-rejected'].includes(r.status)) {
    return { signal, exists, rank: ['Rejected: kept visible for traceability', 'No longer competes in the active ranking'], caveat: '' };
  }
  const rank = [];
  rank.push(r.estimatedMonths <= config.months
    ? `Fits the ${config.months}-month target (about ${r.estimatedMonths} months of work)`
    : `Needs about ${r.estimatedMonths} months, longer than the ${config.months}-month target`);
  const [driver] = Object.entries({ demand: parts.demand, timeline: parts.timeline, market: parts.market }).sort((a, b) => b[1] - a[1]);
  rank.push(`Biggest driver of its score: ${DRIVER_LABELS[driver[0]]}`);
  if (parts.memory) rank.push(`+${parts.memory} points from a similar past decision in Decision Memory`);
  if (previous) rank.push(previous.score === r.score
    ? `Tied on score with “${previous.feature}” (${r.score}), which more customers raised`
    : `Below “${previous.feature}” (${previous.score}), which scores higher`);
  else if (next) rank.push(`Highest score in this domain, ahead of “${next.feature}” (${next.score})`);
  let caveat = '';
  if (signalKey === 'weak' || signalKey === 'limited' || signalKey === 'market') {
    const reason = r.frequency ? `Only ${plural(r.frequency, 'customer')} raised this` : 'No customer raised this directly';
    const rest = [parts.timeline && `timeline fit (${parts.timeline})`, parts.market && `market evidence (${parts.market})`, parts.memory && `past decisions (${parts.memory})`].filter(Boolean);
    caveat = parts.demand < r.score / 4
      ? `${reason}. Just ${parts.demand} of its ${r.score} points ${parts.demand === 1 ? 'comes' : 'come'} from customer demand; the rest is ${listJoin(rest)}. Validate demand before committing.`
      : `${reason}. Validate demand before committing.`;
  }
  return { signal, exists, rank, caveat };
}

export const groupFor = feature => DOMAIN_RULES.find(([,rule]) => rule.test(String(feature).replace(/\s+/g,' ')))?.[0] || 'Driving & Powertrain';
export const outcomeFor = feature => OUTCOME_RULES.find(([,rule]) => rule.test(feature))?.[0] || `Improve ${feature}`;

export function entityFor(feature) {
  const matches=DEPARTMENTS.filter(department=>department.rule?.test(normalizeLabel(feature)));
  const name=matches[0]?.name||FALLBACK_DEPARTMENT;
  return { name, alternative:matches[1]?.name||(name===FALLBACK_DEPARTMENT?'Manufacturing & Quality':FALLBACK_DEPARTMENT), confidence:matches.length===1?'high':matches.length?'medium':'low', reason:matches.length?`“${feature}” is typically owned by ${name}.`:`No single owner is obvious for “${feature}”, so it starts with ${FALLBACK_DEPARTMENT}.` };
}

const monthsFor = feature => /app|software|display|touch|operating|bluetooth|carplay|manual/i.test(feature)?6:/seat|console|storage|mirror|belt|audio|climat|control|camera/i.test(feature)?12:/chassis|suspension|body|roof|luggage|battery|drivetrain/i.test(feature)?24:15;
const INVALID_FEATURE=/^(no_class_found|other|none|n\/a|unknown)?$/i;
const EUROPEAN_MARKETS=new Set(['GB','DE','FR','IT','ES','AT','BE','NL','CH']);
const FEATURE_REQUIREMENTS=[
  [/digital key/i,'Ensure Digital Key access is reliable and presents clear recovery guidance when unlocking or starting fails.'],
  [/my modes/i,'Make each My Mode’s effect on the driving experience clear before and after activation.'],
  [/engine start-stop|\(msa\)/i,'Make automatic engine start-stop behavior predictable and give the driver clear status and override feedback.'],
  [/braking/i,'Provide progressive, predictable braking response across low-speed and normal-road driving.'],
  [/space \/ spatial impression/i,'Preserve an open cabin impression while keeping passenger space practical and unobstructed.'],
  [/driver profile/i,'Apply the correct driver profile reliably and make profile switching immediately visible.'],
  [/impression of safety/i,'Strengthen occupants’ sense of safety through clear vehicle-state and assistance feedback.'],
  [/lane departure warning/i,'Issue timely lane-departure warnings without nuisance intervention and clearly show when the system is active.'],
  [/transmission/i,'Deliver smooth, well-timed gear changes and clearly communicate the selected drive state.'],
  [/automatic.?hold/i,'Keep Automatic Hold behavior consistent at every stop and clearly show whether it is active.'],
  [/parking brake/i,'Make parking-brake engagement and release states immediately clear to the driver.'],
  [/remote controlled parking/i,'Guide drivers through Remote Controlled Parking with clear handoffs between the vehicle and My BMW App.'],
  [/touch screen|operating concept|operating system/i,'Keep frequently used vehicle controls discoverable within one clear interaction path.'],
  [/owner.?s manual/i,'Make core vehicle functions understandable without requiring drivers to search the Owner’s Manual.'],
  [/electric range/i,'Provide a stable, trustworthy remaining-range estimate across normal driving conditions.'],
  [/real time traffic|rtti/i,'Keep route guidance updated with timely traffic, signal, and road-condition information.'],
  [/drive recorder/i,'Make Drive Recorder status, capture controls, and saved footage immediately accessible.'],
  [/ambient light/i,'Preserve customizable ambient lighting with consistent brightness and scene controls.'],
  [/wheels? \/ tires?/i,'Make tire status, operating limitations, and required driver actions clear throughout normal use.'],
  [/door, finisher panel, front/i,'Improve the fit, finish, and everyday usability of the front door finisher panel.'],
  [/rsc tire/i,'Make run-flat tire status and post-puncture driving guidance clear to the driver.'],
  [/trunk light/i,'Illuminate the full luggage area without leaving loading zones or corners obscured.'],
  [/headlight.*taillight design/i,'Create a distinctive, coherent front and rear lighting signature that remains recognizably BMW.'],
  [/non-contact trunk/i,'Make hands-free trunk opening reliable and provide immediate confirmation when the gesture is detected.'],
  [/^exterior$/i,'Resolve documented exterior-quality concerns while preserving the intended BMW design character.'],
  [/head-?up display/i,'Keep Head-Up Display content readable, correctly positioned, and easy to configure.'],
  [/smartphone integration|connectivity/i,'Keep smartphone pairing, wireless projection, and reconnection reliable, with a clear recovery path when a connection fails.'],
  [/parking assistance/i,'Provide low-speed parking assistance with a clear surrounding view, unambiguous obstacle warnings, and immediate control hand-back.'],
  [/audio system/i,'Deliver clear, balanced in-cabin audio with controls that make source, volume, and sound-profile changes immediately understandable.'],
  [/driver assistance/i,'Make driver-assistance availability, intervention, and control hand-back unambiguous in every supported driving state.'],
  [/exterior lighting/i,'Provide reliable exterior illumination and a distinctive lighting signature without obscuring system status or required driver action.'],
  [/ownership support/i,'Provide clear warranty coverage and ownership support terms at the point where the customer needs service or recovery assistance.'],
  [/connecteddrive.*infotainment/i,'Make ConnectedDrive and infotainment services reliable, responsive, and easy to navigate.'],
  [/navigation/i,'Provide clear route guidance with responsive destination search and current traffic information.'],
  [/(active).*cruise|cruise control/i,'Make cruise-control activation, target speed, and intervention state unambiguous to the driver.'],
  [/wireless charging/i,'Keep a compatible phone securely positioned and charging reliably throughout the journey.'],
  [/gesture control/i,'Recognize supported gestures consistently and confirm each accepted command immediately.'],
  [/pair mobile|bluetooth/i,'Reduce Bluetooth pairing and reconnection to a clear, recoverable interaction flow.'],
  [/rear view camera/i,'Provide a clear, timely rear-camera view with dependable guidance during every reversing maneuver.'],
  [/voice control|speech recognition/i,'Recognize natural driver commands reliably and offer a clear recovery path after misunderstood speech.'],
  [/audio mode|sound/i,'Make audio modes and sound settings easy to understand, adjust, and verify.'],
  [/center console/i,'Organize the front center console so storage and controls are easy to reach and use.'],
  [/interior acoustics/i,'Limit intrusive road, wind, and drivetrain noise while preserving clear in-cabin audio.'],
  [/seat belts/i,'Make seat-belt access, fastening, and status feedback comfortable and immediately clear.'],
  [/blower function/i,'Deliver the selected airflow quickly and make blower level and direction easy to verify.'],
  [/seating, ventilate|seat.*heat/i,'Deliver even seat heating and ventilation with clear, responsive level controls.'],
  [/cupholders/i,'Secure common drink sizes without obstructing adjacent controls or storage.'],
  [/panorama.*roof|panoramic.*roof/i,'Provide a clearly controlled panoramic-roof opening experience that matches customer expectations.'],
  [/seat/i,'Provide supportive seat comfort and intuitive adjustment throughout long-distance driving.'],
  [/handling|riding/i,'Maintain precise handling while isolating occupants from disruptive road impacts.'],
  [/drivetrain/i,'Deliver smooth and predictable drivetrain response during acceleration and low-speed driving.'],
  [/exterior design|exterior styling/i,'Strengthen the vehicle’s exterior character while retaining a recognizably BMW appearance.'],
  [/interior design/i,'Create a coherent premium interior through clear layout, material quality, and visual consistency.'],
  [/interior comfort/i,'Maintain a quiet, temperature-stable cabin during everyday and long-distance driving.'],
  [/body equipment/i,'Make body-equipment functions reliable and their operating states immediately understandable.'],
  [/luggage|cargo|trunk/i,'Make the luggage area easy to access, load, and use without avoidable obstruction.']
];

const cleanTokens=value=>String(value||'').toLowerCase().replace(/overall|technology|appearance|customer|vehicle|bmw|series|design|system/g,' ').match(/[a-z]{4,}/g)||[];
const studyMarket=market=>EUROPEAN_MARKETS.has(market)?'EU':market;
const studyApplies=(study,market)=>String(study.sheet||'').toUpperCase().split(/[_-]/).includes(studyMarket(market));
const isStudyTopic=study=>{const cells=study.cells||{},keys=Object.keys(cells);return keys.length===1&&keys[0]==='A'&&String(cells.A||'').length>3&&!/sample|base|total|mean|median|standard|percent/i.test(cells.A)};
const topicMatches=(topic,feature)=>{const a=new Set(cleanTokens(topic)),b=cleanTokens(feature),pair=`${topic} ${feature}`;return b.some(token=>a.has(token))||(/exterior/i.test(topic)&&/exterior|wheel|tire|door|roof/i.test(feature))||(/interior/i.test(topic)&&/interior|seat|comfort|cabin/i.test(feature))||(/seat/i.test(topic)&&/seat/i.test(feature))||(/light/i.test(topic)&&/light/i.test(feature))||(/park/i.test(topic)&&/park/i.test(feature))||(/audio|sound/i.test(topic)&&/audio|sound/i.test(feature))||(/climat|ventilat/i.test(topic)&&/climat|blower|ventilat/i.test(feature))||(/connect|smartphone|infotainment|operat|display/i.test(topic)&&/connect|mobile|bluetooth|infotainment|operat|touch|display/i.test(feature))||(/powertrain|drivetrain|transmission|engine/i.test(topic)&&/powertrain|drivetrain|transmission|engine/i.test(feature))||(/steer|handling|suspension/i.test(topic)&&/steer|handling|suspension|riding/i.test(feature))||(/driver assistance|collision|lane|cruise/i.test(topic)&&/driver assistance|collision|lane|cruise/i.test(feature))||(/cargo|trunk|luggage/i.test(topic)&&/cargo|trunk|luggage/i.test(feature))||(/wheel|tire/i.test(pair)&&/wheel|tire/i.test(topic)&&/wheel|tire/i.test(feature));};
const COMPETITOR_TARGETS=[
  [/^powertrain performance$/i,/^drivetrain$/i], [/^steering and handling$/i,/handling.*riding/i], [/^driver assistance$/i,/active.*cruise control/i],
  [/^operating system \/ infotainment$/i,/connecteddrive.*infotainment/i], [/^smartphone integration/i,/pair mobile|bluetooth/i], [/^parking assistance$/i,/remote controlled parking/i],
  [/^seating comfort$/i,/^seats$|seating, ventilate/i], [/^cabin climate$/i,/interior comfort/i], [/^panoramic roof$/i,/panorama.*roof/i],
  [/^exterior lighting$/i,/headlight.*taillight/i], [/^electric range and charging$/i,/^electric range$/i], [/^cargo access$/i,/cargo capacity|non-contact trunk/i],
  [/^audio system$/i,/audio mode/i], [/^wheels \/ tires$/i,/^wheels? \/ tires?$/i], [/^braking$/i,/^braking$/i], [/^head-up display$/i,/^head-up display$/i], [/^digital key$/i,/^digital key$/i]
];
const competitorFeatureMatch=(topic,candidates)=>candidates.find(candidate=>candidate.toLowerCase()===topic.toLowerCase())||candidates.find(candidate=>COMPETITOR_TARGETS.some(([source,target])=>source.test(topic)&&target.test(candidate)))||candidates.find(candidate=>topicMatches(topic,candidate))||topic;

function requirementStatement(feature,records,marketOnly=false){
  const curated=FEATURE_REQUIREMENTS.find(([rule])=>rule.test(feature));if(curated)return curated[1];
  const types=new Set(records.map(r=>r.feedbackType));
  if(marketOnly)return `Improve customer-rated ${feature.toLowerCase()} performance in the selected market.`;
  if([...types].some(t=>/Difficult/i.test(t)))return `Make ${feature.toLowerCase()} behavior consistent and its controls easy to identify during normal use.`;
  if([...types].some(t=>/Want/i.test(t)))return `Provide the requested ${feature.toLowerCase()} capability through a clear, direct customer interaction.`;
  return `Preserve the documented strengths of ${feature.toLowerCase()} throughout the next product cycle.`;
}

function marketInputs(context,config,feedbackFeatures){
  const topics=(context?.studies||[]).filter(row=>studyApplies(row,config.market)&&isStudyTopic(row));
  const salesMarket=EUROPEAN_MARKETS.has(config.market)?'EU':config.market;
  const sales=(context?.sales||[]).find(row=>String(row.vehicle).split('_').includes(config.vehicle)&&row.market===salesMarket);
  const assigned=new Map(feedbackFeatures.map(feature=>[feature,[]])),unmatched=[];
  for(const topic of topics){const feature=feedbackFeatures.find(candidate=>topicMatches(topic.cells.A,candidate));if(feature)assigned.get(feature).push(topic);else unmatched.push(topic)}
  return {assigned,unmatched:unmatched.slice(0,24),sales};
}

// Unique customers, with PM-uploaded rows scaled by their weight (5 = same as BMW data).
const weightedCount=records=>[...new Map(records.map(r=>[r.feedbackId,r])).values()].reduce((sum,r)=>sum+(r.weight??1),0);

export function buildModel(records,config,statuses={},context={},overrides={}) {
  const relevant=records.filter(r=>r.vehicle===config.vehicle&&r.market===config.market&&r.quality!=='low'&&r.feature&&!INVALID_FEATURE.test(r.feature));
  const byFeature=new Map();
  for(const record of relevant){if(!byFeature.has(record.feature))byFeature.set(record.feature,{feedback:[],studies:[],external:[],competitors:[]});byFeature.get(record.feature).feedback.push(record)}
  const intelligence=marketInputs(context,config,[...byFeature.keys()]);
  for(const [feature,studies] of intelligence.assigned)byFeature.get(feature).studies.push(...studies);
  for(const study of intelligence.unmatched){const feature=String(study.cells.A).trim();if(!byFeature.has(feature))byFeature.set(feature,{feedback:[],studies:[study],external:[],competitors:[]})}
  for(const signal of context?.external||[]){if(signal.vehicle!==config.vehicle||signal.market!==config.market||!signal.feature)continue;if(!byFeature.has(signal.feature))byFeature.set(signal.feature,{feedback:[],studies:[],external:[],competitors:[]});byFeature.get(signal.feature).external.push(signal)}
  for(const signal of context?.competitors||[]){if(signal.vehicle!==config.vehicle||signal.market!==config.market||!signal.feature)continue;const feature=competitorFeatureMatch(signal.feature,[...byFeature.keys()]);if(!byFeature.has(feature))byFeature.set(feature,{feedback:[],studies:[],external:[],competitors:[]});byFeature.get(feature).competitors.push(signal)}
  for(const signal of context?.uploads||[]){if(signal.vehicle!==config.vehicle||signal.market!==config.market||!signal.feature)continue;if(!byFeature.has(signal.feature))byFeature.set(signal.feature,{feedback:[],studies:[],external:[],competitors:[]});const bucket=byFeature.get(signal.feature);(bucket.uploads||=[]).push(signal)}
  const maxFrequency=Math.max(1,...[...byFeature.values()].map(bucket=>weightedCount(bucket.feedback)));
  const requirements=[...byFeature].map(([feature,bucket])=>{
    const unique=[...new Map(bucket.feedback.map(item=>[item.feedbackId,item])).values()].sort((a,b)=>Number(Boolean(b.uploaded))-Number(Boolean(a.uploaded))),studies=bucket.studies,external=bucket.external||[],competitors=bucket.competitors||[],uploads=bucket.uploads||[],uploadedFeedback=unique.filter(r=>r.uploaded).length;
    const months=monthsFor(feature),peopleNeeded=Math.max(2,Math.ceil(months/3));
    const frequencyScore=Math.round(weightedCount(unique)/maxFrequency*100),marketScore=Math.min(100,(studies.length?45+Math.min(20,studies.length*5):0)+Math.min(35,competitors.length*7)+Math.min(20,external.length*10)+Math.min(30,Math.round(uploads.reduce((sum,u)=>sum+u.weight*8,0)))+(intelligence.sales?10:0));
    const fitScore=Math.round(Math.min(100,(config.months*Math.max(1,config.people)/(months*peopleNeeded))*70));
    const importance=Number(config.importance)/10,historicalBonus=config.historyBonus?.[feature]??(config.historyFeatures?.includes(feature)?5:0);
    const scoreParts={demand:Math.round(frequencyScore*(.60-importance*.20)),timeline:Math.round(fitScore*(.25+importance*.20)),market:Math.round(marketScore*.15),memory:historicalBonus};
    let score=Math.min(100,Math.round(frequencyScore*(.60-importance*.20)+fitScore*(.25+importance*.20)+marketScore*.15+historicalBonus));
    if(statuses[feature]==='deleted')score=-1;
    if(['not-feasible','pm-rejected'].includes(statuses[feature]))score=0;
    if(statuses[feature]==='conditional'||statuses[feature]==='approved-conditional')score-=12;
    const qualityCounts=unique.reduce((out,row)=>(out[row.quality]=(out[row.quality]||0)+1,out),{});
    const feedbackCitations=unique.slice(0,8).map(r=>({evidenceId:r.evidenceId,file:r.sourceFile,sheet:r.sheet,row:r.row,column:'Customer Feedback / Feature classification',excerpt:r.text,feedbackId:r.feedbackId,sourceType:'customer_feedback',uploaded:Boolean(r.uploaded)}));
    const uploadCitations=uploads.map(u=>({evidenceId:u.evidenceId,file:u.sourceFile,sheet:'PM upload',row:u.row,column:u.sourceType==='pm_market_data'?'PM market data':'PM global trend',excerpt:u.text,feedbackId:u.evidenceId,sourceType:u.sourceType,url:/^https?:\/\//i.test(u.source)?u.source:'',note:u.source,uploaded:true}));
    const studyCitations=studies.slice(0,4).map(row=>({evidenceId:row.evidenceId,file:row.sourceFile,sheet:row.sheet,row:row.row,column:'Market study measure',excerpt:String(row.cells.A),feedbackId:row.evidenceId,sourceType:'market_study'}));
    const competitorCitations=competitors.map(signal=>({evidenceId:signal.evidenceId,file:signal.sourceFile,sheet:signal.sheet,row:signal.row,column:`Competitor signal · ${signal.classificationBasis}`,excerpt:signal.rationale,feedbackId:signal.evidenceId,sourceType:signal.sourceType||'competitor_intelligence',url:signal.sourceUrl||''}));
    const externalCitations=external.flatMap(signal=>signal.sourceUrls.slice(0,4).map(url=>({evidenceId:signal.evidenceId,file:url,sheet:'External web intelligence',row:'live',column:'Cited market signal',excerpt:signal.rationale,feedbackId:signal.evidenceId,sourceType:'external_web',url})));
    const salesCitation=intelligence.sales?{evidenceId:intelligence.sales.evidenceId,file:intelligence.sales.sourceFile,sheet:intelligence.sales.sheet,row:intelligence.sales.row,column:'2025 / 2030 sales volume',excerpt:`${intelligence.sales.marketName}: ${Number(intelligence.sales.volume2025).toLocaleString()} vehicles in 2025 and ${Number(intelligence.sales.volume2030).toLocaleString()} projected for 2030.`,feedbackId:intelligence.sales.evidenceId,sourceType:'sales_volume'}:null;
    const marketSummary=`${studies.length} relevant customer-study measure${studies.length===1?'':'s'}, ${competitors.length} row-traceable competitor signal${competitors.length===1?'':'s'}, and ${externalCitations.length} current cited web-market signal${externalCitations.length===1?'':'s'}${intelligence.sales?` plus ${intelligence.sales.marketName} sales planning (${Number(intelligence.sales.volume2025).toLocaleString()} in 2025; ${Number(intelligence.sales.volume2030).toLocaleString()} projected for 2030)`:''}`;
    return {
      id:`req-${feature.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}`,feature,group:groupFor(feature),outcome:outcomeFor(feature),
      statement:overrides[feature]||external[0]?.statement||requirementStatement(feature,bucket.feedback,!unique.length),problem:`Evidence identifies ${feature.toLowerCase()} as a product-cycle priority for ${config.vehicle} in ${config.market}.`,
      frequency:unique.length,uploadedFeedback,uploadedSignals:uploads.length,evidenceCount:unique.length+studies.length+competitors.length+externalCitations.length+uploads.length+(salesCitation?1:0),marketEvidenceCount:studies.length+competitors.length+externalCitations.length+uploads.length+(salesCitation?1:0),score,scoreParts,scoreBreakdown:{frequency:frequencyScore,marketIntelligence:marketScore,timeToMarketFit:fitScore,deadlineImportance:Number(config.importance),historicalDecisionBonus:historicalBonus},
      estimatedMonths:months,estimatedPeople:peopleNeeded,fitScore,status:statuses[feature]||'not-checked',owner:entityFor(feature),
      confidence:unique.length+studies.length+competitors.length+externalCitations.length+uploads.length>=10?'high':unique.length+studies.length+competitors.length+externalCitations.length+uploads.length>=3?'medium':'low',evidenceQuality:qualityCounts,
      citations:[...feedbackCitations,...studyCitations,...competitorCitations,...externalCitations,...uploadCitations,...(salesCitation?[salesCitation]:[])],
      whyExists:`${unique.length} unique, relevant feedback record${unique.length===1?'':'s'} and ${marketSummary} support this requirement. Low-quality and duplicate feedback does not contribute to the count.`,
      rankBasis:`Feedback frequency: ${unique.length} (${frequencyScore}/100 normalized). Market intelligence: ${marketScore}/100. Planning estimate: ${months} months with about ${peopleNeeded} people. Against the PM’s ${config.months}-month target, ${config.people}-person team and ${config.importance}/10 deadline importance, time-to-market fit is ${fitScore}/100.${historicalBonus?` Relevant demo-cycle memory adds ${historicalBonus} points.`:''}`
    };
  }).filter(r=>r.citations.length&&r.score>=0);

  const groups=new Map();for(const requirement of requirements){if(!groups.has(requirement.group))groups.set(requirement.group,[]);groups.get(requirement.group).push(requirement)}
  return [...groups].map(([name,items])=>{
    const sorted=items.sort((a,b)=>b.score-a.score||b.frequency-a.frequency);
    const rejected=sorted.filter(item=>['not-feasible','pm-rejected'].includes(item.status));
    const active=sorted.filter(item=>!['not-feasible','pm-rejected'].includes(item.status));
    const selected=[...active.slice(0,Math.max(0,10-rejected.length)),...rejected.slice(0,10)].slice(0,10);
    const ranked=selected.map((r,index)=>{
      if(['not-feasible','pm-rejected'].includes(r.status))return {...r,rank:index+1,explanation:explainRequirement(r,config),whyRanked:`This requirement remains visible for decision traceability after rejection. It no longer competes in the active priority ranking and has a score of 0/100. ${r.rankBasis}`};
      const above=index?` It ranks below “${selected[index-1].feature}” (${selected[index-1].score}) because its combined evidence and schedule score is lower.`:'';
      const below=index<selected.length-1?` It ranks above “${selected[index+1].feature}” (${selected[index+1].score}) because its combined score is higher.`:'';
      return {...r,rank:index+1,explanation:explainRequirement(r,config,selected[index-1],selected[index+1]),whyRanked:`${r.rankBasis} Final score: ${r.score}/100.${above}${below}`};
    });
    return {name,description:`BMW domain containing evidence-backed outcomes such as ${[...new Set(ranked.map(r=>r.outcome))].slice(0,4).join(', ')}. The PM can rename, split, or merge this group.`,evidenceSummary:`${ranked.reduce((sum,r)=>sum+r.evidenceCount,0)} cited feedback and market-intelligence links across ${ranked.length} ranked requirements.`,requirements:ranked};
  }).filter(g=>g.requirements.length).sort((a,b)=>b.requirements[0].score-a.requirements[0].score);
}

export function validateCitations(groups,evidence,context={}){const ids=new Set([...evidence,...(context.studies||[]),...(context.sales||[]),...(context.competitors||[]),...(context.external||[]),...(context.uploads||[])].map(r=>r.evidenceId));return groups.flatMap(g=>g.requirements).every(r=>r.citations.length&&r.citations.every(c=>ids.has(c.evidenceId)))}

export function draftEmail(r,c,department=r.owner.name){const focus=departmentByName(department)?.focus||'the feasibility, effort and timing implications';return `Subject: Feasibility review — ${r.feature}\n\nHello ${department} team,\n\nFor the ${c.vehicle} in ${c.market}, we are evaluating this requirement:\n“${r.statement}”\n\nWhy it exists: ${r.whyExists}\nEvidence: ${r.evidenceCount} cited records; ${r.citations[0].file}, ${r.citations[0].sheet}, row ${r.citations[0].row} (plus ${Math.max(0,r.citations.length-1)} additional citations).\n\nPlanning context: ${c.months}-month target, ${c.people} people, deadline importance ${c.importance}/10. The ${r.estimatedMonths}-month estimate shown in PM is a planning estimate, not a feasibility conclusion.\n\nFrom your side, we especially need to understand ${focus}.\n\nCould you confirm whether this requirement is feasible, feasible with conditions, or not feasible? Please identify constraints, timing implications, and any recommended wording changes.\n\nThank you.`}

export function gmailComposeUrl(recipient,draft){
  const lines=String(draft||'').split(/\r?\n/),first=lines[0]||'';
  const subject=first.replace(/^Subject:\s*/i,'').trim();
  const body=(/^Subject:/i.test(first)?lines.slice(1):lines).join('\n').replace(/^\n+/,'');
  const params=new URLSearchParams({view:'cm',fs:'1',to:String(recipient||'').trim(),su:subject,body});
  return `https://mail.google.com/mail/?${params.toString()}`;
}
