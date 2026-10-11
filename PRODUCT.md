# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Single self-contained HTML file using reveal.js 5 from CDN (needs internet at the venue). Opens in Chrome, driven by keyboard or presentation clicker. Lives in `presentation/`.

## Users

- **Primary (audience):** BMW product managers acting as hackathon judges (EHL x BMW Group finals, "AI for Product Decision Making"). Non-technical; they judge the idea, concept, and story, not the backend. They are also the people who would use the tool day to day.
- **Secondary (audience):** the overall hackathon jury and room.
- **Presenter:** our team, delivering a hard-cut 3-minute pitch followed by 3 minutes of Q&A, clicking through a simulated product demo.
- **Product user (as depicted):** a BMW vehicle PM, especially one who takes over a vehicle line mid-lifecycle and inherits earlier decisions without knowing why they were made.

## Product Purpose

An AI decision-support tool that helps BMW PMs derive, justify, and prioritize customer-facing requirements for the successor of an existing vehicle, while the PM stays in control of every decision. The pitch artifact is a simulated frontend demo of that tool. Success: the judges remember the concept and see it as BMW-ready.

## Positioning

The edge, as confirmed by the team, combines three things:
1. **Decision memory.** The rationale behind each decision is captured by voice with no extra admin work, so the next PM knows why something changed.
2. **Automated recalibration.** When a requirement is rejected (by the PM or engineering), the remaining set is re-ranked to stay compatible.
3. **Red-team honesty.** In the negative demo case, the AI argues against its own proposal and openly explains why a requirement ranks lower, showing the tool is truthful rather than agreeable.

## Operating Context

Pipeline shown in the demo:
1. Upfront objectives: market, time to market, strategic focus, source weighting.
2. Knowledge base: BMW customer feedback, customer study, sales volumes, competitor intel, past decisions.
3. AI-ranked requirements per group (e.g. Exterior & Dynamics), each with reasoning tagged as evidence or assumption.
4. The PM approves, rejects, re-ranks, or challenges a requirement (red team).
5. Recalibration after a rejection.
6. Voice-captured rationale saved to Decision Memory.
7. Final vehicle configuration output (3D placeholder).

This mirrors BMW's own PM process: situation analysis → structure and context → requirements definition → prioritization → documentation.

## Capabilities and Constraints

- Vehicle focus: BMW 5 Series G60, chosen because it has the most data.
- The demo is simulated: hard-coded content, no live AI.
- 3-minute hard cutoff; keep the click count low.
- Customer-facing requirements and customer value, not engineering specs or business-case math (BMW brief).
- Every reasoning shown must be labelled as evidence or assumption (BMW brief).
- **Open:** target market shown in the demo. The current mock says China, but the G60 feedback file has no China entries; China data comes only from the customer study.

## Brand Commitments

- Presented to BMW; references are BMW's own PM keynote ("From billions of findings to one BMW vehicle", "The Process") at `../project context/`, plus BMW corporate design language (DESIGN.md).
- Concept car visual from the keynote: `../project context/BMW Product Management Key Note.pptx` (media image8.png, labelled "Future BMW sedan, AI concept visual").

## Evidence on Hand

- BMW data: `../BMW-Data/` (G60 feedback with 5,005 entries, customer studies, sales volumes, option lists).
- Real PM quote, attributed as "Senior PM, automotive": "I have too much data to look at, and when I take over a new vehicle lifecycle, I have zero memory of why the previous PM made their design choices."
- Insights from the Q&A with 3 BMW PMs: pain points outweigh wishlists; priorities must be adjustable per project; shortlist the top 10–50 requirements; decision memory is "very important".
- Do not fabricate statistics, customer counts, or competitor claims beyond what the data supports. Demo reasoning stays qualitative unless verified.

## Product Principles

1. The PM decides; the AI proposes, explains, and challenges.
2. Every recommendation shows its evidence and its assumptions.
3. Honesty over agreeableness: the AI says when a proposal is weak.
4. Zero-friction memory: capture the why without extra admin.
5. One deep example (G60) that works as a template for every line.
