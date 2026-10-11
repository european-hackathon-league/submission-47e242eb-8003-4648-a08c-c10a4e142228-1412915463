---
name: BMW Product Strategy AI
description: The next chapter of BMW's PM keynote. "The Process" slide turned into working decision software, set on the keynote's own ground.
colors:
  bmw-blue: "#1c69d4"
  bmw-blue-active: "#0653b6"
  m-red: "#e22718"
  rose: "#ffb3ab"
  amber: "#f2c46d"
  amber-ink: "#2a1d05"
  night: "#0a1726"
  petrol: "#035970"
  ice: "#c3e7f0"
  mist: "#c8d7e0"
  steel: "#85acb9"
  slate: "#548d9e"
  white: "#ffffff"
  line: "rgba(255, 255, 255, 0.92)"
  line-soft: "rgba(200, 215, 224, 0.28)"
typography:
  display-xl:
    fontFamily: "'Saira Condensed', 'Arial Narrow', sans-serif"
    fontSize: "96px"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "0"
  display-lg:
    fontFamily: "'Saira Condensed', 'Arial Narrow', sans-serif"
    fontSize: "64px"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "0"
  headline:
    fontFamily: "'Saira Condensed', 'Arial Narrow', sans-serif"
    fontSize: "46px"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "0"
  numeral:
    fontFamily: "'Saira Condensed', 'Arial Narrow', sans-serif"
    fontSize: "38px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "'tnum'"
  title:
    fontFamily: "'Saira Condensed', 'Arial Narrow', sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.1
  statement:
    fontFamily: "'Saira Semi Condensed', 'Arial Narrow', sans-serif"
    fontSize: "34px"
    fontWeight: 300
    lineHeight: 1.28
  lede:
    fontFamily: "'Saira Semi Condensed', 'Arial Narrow', sans-serif"
    fontSize: "19px"
    fontWeight: 300
    lineHeight: 1.45
  body:
    fontFamily: "'Saira Semi Condensed', 'Arial Narrow', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.35
  button:
    fontFamily: "'Saira Condensed', 'Arial Narrow', sans-serif"
    fontSize: "16px"
    fontWeight: 700
    letterSpacing: "1.2px"
  label:
    fontFamily: "'Saira Condensed', 'Arial Narrow', sans-serif"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "1.5px"
  tag:
    fontFamily: "'Saira Condensed', 'Arial Narrow', sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "1.2px"
rounded:
  none: "0"
  voice: "50%"
spacing:
  tile-gap: "8px"
  cell: "18px"
  block: "28px"
  frame-top: "40px"
  gutter: "56px"
components:
  button-primary:
    backgroundColor: "{colors.bmw-blue}"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 28px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.bmw-blue-active}"
  tile:
    backgroundColor: "transparent"
    textColor: "{colors.mist}"
    rounded: "{rounded.none}"
    padding: "9px 14px"
  tile-selected:
    backgroundColor: "rgba(255, 255, 255, 0.08)"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
    padding: "8px 13px"
  row-action:
    backgroundColor: "transparent"
    textColor: "{colors.mist}"
    rounded: "{rounded.none}"
    size: "36px"
  row-action-reject-pressed:
    backgroundColor: "{colors.m-red}"
    textColor: "{colors.white}"
  tag-evidence:
    backgroundColor: "{colors.ice}"
    textColor: "{colors.night}"
    typography: "{typography.tag}"
    rounded: "{rounded.none}"
    padding: "2px 7px 1px"
  tag-assumption:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.amber-ink}"
    typography: "{typography.tag}"
    rounded: "{rounded.none}"
    padding: "2px 7px 1px"
  tag-rejected:
    backgroundColor: "{colors.m-red}"
    textColor: "{colors.white}"
    typography: "{typography.tag}"
    rounded: "{rounded.none}"
    padding: "2px 7px 1px"
  tag-ai:
    backgroundColor: "{colors.bmw-blue}"
    textColor: "{colors.white}"
    typography: "{typography.tag}"
    rounded: "{rounded.none}"
    padding: "2px 7px 1px"
  tag-gap:
    backgroundColor: "transparent"
    textColor: "{colors.ice}"
    typography: "{typography.tag}"
    rounded: "{rounded.none}"
    padding: "1px 6px 0"
  requirement-row:
    backgroundColor: "transparent"
    textColor: "{colors.white}"
    height: "70px"
    padding: "0 14px 0 6px"
  requirement-row-rejected:
    backgroundColor: "rgba(226, 39, 24, 0.16)"
    textColor: "{colors.rose}"
  requirement-row-recalibrated:
    backgroundColor: "rgba(28, 105, 212, 0.26)"
    textColor: "{colors.white}"
  verdict-bar:
    backgroundColor: "{colors.white}"
    textColor: "{colors.night}"
    rounded: "{rounded.none}"
    padding: "14px 20px"
  status:
    backgroundColor: "transparent"
    textColor: "{colors.mist}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "9px 14px"
  voice-capture:
    backgroundColor: "{colors.bmw-blue}"
    textColor: "{colors.white}"
    rounded: "{rounded.voice}"
    size: "112px"
