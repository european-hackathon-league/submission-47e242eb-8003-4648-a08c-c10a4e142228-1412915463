import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeReportAudienceAssignments, partitionReportRequirements } from '../src/report-routing.mjs';

test('PM partition contains every requirement exactly once and departmental reports are distinct', () => {
  const requirements=[
    {id:'technical',statement:'Improve thermal control.',group:'Driving & Powertrain',owner:{name:'Powertrain Engineering'}},
    {id:'gtm',statement:'Clarify the customer market proposition.',group:'Exterior & Utility',owner:{name:'Product Marketing'}},
    {id:'another-technical',statement:'Reduce display response latency.',group:'Digital Experience & Controls',owner:{name:'Software Engineering'}}
  ];
  const routing=mergeReportAudienceAssignments(requirements,[
    {requirementId:'technical',audience:'technical',rationale:'Implementation scope.'},
    {requirementId:'gtm',audience:'gtm',rationale:'Market scope.'},
    {requirementId:'another-technical',audience:'technical',rationale:'Implementation scope.'}
  ]);
  const result=partitionReportRequirements(requirements,routing);
  assert.deepEqual(result.technical.map(item=>item.id),['technical','another-technical']);
  assert.deepEqual(result.gtm.map(item=>item.id),['gtm']);
  assert.deepEqual([...result.technical,...result.gtm].map(item=>item.id).sort(),['another-technical','gtm','technical']);
});

test('missing or invalid model assignments receive deterministic routing', () => {
  const requirements=[{id:'fallback',statement:'Improve luggage access for customers.',group:'Exterior & Utility',owner:{name:'Body Engineering'}}];
  const routing=mergeReportAudienceAssignments(requirements,[]);
  assert.equal(routing.get('fallback').technical,false);
  assert.equal(routing.get('fallback').gtm,true);
  assert.match(routing.get('fallback').rationale,/fallback/i);
});
