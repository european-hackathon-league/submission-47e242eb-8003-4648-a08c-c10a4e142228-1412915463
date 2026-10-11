# CONTEXT BRIEF FOR PROMPT ENGINEERING

## Your role
You are a prompt engineer. You will NOT analyze any transcripts yourself. Your job is to write ONE high-quality, self-contained prompt that I will paste into a *separate* AI chat. That second chat has no context at all; it will only receive your prompt plus two long audio transcripts. Everything it needs to know about the project must therefore be inside the prompt you write.

## What the second chat will receive
- Your prompt.
- Two transcripts (~30 minutes each) of internal team discussions where our hackathon team designed our product's pipeline end-to-end and debated our focus.
- Transcripts are auto-generated (TurboScribe): no reliable speaker labels, transcription errors, filler, mixed German/English, interruptions, repeated or abandoned ideas, and possibly contradictions between the two sessions or within one.

## The project (must be embedded in the prompt)

### Event
Hackathon finals (EHL x BMW Group). Challenge set by BMW Open Innovation: **"AI for Product Decision Making."** Judged by BMW product managers (PMs).

### The official challenge (BMW briefing)
Build an AI-powered application that helps BMW product managers **derive, justify, and prioritize customer-facing requirements for the successor of an existing BMW vehicle**, while keeping the PM firmly in control of every decision.
- Vehicle lines: BMW 1 Series, 5 Series, 7 Series (or a combination).
- Markets: Europe, China, United States (or any subset).
- Time horizon: think 3–5 years ahead. What will customers value when the successor reaches the market?
- BMW provides per vehicle: **customer feedback, equipment data, sales volumes, and a customer study.** Teams may enrich these with external sources (competitor info, reviews, market/technology trends).
- We must make clear **which conclusions rest on available evidence and which rely on forward-looking assumptions.**
- BMW cares about *how* diverse information becomes actionable PM insight with transparent reasoning, not about a specific workflow or technical architecture.

Deliverables to demonstrate:
1. **Concept + working prototype**: AI supports identification, formulation, and prioritization of customer-facing requirements from the provided data (plus external sources where relevant).
2. **Representative set of requirements** backed by clear evidence and reasoning; show how feedback, product data, market signals, and competitor insights become requirements, and what drives their prioritization.
3. **Transparent decision-support experience**: PMs can review, challenge, modify, approve, or reject AI proposals; evidence, assumptions, uncertainties, and key decisions stay visible and traceable.

Judging values: trustworthy sources, transparent reasoning, thoughtful prioritization, clear handling of uncertainty and conflicting evidence, scalability across vehicle lines/markets/future decisions. Focus on **customer value**, NOT engineering specs, regulatory requirements, or detailed business-case math. Not every capability has to be equally mature; depth in the area we choose matters more.

### BMW's framing (kickoff talk, Head of Open Innovation)
- Product management is about emotion ("Sheer Driving Pleasure"), not only number crunching.
- The PM balances a "universe" of forces: **brand/legacy, markets** (each says "my market is different"), **engineering** (can do anything, not at any price → cost & prioritization), **customers** (different segments/car classes), **competition** (Mercedes, Audi, and increasingly Chinese brands like Xiaomi, Zeekr, Xpeng).
- Pipeline: **Foundation** (predecessor in market, competition, customers, market feedback) → **Condense, contextualize, prioritize** (hard: iterative trade-offs, e.g. "1000 km range… 10-min charging… at what cost? → settle on 900 km") → **Documented requirements + decision context** (a car sells 7–8 years; decisions get revisited, so the *why* at decision time must be recorded).