---

# Design System: BMW Product Strategy AI

## Overview

**Creative North Star: "The Keynote, Continued"**

This system is BMW's own product-management keynote carried forward into software. The ground is the keynote's own atmospheric image (navy into petrol into plum), not a colour we chose, and every surface on it is drawn the way the keynote draws "The Process": white hairline rectangles with square corners, bold condensed uppercase headlines that end in a period, and a light condensed voice for everything that explains. The product content (ranked requirements, evidence, rejections, voice-captured reasons) lives inside that drawing language, so a BMW PM reads it as the next slide of their own deck rather than a vendor dashboard.

Density is a keynote stage, not an app screen: a fixed 1280 by 720 canvas, a 56px gutter, one idea per slide, and a persistent process rail along the bottom that says where in BMW's process the viewer stands. Colour is spent on meaning only. BMW blue is the action and the AI's fresh proposal, M red is rejection and weakness, ice and amber split evidence from assumption. Everything else is white, ice, mist, steel, and slate on the ground.

Authorship is visible everywhere. A robot glyph marks what the AI proposed and a person glyph marks what the PM decided, both drawn from the keynote's own icon set. The system rejects the generic SaaS dark dashboard: no rounded glowing cards, no drop-shadowed panels, no gradient fills on surfaces.

**Key Characteristics:**
- The keynote ground image as the only background; surfaces are hairline outlines on it, never filled cards.
- Square corners everywhere except the voice-capture control.
- Condensed uppercase display headlines ending in a period; light semi-condensed body.
- Colour carries meaning: blue acts, red rejects, ice is evidence, amber is assumption.
- Robot and person glyphs mark who authored every item.
- A process rail on every product slide, advancing with the story.

## Colors

A cold, atmospheric ground of navy and petrol with ice-blue tints, broken only by BMW blue and M red where something is acted on or refused.

### Primary
- **BMW Blue** (bmw-blue): the primary action button, the voice-capture control, and the marks of a fresh AI proposal (the "AI" and "Red team" tags, the "Recalibrated" badge, the recalibrated row tint). Also the text-selection colour. One filled blue button per slide at most.
- **BMW Blue Pressed** (bmw-blue-active): hover and active state of the primary button only.

### Secondary
- **M Red** (m-red): rejection and weakness. The "Rejected" tag, the strike-through drawn across a rejected requirement, the pressed reject action, the reject action's hover, the filled bar of a low confidence meter, and the simulated cursor's click ring.
- **Rejection Rose** (rose): text colour of a rejected row's rank and name and of the "case against" heading. Red as ink is too dark on the ground; rose is red made legible.

### Tertiary
- **Assumption Amber** (amber) with **Amber Ink** (amber-ink): the "Assumption" tag only. Amber marks reasoning the AI could not back with data.

### Neutral
- **Keynote Night** (night): page background behind the ground image, ink on the white verdict bar, and ink on ice tags.
- **Keynote Petrol** (petrol): the ground's lower glow and the label colour on the white verdict bar.
- **Ice** (ice): evidence. The "Evidence" tag fill, the "Evidence gap" outline, source weights, approved-item checks, the saved and compatible states, focus rings.
- **Mist** (mist): secondary text on the ground (ledes, sublines, inactive tiles and actions, glyph default colour).
- **Steel** (steel): tertiary text (group names under a requirement, provenance and meta lines, labels, completed rail steps).
- **Slate** (slate): the faintest tint, used only in the depth layering of the floating feedback cloud.
- **White** (white): headlines, active text, the active rail step, the verdict bar fill.
- **Hairline** (line): the 1.5px frame stroke of boxes, table tops, and quote rules.
- **Soft Hairline** (line-soft): 1px dividers between rows, tiles, chips, sources, and spec cells.

