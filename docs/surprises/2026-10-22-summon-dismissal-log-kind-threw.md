---
id: 2026-10-22-summon-dismissal-log-kind-threw
found: test
kind: unknown-value-falls-to-default
status: fixed
reviewed: true
pattern: unknown-value-falls-to-default
---
**Expected:** destroying Prelati's Spellbook dismisses his Horrors quietly, as a split or a timed departure does.
**Actual:** `RangeError: FGT | Unknown log kind "summonDismissed". Expected one of: attack, ability, effect, ...`,
unhandled, twice.
**Cause:** `module/engine/io.mjs:1035 @ ce40e2d7` — `dismissSummon` recorded a kind that Ch. 37's closed log
vocabulary refuses, without awaiting it. Every dismissal since 72e6505f threw an unhandled rejection, and no
dismissal was logged.
**Fix:** `module/engine/io.mjs:1035 @ 0c5e1ad7` — it records `kind: "scheduler", event: "summonDismissed"`,
awaited, and a failure to log is reported, never thrown.
