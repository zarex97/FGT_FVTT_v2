---
id: 2026-10-17-forest-rolled-on-a-body
found: live press
kind: generic-path-escapes-special-case
status: fixed
reviewed: true
pattern: generic-path-escapes-special-case
---
**Expected:** The forest affects *"all enemy Units within a 2 panel area"*: a defeated Unit is no longer one.
**Actual:** Heracles was defeated on tick 25 and his body stood its one Turn; Round 8's end read *"Berserker: Nameless Forest: resisted, rolled 97 vs 90%"*: the forest rolled on the body.
**Cause:** `module/engine/scheduler.mjs#targetsOf @ eebbb988`, case `nearby`, filtered by distance and relation only; bodies stay on the board one Turn (`clearBodies`, #65 ruling 25), inside every radius.
**Fix:** `module/engine/scheduler.mjs#targetsOf @ 7755ebb4` leaves defeated Units out; `nursery-247-rulings.test.mjs` ends a Round beside a body and a live foe.
