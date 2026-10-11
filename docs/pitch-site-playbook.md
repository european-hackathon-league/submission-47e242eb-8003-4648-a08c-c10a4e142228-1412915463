# Pitch website with a live demo: how the NeuroSpace deck was built, and what to do better

A write-up of `MNH26SSA/pitch/index.html` (Neuromorphic Hackathon 2026): the stack, the design system, the
animation techniques, the live-demo integration, how it was verified, and every mistake that cost time.
Use it as the starting brief for the next project.

---

## 1. Architecture at a glance

| Piece | What it is |
|---|---|
| `pitch/index.html` | One self-contained HTML file (~1,700 lines): all CSS in one `<style>`, all slides as `<section>`s, all JS at the bottom. No build step, opens by double-click. |
| Slide engine | **Reveal.js 5.1** from the jsDelivr CDN, plus its **Notes** plugin (press `S` for speaker view with timer). |
| Font | **JetBrains Mono** (400–800) from Google Fonts. |
| Live demo | A **Streamlit** dashboard (`streamlit_app.py`) running at `http://localhost:8501`, shown inside the deck as a full-screen interactive background iframe on one slide. |
| Media | Two looping MP4s and PNG frames in `pitch/assets/`, team photos in `../assets/team/`. |
| Script | `SCRIPT.md` (who says what, per click), `SOURCES.md` (a source for every number), speaker notes inside each slide. |
| Design brief | `PRODUCT.md` (users, purpose, principles) + `DESIGN.md` (tokens) at the project root, written before the UI. |

Why one file: zero tooling, anyone on the team can edit it, it opens in any browser, and Reveal's
Auto-Animate needs all slides in one DOM anyway. The cost: merge conflicts when several people edit it at
once (see section 8).

---

## 2. The design system

### 2.1 Brief first
`PRODUCT.md` and `DESIGN.md` were written before the deck and the dashboard. The direction was
**"aerospace mission control"** (SpaceX flight displays, NASA/JPL telemetry consoles). The rules it set:
- No pure black; deep slate backgrounds.
- Saturated colour **only for data and signals**, never for decoration.
- No heavy drop shadows, no glow halos, no bubbly rounded cards.
- Monospace tabular figures everywhere, so numbers don't jitter in width.

Do this again. One page of brief settles a hundred small arguments later.

### 2.2 Tokens (CSS custom properties on `:root`)
```css
--bg: #0b0e14;        /* canvas: deep slate, never #000 */
--surface: #111620;   /* cards, nodes */
--elevated: #171f2c;  /* active / hovered surface */
--border: #283446;  --border-subtle: #1c2534;  --border-hi: #3c4e68;
--text: #f1f5f9;  --text-2: #94a3b8;  --text-3: #6b7a90;
--cyan: #00f0ff;     /* OUR system (filtered track, active stage) */
--emerald: #00e699;  /* ground truth / "yes" */
--amber: #f59e0b;    /* warning, estimate, the problem */
--red: #ff3344;      /* hazard */
--purple: #a855f7;   /* raw network output + the brand logo */
--mono: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace;
--ease: cubic-bezier(0.65, 0, 0.35, 1);   /* the ONE easing curve for everything */
```
**The key decision: colours carry meaning, and the deck and the dashboard share them.** Cyan always means
"our track", green always means "truth", purple always means "raw network". So when the demo opens, the
audience already knows how to read it. Pick your semantic colours on day one and use them identically in
the slides and the app.

### 2.3 Typography
- One family (JetBrains Mono) in every weight. Everything is uppercase except the wordmark "NeuroSpace".
- `font-variant-numeric: tabular-nums` globally: count-up numbers don't wobble.
- A fixed scale for a 1920×1080 canvas, as classes:
  `.mega 300px/800` (hero numbers) · `.big 150px` · `.head 64px/700 uppercase` · `.body 30px` · `.label 24px, letter-spacing 0.12em` · `.kicker 22px, 0.16em`.
- Big numbers get negative letter-spacing (−0.04 to −0.05em); small uppercase labels get positive (0.12–0.16em).
  That contrast is most of the "designed" look.

### 2.4 Surfaces and details
- Background: a faint 1px dot grid (`radial-gradient` every 48px) instead of a flat colour: "coordinate paper" without noise.
- Cards: `--surface` + 1px `--border` + **2–4px radius**. Never larger.
- Active state = border turns cyan + background goes to `--elevated`. No shadows anywhere.
- All icons and diagrams are inline SVG drawn in the same stroke style (one `<symbol id="sat">` logo reused via `<use>`).
- Inline SVG, CSS grid and canvas for all graphics: no chart libraries, so everything matches the tokens.