### Named Rules
**The Meaning-Only Colour Rule.** Blue means act or newly proposed by the AI, red means rejected or weak, ice means evidence, amber means assumption. No hue appears for decoration.

**The One Blue Button Rule.** A slide carries at most one filled BMW blue button. Every other control is a hairline outline.

**The Ground Is Given Rule.** The background is the keynote's own image (assets/keynote-ground.webp) over night. Never replace it with a CSS gradient or a flat fill, and never paint surfaces over it with opaque panels.

## Typography

**Display Font:** Saira Condensed (with Arial Narrow, sans-serif)
**Body Font:** Saira Semi Condensed (with Arial Narrow, sans-serif)

**Character:** A keynote pairing: a bold condensed display that reads like BMW's slide titles, and a lighter, slightly wider semi-condensed for explanation. The contrast is weight (700 against 300), not family.

### Hierarchy
- **Display XL** (display-xl): the title slide headline only.
- **Display L** (display-lg): the problem statement slide headline.
- **Headline** (headline): every product slide's headline, uppercase, ending in a period.
- **Numeral** (numeral): requirement ranks, tabular figures. The title funnel's counts use the same face at 40px.
- **Title** (title): requirement names and source names, sentence case, condensed bold.
- **Statement** (statement): the PM quote and the voice transcript, light weight, white. The transcript runs at 32px with 1.38 leading.
- **Lede** (lede): the one-sentence line under each headline, in mist.
- **Body** (body): reasoning text in rows, group names, provenance, meta. Claims in the debate run at 16px light with 1.4 leading.
- **Button** (button): uppercase condensed bold labels on buttons; objective tiles use the same face at 17px, 600 weight, 0.6px tracking.
- **Label** (label): uppercase field labels ("Target market", "Reason", "Verdict"), rail steps, status pills, context chips, in steel or mist.
- **Tag** (tag): evidence, assumption, rejected, AI, and gap tags.

### Named Rules
**The Keynote Headline Rule.** Product headlines are condensed, bold, uppercase, set tight (0.95 leading, 0 tracking), and end with a period, like a keynote statement. Headlines never sit under a small label or kicker.

**The Weight Contrast Rule.** Explanation is light (300) and decisions are bold (700). Inside a light sentence, the decisive figure is bolded in white ("144 of 157").

**The Tabular Figures Rule.** Every count and rank uses tabular numerals.

## Layout

A fixed 1280 by 720 stage (reveal.js scales it to the screen, no breakpoints). Product slides share one frame: 40px top padding, 56px side gutters, a head row (headline and lede on the left, a status pill or context chips on the right, aligned to the bottom), a flexible body with 22px top padding, and a 78px process rail pinned to the bottom. Story slides (title, problem) drop the frame and place elements absolutely on the same 56px gutter.

Hairline groups sit edge to edge: adjacent boxes share a single border (the second drops its left border, or overlaps by -1px), so a row of boxes reads as one ruled diagram like the keynote's process boxes. Internal padding is 16 to 24px; the requirement table uses 70px rows with an 18px column gap and a fixed column grid (rank, name, reasoning, author, actions). Spacing steps in use: 8px between tiles, 18px cell rhythm, 28px between blocks, 56px gutter.

Motion is exponential ease-out (cubic-bezier(0.16, 1, 0.3, 1)): entrances rise 18px from a blur on forward navigation only, reveal auto-animate morphs shared elements (headline, rail, rows) between slides, and the ground image drifts slowly over 48s. All motion collapses under prefers-reduced-motion.

## Elevation & Depth

Flat. Depth comes from the keynote ground image itself and from line weight: a 1.5px white hairline marks a primary frame, a 1px soft hairline marks a subdivision. Emphasis is done with tint, never lift: a rejected row takes a red wash, a recalibrated row takes a blue wash with a 1.5px inset hairline ring, the focused row in a debate takes a dark veil, and the verdict is a solid white bar. Images bleed into the ground through gradient masks rather than sitting in frames.

### Named Rules
**The No Lift Rule.** No drop shadows on surfaces, buttons, rows, or images. A surface that needs emphasis changes its tint or its line, not its height.

## Shapes

Square corners (0) on every frame, button, tile, tag, chip, action, status pill, rail head, and hotspot dot. The single exception is voice: the voice-capture control is a circle (50%), and its listening ripples are circles. Strokes are the keynote's: 1.5px for frames, table tops, and quote rules; 1px for dividers and outlined controls; 2px for the selected tile and the rail progress line. Icons are outline SVG at 1.6px stroke with square caps and mitred joins. Arrows are drawn as a line ending in a solid triangle head, as on the keynote's process slide.

