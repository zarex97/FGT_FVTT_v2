---
id: 2026-10-30-choice-asked-per-process
found: test
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Chibirā Sanu's Pretender `choose`, its branches `target: self`, is asked once at declaration, and not at all when its predicate (`not:self:effect:shisarotForm`) holds it back.
**Actual:** the test world reported *"A question nobody scripted was shown to u1: "FGT.Pretender.ChooseClass""* twice, in the NP used outside the Form and in the NP used inside it.
**Cause:** `module/engine/attack.mjs:9440 @ 2d63f159` — the rider step's `resolveChoosePhases` counted any branch with an `applyEffects` as a per-defender rider, though its effect was the caster's, and asked before the loop read the choice's predicate; the Skill path's runner read both.
**Fix:** `module/engine/attack.mjs:9440 @ uncommitted` — a branch is a rider only when its effect lands on somebody other than the caster, and a choice its predicate holds back is not asked.