### 2.5 Content rules (learned the hard way)
- **One idea per slide, as few words as possible.** Text-heavy slides, footers, captions and legends were all
  rejected and removed ("deslopify"). The spoken script carries the detail; the slide carries one number or one picture.
- **Every number has a source** (in the speaker notes and `SOURCES.md`) or is our own measurement.
  Unmeasured values carried an amber `EST` tag until real numbers replaced them.

---

## 3. Slide mechanics

### 3.1 Fixed canvas
```js
Reveal.initialize({ width: 1920, height: 1080, margin: 0, minScale: 0.1, maxScale: 2.0, ... })
```
```css
.reveal .slides section { width: 1920px; height: 1080px; padding: 0; }
```
Everything is laid out in absolute pixels on a 1920×1080 canvas and Reveal scales the whole thing to the
screen. This makes layouts predictable on any projector, and screenshots reproducible.

Layout helpers: `.abs` (absolute), `.row` / `.col` (flex), `.center-x` (full-width flex centring),
`.center-text` (full-width, text-align centre). **Positioning lives on wrapper divs, never on the element that morphs** (section 4).

### 3.2 Builds (fragments)
Reveal fragments with a custom transition using the same easing:
```css
.reveal .slides section .fragment { transition: opacity 600ms var(--ease), transform 600ms var(--ease); }
.fragment.rise { transform: translateY(16px); }   .fragment.rise.visible { transform: none; }
.fragment.pop  { transform: scale(0.85); }        .fragment.pop.visible  { transform: none; }
```
Only two kinds of build in the whole deck (rise and pop), so it feels consistent.

### 3.3 Speaker notes
Each slide has an `<aside class="notes">` with the speaker's name, the exact lines, `[CLICK]` markers, the
source of every number, and Q&A fallbacks. Press `S` for the speaker window with a timer.

---

## 4. Animations: Auto-Animate morphs (the part that took the most debugging)

Every slide is `<section data-auto-animate>`. Elements with the same `data-id` on consecutive slides morph
(position, size, colour) instead of cutting. Examples in the deck:
- The giant title wordmark shrinks into the top-left brand mark and **stays there across all slides**
  (`<p class="brand" data-id="brand">` on every slide).
- `355,848` (300px, centre) shrinks to a 64px line at the top while `89 s` appears below it.
- The 5-stage pipeline starts big in the centre, then morphs into a compact top bar that highlights the current
  stage on each of the five stage slides.
- A 100-cell grid (built in JS, one `data-id` per cell) morphs between slides, then the cells pop in one by one.

Global settings that made it smooth:
```js
transition: "fade", backgroundTransition: "fade",
autoAnimateDuration: 1.0,
autoAnimateEasing: "cubic-bezier(0.65, 0, 0.35, 1)",   // even ease-in-out: no snap, no bounce
autoAnimateUnmatched: true,
```

### The five rules that fixed broken morphs
1. **Use `center: true`, then pin slides to the top with CSS.** Auto-Animate measures real on-screen positions
   correctly only in centre mode. Our layouts are top-anchored, so:
   ```css
   .reveal .slides > section, .reveal .slides > section > section { top: 0 !important; }
   ```
   Without this, elements morphed from the wrong place (they jumped first, then animated).
2. **Morphing text must be a `<p>`, not a `<div>`.** For text elements Reveal animates `font-size`; for a div it
   scales the box with a transform *and* the text inside changes size, so it double-scales and wobbles.
   Set `.reveal .slides p { margin: 0; }`.
3. **Centred text that morphs sits in a full-width box** (`.center-text { left:0; right:0; text-align:center }`).
   Then only `y` and `font-size` animate. If the box is content-width, its `x` changes as the width changes and the
   text drifts sideways mid-morph.
4. **Don't put `position`/`left`/`top` on the morphing element itself.** Put it on a wrapper. Otherwise the start
   and end boxes don't match and the morph swings.
5. **Elements on hidden slides measure as 0×0.** The centred hero logo needed exact coordinates, so an invisible
   probe copy is rendered off-screen and measured, and the measurement is **re-run after `document.fonts.ready`**
   (the web font changes the width):
   ```js
   const probe = document.createElement("p");
   probe.className = "brand hero"; probe.style.cssText = "visibility:hidden;position:absolute;left:-9999px";
   document.querySelector(".reveal").appendChild(probe);
   function centre() { const left = Math.round((1920 - probe.offsetWidth) / 2); /* apply to .brand.hero.center */ }
   centre(); document.fonts.ready.then(centre);
   ```

