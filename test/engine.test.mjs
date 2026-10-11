import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildModel, gmailComposeUrl, validateCitations } from '../src/engine.mjs';
import { buildModel as buildBrowserModel } from '../public/engine.js';

const evidence = [
  { evidenceId:'a', feedbackId:'same', vehicle:'G60', market:'US', quality:'high', feature:'Digital Key', feedbackType:'Difficult to Use', sourceFile:'x.xlsx', sheet:'Feedback_Explorer', row:2, text:'fails' },
  { evidenceId:'b', feedbackId:'same', vehicle:'G60', market:'US', quality:'high', feature:'Digital Key', feedbackType:'Difficult to Use', sourceFile:'x.xlsx', sheet:'Feedback_Explorer', row:3, text:'fails' },
  { evidenceId:'c', feedbackId:'other', vehicle:'G60', market:'US', quality:'high', feature:'Digital Key', feedbackType:'Wants', sourceFile:'x.xlsx', sheet:'Feedback_Explorer', row:4, text:'reliable access' }
];

test('deduplicates frequency and preserves resolvable citations', () => {
  const groups = buildModel(evidence, { vehicle:'G60', market:'US', months:12, people:8, importance:8 });
  assert.equal(groups[0].requirements[0].frequency, 2);
  assert.equal(validateCitations(groups, evidence), true);
});

test('time-to-market importance changes ranking scores', () => {
  const loose = buildModel(evidence, { vehicle:'G60', market:'US', months:2, people:1, importance:1 });
  const strict = buildModel(evidence, { vehicle:'G60', market:'US', months:2, people:1, importance:10 });
  assert.notEqual(loose[0].requirements[0].score, strict[0].requirements[0].score);
});

test('limits each group to ten requirements', () => {
  const many = Array.from({length:14}, (_, i) => ({...evidence[0], evidenceId:`e${i}`, feedbackId:`f${i}`, feature:`App feature ${i}`}));
  assert.equal(buildModel(many, { vehicle:'G60', market:'US', months:12, people:8, importance:8 })[0].requirements.length, 10);
});

test('browser and tested engines produce the same ranking', () => {
  const config = { vehicle:'G60', market:'US', months:12, people:8, importance:8 };
  assert.deepEqual(buildBrowserModel(evidence, config), buildModel(evidence, config));
});

test('filters requirements and citations to the exact vehicle and market', () => {
  const mixed = [
    ...evidence,
    {...evidence[0], evidenceId:'gb', feedbackId:'gb', market:'GB'},
    {...evidence[0], evidenceId:'g70', feedbackId:'g70', vehicle:'G70'}
  ];
  const groups = buildModel(mixed, { vehicle:'G60', market:'US', months:12, people:8, importance:8 });
  const citationIds = groups.flatMap(g => g.requirements).flatMap(r => r.citations.map(c => c.evidenceId));
  assert.equal(citationIds.includes('gb'), false);
  assert.equal(citationIds.includes('g70'), false);
});

test('uses at most four coherent BMW vehicle-domain groups', () => {
  const features = ['Seats', 'Exterior design', 'Digital Key', 'Drivetrain'];
  const mixed = features.map((feature, i) => ({...evidence[0], evidenceId:`domain-${i}`, feedbackId:`domain-${i}`, feature}));
  const groups = buildModel(mixed, { vehicle:'G60', market:'US', months:12, people:8, importance:8 });
  assert.deepEqual(new Set(groups.map(g => g.name)), new Set(['Interior & Comfort','Exterior & Utility','Digital Experience & Controls','Driving & Powertrain']));
});

test('preserves approval and retains PM-rejected requirements for traceability', () => {
  const config = { vehicle:'G60', market:'US', months:12, people:8, importance:8 };
  const approved = buildModel(evidence, config, {'Digital Key':'approved'});
  assert.equal(approved.flatMap(g => g.requirements)[0].status, 'approved');
  const rejected = buildModel(evidence, config, {'Digital Key':'pm-rejected'});
  assert.equal(rejected.flatMap(g => g.requirements)[0].status, 'pm-rejected');
  assert.equal(rejected.flatMap(g => g.requirements)[0].score, 0);
});

test('exposes complete evidence, ranking, and ownership metadata without generated dependencies', () => {
  const richer = [
    {...evidence[0], evidenceId:'parking', feedbackId:'parking', feature:'Remote controlled parking'},
    {...evidence[0], evidenceId:'camera', feedbackId:'camera', feature:'Rear view camera'}
  ];
  const groups=buildModel(richer,{vehicle:'G60',market:'US',months:12,people:8,importance:8});
  for(const requirement of groups.flatMap(group=>group.requirements)){
    assert.ok(requirement.problem);
    assert.ok(requirement.whyExists);
    assert.ok(requirement.whyRanked);
    assert.ok(requirement.owner.name);
    assert.ok(requirement.owner.alternative);
    assert.ok(requirement.scoreBreakdown);
    assert.ok(requirement.citations.every(c=>c.file&&c.sheet&&c.row&&c.column));
    assert.equal('dependencies' in requirement,false);
  }
});

