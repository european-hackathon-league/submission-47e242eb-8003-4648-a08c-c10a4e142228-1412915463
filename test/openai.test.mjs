import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyReportAudiences, classifyStakeholderResponse, draftStakeholderEmail, outcomeToStatus, researchMarketIntelligence, synthesizeRequirements } from '../src/openai.mjs';

test('uses OpenAI structured output and returns auditable classification metadata', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return { ok:true, json:async()=>({
      id:'resp_test_123', status:'completed', output:[{content:[{type:'output_text',text:JSON.stringify({
        outcome:'feasible_with_conditions', confidence:.93, summary:'Feasible with a three-month extension.',
        conditions:['Extend the schedule'], constraints:[], time_impact:'Three additional months',
        suggested_modification:'Update the target timing.', supporting_quotes:['requires an additional three months']
      })}]}]
    }) };
  };
  const result = await classifyStakeholderResponse({ requirement:'Increase luggage space', featureGroup:'Exterior & Utility', responsibleEntity:'Body Engineering', productContext:{vehicle:'G60'}, stakeholderResponse:'This is feasible, but requires an additional three months.' }, { apiKey:'test-key', model:'gpt-4o-mini', fetchImpl });
  assert.equal(result.outcome, 'feasible_with_conditions');
  assert.equal(result.responseId, 'resp_test_123');
  assert.equal(outcomeToStatus(result.outcome), 'conditional');
  assert.equal(request.url, 'https://api.openai.com/v1/responses');
  assert.equal(request.options.headers.Authorization, 'Bearer test-key');
  assert.equal(request.body.text.format.type, 'json_schema');
  assert.equal(request.body.text.format.strict, true);
});

test('will not classify without a server-side API key', async () => {
  await assert.rejects(() => classifyStakeholderResponse({ stakeholderResponse:'Feasible.' }, { apiKey:'' }), /OPENAI_API_KEY/);
});

test('creates a grounded editable email from PM notes', async () => {
  let request;
  const fetchImpl=async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({id:'resp_email',status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({subject:'Review cargo access timing',body:'Hello Body Engineering team,\n\nPlease confirm the timing impact.'})}]}]})}};
  const result=await draftStakeholderEmail({requirement:'Increase luggage opening width',roughNotes:'Ask about timing impact.',currentDraft:'Existing draft'},{apiKey:'test-key',fetchImpl});
  assert.equal(result.subject,'Review cargo access timing');
  assert.match(result.body,/timing impact/);
  assert.equal(request.text.format.type,'json_schema');
});

test('synthesizes requirement wording only from attached evidence IDs', async () => {
  let request;
  const fetchImpl=async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({id:'resp_wording',status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({requirements:[{requirement_id:'req-cargo',statement:'Improve cargo access so customers can load luggage with less difficulty.',evidence_ids:['evidence-1']}]})}]}]})}};
  const result=await synthesizeRequirements({productContext:{vehicle:'G60',market:'US'},requirements:[{id:'req-cargo',feature:'Cargo access',group:'Exterior & Utility',outcome:'Cargo usability',fallback_statement:'Improve cargo access.',evidence:[{evidence_id:'evidence-1',source_type:'customer_feedback',excerpt:'Customers report that cargo access makes luggage loading difficult.'}]}]},{apiKey:'test-key',fetchImpl});
  assert.equal(result.requirements[0].statement,'Improve cargo access so customers can load luggage with less difficulty.');
  assert.deepEqual(result.requirements[0].evidenceIds,['evidence-1']);
  assert.equal(result.responseId,'resp_wording');
  assert.equal(request.text.format.type,'json_schema');
  assert.equal(request.text.format.strict,true);
});

