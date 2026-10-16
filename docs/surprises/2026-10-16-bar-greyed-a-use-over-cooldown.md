---
id: 2026-10-16-bar-greyed-a-use-over-cooldown
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Mana Burst on its Cooldown, Arturia inside her Master's ZON: the bar lets Player1 use it for 20 of the Master's Health (#230 reading 2, MB.oncd).
**Actual:** the slot greyed "Mana Burst — Cooldown 1◈ (3 turns)". The gate, asked on the GM, answered `{ok: true, overCooldown: {masterHealth 20}}`.
**Cause:** `module/apps/hud/present.mjs:83 @ b4464ed` — `slotFor` disabled any slot with a Cooldown left, after the verdict, "the only thing left that disables a slot is its cooldown". I built `cooldownOverride` into `costs.mjs` and the use paths, and never asked the bar.
**Fix:** `module/apps/hud/present.mjs#slotFor @ 9d0ab57` — a verdict with `overCooldown` keeps the slot live, the clock still shown; the tooltip names the price (`FGT.Ability.OverCooldown`). Test in `action-bar-present.test.mjs`.
