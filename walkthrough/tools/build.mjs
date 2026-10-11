// Builds walkthrough/index.html: an offline, clickable demo walkthrough that plays one screen-recorded
// clip per step (from record.mjs + encode.mjs) and pauses on hotspots the presenter clicks.
// Usage: node build.mjs <media-dir-with-manifest.json> <out-dir>
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [MEDIA = '/tmp/walkthrough-capture/media', OUT_DIR] = process.argv.slice(2);
const recorded = Object.fromEntries(JSON.parse(readFileSync(join(MEDIA, 'manifest.json'), 'utf8')).map(step => [step.name, step]));
rmSync(join(OUT_DIR, 'media'), { recursive: true, force: true });
cpSync(MEDIA, join(OUT_DIR, 'media'), { recursive: true, filter: source => !source.endsWith('manifest.json') });

// Presenter copy per captured step. `label` names the click; `zoom` uses the recorded focus box.
const SHOT_COPY = {
  '01-setup': { chapter: 'demo1', title: 'Set the upfront requirements', text: 'Vehicle, market, time to market, team size and how much the deadline matters. Every ranking is filtered and weighted against this.', label: 'Add evidence' },
  '02-evidence': { chapter: 'demo1', title: 'Add your own evidence', text: 'Customer feedback, market data, global trends or past decisions. Here: a customer-feedback CSV, weighted the same as BMW data.', label: 'Preview rows' },
  '03-preview': { chapter: 'demo1', title: 'Check it before it counts', text: 'Every row is matched to an existing feature. The PM corrects anything wrong before it enters the knowledge base.', label: 'Add 8 rows' },
  '04-generate': { chapter: 'demo1', title: 'Generate', text: 'BMW 5 Series, United States, 18 months, 12 people, deadline 8/10, plus 8 rows of our own evidence.', label: 'Generate requirements' },
  '05-requirements': { chapter: 'demo1', title: 'Ranked requirements per vehicle domain', text: 'Interior & Comfort. Seating comfort sits at #2, behind the audio settings.', label: 'Evidence & reasoning' },
  '06-reasoning': { chapter: 'demo1', title: 'Reasoning anyone can check', text: 'Why it exists, why #2, what our upload added, and what makes up the score: customer demand, timeline fit, market evidence and competitor data. No past decisions yet.', label: 'View cited sources', zoom: true },
  '06b-competitors': { chapter: 'demo1', title: 'Every claim has a source, competitors included', text: 'Nine competitor signals from the workbook: Mercedes E-Class and Audi A6 reports and equipment lists, each linked to its row and original source.', zoom: true },
  '06c-move-up': { chapter: 'demo1', title: 'Back to the ranking', text: 'The PM has seen the evidence. Now they decide.', label: 'Move up' },
  '07-moved': { chapter: 'demo1', title: 'The PM decides the order', text: 'Seating comfort moves to #1. The AI proposes; the PM decides.', label: 'Approve' },
  '08-approve': { chapter: 'demo1', title: 'Say why, out loud', text: 'The PM dictates the reason; it is transcribed live and saved with the decision in Decision Memory.', label: 'Approve requirement', zoom: true },
  '09-approved': { chapter: 'demo1', title: 'Approved, with its reason', text: 'This is what the challenge asked for.' },
  '10-diary': { chapter: 'demo2', title: 'October: a new PM joins the project', text: 'Day one: the Project Diary shows every change and decision on this vehicle, including the April decisions of the previous PM.', label: 'Storyline' },
  '11-storyline-menu': { chapter: 'demo2', title: 'Pick the onboarding storyline', text: 'From the first recorded decision to today.', label: 'Onboarding' },
  '12-storyline-range': { chapter: 'demo2', title: 'The whole project history', text: 'Every recorded change in the range goes into the storyline.', label: 'Generate storyline' },
  '13-storyline': { chapter: 'demo2', title: 'The project in five minutes', text: 'What was decided, in what order, and why, each linked back to the recorded event.', zoom: true },
  '14-setup-again': { chapter: 'demo2', title: 'The new PM sets their own constraints', text: '24 months, 8 people, deadline priority 5/10. Same vehicle, same market.' },
  '14b-generate-again': { chapter: 'demo2', title: 'Generate again', text: 'Nothing new uploaded. Decision Memory travels with the project.', label: 'Generate requirements' },
  '15-requirements-again': { chapter: 'demo2', title: 'Seating comfort leads, tagged Past decision', text: 'The new PM sees immediately that this requirement already has history.', label: 'Evidence & reasoning' },
  '16-memory': { chapter: 'demo2', title: 'The previous PM’s reasoning, on the requirement', text: 'Decision Memory shows who approved it, when, and why. No upload, no search: it travels with the project.', zoom: true },
  '16b-score': { chapter: 'demo2', title: 'And it carries weight in the ranking', text: 'Past decisions are now part of the score, next to customer demand, timeline fit, market evidence and competitor data.', zoom: true }
};

