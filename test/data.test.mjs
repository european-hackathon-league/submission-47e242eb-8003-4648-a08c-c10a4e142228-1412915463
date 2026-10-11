import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(.:)/,'$1');

test('normalized evidence and every supplied source file are present and traceable', async () => {
  const evidence=JSON.parse(await readFile(join(root,'data/evidence.json'),'utf8'));
  const context=JSON.parse(await readFile(join(root,'data/context.json'),'utf8'));
  assert.equal(evidence.records.length,13771);
  assert.equal(context.studies.length,1003);
  assert.equal(context.sales.length,12);
  assert.equal(context.manifest.length,8);
  assert.equal(new Set(evidence.records.map(r=>r.evidenceId)).size,evidence.records.length);
  for(const source of context.manifest){const info=await stat(join(root,'data/sources',source.file));assert.equal(info.size,source.bytes)}
  for(const pdf of context.manifest.filter(source=>source.kind==='pdf'))assert.ok(pdf.pageCount>0);
});

test('historical seed records are explicitly marked as demo history', async () => {
  const history=JSON.parse(await readFile(join(root,'data/historical-decisions.json'),'utf8'));
  assert.ok(history.decisions.length>0);
  assert.ok(history.decisions.every(decision=>decision.provenance==='Team-authored demo history'));
});
