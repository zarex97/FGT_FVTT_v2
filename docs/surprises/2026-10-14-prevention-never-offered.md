---
id: 2026-10-14-prevention-never-offered
found: user
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** The Prevention Luck Check exists: `applyEffect` has a step for it.
**Actual:** No caller ever set `preventionAvailable`, so the step never ran; the rule was unplayable.
**Cause:** `module/engine/effect-applier.mjs:210 @ a436802` — a step gated on a context key nothing produced.
**Fix:** `module/engine/landing.mjs:399 @ 1f1b099` — ruled with the user and built in Landing, asked on the target owner's screen.
