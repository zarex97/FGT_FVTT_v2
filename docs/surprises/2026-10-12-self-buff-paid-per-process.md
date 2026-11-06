---
id: 2026-10-12-self-buff-paid-per-process
found: live press
kind: siblings-race-at-shared-step
status: fixed
reviewed: true
pattern: check-then-act-race
---
**Expected:** Airavata's *First, apply NP DmUp* lands once and counts on all three hits.
**Actual:** after the window fix the Processes moved together: NP DmUp landed three times; with a claim, it landed once and only the first card counted it.
**Cause:** `module/engine/attack.mjs:1971 @ 50c5731` asked the siblings' histories, which none had written yet.
**Fix:** `module/engine/attack.mjs:1959 @ 81c5732` — the first to strike pays in memory; its siblings await the payment before their damage.