test('uses market studies and sales intelligence to create and rank cited requirements', () => {
  const context={
    studies:[{evidenceId:'study-1',sourceFile:'studies.xlsx',sourceType:'customer_study',sheet:'US_2025',row:10,cells:{A:'Exterior door handles'}}],
    sales:[{evidenceId:'sales-1',sourceFile:'sales.xlsx',sourceType:'sales_volume',sheet:'G60_G68',row:4,vehicle:'G60_G68',market:'US',marketName:'USA',volume2025:78000,volume2030:80000}]
  };
  const groups=buildModel(evidence,{vehicle:'G60',market:'US',months:12,people:8,importance:8},{},context);
  const marketRequirement=groups.flatMap(group=>group.requirements).find(requirement=>requirement.feature==='Exterior door handles');
  assert.ok(marketRequirement);
  assert.equal(marketRequirement.frequency,0);
  assert.equal(marketRequirement.marketEvidenceCount,2);
  assert.ok(marketRequirement.scoreBreakdown.marketIntelligence>0);
  assert.equal(validateCitations(groups,evidence,context),true);
});

test('uses supplied competitor workbook signals in requirement generation and ranking', () => {
  const context={competitors:[{evidenceId:'competitor-option-1',sourceFile:'competitor_bmw_format.xlsx',sourceType:'competitor_equipment',sheet:'Option_List',row:2,vehicle:'G60',market:'US',feature:'Parking assistance',rationale:'A comparable vehicle lists surround-view parking assistance.',sourceUrl:'https://example.com/specification',classificationBasis:'Workbook equipment group.'}]};
  const groups=buildModel([],{vehicle:'G60',market:'US',months:18,people:12,importance:8},{},context);
  const requirement=groups.flatMap(group=>group.requirements).find(item=>item.feature==='Parking assistance');
  assert.ok(requirement);
  assert.equal(requirement.citations[0].sourceType,'competitor_equipment');
  assert.equal(requirement.citations[0].file,'competitor_bmw_format.xlsx');
  assert.equal(requirement.citations[0].row,2);
  assert.ok(requirement.scoreBreakdown.marketIntelligence>0);
  assert.equal(validateCitations(groups,[],context),true);
});

test('matches European studies when EU is one segment of a combined sheet name', () => {
  const context={studies:[{evidenceId:'study-eu-1',sourceFile:'studies.xlsx',sourceType:'customer_study',sheet:'CN_EU_2025',row:7,cells:{A:'Interior styling'}}]};
  const groups=buildModel([],{vehicle:'G60',market:'DE',months:18,people:12,importance:8},{},context);
  const requirement=groups.flatMap(group=>group.requirements).find(item=>item.feature==='Interior styling');
  assert.ok(requirement);
  assert.equal(requirement.citations[0].evidenceId,'study-eu-1');
  assert.ok(requirement.scoreBreakdown.marketIntelligence>0);
});

test('uses externally researched cited market signals to create requirements', () => {
  const context={external:[{evidenceId:'external-1',vehicle:'G60',market:'US',feature:'Cargo access',statement:'Provide hands-free cargo access under defined operating conditions.',rationale:'Current competitor evidence supports hands-free cargo access.',sourceUrls:['https://example.com/cargo']}]};
  const groups=buildModel([],{vehicle:'G60',market:'US',months:18,people:12,importance:8},{},context);
  const requirement=groups.flatMap(group=>group.requirements).find(item=>item.feature==='Cargo access');
  assert.ok(requirement);
  assert.equal(requirement.statement,context.external[0].statement);
  assert.equal(requirement.citations[0].sourceType,'external_web');
  assert.equal(requirement.citations[0].url,'https://example.com/cargo');
  assert.equal(validateCitations(groups,[],context),true);
});

test('conditional feasibility causes a transparent score penalty before approval', () => {
  const config={vehicle:'G60',market:'US',months:12,people:8,importance:8};
  const baseline=buildModel(evidence,config).flatMap(g=>g.requirements)[0];
  const conditional=buildModel(evidence,config,{'Digital Key':'conditional'}).flatMap(g=>g.requirements)[0];
  assert.equal(baseline.score-conditional.score,12);
  assert.equal(conditional.status,'conditional');
});

test('rejection recalibrates active requirements while retaining the rejected record', () => {
  const sameGroup=[
    {...evidence[0],evidenceId:'seat-a',feedbackId:'seat-a',feature:'Seats'},
    {...evidence[0],evidenceId:'seat-b',feedbackId:'seat-b',feature:'Interior lighting'}
  ];
  const config={vehicle:'G60',market:'US',months:12,people:8,importance:8};
  const recalibrated=buildModel(sameGroup,config,{'Seats':'pm-rejected'}).find(group=>group.name==='Interior & Comfort');
  assert.equal(recalibrated.requirements.length,2);
  assert.equal(recalibrated.requirements[0].feature,'Interior lighting');
  assert.equal(recalibrated.requirements[0].rank,1);
  assert.equal(recalibrated.requirements[1].feature,'Seats');
  assert.equal(recalibrated.requirements[1].status,'pm-rejected');
});

