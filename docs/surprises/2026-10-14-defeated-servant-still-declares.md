---
id: 2026-10-14-defeated-servant-still-declares
found: live press
kind: generic-path-escapes-special-case
status: fixed
reviewed: true
pattern: generic-path-escapes-special-case
---
**Expected:** a Servant defeated at Tick 30 (Serenity, masterless, her 8◈ Sustainability exhausted: `defeated: true, defeatedAt: 30`) can declare nothing.
**Actual:** at Tick 31, before her body was cleared, Player1 declared her Normal Attack on Achilles and it resolved; at Tick 33, after her token was gone, her Presence Concealment was cast and applied (`useSkill` returned `ok: true`).
**Cause:** `module/engine/attack-preflight.mjs @ 26d95f4` and `module/engine/skill-use.mjs:77 @ 26d95f4` — neither declaration path refuses a defeated actor; only auto-counters (`attack.mjs:1564`) and the deferred attack (`attack.mjs:6919`) do, and the latter reads `system.defeated?.at` though `system.defeated` is a boolean, so it never refuses either.
**Fix:** `module/rules/costs.mjs @ f789a77` — `canUseAbility` refuses a defeated Unit first (`defeated`), which every declaration path, the action bar and the sheet ask; `rules/movement.mjs#validatePath` refuses its Move; the deferred attack reads `system.defeated === true`. `test/unit/defeated-unit-acts.test.mjs` failed on all five before.
