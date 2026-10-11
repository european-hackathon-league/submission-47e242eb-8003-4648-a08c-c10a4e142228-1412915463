import { createServer } from 'node:http';
import { appendFile, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { classifyStakeholderResponse, draftStakeholderEmail, outcomeToStatus, researchMarketIntelligence } from './src/openai.mjs';
import { DECISION_EVENT_TYPES, isRecordedDecision } from './src/decision-memory.mjs';

const root = new URL('.', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const port = Number(process.env.PORT || 4173);
const apiVersion = 'pm-api-2';
const decisionEventsPath = join(root, 'data', 'decision-events.ndjson');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp' };

const sendJson = (res, status, value) => { res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' }); res.end(JSON.stringify(value)); };
const readJson = req => new Promise((resolve, reject) => {
  let body='';
  req.on('data', chunk => { body += chunk; if (body.length > 100_000) reject(new Error('Request is too large.')); });
  req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON request.')); } });
  req.on('error', reject);
});

createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, { ok:true, apiVersion, openaiConfigured:Boolean(process.env.OPENAI_API_KEY), model:process.env.OPENAI_MODEL || 'gpt-4o-mini' });
    return;
  }
  if (pathname === '/api/openai-status' && req.method === 'GET') {
    sendJson(res, 200, { configured: Boolean(process.env.OPENAI_API_KEY), model: process.env.OPENAI_MODEL || 'gpt-4o-mini' });
    return;
  }
  if (pathname === '/api/decision-events' && req.method === 'GET') {
    try {
      const lines=(await readFile(decisionEventsPath,'utf8')).split(/\r?\n/).filter(Boolean);
      sendJson(res,200,{events:lines.map(line=>JSON.parse(line)).filter(isRecordedDecision)});
    } catch (error) {
      if(error.code==='ENOENT')sendJson(res,200,{events:[]});else sendJson(res,500,{error:'Decision memory could not be read.'});
    }
    return;
  }
  if (pathname === '/api/decision-events' && req.method === 'POST') {
    try {
      const event=await readJson(req);
      if(!event.id||!event.type||!event.title||!event.at)throw new Error('Decision event is incomplete.');
      if(!DECISION_EVENT_TYPES.has(event.type))throw new Error('Decision Memory only accepts requirement approvals and rejections.');
      if(!String(event.data?.rationale||'').trim())throw new Error('An approval or rejection reason is required.');
      const immutableEvent={id:String(event.id),type:String(event.type),title:String(event.title),description:String(event.description||''),actor:String(event.actor||'PM'),data:event.data||{},at:String(event.at),provenance:'Append-only application event'};
      await appendFile(decisionEventsPath,`${JSON.stringify(immutableEvent)}\n`,'utf8');
      sendJson(res,201,{ok:true,id:immutableEvent.id});
    } catch(error){sendJson(res,400,{error:error.message})}
    return;
  }
  if (pathname === '/api/interpret-stakeholder' && req.method === 'POST') {
    try {
      const input = await readJson(req);
      const interpretation = await classifyStakeholderResponse(input);
      sendJson(res, 200, { ...interpretation, status: outcomeToStatus(interpretation.outcome), requiresConfirmation: true });
    } catch (error) {
      const configurationError = /OPENAI_API_KEY/.test(error.message);
      sendJson(res, configurationError ? 503 : 502, { error: error.message });
    }
    return;
  }
  if (pathname === '/api/draft-email' && req.method === 'POST') {
    try {
      sendJson(res, 200, await draftStakeholderEmail(await readJson(req)));
    } catch (error) {
      sendJson(res, /OPENAI_API_KEY/.test(error.message) ? 503 : 502, { error:error.message });
    }
    return;
  }
  if (pathname === '/api/market-intelligence' && req.method === 'POST') {
    try {
      sendJson(res, 200, await researchMarketIntelligence(await readJson(req)));
    } catch (error) {
      sendJson(res, /OPENAI_API_KEY/.test(error.message) ? 503 : 502, { error:error.message });
    }
    return;
  }
  if (pathname.startsWith('/sources/')) {
    const sourceTarget=decodeURIComponent(pathname.slice('/sources/'.length));
    if (/^https?:\/\//i.test(sourceTarget)) { res.writeHead(302, { Location:sourceTarget, 'Cache-Control':'no-store' }).end(); return; }
  }
  const decodedPathname=decodeURIComponent(pathname);
  const requested = decodedPathname === '/' ? '/public/index.html' : decodedPathname.startsWith('/sources/') ? `/data${decodedPathname}` : (decodedPathname.startsWith('/data/') || decodedPathname.startsWith('/src/')) ? decodedPathname : `/public${decodedPathname}`;
  const path = normalize(join(root, requested));
  if (!path.startsWith(normalize(root))) { res.writeHead(403).end('Forbidden'); return; }
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`PM (${apiVersion}): http://localhost:${port}`));
