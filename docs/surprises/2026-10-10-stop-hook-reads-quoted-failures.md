---
id: 2026-10-10-stop-hook-reads-quoted-failures
found: live press
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** The Stop hook blocks only when a tool in this turn failed.
**Actual:** It blocked a turn where every call succeeded: "This turn hit a failure." The turn had only printed the Surprise records, and those quote old failures like `Exit code 144` and "refused". After the first fix it blocked again, on a `cat` of its own source, whose regex holds the same words.
**Cause:** `.claude/hooks/surprise-stop.mjs:12 @ a238438` — the text test matched any prose naming a failure, not a runner's verdict. Also `:48` counted a record as written only for `docs/surprises/` with a slash, so `cd …/docs/surprises;` did not count.
**Fix:** `.claude/hooks/surprise-stop.mjs:12 @ uncommitted` — a failed command already sets `is_error`, so the text test now matches only a runner's own lines: `FAIL`, `×`, `Tests N failed`, `AssertionError:`. Calls that touch `docs/surprises` are skipped. Checked against seven sample lines and this session's transcript.
