# PM acceptance audit

This audit maps the supplied 23-section specification to verified implementation. It intentionally distinguishes complete behavior from bounded prototype behavior.

## Implemented and verified

- BMW vehicle, data-backed market, target months, available people, and deadline-importance setup.
- Read-only ingestion from the supplied ZIP: 13,771 feedback-classification rows, 1,003 study rows, 12 sales rows, three PDFs, and all eight original files.
- Exact feedback lineage: filename, sheet, row, feedback ID, vehicle, market, engine, classification, text, and quality.
- Low-quality evidence retained but excluded; feedback frequency deduplicated by original feedback ID.
- Evidence-backed requirement candidates with confidence, quality summary, citations, outcome, ownership, planning estimate, and status.
- Four stable BMW navigation domains with evidence-derived outcome clusters beneath them. This reconciles the original dynamic-group requirement with the later explicit request for coherent Interior/Exterior-style navigation.
- At most ten requirements per group, without padding.
- Deterministic, inspectable ranking using deduplicated feedback, matching customer-study measures, vehicle/market sales planning, PM schedule context, and explicitly labeled demo-history relevance.
- Separate “why this requirement exists” and “why this rank” explanations, including adjacent-rank comparison.
- Downloadable original sources and exact feedback-row citations.
- PM rename, split, merge, move, edit, and reorder operations with decision events.
- AI-inferred responsible entity, reason, confidence, alternative owner, and PM correction.
- Editable default email draft that is never sent by the application, Gmail compose link, rough-note voice transcription, and optional OpenAI-assisted redrafting.
- Separate external Market Intelligence tab using live OpenAI web search for competitor analysis, PM reasoning, and visible clickable URL citations. It is explicitly separated from uploaded evidence; grounded atomic candidates are fed into the matching requirement cycle and trigger recalculation.
- OpenAI Responses API stakeholder interpretation with a strict schema for outcome, confidence, conditions, constraints, timing, suggested wording, and grounded quotes.
- PM confirmation required before any feasibility result changes ranking.
- Feasible, feasible-with-conditions, not-feasible, approved, approved-with-conditions, PM-rejected, and deleted flows. PM approval does not require feasibility review or a mandatory rationale field. Rejected requirements remain visible in red while their group recalibrates.
- Full before/after ranking snapshots, OpenAI response ID/model, stakeholder text, citations, and PM rationale in decision memory.
- Browser voice transcription when supported, with typed fallback.
- Explicitly labeled team-authored historical demo decisions plus genuine application events.
- PM, technical, and GTM text report exports.
- Automated tests for ingestion integrity, source presence, deduplication, exact filtering, citations, group limits, ranking sensitivity, metadata, conditional recalculation, approval/rejection, historical provenance, and OpenAI structured output.

## Honest prototype boundaries

- Feedback, market-study, and sales rows support ranked claims. Study measures are matched by market sheet and feature terminology; sales plans are matched by vehicle and market. Each attached signal retains an exact workbook, sheet, and row citation.
- Original PDFs and verified page counts are available for inspection. PDF text is not parsed because a reliable PDF parser is unavailable; therefore PM does not fabricate option-list content or page claims.
- Candidate generation, BMW domain mapping, outcome clustering, planning estimates, and initial ownership use deterministic prototype logic. The live OpenAI integration is used for stakeholder-response interpretation, email redrafting, and external cited market research.
- Decision events are appended to server-side NDJSON and mirrored in browser storage. A production system still requires authentication, actor identity, tamper-evident signing, backups, and retention controls.
- Speech recognition depends on browser support.
- The application drafts but does not send email.

These boundaries are visible in the UI and documentation and must not be represented as completed production capabilities.
