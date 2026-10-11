// Screen-records the real app through the whole demo flow and cuts it into one clip per step.
// A visible cursor glides to each control and clicks; scrolling is eased; text is typed.
// Long AI waits are trimmed. Writes <out>/frames/*.jpg and <out>/timeline.json; encode.mjs turns
// that into MP4 clips.
// Usage: node record.mjs <base-url> <out-dir> <demo-data-dir> <app-data-dir>
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [BASE = 'http://localhost:4175', OUT = '/tmp/walkthrough-capture/rec', DATA, APP_DATA] = process.argv.slice(2);
// Demo 2 is a handover months later: demo 1's records are moved back to this date before it starts.
const HANDOVER_FROM = '2026-04-14T09:40:00Z';
const W = 1440, H = 900, SCALE = 4 / 3, PORT = 9400 + Math.floor(Math.random() * 400);
rmSync(join(OUT, 'frames'), { recursive: true, force: true });
mkdirSync(join(OUT, 'frames'), { recursive: true });

const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, '--hide-scrollbars', `--user-data-dir=${OUT}/../profile-${Date.now()}`, 'about:blank']);
const cleanup = () => { try { chrome.kill(); } catch {} };
process.on('exit', cleanup);
process.on('uncaughtException', error => { console.error(error); cleanup(); process.exit(1); });
process.on('unhandledRejection', error => { console.error(error); cleanup(); process.exit(1); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 40; i++) { try { await fetch(`http://127.0.0.1:${PORT}/json`); break; } catch { await sleep(300); } }
const page = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(r => (ws.onopen = r));

// ---------- CDP plumbing and frame capture ----------
let id = 0, frameCount = 0, clockOffset = null;
const pending = new Map(), errors = [], frames = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = m => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description?.slice(0, 300));
  if (d.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true });
  if (d.method === 'Page.screencastFrame') {
    send('Page.screencastFrameAck', { sessionId: d.params.sessionId });
    const t = d.params.metadata.timestamp, file = `${String(++frameCount).padStart(6, '0')}.jpg`;
    // Map the screencast clock onto ours so markers and frames share one timeline.
    const offset = Date.now() / 1000 - t;
    clockOffset = clockOffset === null ? offset : Math.min(clockOffset, offset);
    writeFileSync(join(OUT, 'frames', file), Buffer.from(d.params.data, 'base64'));
    frames.push({ t, file });
  }
};
const now = () => Date.now() / 1000 - (clockOffset ?? 0);
const js = async expression => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(`${expression.slice(0, 140)}\n${r.exceptionDetails.exception?.description}`); return r.result?.value; };
const waitFor = async (expression, timeout = 240000) => { const end = Date.now() + timeout; while (Date.now() < end) { if (await js(expression)) return; await sleep(250); } throw new Error(`Timed out: ${expression}`); };
const rect = selector => js(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()`);

// ---------- Visible cursor, eased scrolling, typing ----------
const CURSOR = `(()=>{if(window.__cursor)return;
  const zoom=()=>parseFloat(getComputedStyle(document.documentElement).zoom)||1;
  const el=document.createElement('div');el.id='__demo_cursor';
  el.innerHTML='<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2v17l4.6-4.3 3 6.8 2.8-1.2-3-6.6H17.6z" fill="#fff" stroke="#172230" stroke-width="1.5" stroke-linejoin="round"/></svg><i></i>';
  const css=document.createElement('style');
  css.textContent='#__demo_cursor{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;will-change:transform;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));transition:opacity .3s}#__demo_cursor svg{display:block;transition:transform .12s}#__demo_cursor.down svg{transform:scale(.86)}#__demo_cursor i{position:absolute;left:-12px;top:-12px;width:28px;height:28px;border-radius:50%;border:2px solid #0669d7;opacity:0}#__demo_cursor.ripple i{animation:__r .5s ease-out}@keyframes __r{from{opacity:1;transform:scale(.3)}to{opacity:0;transform:scale(1.6)}}';
  document.head.append(css);
  let x=760,y=520;
  const place=()=>{const z=zoom();el.style.transform='translate('+(x/z)+'px,'+(y/z)+'px)'};
  window.__cursor={
    show(){if(!el.isConnected)document.documentElement.append(el);place()},
    move(nx,ny,ms){return new Promise(res=>{const sx=x,sy=y,s=performance.now();const f=n=>{const p=Math.min(1,(n-s)/ms),e=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;x=sx+(nx-sx)*e;y=sy+(ny-sy)*e;place();p<1?requestAnimationFrame(f):res()};requestAnimationFrame(f)})},
    press(){el.classList.add('down');el.classList.remove('ripple');void el.offsetWidth;el.classList.add('ripple');setTimeout(()=>el.classList.remove('down'),140)}
  };
  window.__cursor.show();
})()`;
// Keep the cursor element mounted even when the app re-renders large parts of the page.
const cursorShow = () => js(`window.__cursor&&window.__cursor.show()`);
async function moveTo(selector, { fx = 0.5, fy = 0.5 } = {}) {
  const r = await rect(selector); if (!r) throw new Error(`Missing ${selector}`);
  const x = r.x + r.w * fx, y = r.y + r.h * fy;
  const from = await js(`(()=>{const m=document.getElementById('__demo_cursor').style.transform.match(/([\\d.-]+)px,\\s*([\\d.-]+)px/);const z=parseFloat(getComputedStyle(document.documentElement).zoom)||1;return m?[m[1]*z,m[2]*z]:[760,520]})()`);
  const distance = Math.hypot(x - from[0], y - from[1]);
  await cursorShow();
  await js(`window.__cursor.move(${x},${y},${Math.round(Math.min(950, Math.max(380, distance * 0.9)))})`);
  return { x, y };
}
async function click(selector, options = {}) {
  const { x, y } = await moveTo(selector, options);
  await sleep(120);
  await js(`window.__cursor.press()`);
  if (!options.visualOnly) for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  await sleep(380);
}
// Eased page scroll so the target's top lands `offset` px below the viewport top.
async function scrollTo(selector, offset = 118, ms = 950) {
  await js(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});const from=scrollY,to=Math.max(0,Math.min(document.documentElement.scrollHeight-innerHeight,scrollY+el.getBoundingClientRect().top-${offset}));if(Math.abs(to-from)<4)return;const s=performance.now();return new Promise(res=>{const f=n=>{const p=Math.min(1,(n-s)/${ms}),e=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;scrollTo({top:from+(to-from)*e,behavior:'instant'});p<1?requestAnimationFrame(f):res()};requestAnimationFrame(f)})})()`);
  await sleep(250);
}
async function typeInto(selector, text, delay = 16) {
  await js(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  for (const ch of text) { await send('Input.insertText', { text: ch }); await sleep(delay); }
}
const setFile = async (selector, file) => { const doc = await send('DOM.getDocument'); const node = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector }); await send('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [file] }); };

// ---------- Timeline: one marker per step, trimmed waits ----------
const steps = [], cuts = [];
async function mark(name, target, extra = {}) {
  await sleep(600);
  const toUnit = r => r && { x: r.x / W, y: r.y / H, w: r.w / W, h: r.h / H };
  const hotspot = target ? toUnit(await rect(target)) : null;
  if (target && !hotspot) throw new Error(`Hotspot target missing for ${name}: ${target}`);
  if (hotspot && (hotspot.y < 0 || hotspot.y + hotspot.h > 1 || hotspot.x < 0 || hotspot.x + hotspot.w > 1)) throw new Error(`Hotspot off-screen for ${name}: ${JSON.stringify(hotspot)}`);
  const focus = extra.focus ? toUnit(await rect(extra.focus)) : null;
  steps.push({ name, end: now(), start: extra.start, hotspot, focus });
  console.log(`✓ ${name}`);
}
// Waiting on the server: keep the first `hold` seconds of the loading state, drop the rest.
async function trimmedWait(expression, hold = 1.4) {
  const start = now();
  await waitFor(expression);
  const end = now();
  if (end - start > hold + 0.5) cuts.push([start + hold, end - 0.15]);
}
const card = match => `[...document.querySelectorAll('.requirement')].find(c=>${match}.test(c.querySelector('.outcome').textContent+' '+c.querySelector('h3').textContent))`;
const markCard = match => js(`(()=>{document.querySelectorAll('[data-demo]').forEach(e=>e.removeAttribute('data-demo'));const c=${card(match)};if(c)c.setAttribute('data-demo','1');return Boolean(c)})()`);
const setValue = (id, value) => js(`(()=>{const e=document.getElementById('${id}');e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()`);

// ---------- Run ----------
await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false });
await send('Page.navigate', { url: BASE });
await waitFor(`document.getElementById('generate-button')&&!document.getElementById('generate-button').disabled`);
await sleep(1000);
await js(CURSOR);
await send('Page.startScreencast', { format: 'jpeg', quality: 82, maxWidth: Math.round(W * SCALE), maxHeight: Math.round(H * SCALE), everyNthFrame: 1 });
await sleep(1200);
const recordingStart = now();