test('drops synthesized wording with unsupported claims or evidence IDs', async () => {
  const fetchImpl=async()=>({ok:true,json:async()=>({id:'resp_unsupported',status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({requirements:[{requirement_id:'req-cargo',statement:'Increase cargo access width by 25 millimeters.',evidence_ids:['not-supplied']}]})}]}]})});
  const result=await synthesizeRequirements({requirements:[{id:'req-cargo',feature:'Cargo access',fallback_statement:'Improve cargo access.',evidence:[{evidence_id:'evidence-1',source_type:'customer_feedback',excerpt:'Customers report difficult cargo access.'}]}]},{apiKey:'test-key',fetchImpl});
  assert.deepEqual(result.requirements,[]);
});

test('classifies every requirement into one primary department with strict structured output', async () => {
  let request;
  const fetchImpl=async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({id:'resp_routing',status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({assignments:[
    {requirement_id:'req-chassis',audience:'technical',rationale:'Chassis Engineering must validate the implementation.'},
    {requirement_id:'req-brand',audience:'gtm',rationale:'The requirement defines a customer-facing brand proposition.'}
  ]})}]}]})}};
  const result=await classifyReportAudiences({productContext:{vehicle:'G60',market:'US'},requirements:[
    {requirement_id:'req-chassis',feature:'Ride isolation',group:'Driving & Powertrain',outcome:'Ride comfort',statement:'Reduce disruptive road impacts.',responsible_entity:'Chassis Engineering'},
    {requirement_id:'req-brand',feature:'Exterior character',group:'Exterior & Utility',outcome:'Brand expression',statement:'Retain a recognizable BMW exterior character.',responsible_entity:'Body Engineering'}
  ]},{apiKey:'test-key',fetchImpl});
  assert.equal(result.assignments.length,2);
  assert.deepEqual(result.assignments[1],{requirementId:'req-brand',audience:'gtm',technical:false,gtm:true,rationale:'The requirement defines a customer-facing brand proposition.'});
  assert.equal(result.responseId,'resp_routing');
  assert.equal(request.text.format.type,'json_schema');
  assert.equal(request.text.format.strict,true);
});

test('rejects invalid audience assignments instead of trusting model output', async () => {
  const fetchImpl=async()=>({ok:true,json:async()=>({id:'resp_invalid_routing',status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({assignments:[
    {requirement_id:'req-known',audience:'neither',rationale:'No audience.'},
    {requirement_id:'req-unknown',audience:'technical',rationale:'Not supplied.'}
  ]})}]}]})});
  const result=await classifyReportAudiences({requirements:[{requirement_id:'req-known',statement:'Provide clear charging status.',feature:'Charging status'}]},{apiKey:'test-key',fetchImpl});
  assert.deepEqual(result.assignments,[]);
});

test('uses required web search and returns citation positions for market intelligence', async () => {
  const requests=[];
  const report='Competitor evidence 【1】';
  const fetchImpl=async(url,options)=>{const request=JSON.parse(options.body);requests.push(request);if(request.tools)return {ok:true,json:async()=>({id:'resp_market',status:'completed',output:[{type:'web_search_call',action:{type:'search'}},{type:'message',content:[{type:'output_text',text:report,annotations:[{type:'url_citation',start_index:20,end_index:23,url:'https://example.com/source',title:'Primary source'}]}]}]})};return {ok:true,json:async()=>({id:'resp_extract',status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({candidates:[{feature:'Cargo access',requirement:'Provide hands-free cargo access under defined operating conditions.',rationale:'The cited competitor evidence establishes a current market signal.',source_urls:['https://example.com/source']}]})}]}]})}};
  const result=await researchMarketIntelligence({vehicle:'G60',market:'US',months:18,importance:8},{apiKey:'test-key',fetchImpl});
  assert.equal(requests[0].tools[0].type,'web_search');
  assert.equal(requests[0].tool_choice,'required');
  assert.equal(result.citations[0].url,'https://example.com/source');
  assert.equal(result.citations[0].startIndex,20);
  assert.equal(result.candidates[0].feature,'Cargo access');
  assert.equal(result.candidates[0].sourceUrls[0],'https://example.com/source');
});
