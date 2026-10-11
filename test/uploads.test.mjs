import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCsv, parseInput, suggestFeature, templateCsv, toKnowledge, validateBatch, UPLOAD_TYPES } from '../src/uploads.mjs';
import { buildModel } from '../src/engine.mjs';

test('CSV parser handles quotes, embedded commas, newlines and semicolon files', () => {
  assert.deepEqual(parseCsv('text,feature\n"Seats, too firm","Seats"\n"Line one\nline two",Seats\n'), [['text', 'feature'], ['Seats, too firm', 'Seats'], ['Line one\nline two', 'Seats']]);
  assert.deepEqual(parseCsv('text;feature\nsay "hi";Seats'), [['text', 'feature'], ['say "hi"', 'Seats']]);
  assert.deepEqual(parseCsv('a\n"He said ""no"""'), [['a'], ['He said "no"']]);
});

test('every evidence type has a template that parses back cleanly', () => {
  for (const type of Object.keys(UPLOAD_TYPES)) {
    const { rows, errors } = parseInput(type, templateCsv(type), { csv: true });
    assert.equal(errors.length, 0, type);
    assert.equal(rows.length, 1, type);
  }
});

test('input parsing reports missing columns and treats pasted text as one row per line', () => {
  assert.match(parseInput('customer_feedback', 'feature\nSeats', { csv: true }).errors[0], /Missing column: text/);
  const pasted = parseInput('global_trend', 'Trend one\n\n  Trend two  ');
  assert.deepEqual(pasted.rows.map(row => row.text), ['Trend one', 'Trend two']);
  assert.match(parseInput('past_decision', 'anything').errors[0], /CSV/);
  const decision = parseInput('past_decision', 'requirement,decision,reasoning\nVentilated seats,Approved with conditions,Supplier risk', { csv: true });
  assert.equal(decision.rows[0].decision, 'approved with conditions');
});

test('feature suggestion prefers an exact feature column, then word overlap, else nothing', () => {
  const features = ['Seats', 'Navigation', 'Mobile device, wireless charging', 'Exterior design'];
  assert.equal(suggestFeature({ feature: 'navigation', text: 'x' }, features), 'Navigation');
  assert.equal(suggestFeature({ text: 'The wireless charging pad overheats my phone' }, features), 'Mobile device, wireless charging');
  assert.equal(suggestFeature({ text: 'Rear seats are too firm' }, features), 'Seats');
  assert.equal(suggestFeature({ text: 'The glass roof should open fully' }, ['Roof', 'Panorama glass roof']), 'Panorama glass roof');
  assert.equal(suggestFeature({ text: 'Completely unrelated sentence' }, features), '');
  assert.equal(suggestFeature({ text: 'I wish the car came in more colours.' }, ['Caring Car', 'Seats']), '');
});

test('server validation enforces weight, scope and an assigned feature', () => {
  const base = { type: 'customer_feedback', vehicle: 'G60', market: 'US', weight: 5, rows: [{ row: 2, text: 'Seats too firm', feature: 'Seats' }] };
  assert.equal(validateBatch(base).rows.length, 1);
  assert.throws(() => validateBatch({ ...base, weight: 11 }), /1 to 10/);
  assert.throws(() => validateBatch({ ...base, type: 'gossip' }), /Unknown evidence type/);
  assert.throws(() => validateBatch({ ...base, rows: [{ row: 2, text: 'No feature' }] }), /assigned feature/);
  assert.throws(() => validateBatch({ ...base, market: '' }), /Vehicle and market/);
});