// Demo 1
await moveTo('.hero-cta');
await scrollTo('#product-context', 105, 1300);
await moveTo('#vehicle + .bmw-select .bmw-select-trigger');
await sleep(250);
await moveTo('#importance', { fx: 0.62 });
await mark('01-setup', '[data-upload-type="customer_feedback"]');

await click('[data-upload-type="customer_feedback"]');
await scrollTo('#add-evidence', 105);
await click('[data-upload-mode="csv"]');
await click('#upload-drop', { visualOnly: true });
await setFile('#upload-file', join(DATA, '1-customer-feedback.csv'));
await sleep(500);
await mark('02-evidence', '#upload-preview-button');

await click('#upload-preview-button');
await sleep(300);
await scrollTo('#upload-commit', 720, 1300);
await mark('03-preview', '#upload-commit');

await click('#upload-commit');
await waitFor(`document.getElementById('upload-errors').classList.contains('success')`);
await sleep(500);
await scrollTo('.generate-step', 300, 1100);
await mark('04-generate', '#generate-button');

await click('#generate-button');
await trimmedWait(`!document.getElementById('workspace').classList.contains('hidden')&&document.querySelectorAll('.requirement').length>0`);
await sleep(900);
await js(`[...document.querySelectorAll('.group-button')].find(b=>/Interior/.test(b.textContent)).setAttribute('data-demo-group','1')`);
await scrollTo('#workspace', 0, 700);
await click('[data-demo-group]');
await sleep(500);
if (!(await js(`/Interior/.test(document.querySelector('.group-button.active')?.textContent||'')`))) {
  console.log('! domain click missed:', await rect('[data-demo-group]'), await js(`document.querySelector('.group-button.active')?.textContent`), await js('scrollY'));
  await js(`document.querySelector('[data-demo-group]').click()`);
}
await sleep(700);
await markCard('/seating comfort/i');
await scrollTo('[data-demo] .card-reasoning summary', 640, 900);
await mark('05-requirements', '[data-demo] .card-reasoning summary');