### Other animation techniques used
- **Count-up numbers**: `data-count="355848"` → a requestAnimationFrame tween with cubic ease-out, 1.1 s, re-run on every slide entry.
- **Staggered grid build**: each cell gets `--i`, `transition-delay: calc(var(--i) * 9ms)`; the `built` class is removed on
  every slide change and re-added 450 ms after entry (after the morph has settled), so it replays when you go back.
- **Click-driven scene animation (Scalability slide)**: the Jetson board is thrown off-screen, a line-art satellite flies in
  and docks around the Akida chip, then the data path lights up. Implementation:
  - Three invisible fragments (`<span class="fragment step-trigger">`) give three clicks.
  - On `fragmentshown` **and** `fragmenthidden`, count the visible triggers and toggle classes `s1 s2 s3` on the stage.
    Handling `fragmenthidden` means going back un-plays the animation correctly.
  - All motion is CSS transitions keyed on those classes (`.scal-stage.s1 .scal-jetson { transform: translate(...) rotate(-42deg); opacity:0 }`),
    with `transform-box: view-box` and explicit `transform-origin` for SVG groups.
  - Different curves on purpose: an ease-in "throw" for the exit, a long ease-out (1.9 s) "dock" for the arrival,
    a single fill pulse when it locks, and infinite dash-offset animation for the data flow.
- **Canvas mini-game** (Galaga-style "people left" joke): drawn as a **pure function of time** `draw(t)`, restarted on
  slide entry, stopped on exit (no CPU burn in the background).
- **Seeded randomness** (a small LCG, `seed = seed * 16807 % 2147483647`) for the scatter plot, starfield and debris, so
  every run and every screenshot is identical.
- **Videos**: Reveal pauses videos when you leave a slide, so on every slide change the deck restarts the video on the
  current slide (forced `muted` for autoplay policy, swallowing the play() promise rejection) and pauses the rest.

---

## 5. The live demo integration

### 5.1 How it is embedded
```html
<section id="demo" data-background-iframe="DASHBOARD" data-background-interactive data-background-color="#0b0e14">
```
```js
const DASHBOARD_URL = "http://localhost:8501/?embed=true";   // one constant to change for another host
document.getElementById("demo").setAttribute("data-background-iframe", DASHBOARD_URL);
```
- `data-background-iframe` makes the app fill the whole screen behind the slide.
- `data-background-interactive` lets you click, drag sliders and press buttons in it.
- `?embed=true` is Streamlit's embed mode (strips its chrome). The dashboard's own CSS also hides Streamlit's header,
  toolbar, deploy button and decoration stripe.
- The URL lives in **one constant** at the bottom of the file, so it can point at the Jetson's IP if needed.

### 5.2 The keyboard-focus trap and its fix
Once you click inside the iframe, it owns the keyboard: arrow keys no longer advance the deck. Fix: a fixed
`NEXT ▸` button that's only visible on the demo slide (`body.on-demo .demo-next { display:block }`, class toggled in
`slidechanged`):
```js
document.getElementById("demoNext").addEventListener("click", () => { window.focus(); Reveal.next(); });
```
Put this in the speaker notes and the script ("after the demo, click NEXT").

### 5.3 Making the app look native inside the deck
- **Same tokens, same font, same semantic colours** as the deck: the transition from slide to demo looks like a continuation, not a different program.
- **One screen, no scrolling**: the dashboard was laid out so everything fits at the projector's resolution. The background
  iframe is **not** scaled with Reveal's 1920×1080 canvas; it renders at the real window size, so test it at the actual projector resolution.
- **Data source chosen automatically** (live chip → recorded model output → simulated), and simulated data is never presented as model output.
- **Choreography written down**: which scenario to select, where to drag the timeline, when the alarm fires, what to say at each moment.

### 5.4 Weaknesses to fix next time
- **If the app isn't running, the demo slide is blank.** Nothing in the deck detects that.
- **It needs a server**, so the deck can't be sent as a file with a working demo.
- There's no fallback recording.

---

## 6. Verification: headless Chrome screenshots

Visual problems (overflow, morph jumps, wrong colours) were caught by driving headless Chrome over the DevTools
protocol and taking screenshots, not by eye on one laptop. The scripts lived in `/tmp/cdp/` (e.g. `morph.py`, `deck.mjs`, `scal.py`).

