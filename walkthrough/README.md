# Demo walkthrough

`index.html` plays a screen recording of the live demo, one clip per step, and pauses on the next control so the presenter clicks through it. Open it in Chrome and keep the `media/` folder next to it. It needs no server and no internet, and makes no OpenAI calls.

**Controls:** click the highlighted control, or press `→` / `Space` (plays the next clip; pressed during a clip, it skips to its end), `←` (back, no replay), `F` (full screen), `Home` / `End`. The chapter names at the top jump between sections.

**Flow:** intro → Demo 1 (upfront requirements, evidence upload, ranking, reasoning with the score breakdown, competitor sources, reorder, approve with a reason) → "that was the brief" → quote from a former Vodafone PM (used with his consent) → Demo 2 (a new PM onboards through the Project Diary, generates again, and the previous PM's decision appears in the reasoning as Decision Memory and in the score) → close.

**Rebuild after app changes:** `walkthrough/tools/recapture.sh` (about 4 minutes). It runs a clean copy of the app in `/tmp` (the repo's data is never touched), records it in headless Chrome with a visible cursor, trims the AI waits, cuts one MP4 per step, and rebuilds `index.html` and `media/`. Needs Google Chrome, ffmpeg with libx264, cwebp, and `OPENAI_API_KEY` (the app calls OpenAI for requirement wording and the storyline while recording). Captions live in `tools/build.mjs`.

| Tool | Does |
| --- | --- |
| `tools/record.mjs` | Drives the app and records it (Chrome screencast, 60 fps) |
| `tools/encode.mjs` | Cuts the recording into one clip and end-frame still per step |
| `tools/build.mjs` | Writes the player (`index.html`) and copies `media/` |
