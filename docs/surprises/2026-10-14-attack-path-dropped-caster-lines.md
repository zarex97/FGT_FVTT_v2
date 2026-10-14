---
id: 2026-10-14-attack-path-dropped-caster-lines
found: test
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Ruling LK, "a Skill card lists its resource changes", needed one line in the Skill path's `resource` phase.
**Actual:** The attack path runs the same caster phases through `runCasterPhases` and threw away every row they returned, so Toole Fragarach's 3 tokens, Troias Tragōidia's Agility and every caster-phase cooldown or item line on an Attack reached no card.
**Cause:** `module/engine/attack.mjs:1230 @ 4983091` — `await runCasterPhases(...)` with its result unread; only the Skill path called `postCard`.
**Fix:** `module/engine/attack.mjs:1232 @ uncommitted` — the attack path posts those rows on a Skill card of its own.