## Components

### Buttons
Decisive and rare: the BMW corporate primary action, carried over unchanged.
- **Shape:** square corners (0).
- **Primary:** BMW blue fill, white uppercase condensed label with 1.2px tracking, 48px tall with 28px side padding, a trailing arrow icon.
- **Hover / Focus:** hover and active shift to bmw-blue-active, active nudges down 1px; focus shows a 2px ice outline offset 3px.
- **Secondary:** there is no filled secondary. Every other control is a hairline outline (tiles, row actions).

### Chips (objective tiles, context chips, status)
- **Objective tiles:** transparent with a 1px soft hairline and mist text; hover brightens the line and text to white; selected takes a 2px white border, white text, and an 8% white wash. Single choice per group.
- **Context chips:** the active objectives repeated in the slide head as joined label-type cells with soft hairlines, read-only.
- **Status pill:** label type in a soft-hairline box with a glyph or a pulsing square; the success state turns line and text ice.

### Evidence tags
The system's honesty mark: every piece of reasoning opens with a tag. Square, uppercase tag type, inline before the sentence. Evidence is night ink on ice, Assumption is amber ink on amber, Rejected is white on M red, AI and Red team are white on BMW blue, Evidence gap is an ice outline with no fill.

### Requirement rows
The signature table. A 1.5px hairline tops the table; each 70px row is divided by a soft hairline and holds a large rank numeral, the requirement name with its group beneath in steel, a tagged reason in mist with the key figure bolded white, an authorship glyph, and three square 36px outline actions (approve, challenge, reject).
- **Rejected:** red wash, rose rank and name, a 2px M red strike drawn across the name, reject action filled red, person glyph as author. Archived rejections drop below a divider at 56px height and 80% opacity.
- **Recalibrated:** blue wash, 1.5px inset blue hairline ring, a "Recalibrated" blue badge, slides in from the right with a single light sweep.
- **Actions:** hover brightens line and text; the reject action's hover turns line and icon red.

### Authorship glyphs
The keynote's robot (AI) and person (PM) line icons at 22px (18px small), in mist by default. They sit in every row, run-log line, debate side, and memory entry. Both together mark a jointly owned item (a requirement under challenge).

### Process rail (navigation)
A six-step ordered list (Situation analysis, Structure and context, Requirements, Prioritization, Documentation, One car) in label type over a 2px faint line ending in a triangle head. Completed steps are steel, the current step white, upcoming steps faded mist. A white progress line and a 10px square head mark position, and they morph forward between auto-animated slides.

### Debate and verdict
Two joined hairline boxes, "The case for" and "The case against" (the latter headed in rose), each listing tagged claims separated by faint dividers. Below, a solid white verdict bar in night ink: a label, an 800-weight uppercase decision, a one-line reason, and a five-bar confidence meter whose filled bars are M red when confidence is low.

### Voice capture and decision memory
A 112px BMW blue circular control with a microphone icon beside a ledger box. Listening adds two expanding white ripple rings and an animated bar waveform; saved turns the control white with night ink. The ledger shows the tagged decision, its author line, the transcript in statement type with a blinking caret, and a four-cell spec strip that rises in on save.

## Do's and Don'ts

### Do:
- **Do** set every slide on the keynote ground image (assets/keynote-ground.webp) over night.
- **Do** draw surfaces as white hairline rectangles: 1.5px for frames, 1px soft hairline for subdivisions, square corners.
- **Do** end product headlines with a period, in Saira Condensed 700 uppercase.
- **Do** open every piece of AI reasoning with an Evidence, Assumption, or Evidence gap tag.
- **Do** mark authorship with the robot glyph (AI proposes) or the person glyph (PM decides).
- **Do** keep the process rail on every product slide and advance it with the story.
- **Do** use tabular numerals for every count and rank, and bold the decisive figure in white.

### Don't:
- **Don't** round corners on frames, buttons, tiles, tags, or rows; the circle belongs to the voice-capture control alone.
- **Don't** add drop shadows or glows to surfaces; emphasise with tint or line weight.
- **Don't** place more than one filled BMW blue button on a slide.
- **Don't** use M red for anything other than rejection or weakness.
- **Don't** fill surfaces with opaque or gradient card backgrounds over the ground; the only solid surface is the white verdict bar.
- **Don't** put a small label or kicker above a headline.
- **Don't** substitute a CSS gradient for the keynote ground image.
