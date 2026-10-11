# Synthetic Project Diary demo

`data/project-diary-demo.json` contains 66 fictional PM events across 27 days, July 1–October 10, 2026, for BMW 5 Series G60 / United States. All decisions, stakeholder feedback and rationales are fabricated. They are displayed with synthetic labels and kept separate from the real append-only application event log. They do not change requirement approvals or ranking state.

For the October 11 demo, open Project Diary and select Last Week for the launch review (October 5–9), Last Month for September scope trade-offs, Last Quarter for July–September development, or Onboarding for the full available history. Custom dates July 1–October 10 isolate this fixture's development period. Select October 7 on the calendar for a busy-day summary. Older existing demo records may also be included in Onboarding.

The storyline tracks cabin usability, smartphone reconnection, seating comfort, parking confidence, and the deferral of a passenger display and decorative lighting. Different activity densities and decisions without rationale are included.

To run a real LLM summary, set OPENAI_API_KEY in the local ignored .env file and restart with npm start. Then click Generate storyline. No generated summary is pre-recorded or passed off as a live response. Date presets are relative to today's date; use custom dates for later demos.
