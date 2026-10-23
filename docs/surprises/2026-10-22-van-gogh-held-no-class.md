---
id: 2026-10-22-van-gogh-held-no-class
found: live press
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** Prelati's Spellbook's Active cuts an allied Foreigner's NP Cooldown by 1◈: Van Gogh's De
Sterrennacht 9 → 6, as the unit test asserted.
**Actual:** "De Sterrennacht: The Starry Night: Cooldown 9 → 7", the ½◈ the non-Foreigner phase gives an Existence
outside the Domain holder; her options held no `target:class:` at all.
**Cause:** `packs/_source/servants/van-gogh.yml:28 @ d97795b9` — she states `classContainer: foreigner` (the slot and
icon) and no `servantClasses`, the list every Class reader asks. The test built its Foreigner from Medea with
`servantClasses: ["foreigner"]` written in, a shape no roster Foreigner has.
**Fix:** `packs/_source/servants/van-gogh.yml:32 @ uncommitted` — `servantClasses: [foreigner]`; the test now builds
both Foreigners from `van-gogh`. Drake and Kiritsugu also state no `servantClasses`: open.
