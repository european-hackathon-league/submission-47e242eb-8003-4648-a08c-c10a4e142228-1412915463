import test from 'node:test';
import assert from 'node:assert/strict';
import {diaryEntries,dayKey,isDiaryEvent} from '../src/project-diary.mjs';
import {summarizeDiaryDay} from '../src/openai.mjs';
const make=(id,at,vehicle='G60')=>({id,at,type:'requirement-approved',data:{project:{vehicle,market:'US'},rationale:''}});
test('diary keeps decisions without rationale, deduplicates and sorts newest first',()=>{
 const a=make('a','2026-10-10T12:00:00Z'),b=make('b','2026-10-11T12:00:00Z');
 assert.ok(isDiaryEvent(a));assert.deepEqual(diaryEntries([a,b,a],null).map(e=>e.id),['b','a']);
});
test('diary filters exact project and local calendar day',()=>{
 const a=make('a','2026-10-10T12:00:00Z'),b=make('b','2026-10-11T12:00:00Z'),c=make('c',b.at,'F70');
 assert.deepEqual(diaryEntries([a,b,c],{vehicle:'G60',market:'US'},dayKey(b.at)).map(e=>e.id),['b']);
});
test('day summary uses all selected records and rejects invented event IDs',async()=>{
 const events=[make('a','2026-10-10T12:00:00Z'),make('b','2026-10-10T13:00:00Z')];let body;
 const options={apiKey:'test',fetchImpl:async(url,request)=>{body=JSON.parse(request.body);return {ok:true,json:async()=>({id:'response',output:[{content:[{type:'output_text',text:JSON.stringify({decisions:[{title:'Approval',significance:'No rationale recorded',eventIds:['a','b']}]})}]}]})}}};
 const result=await summarizeDiaryDay({day:'2026-10-10',events},options);assert.equal(result.decisions.length,1);assert.equal(JSON.parse(body.input[1].content[0].text).events.length,2);
 options.fetchImpl=async()=>({ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({decisions:[{eventIds:['invented']}]})}]}]})});
 await assert.rejects(summarizeDiaryDay({day:'2026-10-10',events},options),/unsupported event/);
});

import {diaryRange,eventsInRange} from '../src/project-diary.mjs';
test('presets use completed workweek, previous calendar month and quarter',()=>{
 const now=new Date(2026,9,11,12);
 assert.deepEqual(diaryRange('week',[],now),{start:'2026-10-05',end:'2026-10-09'});
 assert.deepEqual(diaryRange('month',[],now),{start:'2026-09-01',end:'2026-09-30'});
 assert.deepEqual(diaryRange('quarter',[],now),{start:'2026-07-01',end:'2026-09-30'});
 assert.deepEqual(diaryRange('week',[],new Date(2026,9,9,12)),{start:'2026-09-28',end:'2026-10-02'});
 assert.deepEqual(diaryRange('quarter',[],new Date(2026,0,2,12)),{start:'2025-10-01',end:'2025-12-31'});
});
test('onboarding starts at first recorded event and custom ranges include both boundary days',()=>{
 const events=[make('a','2024-06-15T12:00:00Z'),make('b','2026-10-11T12:00:00Z')];
 assert.deepEqual(diaryRange('onboarding',events,new Date(2026,9,11,12)),{start:'2024-06-15',end:'2026-10-11'});
 assert.equal(eventsInRange(events,'2024-06-15','2026-10-11').length,2);
});
