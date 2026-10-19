---
id: 2026-10-18-wizard-turns-per-round-never-written
found: test
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** the War tab's "Turns per Round" field sets the ◈ of the war it builds.
**Actual:** the field is edited, shown on the Confirm tab, and then dropped. `commitWar` writes `warType`, `ruleset`, `homeBaseDepth`, `region`, `difficulty` and `grailThreshold` to the match, and nothing writes `turnsPerRound` anywhere. Every Tick reader keeps reading the world setting (`game.settings.get("fgt", "turnsPerRound")`, 69 sites), so a war set up at 8 plays at whatever the world says.
**Cause:** `module/engine/war-setup.mjs:332 @ b7005fed` — the match update names six of the draft's fields and not `turnsPerRound`; `MatchData` (`module/data/misc.mjs:159-194 @ b7005fed`) has no field to hold it.
**Fix:** `module/engine/war-setup.mjs:350 @ ddf335e4` — `commitWar` walks `WAR_RULE_KEYS` and writes every War Rule onto the War, `turnsPerRound` included; `MatchData` declares one field per rule. Live: a wizard war set to 8 holds `turnsPerRound: 8`, and a 4◈ cooldown read 32 Turns.