test('allows PM deletion and preserves direct approval without feasibility', () => {
  const config={vehicle:'G60',market:'US',months:12,people:8,importance:8};
  assert.equal(buildModel(evidence,config,{'Digital Key':'deleted'}).length,0);
  assert.equal(buildModel(evidence,config,{'Digital Key':'approved'}).flatMap(group=>group.requirements)[0].status,'approved');
});

test('creates a Gmail compose link from the editable email draft', () => {
  const url=new URL(gmailComposeUrl('engineer@bmwgroup.com','Subject: Feasibility review\n\nPlease review this requirement.'));
  assert.equal(url.hostname,'mail.google.com');
  assert.equal(url.searchParams.get('to'),'engineer@bmwgroup.com');
  assert.equal(url.searchParams.get('su'),'Feasibility review');
  assert.match(url.searchParams.get('body'),/Please review/);
});

test('connectivity features are filed under Digital Experience, not the Driving fallback', async () => {
  const { groupFor } = await import('../src/engine.mjs');
  for (const feature of ['WiFi hotspot', 'Personal eSIM', 'USB port', 'Intelligent Personal Assistant', 'Vehicle key', 'Driver profile'])
    assert.equal(groupFor(feature), 'Digital Experience & Controls', feature);
  assert.equal(groupFor('Glove box'), 'Interior & Comfort');
  assert.equal(groupFor('Drivetrain'), 'Driving & Powertrain');
});

test('plain-language explanation is derived from the requirement numbers and flags weak demand honestly', async () => {
  const { buildModel, signalFor } = await import('../src/engine.mjs');
  assert.equal(signalFor(0, 'low'), 'market');
  assert.equal(signalFor(5, 'high'), 'weak');
  assert.equal(signalFor(20, 'high'), 'limited');
  assert.equal(signalFor(60, 'high'), 'solid');
  assert.equal(signalFor(300, 'high'), 'strong');
  const evidence = JSON.parse(await readFile(new URL('../data/evidence.json', import.meta.url), 'utf8')).records;
  const context = JSON.parse(await readFile(new URL('../data/context.json', import.meta.url), 'utf8'));
  const groups = buildModel(evidence, { vehicle:'G60', market:'US', months:18, people:12, importance:8 }, {}, context, {});
  for (const requirement of groups.flatMap(group => group.requirements)) {
    const { explanation: x, scoreParts: parts } = requirement;
    assert.ok(x.exists.length && x.rank.length, requirement.feature);
    assert.match(x.exists[0], requirement.frequency ? new RegExp(`^${requirement.frequency.toLocaleString()} customer`) : /market evidence only/);
    assert.ok(Math.abs(parts.demand + parts.timeline + parts.market + parts.memory - requirement.score) <= 2, `${requirement.feature} parts add up to score`);
    if (['weak', 'limited', 'market'].includes(x.signal.key)) assert.match(x.caveat, /Validate demand before committing/);
    else assert.equal(x.caveat, '');
  }
});

test('every feasibility question has a suggested department and the draft follows the chosen department', async () => {
  const { departmentOptions, draftEmail, entityFor, DEPARTMENTS } = await import('../src/engine.mjs');
  assert.equal(entityFor('Braking').name, 'Chassis & Vehicle Dynamics');
  assert.equal(entityFor('Drivetrain').name, 'Powertrain Engineering');
  assert.equal(entityFor('If applicable: 4WD/AWD performance').name, 'Powertrain Engineering');
  assert.equal(entityFor('ground clearance').name, 'Chassis & Vehicle Dynamics');
  const options = departmentOptions('Braking');
  assert.equal(options.length, DEPARTMENTS.length);
  assert.equal(options[0].name, 'Chassis & Vehicle Dynamics');
  assert.equal(options.filter(option => option.suggested).length, 1);
  const requirement = { feature:'Braking', statement:'Provide predictable braking.', whyExists:'36 customers.', evidenceCount:3, estimatedMonths:15, owner:{ name:'Chassis & Vehicle Dynamics' }, citations:[{ file:'f.xlsx', sheet:'s', row:1 }] };
  const config = { vehicle:'G60', market:'US', months:18, people:12, importance:8 };
  const chassis = draftEmail(requirement, config), cost = draftEmail(requirement, config, 'Purchasing & Cost Controlling');
  assert.match(chassis, /Hello Chassis & Vehicle Dynamics team/);
  assert.match(chassis, /chassis tuning/);
  assert.match(cost, /Hello Purchasing & Cost Controlling team/);
  assert.match(cost, /cost, sourcing and supplier/);
});