### Insider insights (our Q&A with 3 BMW product managers; high value, judges think like this)
- **No fixed ranking of input sources.** Customer feedback vs. competitor intel vs. predecessor data: weight depends on the topic (e.g. a feature where competitors are far ahead but there's no customer feedback yet).
- **Pain points > wishlists.** Negative feedback on things that don't work or poor quality outweighs "nice-to-have" wishes.
- **Ranking criteria: all of them**: cost, time-to-market, region, target group, etc. Priorities shift (sales region mix, target customer). The tool must let PMs **flexibly set/adjust priorities per project up front** (e.g. "China market, prioritize cost"; for BMW typically "sportiness"; outperform vs. match competitors in a category).
- **PMs do much of the market/competitor research themselves** (visit competitor sites, look at cars, one-pagers).
- **Shortlist, then business cases.** PMs don't build business cases for everything; the tool should surface the **top 10–50 requirements**, then trade-offs are made against a fixed budget ("more expensive but brings more" vs. "nice to have").
- **PM = "voice/advocate of the customer"** in the vehicle project. Works bilaterally with engineering domain experts (e.g. seats team: "can we load skis through the middle?", "two golf bags in the back?"), controlling (cost), project lead. Not a single approval step; continuous exchange. Requirements are fought for, then engineering responds what's feasible (feedback loop).
- **Gate/milestone logic** in vehicle development; decisions get more concrete toward start of production.
- **Knowledge base desired**: the tool should have its own competition/market/trend data, and the PM can also add input at the start.
- **Cost/sales data of predecessors**: may be **mocked** for the hackathon; logic matters more than real values. Predecessor cost/performance drives a lot of internal discussion, so hard facts beat estimates.
- **Decision memory is "very important"**: why decisions were made is often not recorded. Capturing rationale and **recommending it in future cycles** (learning across vehicle lines) is a "big added value," but **without adding friction**: only big decisions need written rationale.
- **Depth over breadth**: one excellent example (e.g. one series, one market) that serves as a template beats many shallow examples. "It's really about the logic."

## What I need from the second chat (the analysis it should produce)
The prompt you write should make the second chat turn the two messy transcripts into a **structured, condensed, decision-ready synthesis** of our team's plan, checked against the challenge above. It should cover at least:

1. **Executive summary**: our product concept in 5–8 sentences.
2. **Chosen focus/scope**: vehicle line(s), market(s), user persona, which deliverable we go deepest on; mark anything still undecided.
3. **End-to-end pipeline** as numbered stages (input → processing → output → PM interaction), and for each: purpose, inputs, AI/logic used, outputs, PM touchpoints (review/challenge/edit/approve/reject).
4. **Data sources & handling**: provided BMW data, external sources, mocked data, how evidence vs. assumption is tagged.
5. **Prioritization logic**: criteria, weighting, how PMs adjust it, how conflicts/uncertainty are shown.
6. **Human-in-the-loop & traceability / decision memory** design.
7. **Key decisions made** (with rationale as stated) vs. **open questions / unresolved disagreements** (and between which positions).
8. **Contradictions**: between transcript 1 and 2 (state which is likely the later/final view) or within a transcript.
9. **Gap analysis vs. the BMW brief and PM insights**: what we cover well, what's weak/missing, risks with the judges.
10. **Tech stack / architecture** mentioned (only if discussed).
11. **Demo/pitch storyline** ideas mentioned.
12. **Action items / next steps** (owner if mentioned) and a prioritized "build next" list.

Quality rules the second chat must follow:
- Base everything on the transcripts; **never invent** decisions. Clearly separate *stated in transcript* vs. *its own recommendation/inference*.
- Where useful, cite short quotes or approximate locations (transcript 1/2, early/mid/late).
- Silently fix obvious transcription errors (e.g. BMW model names, brand names); flag ambiguous ones.
- Merge duplicates; when ideas evolved over time, report the final version and note the evolution briefly.
- Output in English (transcripts may contain German), in clear Markdown with headings, bullets and tables where helpful; dense, no filler.
- Ask the reader nothing; finish the full analysis in one response.

## What I want from YOU (this chat)
Write the final prompt for the second chat:
- Self-contained: embed a condensed but complete version of the project context above (the challenge, BMW framing, PM insights) so the second chat can judge our plan against it.
- Use solid prompt-engineering structure: role, context, input description, task, step-by-step method (e.g. read both fully first → extract → reconcile → synthesize → gap-check), exact output format/template, quality rules.
- Leave clear placeholders where I will paste the transcripts, e.g. `<transcript_1> … </transcript_1>` and `<transcript_2> … </transcript_2>`.
- Output only the finished prompt in one copyable code block, then 2–3 lines of optional tweaks I could make.