Pattern:
1. Launch `Google Chrome --headless=new --remote-debugging-port=9341 --user-data-dir=<tmp profile>`.
2. `Emulation.setDeviceMetricsOverride` → 1920×1080 (also test 1440×900 and the projector size).
3. `Page.navigate` to the deck, wait for fonts.
4. For each slide: `Runtime.evaluate("Reveal.slide(i, 0, 99)")` (all fragments shown) → `Page.captureScreenshot`.
5. **Mid-morph frames**: go to slide *i*, trigger `Reveal.slide(i+1)`, wait **300 ms**, screenshot. This is how jumps and
   double-scaling were spotted: the end state can look perfect while the transition is broken.
6. Overflow check: list elements whose `scrollWidth > clientWidth` inside slides.
7. Collect `Runtime.exceptionThrown` and console logs so JS errors surface.

Minimal Node version (Node 22+, built-in WebSocket):
```js
import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new','--remote-debugging-port=9334','--hide-scrollbars','--user-data-dir=/tmp/cdp-profile','about:blank']);
const sleep = ms => new Promise(r => setTimeout(r, ms)); await sleep(2000);
const t = await (await fetch('http://127.0.0.1:9334/json')).json();
const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = e => send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'file:///ABSOLUTE/PATH/index.html' }); await sleep(3500);
const n = (await ev('Reveal.getTotalSlides()')).result.value;
for (let i = 0; i < n; i++) {
  await ev(`Reveal.slide(${i}, 0, 99)`); await sleep(1600);
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`shot-${i}.png`, Buffer.from(r.data, 'base64'));
}
ws.close(); chrome.kill();
```

---

## 7. Mistakes we made, and how to avoid them

### Animation and layout
| Mistake | Symptom | Fix / rule |
|---|---|---|
| `center: false` with Auto-Animate | Elements jumped before morphing | `center: true` + pin sections to `top: 0 !important` |
| Morphing `<div>` text | Text double-scaled / wobbled | Morphing text is always `<p>` |
| Content-width centred text | Text slid sideways mid-morph | Full-width `.center-text` box |
| Position on the morphing element | Morph swung or started offset | Position the wrapper only |
| Measuring elements on hidden slides | Width 0, logo off-centre | Off-screen probe + re-measure after `fonts.ready` |
| Bouncy / snappy easing | Felt cheap | One even ease-in-out curve, 1.0 s, for everything |
| Animations that only play once | Going back showed the end state | Reset on every `slidechanged`, re-trigger on entry, handle `fragmenthidden` |
| Random visuals | Different every run, flaky screenshots | Seeded random generator |
| Checking only end states | Broken transitions shipped | Screenshot mid-morph (300 ms in) |

### Demo
| Mistake | Fix |
|---|---|
| Iframe steals the keyboard | A NEXT button that calls `window.focus(); Reveal.next()` |
| App not running → blank slide | **Next time:** probe the URL on load and swap in a recorded video if it doesn't answer (section 9) |
| App layout scrolled on the projector | Design the app for one screen; test at the real projector resolution |
| A shared CSV corrupted by parallel writers (`model_predictions.csv`) | One output file per run/scenario; never let two processes append to one file |
| Risk of showing simulated data as real | Source label per scenario, and a written rule: never present simulated data as model output |

### Content and team process
| Mistake | Fix |
|---|---|
| Text-heavy slides, captions, footers | One idea per slide; the script carries the detail |
| Numbers without sources | `SOURCES.md` + source in each slide's notes; amber `EST` until measured |
| Speaker notes and `SCRIPT.md` drifted apart | **One** master (the script) and generate or paste the notes from it at the end |
| Teammates added/reordered slides in the same file | Merge commits, and the script's click counts went stale. Assign slide ownership, announce reorders, re-time after every pull |
| Results slide built before the results existed | Placeholders with `EST`, a list of open questions ("Waiting on Q3, Q10…") in the script |

### Portability
| Mistake | Fix |
|---|---|
| Reveal.js and the font from CDNs | Deck is dead offline. Vendor `reveal.js`, `reveal.css`, `notes.js` and the font files into `vendor/` |
| Assets outside the deck folder (`../assets/team/`) | Keep everything the deck loads inside its own folder |
| "Send the HTML" didn't work | Ship a zip of the folder, or a PDF export (`?print-pdf` → Chrome Print → Save as PDF), plus a demo video |

---

## 8. Recommended setup for the new project

