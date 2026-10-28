---
id: 2026-10-27-restore-clamped-before-its-buff
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** Man-made Hero at full Health: Max HpUp raises Max Health 500 → 600 and current Health with it.
**Actual:** Card *"NP Regen ; Max HpUp; Health 500 (no change)"*, Health 500/600. The unit test, at 300 Health, passed.
**Cause:** `module/engine/landing.mjs:263 @ 6ef9ce96` — a landing's `restores` statDelta ranked before `applyEffect`, so it was clamped to the maximum the buff had not raised yet.
**Fix:** `module/engine/intents.mjs:756 @ ab3d28a9` — a restore riding a landing (`afterEffects`) ranks after the effect, as Proliferation's heal does.
