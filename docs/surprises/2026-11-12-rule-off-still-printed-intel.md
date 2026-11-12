---
id: 2026-11-12-rule-off-still-printed-intel
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** With the War Rule off every page is open, "with no Intel shown" (WR.off.open).
**Actual:** The list and the page still printed each Unit's Intel ("Achilles 22").
**Cause:** `module/apps/intel-window.mjs:233 @ 0d8224a` — the off branch opened every Entry but kept the figure.
**Fix:** `module/apps/intel-window.mjs:233 @ 0d8224a`, `templates/apps/intel.hbs` — off, no Intel figure in the list or on the page.
