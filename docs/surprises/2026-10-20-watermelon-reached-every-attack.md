---
id: 2026-10-20-watermelon-reached-every-attack
found: live press
kind: qualifier-quoted-not-checked
status: fixed
reviewed: false
---
**Expected:** Watermelon Splitting Master's passive is *"When Anastasia performs a Normal Attack at a Range of 1 to 2 while inflicted with Blind"*: an Attack Skill or NP she makes while Blind keeps its Miss check (Clause `WM.p.kind`).
**Actual:** card ZCrs4vDCumlajdJV, her Blind Ice Bucket Challenge on Medea at 2 panels: ladder *"missCheck → hit"* with no Miss die, and *"defUp 0 (defUp (ignored by Ignore Def))"*. Every Attack in the band, Skills and NPs, became a sure hit with Pierce and Ignore Def.
**Cause:** `packs/_source/abilities/anastasia-watermelon.yml:36 @ 50eae993` — all four rules read `["self:effect:blind", "attack:range:lte:2"]`; the quoted qualifier "Normal Attack" had no guard, and the design's own predicate string (Ch. 45) left it out.
**Fix:** `packs/_source/abilities/anastasia-summer-watermelon.yml @ 0552085c` — `attack:kind:normal` on all four; `anastasia.test.mjs` holds a Skill's Miss chance at 80.
