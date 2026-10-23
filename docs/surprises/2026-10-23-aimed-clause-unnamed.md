---
id: 2026-10-23-aimed-clause-unnamed
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Antares Snipe's Heel offer, shown to Player1, names every clause of the 95% in words.
**Actual:** *"at Range +5 · initiated +5 · unseen +10 · FGT.WeakPoint.Part.aimed +75"*.
**Cause:** `module/rules/weak-point.mjs:131 @ uncommitted`: the new `aimed` clause (#326 ruling 12) went into the
breakdown, and the offer builds `FGT.WeakPoint.Part.<label>` from it; no string, and no guard over the family.
**Fix:** `lang/en.json @ uncommitted`: the string. `i18n.test.mjs` "every weak point clause can name itself" scans
every `add("label"` the rules make, red first.
