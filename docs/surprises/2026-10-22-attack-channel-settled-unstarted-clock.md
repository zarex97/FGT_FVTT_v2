---
id: 2026-10-22-attack-channel-settled-unstarted-clock
found: retraction
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: passes-for-the-wrong-reason
---
**Expected:** Review Focus 4, "pinned in Task 12": a use that began a channel neither starts nor settles its clock, on both paths.
**Actual:** an Attack whose first phase is a `channel` and whose clock reads `use:evaded` was Evaded, and the settle wrote a 3-Turn clock on an ability still channelling (`cooldown-settle.test.mjs`, "expected 3 to be +0").
**Cause:** `module/engine/attack.mjs:267 @ ba3b40a5` — the Skill path notes `channelStarted` on its record; the attack path's commit noted `criteriaMet`, `overCooldown` and `concealmentBroken` only, and `payAbilityPrice` never returned the channel it began. `settleDelta`'s guard had nothing to read. Task 12's test pinned `settleDelta` with a hand-noted fact, not the path that should note it.
**Fix:** `module/engine/attack.mjs#resolveAttack @ 8da7aa09` — `payAbilityPrice` returns `channelStarted` and the commit notes it; the test reads the saved record and the clock.