```
pitch/
  index.html          # slides only
  css/tokens.css      # :root tokens (shared with the app if possible)
  css/deck.css
  js/deck.js          # Reveal init, hooks, animations
  vendor/reveal/      # reveal.js, reveal.css, plugin/notes  (no CDN)
  vendor/fonts/       # woff2 files + @font-face
  assets/             # every image/video the deck uses
  demo-fallback.mp4   # screen recording of the demo
  SCRIPT.md  SOURCES.md
tools/shoot.mjs       # headless screenshot script (section 6)
PRODUCT.md  DESIGN.md # brief + tokens, written first
```

Order of work:
1. **Brief**: `PRODUCT.md` (audience, the one message, principles) and `DESIGN.md` (tokens, type scale, semantic colours).
2. **Script before slides**: write `SCRIPT.md` per click, count words (~140/min), then design a slide for each beat.
3. **Skeleton deck** with the fixed canvas, tokens, brand mark morph and Reveal settings from sections 3–4.
4. **Demo app** using the same tokens, designed for one screen at the projector resolution.
5. **Embed** with the fallback (below), the NEXT button, and the URL in one constant.
6. **Screenshot pass** after every visual change: end states, mid-morph frames, overflow, console errors.
7. **Freeze**: no slide reorders in the last hours; re-time the full run after the final pull.

---

## 9. Snippets to reuse

**Reveal init (smooth morphs):**
```js
Reveal.initialize({
  width: 1920, height: 1080, margin: 0, minScale: 0.1, maxScale: 2.0,
  center: true, hash: true, controls: false, progress: true, slideNumber: false,
  transition: "fade", backgroundTransition: "fade",
  autoAnimateDuration: 1.0, autoAnimateEasing: "cubic-bezier(0.65, 0, 0.35, 1)", autoAnimateUnmatched: true,
  plugins: [RevealNotes],
});
```
```css
.reveal .slides section { width: 1920px; height: 1080px; padding: 0; }
.reveal .slides > section, .reveal .slides > section > section { top: 0 !important; }
.reveal .slides { text-align: left; }
.reveal .slides p { margin: 0; }
```

**Live demo with automatic video fallback (new, not in the NeuroSpace deck):**
```html
<section id="demo" data-background-color="#0b0e14" data-background-interactive>
  <video id="demoFallback" src="assets/demo-fallback.mp4" muted loop playsinline style="display:none;width:1920px;height:1080px"></video>
</section>
```
```js
const DEMO_URL = "http://localhost:8501/?embed=true";
async function demoAlive(url, ms = 1500) {
  try { await fetch(url, { mode: "no-cors", signal: AbortSignal.timeout(ms) }); return true; }   // any answer = server is up
  catch { return false; }
}
demoAlive(DEMO_URL).then((up) => {
  const s = document.getElementById("demo");
  if (up) s.setAttribute("data-background-iframe", DEMO_URL);
  else document.getElementById("demoFallback").style.display = "block";
  Reveal.sync();
});
```

**Focus hand-back button:**
```js
Reveal.on("slidechanged", (e) => document.body.classList.toggle("on-demo", e.currentSlide.id === "demo"));
document.getElementById("demoNext").addEventListener("click", () => { window.focus(); Reveal.next(); });
```

**Click-driven multi-step scene:**
```html
<span class="fragment step-trigger"></span><span class="fragment step-trigger"></span>   <!-- .step-trigger { display:none } -->
```
```js
function syncSteps() {
  const slide = document.getElementById("scene"), stage = slide.querySelector(".stage");
  const step = slide.querySelectorAll(".step-trigger.visible").length;
  [1, 2, 3].forEach((k) => stage.classList.toggle(`s${k}`, step >= k));
}
Reveal.on("fragmentshown", syncSteps); Reveal.on("fragmenthidden", syncSteps); Reveal.on("slidechanged", syncSteps);
```

**Video restart on entry:**
```js
Reveal.on("slidechanged", (e) => setTimeout(() => {
  document.querySelectorAll(".reveal .slides video").forEach((v) => {
    if (e.currentSlide.contains(v)) { v.muted = true; v.play()?.catch(() => {}); } else v.pause();
  });
}, 50));
```

---

## 10. Pre-pitch checklist
- [ ] Deck works **with Wi-Fi off** (vendored Reveal + font).
- [ ] Demo app started, **opened once** (warm caches), at the projector resolution, no scrollbars.
- [ ] Fallback video plays if the app is stopped.
- [ ] Clicked through the whole deck forwards **and backwards** (animations replay, scenes un-play).
- [ ] NEXT button returns control after the demo.
- [ ] Every number on screen has a source in `SOURCES.md`; no `EST` left unless intentional.
- [ ] Script click counts match the current slide order (after the last `git pull`).
- [ ] Full timed run with all speakers, including the handovers.
