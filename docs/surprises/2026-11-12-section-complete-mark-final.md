---
id: 2026-11-12-section-complete-mark-final
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** An ability a Unit gains joins its Section's draw and drops a Complete mark (SE.change.reopen).
**Actual:** Achilles's Active Skills, Complete, stayed Complete after he gained Golden Rule: no buy offered.
**Cause:** `module/engine/intel.mjs:303 @ dd96b35` — the stored mark was read as final by the window and the buy.
**Fix:** `module/rules/intel.mjs:277 @ 0d8224a` — `isSectionComplete` asks the mark and every ability held; both readers call it.
