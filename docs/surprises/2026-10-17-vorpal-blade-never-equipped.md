---
id: 2026-10-17-vorpal-blade-never-equipped
found: retraction
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** A Unit that picks up the Vorpal Blade swings it: BA(STR) +50, Range 1, Normal Attacks on BA(STR).
**Actual:** Read for the ruling: `contributionsOf` collects an Item's rules only while `equipped`, and nothing in the system writes `equipped`. The Blade did nothing in any hand. Its *"Normal Attacks … use Base Attack (STR)"* was never authored either (B5).
**Cause:** `module/rules/snapshot.mjs#contributionsOf @ eebbb988` gates on a flag with no writer; `packs/_source/abilities/vorpal-blade.yml @ eebbb988` has no rule for B5.
**Fix:** `packs/_source/abilities/vorpal-blade.yml @ 7755ebb4`: `worksWhenHeld` (picking it up equips it, #247 reading 14), `BaseAttackModifier` with `exceptNP`, and `NormalAttackComponent`.
