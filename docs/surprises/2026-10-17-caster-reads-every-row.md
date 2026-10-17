---
id: 2026-10-17-caster-reads-every-row
found: live press
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** a Skill card's row names an enemy by the name the table knows: Het Gele Huis's Def Dwn on Karna reads "Lancer: Def Dwn" to Van Gogh's player.
**Actual:** Player1's card listed "Karna: Def Dwn · Karna: Def Dwn (C) · Proto Gil: Def Dwn …", True Names, live, Round 3 tick 7.
**Cause:** `module/engine/skill-use.mjs:1451 @ 8d1c012f` — `postCard` prefixed each row with `recipient?.name`, reasoned "a row is shown only to its recipient's controllers"; `rules/card-visibility.mjs#skillEffectsFor` shows every row to the CASTER's controllers too. The same false reason marked the stat row `fgt-name-ok` in #235 (2026-10-17-row-already-named-its-recipient), and the guard's holder list had no `recipient`.
**Fix:** `module/engine/skill-use.mjs` `postCard` and the stat row @ 05211bb1 — both prefix `shownName`; `tools/check-public-names.mjs` reads `recipient`. Two tests that asserted the True Name (the Dioscuri's, Hassan's "public name" test) assert the public one.
