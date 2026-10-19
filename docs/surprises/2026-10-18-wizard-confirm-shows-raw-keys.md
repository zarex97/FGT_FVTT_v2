---
id: 2026-10-18-wizard-confirm-shows-raw-keys
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** the setup wizard's Confirm tab names the war as the War tab does: "Great Holy Grail War", "Normal", "Intermediate — the Luck Check removed", "Essences".
**Actual:** it printed the stored keys: "greatHolyGrailWar", "normal", "intermediate", "essences", seen while shooting the beginner's guide.
**Cause:** `templates/apps/setup-wizard-confirm.hbs:3 @ b7005fed` — each `<dd>` printed the draft value itself; the label maps the War tab localizes were never looked up here.
**Fix:** `templates/apps/setup-wizard-confirm.hbs:3 @ 12f979b2` — each value is localized through the context's `warTypes`, `rulesets`, `difficulties` and a new `masterModes` map.
