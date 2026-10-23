---
id: 2026-10-23-revival-aftermath-said-nothing
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** when Defender of Humanity revives U-Olga Marie, Gyakkou's four effects are on a card: Atk Up,
Invuln (Gyakkou), her NP's clock −⅓◈ and Max Health −10% (#328, GY.*).
**Actual:** pressed live 2026-10-23, Round 40: the only card read *"Beast is defeated and revived by Defender of
Humanity, with 1000 Health. Agility restored to 5. Luck restored to 3."* All four were written (her Max Health
2000 → 1800, Invuln (Gyakkou) held) and nothing said so. Heracles's Indomitable has had the same silence.
**Cause:** `module/engine/scheduler.mjs:1898 @ 7f02a2c2`: `resolveDefeat` spread `unitRevived`'s intents into
the batch, and the Attack applies that batch with `applyBatch`, which keeps no lines; the revive log carried none.
**Fix:** `module/engine/scheduler.mjs#revivedSaid @ 7f02a2c2`: the revive log carries what each handler did,
by Skill, and `revival-report.mjs` prints a line per Skill. `olga-328.test.mjs` Gyakkou test was red first.
