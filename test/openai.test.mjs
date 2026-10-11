import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyStakeholderResponse, draftStakeholderEmail, outcomeToStatus, researchMarketIntelligence } from '../src/openai.mjs';

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
