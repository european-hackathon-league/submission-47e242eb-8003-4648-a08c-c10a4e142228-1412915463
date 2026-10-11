#!/bin/zsh
# Rebuilds the walkthrough from the live app: records a clean copy of the app in /tmp (the repo's data is
# never touched), cuts one clip per step, and writes walkthrough/index.html + walkthrough/media/.
# Needs macOS, Google Chrome, ffmpeg (libx264), cwebp, and OPENAI_API_KEY for wording and the storyline.
set -e
TOOLS="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$TOOLS/../.." && pwd)"; WORK=/tmp/walkthrough-capture
"$TOOLS/rec.sh"
node "$TOOLS/encode.mjs" "$WORK/rec" "$WORK/media"
node "$TOOLS/build.mjs" "$WORK/media" "$REPO/walkthrough"
