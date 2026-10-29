---
id: 2026-10-29-background-list-held-stdout
found: tooling
kind: background-list-not-the-process
status: fixed
reviewed: false
---
**Expected:** `(cd "$APP" && nohup node main.js … > "$LOG" 2>&1 & echo $! > "$PIDFILE")` starts Foundry detached and records its pid.
**Actual:** `fvtt-up | tail -1` hung for 400 s, and the pid file named a `bash /usr/local/bin/fvtt-up` process whose child was node; `fvtt-down` killed that shell and Foundry kept answering.
**Cause:** `tools/cloud/setup.sh:61 @ 1de4229` — `&` backgrounds the whole `cd && nohup` list, so a subshell sits between the script and node, `$!` is that subshell, and it holds the caller's stdout open.
**Fix:** `tools/cloud/setup.sh:61 @ 1de4229` — `cd` first, then node alone in the background with stdin from `/dev/null`; `fvtt-down` finds every `main.js --dataPath=/opt/fvtt/data` and waits until :30000 is free. Two up/down cycles then ran clean.
