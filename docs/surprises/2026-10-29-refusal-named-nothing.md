---
id: 2026-10-29-refusal-named-nothing
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** A refusal names what it waits on, as the bar's does.

**Actual:** "Cannot use this ability: An ability it depends on is still cooling." for Auctoritas, and the Skill path the same.

**Cause:** `module/engine/attack-preflight.mjs:199 @ uncommitted` — `usageRefusal` formatted `Refused.abilityOffCooldown` and dropped `detail.names`; `useSkill` returned no detail at all.

**Fix:** `module/engine/attack-preflight.mjs:203 @ uncommitted` — `CoolingNamed` with the names; `useSkill` carries the usage detail and `refusalWords` reads it.
