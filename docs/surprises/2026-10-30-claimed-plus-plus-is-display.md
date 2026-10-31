---
id: 2026-10-30-claimed-plus-plus-is-display
found: test
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** Summer Habetrot's spec said *"Health 1000 at END C++ (the `++` on the display, Asterios's)"*, read off `docs/B-rank-tables.md`'s note that Asterios's `A++` is 1500.
**Actual:** her projection read 1200: `expected 1200 to be 1000`. The engine has derived Max Health from END's steps since #126; `asterios.yml` itself says A++ steps to 1700.
**Cause:** `module/domain/health.mjs:127 @ 2d63f159` — `maxHealthFor` steps END by ±100 and the table beats the sheet; the rank-tables chapter's sentence is older than that rule and I quoted it without reading the reader.
**Fix:** `docs/superpowers/specs/2026-10-30-summer-habetrot-clauses.md @ f5052610` — the claim corrected to 1200, and her *"original"* Max Health read as that 1200 (`@self.originalMaxHealth`, `module/rules/snapshot.mjs @ f5052610`).
