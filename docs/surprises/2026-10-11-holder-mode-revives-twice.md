---
id: 2026-10-11-holder-mode-revives-twice
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** Possession takes Mannanán into Holder Mode once. "No duration, no way back" is the design's word, and the Skill has `maxUses: 1`.
**Actual:** Dohatsu Tenshou defeated her at tick 9 and Holder Mode revived her. At tick 11 a Round-end Burn defeated her again, and the log reads a second `revive … God's Holder: Possession, amount 625`. That second entry re-ran `then:`, which emptied her tokens and raised her token ceiling from 7 to 9.
**Cause:** `packs/_source/abilities/mannanan-gods-holder-possession.yml:93 @ 75ae578` — the `RevivalSource` has `consumesOnUse: false` and gates only on holding a token. `maxUses` bounds the button, not the revival. One counter in Holder Mode gave her the token to revive again.
**Fix:** `packs/_source/abilities/mannanan-gods-holder-possession.yml @ uncommitted` adds `requires: modeInactive godsHolderPossession`. `test/unit/mannanan-197.test.mjs` holds it.
