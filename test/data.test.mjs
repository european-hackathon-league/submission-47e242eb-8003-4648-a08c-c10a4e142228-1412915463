import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

test('normalized evidence and every supplied source file are present and traceable', async () => {
  const evidence=JSON.parse(await readFile(join(root,'data/evidence.json'),'utf8'));
  const context=JSON.parse(await readFile(join(root,'data/context.json'),'utf8'));
  assert.equal(evidence.records.length,13771);
  assert.equal(context.studies.length,1003);
  assert.equal(context.sales.length,12);
  assert.equal(context.manifest.length,9);
  assert.equal(context.competitors.length,132);
  assert.equal(context.competitorPrices.length,13);
  assert.equal(context.competitors.filter(signal=>signal.feature).length,129);
  assert.equal(context.competitors.filter(signal=>!signal.feature).length,3);
  assert.ok(context.competitors.every(signal=>signal.sourceFile==='competitor_bmw_format.xlsx'&&signal.sheet&&signal.row&&/^https?:\/\//.test(signal.sourceUrl)));
  assert.equal(new Set(evidence.records.map(r=>r.evidenceId)).size,evidence.records.length);
  for(const source of context.manifest){const info=await stat(join(root,'data/sources',source.file));assert.equal(info.size,source.bytes)}
  for(const pdf of context.manifest.filter(source=>source.kind==='pdf'))assert.ok(pdf.pageCount>0);
});

test('browser modules are served with a JavaScript MIME type', async () => {
  const serverSource=await readFile(join(root,'server.mjs'),'utf8');
  assert.match(serverSource,/['"]\.mjs['"]\s*:\s*['"]text\/javascript; charset=utf-8['"]/);
});

test('market intelligence tab is removed from the application shell', async () => {
  const html=await readFile(join(root,'public/index.html'),'utf8');
  assert.doesNotMatch(html,/data-view="market"|<section id="market"|Market intelligence insights/i);
});

test('historical seed records are explicitly marked as demo history', async () => {
  const history=JSON.parse(await readFile(join(root,'data/historical-decisions.json'),'utf8'));
  assert.ok(history.decisions.length>0);
  assert.ok(history.decisions.every(decision=>decision.provenance==='Team-authored demo history'));
});
