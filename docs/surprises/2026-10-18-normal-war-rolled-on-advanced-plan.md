---
id: 2026-10-18-normal-war-rolled-on-advanced-plan
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** a Normal war's Servants are rolled on the Normal plan: Health 1250 ± 10d20, Agility 1d10+10, Luck 1d20 (`rules/setup-rolls-normal.mjs#normalServantSetupPlan`).
**Actual:** the war built first in world `fgt2026` (Advanced by setting, no active match) showed "Max Health 1250 — no roll", "Max Agility 0 + 1 (1d2)" and "Max Luck 0 + 1 (1d4)" on every card; its Servants committed with Agility 1–2 and Luck 1–4. A second Normal war, set up while the first one's Combat was active, rolled correctly (Saber 1139 Health, Agility 15, Luck 7).
**Cause:** `module/engine/summon.mjs:103 @ b7005fed` — `prepareSummon` chose the plan by `warRuleset()`, the viewed match or else the world setting. The wizard rolls before its war's Combat exists, so it read the setting or the previous war, never the draft's ruleset; the commit guard compares the pack against the same reader and passed.
**Fix:** `module/engine/summon.mjs:103 @ 12f979b2` — the plan is chosen by the Servant's own pack, `rulesetOfPack(source.pack)`. `test/unit/summon-plan-ruleset.test.mjs` fails without it ("expected null to be '10d20'").