const QUOTE = 'When I join a project during a handover, I have zero context on what was decided before, or why. I’d love to see the project’s past decisions and the reasons behind them.';

const steps = [
  { type: 'slide', chapter: 'intro', kind: 'title', html: `<p class="kicker-line">BMW Product Intelligence</p><h1 class="display">From thousands of customer voices<br>to requirements a PM can defend.</h1><p class="lede">A recorded, clickable walkthrough of the live demo. Click the highlighted control, or press <kbd>→</kbd>.</p><button class="start" data-next>Start the demo <span aria-hidden="true">→</span></button>` },
  ...['01-setup', '02-evidence', '03-preview', '04-generate', '05-requirements', '06-reasoning', '06b-competitors', '06c-move-up', '07-moved', '08-approve', '09-approved'].map(name => ({ type: 'shot', name })),
  { type: 'slide', chapter: 'gap', kind: 'scope', html: `<p class="kicker-line">The challenge</p><h2 class="display">That was the brief.<br>And what every team built.</h2><ol class="scope-list"><li><span>01</span>Upfront requirements</li><li><span>02</span>Evidence in</li><li><span>03</span>Ranked requirements with reasoning</li><li><span>04</span>PM decides</li></ol><p class="lede">So we went back and talked to product managers.</p>` },
  { type: 'slide', chapter: 'gap', kind: 'quote', html: `<blockquote class="quote">${QUOTE.split(' ').map((word, i) => `<span style="--i:${i}">${word}</span>`).join(' ')}</blockquote><p class="attribution"><strong>Former Product Manager, Vodafone</strong><span>Quoted with his consent</span></p>` },
  { type: 'slide', chapter: 'demo2', kind: 'divider', html: `<p class="kicker-line">Demo 2 · Six months later</p><h2 class="display">A handover.<br>The new PM starts with the memory, not from zero.</h2>` },
  ...['10-diary', '11-storyline-menu', '12-storyline-range', '13-storyline', '14-setup-again', '14b-generate-again', '15-requirements-again', '16-memory', '16b-score'].map(name => ({ type: 'shot', name })),
  { type: 'slide', chapter: 'close', kind: 'close', html: `<p class="kicker-line">Product Intelligence</p><h2 class="display">Vehicle projects run for years.<br>PMs change. Decisions shouldn’t get lost.</h2><ul class="pillars"><li><strong>Decision memory</strong><span>Every approval and rejection keeps its reason, and the reason counts in the next ranking.</span></li><li><strong>Onboarding</strong><span>A new PM reads the project’s story before the first meeting.</span></li><li><strong>Handover</strong><span>The next cycle starts where the last one left off.</span></li></ul><p class="lede">We don’t replace product managers. We give them the memory of everyone who came before.</p>` }
].map(step => {
  if (step.type !== 'shot') return step;
  const rec = recorded[step.name], copy = SHOT_COPY[step.name];
  if (!rec) throw new Error(`Missing capture for ${step.name}`);
  return { type: 'shot', chapter: copy.chapter, title: copy.title, text: copy.text, label: copy.label || '', clip: `media/${rec.clip}`, poster: `media/${rec.poster}`, hotspot: copy.label ? rec.hotspot : null, focus: copy.zoom ? rec.focus : null };
});

