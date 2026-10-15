---
id: 2026-10-14-negated-hit-dropped-its-riders
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Scáthach's Þurs on Karna (Magic Resistance C): the MAG damage is negated and its Shock is still tried, at the chance Magic Resistance cuts (*"Other debuffs from Attacks … will still have their inflict chance reduced"*; hit, not hurt, §46.4-LI).
**Actual:** "Þurs 0 Negated by Magic Resistance", and no Shock line at all: the rider was never rolled.
**Cause:** `module/engine/attack.mjs:4797 @ 7333e08` — `applyAbilityEffects` returned on any `flags.negatedBy`, Magic Resistance and Invuln included, while `rules/damage/riders.mjs#ridersFire` refuses only Anti-Purge and Substitution; its own comment said Invuln does not stop riders.
**Fix:** `module/engine/attack.mjs:4797 @ 95b91ea` — the ability's riders ask `ridersFire` too; arena test `karna-206-arena.test.mjs`.
