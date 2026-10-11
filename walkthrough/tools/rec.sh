#!/bin/zsh
# Clean copy of the app in /tmp, then record the demo flow.
REPO="$(cd "$(dirname "$0")/../.." && pwd)"; WORK=/tmp/walkthrough-capture
pkill -f "user-data-dir=$WORK" 2>/dev/null; [ -f $WORK/server.pid ] && kill $(cat $WORK/server.pid) 2>/dev/null; sleep 0.5
rsync -a --delete --exclude .git --exclude .impeccable --exclude node_modules --exclude walkthrough "$REPO/" "$WORK/app/"
: > $WORK/app/data/decision-events.ndjson; rm -f $WORK/app/data/uploads.json
(cd $WORK/app && PORT=4175 node server.mjs > $WORK/server.log 2>&1 & echo $! > $WORK/server.pid); sleep 1.5
trap 'kill "$(cat $WORK/server.pid)" 2>/dev/null' EXIT
set -e; node "$REPO/walkthrough/tools/record.mjs" http://localhost:4175 $WORK/rec "$REPO/demo-data" "$WORK/app/data"