await click('[data-demo] .card-reasoning summary');
await sleep(400);
await scrollTo('[data-demo] [data-up]', 830, 1300);
await moveTo('[data-demo] .why-cols', { fx: 0.75, fy: 0.3 });
await sleep(400);
await mark('06-reasoning', '[data-demo] .evidence-link', { focus: '[data-demo] .reasoning-panel' });

await click('[data-demo] .evidence-link');
await waitFor(`document.getElementById('detail-dialog').open`);
await sleep(700);
await js(`[...document.querySelectorAll('#detail-dialog .cite-group')].find(g=>/^Competitors/.test(g.querySelector('h4').textContent.trim())).setAttribute('data-demo-cites','1')`);
await js(`document.querySelector('[data-demo-cites]').scrollIntoView({behavior:'smooth',block:'start'})`);
await sleep(1300);
await moveTo('[data-demo-cites] .cite:first-of-type blockquote', { fx: 0.6, fy: 0.4 });
await mark('06b-competitors', null, { focus: '[data-demo-cites]' });

await js(`document.querySelector('#detail-dialog .close').scrollIntoView({behavior:'smooth',block:'start'})`);
await sleep(1200);
await click('#detail-dialog .close');
await waitFor(`!document.getElementById('detail-dialog').open`);
await sleep(600);
await scrollTo('[data-demo] [data-up]', 830, 900);
await mark('06c-move-up', '[data-demo] [data-up]');