test('uploaded evidence is ranked with BMW data, weighted, and always cited as an upload', async () => {
  const evidence = JSON.parse(await readFile(new URL('../data/evidence.json', import.meta.url), 'utf8')).records;
  const context = JSON.parse(await readFile(new URL('../data/context.json', import.meta.url), 'utf8'));
  const config = { vehicle: 'G60', market: 'US', months: 18, people: 12, importance: 8 };
  const find = groups => groups.flatMap(group => group.requirements).find(r => r.feature === 'Seats');
  const baseline = find(buildModel(evidence, config, {}, context, {}));

  const rows = Array.from({ length: 30 }, (_, i) => ({ row: i + 2, text: `Seat complaint ${i}`, feature: 'Seats' }));
  const batch = (weight, type = 'customer_feedback') => ({ batchId: `b${weight}${type}`, uploadedAt: '2026-10-11T00:00:00Z', ...validateBatch({ type, vehicle: 'G60', market: 'US', weight, rows }) });
  const run = batches => { const k = toKnowledge(batches); return find(buildModel(evidence.concat(k.records), config, {}, { ...context, uploads: k.signals }, {})); };

  const light = run([batch(1)]), heavy = run([batch(10)]);
  assert.equal(light.frequency, baseline.frequency + 30);
  assert.equal(heavy.frequency, baseline.frequency + 30, 'customer count stays honest regardless of weight');
  assert.ok(heavy.scoreParts.demand > light.scoreParts.demand, 'weight scales the demand contribution');
  assert.equal(heavy.uploadedFeedback, 30);
  assert.match(heavy.explanation.exists[0], /30 of them from your uploads/);
  assert.ok(heavy.citations.some(c => c.uploaded && c.file.startsWith('PM upload')));

  const withTrends = run([batch(5, 'global_trend')]);
  assert.ok(withTrends.scoreParts.market >= baseline.scoreParts.market);
  assert.ok(withTrends.citations.some(c => c.sourceType === 'pm_global_trend'));
  assert.match(withTrends.explanation.exists.join(' '), /global trends you added/);

  const decisions = toKnowledge([{ batchId: 'd', uploadedAt: '2026-10-11T00:00:00Z', ...validateBatch({ type: 'past_decision', vehicle: 'G60', market: 'US', weight: 8, rows: [{ row: 2, requirement: 'Ventilated seats', decision: 'approved', reasoning: 'Hot climates', feature: 'Seats' }] }) }]).decisions;
  assert.equal(decisions[0].weight, 8);
  const remembered = find(buildModel(evidence, { ...config, historyBonus: { Seats: 8 } }, {}, context, {}));
  assert.equal(remembered.scoreParts.memory, 8);
});

test('Decision Memory: approved decisions add their weight once, rejected ones add nothing and are flagged', async () => {
  const evidence = JSON.parse(await readFile(new URL('../data/evidence.json', import.meta.url), 'utf8')).records;
  const context = JSON.parse(await readFile(new URL('../data/context.json', import.meta.url), 'utf8'));
  const decision = (feature, decisionStatus, extra = {}) => ({ source: 'upload', feature, decisionStatus, weight: 8, productCycle: 'Demo cycle 2021', pmReasoning: 'Because.', ...extra });
  const config = { vehicle: 'G60', market: 'US', months: 18, people: 12, importance: 8, pastDecisions: [
    decision('Panorama glass roof', 'approved'),
    decision('Touch screen, operation', 'rejected'),
    { source: 'app', requirementId: 'req-seats', decisionStatus: 'approved', weight: 5, pmReasoning: 'Seat comfort matters more on long US drives.', at: '2026-10-11T08:00:00Z' }
  ] };
  const all = buildModel(evidence, config, {}, context, {}).flatMap(group => group.requirements);
  const roof = all.find(r => r.feature === 'Panorama glass roof'), touch = all.find(r => r.feature === 'Touch screen, operation'), seats = all.find(r => r.feature === 'Seats');
  assert.equal(roof.scoreParts.memory, 8);
  assert.match(roof.explanation.memory[0].text, /\(your upload\).*\+8 points/);
  assert.ok(!roof.explanation.rank.some(line => /past decision/i.test(line)), 'memory bonus is not listed twice');
  assert.equal(touch.scoreParts.memory, 0);
  assert.match(touch.explanation.memory[0].text, /No points added/);
  assert.equal(seats.scoreParts.memory, 5, 'decisions recorded in the app match by requirement id');
  assert.match(seats.explanation.memory[0].text, /^Approved by the PM on 11 Oct 2026: “Seat comfort/);
  assert.equal(seats.explanation.added.length, 0);
});
