---
id: 2026-10-12-self-buff-paid-per-process
found: live press
kind: siblings-race-at-shared-step
status: fixed
reviewed: false
---
**Expected:** Airavata's *First, apply NP DmUp* lands once and counts on all three hits.
**Actual:** after the window fix the Processes moved together: NP DmUp landed three times; with a claim, it landed once and only the first card counted it.
**Cause:** `module/engine/attack.mjs:1971 @ 08ea4b1` asked the siblings' histories, which none had written yet.
**Fix:** `module/engine/attack.mjs:1959 @ 98f05ca` — the first to strike pays in memory; its siblings await the payment before their damage.
