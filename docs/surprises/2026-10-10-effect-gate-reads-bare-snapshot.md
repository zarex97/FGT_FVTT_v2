---
id: 2026-10-10-effect-gate-reads-bare-snapshot
found: live press
kind: bare-snapshot-loses-position
status: fixed
reviewed: false
---
**Expected:** Voyager of the Storm pressed inside the Storm Border applies three effects to each ally:
Atk Up 10% for ⅓◈, NP DmUp 10% for ⅓◈, and — Nemo being in Imaginary Numbers Space — Atk Up 20% for 1◈.

**Actual:** "6 effect(s) applied" to three Units: the 1◈ Atk Up 20% landed on nobody. In the same use the
cooldown branch read the terrain and set 7 Turns, the 3◈-⅔◈ branch.

**Cause:** `module/engine/skill-use.mjs:1189 @ 08ea4b1` — a per-entry `predicate` was tested against
`rollOptionsFor({ attacker: unitSnapshot(actor) })`, a bare snapshot with no board annotations, so no
`self:terrain:*` and no `self:onPlatform:*`. The phase gates and the cooldown read the board unit. Same
family as #157.

**Fix:** `module/engine/skill-use.mjs:1196 @ d162f50` — the board-derived caster travels in as
`phaseCtx.self` and the entry gate reads it.
