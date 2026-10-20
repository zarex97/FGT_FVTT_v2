---
id: 2026-10-20-effect-id-on-the-damage-card
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** His Horror's damage card names the Dmg Boost it carries from him (HM.m4.horrors, #260), as it names Mad Enhancement.
**Actual:** Player1's card: "Flat attack bonuses Dmg Boost dmgBoostGilles +30". My first fix named every effect instance by its definition's name, at the writer and in the snapshot; the full suite then failed 14 tests in 7 files, because a contribution's `source` is its identity (rolls key on it in `rules/checks.mjs`, and `sCritUp` and `sCritUpPollux` share the name "S.Crit Up").
**Cause:** `module/rules/explain.mjs:80 @ 48916996` — the card prints a contributor's `note` raw, and an effect's note is its id. `engine/turn-report.mjs` already maps an id to its name for its card; the damage card, the other reader, did not.
**Fix:** `module/rules/explain.mjs:85 @ ca41d4ab` — the card maps an effect id to its definition's name at display. The writer and the snapshot keep the id.