await click('[data-demo] [data-up]');
await sleep(700);
await markCard('/seating comfort/i');
await js(`document.querySelectorAll('.card-reasoning').forEach(d=>d.open=false)`);
await scrollTo('[data-demo]', 130, 900);
await mark('07-moved', '[data-demo] [data-approve]');

await click('[data-demo] [data-approve]');
await waitFor(`document.getElementById('detail-dialog').open`);
await sleep(900);
await js(`document.getElementById('pm-rationale').scrollIntoView({behavior:'smooth',block:'center'})`);
await sleep(900);
// Headless Chrome has no microphone: stand in for the browser's speech recognition so the app's
// real dictation UI runs and fills in the words as they are "heard".
await js(`window.SpeechRecognition=class{start(){const words=${JSON.stringify('Moved seating comfort to number one. Seat complaints and defects are a real pain point on long US drives, while the audio settings mostly need clearer controls.')}.split(' ');let i=0;const tick=()=>{i=Math.min(words.length,i+1+(Math.random()<.35?1:0));this.onresult?.({results:[[{transcript:words.slice(0,i).join(' ')}]]});if(i<words.length)setTimeout(tick,150+Math.random()*170);else setTimeout(()=>this.onend?.(),900)};setTimeout(tick,900)}stop(){this.onend?.()}}`);
await click('#record-rationale');
await waitFor(`/Dictate/.test(document.getElementById('record-rationale').textContent)&&document.getElementById('pm-rationale').value.length>40`, 60000);
await sleep(500);
await mark('08-approve', '#approve-requirement', { focus: '#detail-dialog .decision-box' });

await click('#approve-requirement');
await waitFor(`!document.getElementById('detail-dialog').open`);
await sleep(900);
await markCard('/seating comfort/i');
await js(`document.querySelectorAll('.card-reasoning').forEach(d=>d.open=false)`);
await scrollTo('[data-demo]', 130, 900);
await moveTo('[data-demo] .approval-state, [data-demo] .actions');
await mark('09-approved', null);