const CHAPTERS = [['intro', 'Intro'], ['demo1', 'Demo 1 · The brief'], ['gap', 'What PMs told us'], ['demo2', 'Demo 2 · Memory'], ['close', 'Close']];

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BMW Product Intelligence · Demo walkthrough</title>
<style>
:root{
  --ink:#172230;--muted:#5d6b7c;--line:#cbd5df;--bg:#f4f7fb;--panel:#ffffff;--blue:#0669d7;--blue-soft:#e8f1fc;
  --night:#0b1a2b;--night-ink:#e9eef5;--night-muted:#9fb0c3;
  --ease:cubic-bezier(.16,1,.3,1);--font:Inter,"Helvetica Neue",Helvetica,Arial,sans-serif;
}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font-family:var(--font);-webkit-font-smoothing:antialiased;overflow:hidden}
::selection{background:var(--blue);color:#fff}
button{font:inherit;color:inherit}
kbd{display:inline-block;min-width:1.6em;padding:0 .35em;border:1px solid currentColor;font:inherit;font-size:.85em;text-align:center}

/* ---------- Top bar ---------- */
.topbar{position:fixed;inset:0 0 auto 0;height:64px;display:flex;align-items:center;gap:28px;padding:0 32px;background:rgba(244,247,251,.92);border-bottom:1px solid var(--line);z-index:10;backdrop-filter:saturate(1.2) blur(8px);transition:background-color .6s var(--ease),border-color .6s var(--ease),color .6s var(--ease)}
.brand{display:flex;align-items:baseline;gap:10px;white-space:nowrap}
.brand strong{font-size:16px;font-weight:600}
.brand span{font-size:14px;color:var(--muted)}
.chapters{display:flex;gap:0;margin-left:auto}
.chapters button{position:relative;padding:22px 16px 20px;background:none;border:0;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);cursor:pointer;transition:color .3s}
.chapters button::after{content:'';position:absolute;left:16px;right:16px;bottom:-1px;height:2px;background:var(--blue);transform:scaleX(0);transform-origin:left;transition:transform .6s var(--ease)}
.chapters button[aria-current="true"]{color:var(--ink)}
.chapters button[aria-current="true"]::after{transform:scaleX(1)}
.chapters button:hover{color:var(--ink)}
.counter{min-width:64px;text-align:right;font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums}
.progress{position:fixed;left:0;top:63px;height:2px;background:var(--blue);z-index:11;transition:width .7s var(--ease)}
body.dark .topbar{background:rgba(11,26,43,.9);border-color:#22354b;color:var(--night-ink)}
body.dark .brand span,body.dark .chapters button,body.dark .counter{color:var(--night-muted)}
body.dark .chapters button[aria-current="true"],body.dark .chapters button:hover{color:#fff}

/* ---------- Stages ---------- */
.stage{position:fixed;inset:64px 0 0 0;display:grid;opacity:0;visibility:hidden;transition:opacity .7s var(--ease),visibility .7s}
.stage.on{opacity:1;visibility:visible}
#slide-stage{background:var(--night);color:var(--night-ink);place-items:center}
#slide-stage.light{background:var(--bg);color:var(--ink)}
body.dark{background:var(--night)}

/* ---------- Screenshot stage ---------- */
#shot-stage{grid-template-rows:1fr auto;justify-items:center;padding:22px 32px 0}
.frame{position:relative;width:min(100%,calc((100vh - 64px - 22px - 150px) * 1.6));aspect-ratio:16/10;align-self:center;overflow:hidden;background:#fff;border:1px solid var(--line);box-shadow:0 24px 60px -24px rgba(23,34,48,.35)}
.camera{position:absolute;inset:0;transform-origin:0 0;transition:transform 1.15s var(--ease);will-change:transform}
.camera img,.camera video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;user-select:none;-webkit-user-drag:none}
.camera .on{opacity:1}
.camera img.fade{transition:opacity .55s var(--ease)}
.playing .hotspot{display:none}
.frame::after{content:'';position:absolute;left:0;bottom:0;height:3px;width:var(--clip-progress,0%);background:var(--blue);opacity:.0;transition:opacity .3s}
.playing.frame::after{opacity:.85}
.hotspot{position:absolute;padding:0;border:2px solid var(--blue);background:rgba(6,105,215,.06);cursor:pointer;opacity:0;transform:scale(.92);transition:opacity .45s var(--ease),transform .45s var(--ease),left .9s var(--ease),top .9s var(--ease),width .9s var(--ease),height .9s var(--ease)}
.hotspot.on{opacity:1;transform:none}
.hotspot::before{content:'';position:absolute;inset:-2px;border:2px solid var(--blue);animation:halo 1.8s var(--ease) infinite;pointer-events:none}
@keyframes halo{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(1.18,1.5)}}
.hotspot .tag{position:absolute;left:50%;bottom:calc(100% + 10px);transform:translateX(-50%);white-space:nowrap;padding:6px 11px;background:var(--blue);color:#fff;font-size:13px;font-weight:600;letter-spacing:.02em;pointer-events:none}
.hotspot .tag::after{content:'';position:absolute;left:50%;top:100%;margin-left:-6px;border:6px solid transparent;border-top-color:var(--blue)}
.hotspot.below .tag{bottom:auto;top:calc(100% + 10px)}
.hotspot.below .tag::after{top:auto;bottom:100%;border-top-color:transparent;border-bottom-color:var(--blue)}
.hotspot:hover,.hotspot:focus-visible{background:rgba(6,105,215,.14);outline:none}
.hotspot:focus-visible{box-shadow:0 0 0 4px rgba(6,105,215,.35)}

.caption{width:min(100%,calc((100vh - 64px - 22px - 150px) * 1.6));display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:22px;padding:18px 0 22px}
.caption .num{font-size:13px;font-weight:700;letter-spacing:.08em;color:var(--blue);font-variant-numeric:tabular-nums;white-space:nowrap}
.caption h2{margin:0 0 4px;font-size:22px;font-weight:600;letter-spacing:-.01em}
.caption p{margin:0;font-size:16px;line-height:1.45;color:var(--muted);max-width:90ch}
.caption .copy{min-width:0}
.caption .copy>*{animation:rise .7s var(--ease) both}
.caption .copy p{animation-delay:.08s}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.nav{display:flex;gap:8px}
.nav button{height:44px;min-width:44px;padding:0 16px;border:1px solid var(--line);background:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:border-color .2s,background-color .2s,color .2s}
.nav button:hover{border-color:var(--ink)}
.nav button.primary{background:var(--blue);border-color:var(--blue);color:#fff}
.nav button.primary:hover{background:#0553ad}
.nav button:disabled{opacity:.35;cursor:default}
.nav button:focus-visible,.chapters button:focus-visible,.start:focus-visible{outline:2px solid var(--blue);outline-offset:2px}

/* ---------- Slides ---------- */
.slide{width:min(1180px,calc(100vw - 96px));padding:40px 0}
.slide>*{animation:rise .9s var(--ease) both}
.slide>*:nth-child(2){animation-delay:.12s}.slide>*:nth-child(3){animation-delay:.24s}.slide>*:nth-child(4){animation-delay:.36s}.slide>*:nth-child(5){animation-delay:.48s}
.kicker-line{display:flex;align-items:center;gap:14px;margin:0 0 26px;font-size:14px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--night-muted)}
.kicker-line::before{content:'';width:36px;height:2px;background:var(--blue)}
.display{margin:0;font-size:clamp(40px,5.2vw,74px);line-height:1.04;font-weight:500;letter-spacing:-.035em;text-wrap:balance}
.lede{margin:32px 0 0;font-size:clamp(18px,1.6vw,23px);line-height:1.45;color:var(--night-muted);max-width:60ch}
.start{margin-top:40px;height:56px;padding:0 28px;border:0;background:var(--blue);color:#fff;font-size:16px;font-weight:600;letter-spacing:.04em;cursor:pointer;transition:background-color .2s,transform .2s var(--ease)}
.start:hover{background:#0553ad}.start:active{transform:translateY(1px)}
.scope-list{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin:44px 0 0;padding:0;list-style:none;border-top:1px solid #2a4058}
.scope-list li{padding:20px 18px 0 0;font-size:clamp(17px,1.4vw,21px);line-height:1.35;color:var(--night-ink);opacity:0;animation:rise .8s var(--ease) both}
.scope-list li:nth-child(1){animation-delay:.35s}.scope-list li:nth-child(2){animation-delay:.47s}.scope-list li:nth-child(3){animation-delay:.59s}.scope-list li:nth-child(4){animation-delay:.71s}
.scope-list span{display:block;margin-bottom:8px;font-size:13px;font-weight:700;letter-spacing:.08em;color:var(--blue)}
.quote{position:relative;margin:0;padding:0;font-size:clamp(30px,3.6vw,52px);line-height:1.22;font-weight:400;letter-spacing:-.02em;text-wrap:balance;quotes:'\\201C' '\\201D'}
.quote::before{content:open-quote;position:absolute;left:-.55em;top:-.05em;color:var(--blue)}
.quote::after{content:close-quote;color:var(--blue)}
.quote span{display:inline-block;opacity:0;filter:blur(6px);transform:translateY(6px);animation:word .6s var(--ease) forwards;animation-delay:calc(.25s + var(--i) * .055s)}
@keyframes word{to{opacity:1;filter:none;transform:none}}
.attribution{display:flex;flex-direction:column;gap:4px;margin:40px 0 0;padding-top:20px;border-top:1px solid #2a4058;animation-delay:2.2s!important}
.attribution strong{font-size:20px;font-weight:600;color:#fff}
.attribution span{font-size:15px;color:var(--night-muted)}
.pillars{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin:44px 0 0;padding:28px 0 0;list-style:none;border-top:1px solid #2a4058}
.pillars strong{display:block;margin-bottom:8px;font-size:20px;font-weight:600;color:#fff}
.pillars span{font-size:16px;line-height:1.5;color:var(--night-muted)}
.hint{position:fixed;right:32px;bottom:22px;font-size:13px;color:var(--night-muted);z-index:5;transition:opacity .4s}
body:not(.dark) .hint{opacity:0}

@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-delay:0s!important;transition-duration:.01ms!important}}
</style>
</head>
<body>
<header class="topbar">
  <div class="brand"><strong>Product Intelligence</strong><span>BMW · Demo walkthrough</span></div>
  <nav class="chapters" aria-label="Chapters">${CHAPTERS.map(([key, label]) => `<button type="button" data-chapter="${key}">${label}</button>`).join('')}</nav>
  <div class="counter" id="counter"></div>
</header>
<div class="progress" id="progress"></div>

<main>
  <section class="stage" id="slide-stage" aria-live="polite"><div class="slide" id="slide"></div></section>
  <section class="stage" id="shot-stage">
    <div class="frame" id="frame">
      <div class="camera" id="camera">
        <img id="still" alt="">
        <video id="vid-a" muted playsinline preload="auto"></video><video id="vid-b" muted playsinline preload="auto"></video>
        <button class="hotspot" id="hotspot" type="button"><span class="tag" id="tag"></span></button>
      </div>
    </div>
    <div class="caption">
      <span class="num" id="num"></span>
      <div class="copy" id="copy"></div>
      <div class="nav"><button type="button" id="back" aria-label="Previous step">←</button><button type="button" id="next" class="primary">Next →</button></div>
    </div>
  </section>
</main>
<p class="hint">Press <kbd>→</kbd> to continue · <kbd>F</kbd> full screen</p>

<script>
const STEPS = ${JSON.stringify(steps)};
const $ = id => document.getElementById(id);
let index = -1, zoomTimer = 0, hotspotTimer = 0, playing = null;
const videos = [$('vid-a'), $('vid-b')];
let active = 0;

const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shotNumber = i => STEPS.slice(0, i + 1).filter(step => step.type === 'shot' && step.chapter === STEPS[i].chapter).length;
const shotTotal = chapter => STEPS.filter(step => step.type === 'shot' && step.chapter === chapter).length;
const nextShot = from => STEPS.slice(from + 1).find(step => step.type === 'shot');

// Camera: zoom so the focus box fills the frame, clamped to the recording's edges.
function cameraFor(focus) {
  if (!focus) return { s: 1, tx: 0, ty: 0 };
  const pad = 0.04, s = Math.max(1, Math.min(2.4, 1 / (focus.w + pad * 2), 1 / (focus.h + pad * 2)));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const tx = clamp(0.5 - (focus.x + focus.w / 2) * s, 1 - s, 0), ty = clamp(0.5 - (focus.y + focus.h / 2) * s, 1 - s, 0);
  return { s, tx, ty };
}
const applyCamera = cam => { $('camera').style.transform = 'translate(' + cam.tx * 100 + '%,' + cam.ty * 100 + '%) scale(' + cam.s + ')'; };
const visibleUnder = (box, cam) => {
  const x = box.x * cam.s + cam.tx, y = box.y * cam.s + cam.ty;
  return x >= 0 && y >= 0 && x + box.w * cam.s <= 1 && y + box.h * cam.s <= 1;
};

function placeHotspot(step, cam) {
  const spot = $('hotspot');
  spot.classList.remove('on');
  if (!step.hotspot || !visibleUnder(step.hotspot, cam)) { spot.hidden = true; return; }
  const h = step.hotspot;
  spot.hidden = false;
  Object.assign(spot.style, { left: h.x * 100 + '%', top: h.y * 100 + '%', width: h.w * 100 + '%', height: h.h * 100 + '%' });
  spot.classList.toggle('below', h.y < 0.16);
  spot.setAttribute('aria-label', step.label);
  $('tag').textContent = step.label;
  // Counter-scale the label so it stays readable when the camera zooms in.
  $('tag').style.transform = 'translateX(-50%) scale(' + 1 / cam.s + ')';
  $('tag').style.transformOrigin = h.y < 0.16 ? '50% 0' : '50% 100%';
  hotspotTimer = setTimeout(() => spot.classList.add('on'), cam.s > 1 ? 900 : 250);
}

// End state of a step: its last frame, zoom, hotspot.
function settle(step, animateZoom) {
  playing = null;
  $('frame').classList.remove('playing');
  $('frame').style.setProperty('--clip-progress', '0%');
  const cam = cameraFor(step.focus);
  clearTimeout(zoomTimer);
  if (animateZoom) zoomTimer = setTimeout(() => applyCamera(cam), 120); else applyCamera(cam);
  placeHotspot(step, cam);
  $('next').textContent = step.hotspot && !$('hotspot').hidden ? 'Skip →' : 'Next →';
  preload(index);
}

function showStill(step) {
  const still = $('still');
  still.classList.remove('fade');
  still.src = step.poster;
  still.classList.add('on');
  videos.forEach(v => { v.pause(); v.classList.remove('on'); });
}

// Keep the next clip buffered in the idle video element.
function preload(from) {
  const upcoming = nextShot(from);
  const idle = videos[1 - active];
  if (upcoming && !idle.src.endsWith(upcoming.clip)) { idle.src = upcoming.clip; idle.load(); }
}

function playClip(step) {
  const video = videos.find(v => v.src.endsWith(step.clip)) || videos[1 - active];
  if (!video.src.endsWith(step.clip)) { video.src = step.clip; video.load(); }
  active = videos.indexOf(video);
  playing = step;
  $('frame').classList.add('playing');
  $('next').textContent = 'Skip clip ⇥';
  applyCamera({ s: 1, tx: 0, ty: 0 });
  video.currentTime = 0;
  const start = () => {
    if (playing !== step) return;
    video.classList.add('on');
    // The clip opens on the previous end frame, so hiding the still is seamless.
    requestAnimationFrame(() => { $('still').classList.remove('on'); videos.forEach(v => v !== video && v.classList.remove('on')); });
  };
  video.onplaying = start;
  video.ontimeupdate = () => { if (video.duration) $('frame').style.setProperty('--clip-progress', (video.currentTime / video.duration * 100) + '%'); };
  video.onended = () => { if (playing !== step) return; showStill(step); settle(step, true); };
  video.play().catch(() => { showStill(step); settle(step, false); });
}

function skipClip() {
  if (!playing) return;
  const step = playing;
  videos.forEach(v => { v.onended = null; v.pause(); });
  showStill(step);
  settle(step, true);
}

function showShot(step, previous, direction) {
  $('slide-stage').classList.remove('on');
  $('shot-stage').classList.add('on');
  document.body.classList.remove('dark');
  clearTimeout(zoomTimer); clearTimeout(hotspotTimer);
  $('hotspot').classList.remove('on');
  $('num').textContent = String(shotNumber(index)).padStart(2, '0') + ' / ' + String(shotTotal(step.chapter)).padStart(2, '0');
  $('copy').innerHTML = '<h2>' + escapeHtml(step.title) + '</h2><p>' + escapeHtml(step.text) + '</p>';
  // Moving forward one step plays the recording; anything else jumps straight to the end state.
  if (direction === 1 && previous >= 0 && STEPS.indexOf(nextShot(previous)) === index) playClip(step);
  else { showStill(step); settle(step, false); }
}

function showSlide(step) {
  playing = null;
  videos.forEach(v => v.pause());
  $('shot-stage').classList.remove('on');
  $('slide-stage').classList.add('on');
  document.body.classList.add('dark');
  $('slide').innerHTML = step.html;
  $('slide').querySelector('[data-next]')?.addEventListener('click', () => go(index + 1));
  preload(index);
}

function go(target, direction = 1) {
  if (target < 0 || target >= STEPS.length || target === index) return;
  const previous = index;
  index = target;
  const step = STEPS[index];
  if (step.type === 'shot') showShot(step, previous, Math.abs(target - previous) === 1 ? direction : 0);
  else showSlide(step);
  $('counter').textContent = (index + 1) + ' / ' + STEPS.length;
  $('progress').style.width = ((index + 1) / STEPS.length * 100) + '%';
  document.querySelectorAll('[data-chapter]').forEach(button => button.setAttribute('aria-current', String(button.dataset.chapter === step.chapter)));
  $('back').disabled = index === 0;
  $('next').disabled = index === STEPS.length - 1;
  history.replaceState(null, '', '#' + (index + 1));
}

const advance = () => (playing ? skipClip() : go(index + 1));
$('hotspot').addEventListener('click', () => go(index + 1));
$('next').addEventListener('click', advance);
$('back').addEventListener('click', () => go(index - 1, -1));
document.querySelectorAll('[data-chapter]').forEach(button => button.addEventListener('click', () => go(STEPS.findIndex(step => step.chapter === button.dataset.chapter), 0)));
document.addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(event.key)) { event.preventDefault(); advance(); }
  else if (['ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); go(index - 1, -1); }
  else if (event.key === 'Home') go(0, 0);
  else if (event.key === 'End') go(STEPS.length - 1, 0);
  else if (event.key.toLowerCase() === 'f') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
});

go(Math.min(STEPS.length, Math.max(1, Number(location.hash.slice(1)) || 1)) - 1, 0);
</script>
</body>
</html>
`;

writeFileSync(join(OUT_DIR, 'index.html'), html);
console.log(`Wrote ${join(OUT_DIR, 'index.html')} · ${steps.length} steps · media in ${join(OUT_DIR, 'media')}`);
