---
id: 2026-10-18-wizard-turns-per-round-never-written
found: test
kind: producer-without-consumer
status: open
reviewed: false
---
**Expected:** the War tab's "Turns per Round" field sets the ◈ of the war it builds.
**Actual:** the field is edited, shown on the Confirm tab, and then dropped. `commitWar` writes `warType`, `ruleset`, `homeBaseDepth`, `region`, `difficulty` and `grailThreshold` to the match, and nothing writes `turnsPerRound` anywhere. Every Tick reader keeps reading the world setting (`game.settings.get("fgt", "turnsPerRound")`, 69 sites), so a war set up at 8 plays at whatever the world says.
**Cause:** `module/engine/war-setup.mjs:332 @ b7005fed` — the match update names six of the draft's fields and not `turnsPerRound`; `MatchData` (`module/data/misc.mjs:159-194 @ b7005fed`) has no field to hold it.
**Fix:** open — lands with the War Rules move (every setting onto the War), which gives the match a `turnsPerRound` and makes the Tick readers ask the War.