// Six months later: shift every record from demo 1 back in time, on the server and in the browser.
const shiftAt = (events, delta) => events.map(event => ({ ...event, at: new Date(Date.parse(event.at) + delta).toISOString() }));
const eventsFile = join(APP_DATA, 'decision-events.ndjson');
const serverEvents = readFileSync(eventsFile, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
const delta = Date.parse(HANDOVER_FROM) - Math.max(...serverEvents.map(event => Date.parse(event.at)));
writeFileSync(eventsFile, shiftAt(serverEvents, delta).map(event => JSON.stringify(event)).join('\n') + '\n');
await js(`(()=>{const events=JSON.parse(localStorage.getItem('decision-events')||'[]').map(e=>({...e,at:new Date(Date.parse(e.at)+${delta}).toISOString()}));localStorage.setItem('decision-events',JSON.stringify(events))})()`);
await send('Page.navigate', { url: BASE });
await waitFor(`document.getElementById('generate-button')&&!document.getElementById('generate-button').disabled`);
await sleep(800);
await js(CURSOR);
await js(`window.__cursor.move(900,300,10)`);
await sleep(700);
const demo2Start = now();

// Demo 2
await click('#new-feature-button');
await js(`window.scrollTo({top:0,behavior:'instant'})`);
await sleep(900);
await mark('10-diary', '#diary-period + .bmw-select .bmw-select-trigger', { start: demo2Start });

await scrollTo('.diary-story-controls', 330, 900);
await click('#diary-period + .bmw-select .bmw-select-trigger');
await sleep(400);
const onboarding = await js(`[...document.getElementById('diary-period').options].findIndex(o=>o.value==='onboarding')`);
await mark('11-storyline-menu', `#diary-period + .bmw-select li[data-index="${onboarding}"]`);

await click(`#diary-period + .bmw-select li[data-index="${onboarding}"]`);
await sleep(500);
await mark('12-storyline-range', '#diary-story');

await click('#diary-story');
await trimmedWait(`document.querySelector('.diary-summary-card')||document.querySelector('#diary-summary [role=alert]')`);
const storyError = await js(`document.querySelector('#diary-summary [role=alert]')?.textContent||''`);
if (storyError) throw new Error(`Storyline failed: ${storyError}`);
await sleep(500);
await scrollTo('.diary-summary-card', 120, 1100);
await moveTo('.diary-summary-card', { fx: 0.7, fy: 0.35 });
await mark('13-storyline', null, { focus: '.diary-summary-card' });

await click('[data-view="overview"]');
await sleep(500);
await scrollTo('#product-context', 105, 1100);
await click('#months'); await js(`document.getElementById('months').select()`); await typeInto('#months', '24', 90);
await click('#people'); await js(`document.getElementById('people').select()`); await typeInto('#people', '8', 90);
await moveTo('#importance', { fx: 0.62 });
await setValue('importance', 5);
await moveTo('#importance', { fx: 0.47 });
await mark('14-setup-again', null);

await scrollTo('.generate-step', 300, 1300);
await mark('14b-generate-again', '#generate-button');

await click('#generate-button');
await sleep(1200);
await trimmedWait(`!document.getElementById('workspace').classList.contains('hidden')&&!document.getElementById('generate-button').disabled`);
await sleep(900);
await js(`[...document.querySelectorAll('.group-button')].find(b=>/Interior/.test(b.textContent)).setAttribute('data-demo-group','1')`);
await scrollTo('#workspace', 0, 700);
await click('[data-demo-group]');
await sleep(500);
if (!(await js(`/Interior/.test(document.querySelector('.group-button.active')?.textContent||'')`))) {
  console.log('! domain click missed:', await rect('[data-demo-group]'), await js(`document.querySelector('.group-button.active')?.textContent`), await js('scrollY'));
  await js(`document.querySelector('[data-demo-group]').click()`);
}
await sleep(700);
await markCard('/seating comfort/i');
await scrollTo('[data-demo] .card-reasoning summary', 640, 900);
await mark('15-requirements-again', '[data-demo] .card-reasoning summary');

await click('[data-demo] .card-reasoning summary');
await sleep(400);
await scrollTo('[data-demo]', 110, 1100);
await moveTo('[data-demo] .why-memory', { fx: 0.8, fy: 0.5 });
await mark('16-memory', null, { focus: '[data-demo] .why-memory' });
console.log('demo 2 Interior:', await js(`[...document.querySelectorAll('.requirement')].slice(0,3).map(c=>c.querySelector('.outcome').textContent+' '+c.querySelector('.meta').textContent.match(/Priority \\d+/)?.[0]).join(' | ')`));
console.log('seats parts:', await js(`[...document.querySelectorAll('[data-demo] .mix-legend li')].map(l=>l.textContent).join(' | ')`));

await scrollTo('[data-demo] .score-mix', 560, 1200);
await moveTo('[data-demo] .mix-legend .mix-memory', { fx: 0.5, fy: 0.5 });
await mark('16b-score', null, { focus: '[data-demo] .score-mix' });

await sleep(500);
await send('Page.stopScreencast');
await sleep(500);
writeFileSync(join(OUT, 'timeline.json'), JSON.stringify({ start: recordingStart, steps, cuts, frames, size: { width: Math.round(W * SCALE), height: Math.round(H * SCALE) } }, null, 1));
console.log(`frames ${frames.length} · cuts ${cuts.length} · errors`, errors);
ws.close(); cleanup();
