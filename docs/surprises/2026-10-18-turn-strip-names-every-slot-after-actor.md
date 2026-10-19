---
id: 2026-10-18-turn-strip-names-every-slot-after-actor
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** the turn panel's order strip lists Round 1 of a two-faction war as "Faction 2 · Faction 1 · GM", the order `system.turnOrder` holds.
**Actual:** Player2 saw "Faction 2 · Faction 2 · Faction 2" on Faction 2's Turn, while `turnOrder` was `["faction-2", "faction-1", <GM combatant>]`.
**Cause:** `module/apps/hud/turn-panel.mjs:162 @ b7005fed` — `factionLabel(combat, factionId)` returned `combat.combatant.name`, the combatant acting now, and read its `factionId` argument only as a fallback; the header and the strip shared it, and only the header asks about the acting faction.
**Fix:** `module/apps/hud/turn-panel.mjs:162 @ 12f979b2` — a slot is named by its faction in the roster, or by its combatant for the GM's slot; the acting combatant answers only when no id is given. `test/unit/turn-order-strip.test.mjs`.
