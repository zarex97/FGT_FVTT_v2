---
id: 2026-11-12-class-line-false-after-identity-known
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** A Faction that knows a Unit's identity reads its true Class (HE.np).
**Actual:** The Dossier still printed Camouflage's false Class after the NP reveal.
**Cause:** `module/apps/intel-window.mjs:228 @ 65a1931` — the Class line read the false view before asking whether the identity is known.
**Fix:** `module/apps/intel-window.mjs:228 @ 65a1931` — the true Class once known, else the false one, else the public name.
