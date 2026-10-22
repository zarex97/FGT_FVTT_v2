---
id: 2026-10-22-issue-306-claimed-a-built-gap
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: false
---
**Expected:** the Lancer survey's #306 said nothing lets an ability be used on its Cooldown for a price. My
capability-lookup branch then wrote `keys: none (#306)` on `docs/model/cooldown.md`'s `bypassForCost` line, and
the architecture review of 2026-10-22 listed #306 as a gap for the Cooldown clock candidate.

**Actual:** it has been built since #230. `cooldownOverride: {masterHealth, withinZon}` is authored on Arturia's
Mana Burst. The use gate accepts it, refuses `cooldownOutsideZon` outside the ZON, and charges the Master's Health
as `overCooldown`. Both use paths then skip the clock. `node tools/capability.mjs cooldownOverride` finds it. Only
Lanceturia's copy of the Skill is unauthored content.

**Cause:** `module/rules/costs.mjs:370 @ a3ff740a`. The gate reads `ability.cooldownOverride`. The survey named
`cooldownWaiver` as the nearest key and never searched for the use-on-Cooldown path. When I filled the `keys:`
lines, I copied the issue's claim instead of running the lookup on the Clause's words.

**Fix:** `docs/model/cooldown.md:37 @ 4a2daaef`. The `bypassForCost` line now reads run since #230, with
`keys: field.cooldownOverride`. #306 was closed as built, and Lanceturia's Mana Burst is content for her own build.
