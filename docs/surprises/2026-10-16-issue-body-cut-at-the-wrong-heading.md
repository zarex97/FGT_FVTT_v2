---
id: 2026-10-16-issue-body-cut-at-the-wrong-heading
found: tooling
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** replacing #208's "Open, for the author" list with the 2026-10-16 rulings would leave one copy of the body.
**Actual:** the edited issue held the whole body twice: two `## Parent` headings, two `OE.np` lines.
**Cause:** a scratchpad edit script (not in the repo) — it cut from the Open list to `t.index("## Parent")`, assuming that heading came after the list. It is the body's first heading, so the cut pasted the body back in.
**Fix:** `gh issue edit 208`, 2026-10-16 — truncated after the new Open paragraph and re-published; one `## Parent`, one `OE.np` line, 324 lines.
