---
id: 2026-11-12-lost-ability-row-printed-id
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** An ability its bearer lost keeps its Entry, marked "no longer held" (SE.change.lose).
**Actual:** The row read "achilles-heel No longer held": its content id.
**Cause:** `module/apps/intel-window.mjs:189 @ dd96b35` — the tag is drawn from the Item, which is gone; the row fell back to the id.
**Fix:** `module/engine/intel.mjs:32 @ 0d8224a` — a Faction keeps each learned ability's tag (and name once full); a row with none reads "An ability".
