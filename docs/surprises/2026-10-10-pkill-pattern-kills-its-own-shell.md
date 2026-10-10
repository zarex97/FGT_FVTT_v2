---
id: 2026-10-10-pkill-pattern-kills-its-own-shell
found: tooling
kind: pattern-matches-its-own-command
status: fixed
reviewed: true
pattern: vps-drive-kit
---
**Expected:** `pkill -f remote-debugging-port=9222` closes the headless Chrome and the command goes on.
**Actual:** The Bash call died with `Exit code 144` twice, and three Chrome processes were still running.
**Cause:** `Bash tool @ a238438` — `-f` matches full command lines, and the shell running `pkill` carries the pattern in its own command line. So `pkill` killed its own shell before it reached Chrome.
**Fix:** `Bash tool @ a238438` — list the PIDs with a bracketed pattern that cannot match itself, then kill them: `ps -eo pid,args | grep "[r]emote-debugging-port=9222" | awk '{print $1}' | xargs -r kill`. That left 0.
