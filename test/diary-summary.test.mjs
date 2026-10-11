import test from 'node:test';import assert from 'node:assert/strict';
import {prepareDiarySummary,summarizeStoredDiary} from '../src/diary-summary.mjs';
const project={vehicle:'G60',market:'US'};
const record=(id,at,p=project)=>({id,at,type:'requirement-approved',title:id,description:`Recorded ${id}`,data:{project:p,rationale:'',before:{secret:'outside snapshot'},synthetic:false}});
test('harness passes only requested project and days to the LLM including timezone boundaries',async()=>{
 const records=[record('before','2026-10-04T21:59:59Z'),record('start','2026-10-04T22:00:00Z'),record('end','2026-10-09T21:59:59Z'),record('after','2026-10-09T22:00:00Z'),record('other','2026-10-07T12:00:00Z',{vehicle:'F70',market:'US'})];
 let captured;await summarizeStoredDiary({start:'2026-10-05',end:'2026-10-09',project,timeZone:'Europe/Berlin'},records,async input=>{captured=input;return {}});
 assert.deepEqual(captured.events.map(e=>e.id),['end','start']);assert.equal(JSON.stringify(captured).includes('outside snapshot'),false);
});
test('harness rejects injected client sources, impossible dates, reversed ranges and empty selections before calling LLM',async()=>{
 const invoke=request=>summarizeStoredDiary(request,[],()=>{throw new Error('LLM must not run')});
 await assert.rejects(invoke({day:'2026-10-09',events:[record('injected','2026-10-09T12:00:00Z')]}),/server records/);
 await assert.rejects(invoke({day:'2026-02-30'}),/valid inclusive dates/);
 await assert.rejects(invoke({start:'2026-10-09',end:'2026-10-05'}),/valid inclusive dates/);
 await assert.rejects(invoke({day:'2026-10-09'}),/No recorded changes/);
});
test('single-day and onboarding requests obey the same date boundary',()=>{
 const records=[record('outside','2026-10-08T12:00:00Z'),record('inside','2026-10-09T12:00:00Z')];
 for(const request of [{day:'2026-10-09'},{start:'2026-10-09',end:'2026-10-09',onboarding:true}])assert.deepEqual(prepareDiarySummary(request,records).events.map(e=>e.id),['inside']);
});
