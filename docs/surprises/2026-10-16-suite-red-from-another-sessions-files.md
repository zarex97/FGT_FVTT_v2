---
id: 2026-10-16-suite-red-from-another-sessions-files
found: test
kind: drive-kit
status: open
reviewed: false
---
**Expected:** the full suite green after the #208 rulings, as at `cf20cfc`.
**Actual:** `clauses.test.mjs > names every opening Clause in the audit programme's scope`: "Arturia: expected [ 'IA.pre', 'AV.pre' ] to deeply equal []".
**Cause:** `test/unit/clauses.test.mjs:77 @ cf20cfc` reads every sheet in `char_orig_sheets/`; another Claude session working in the same checkout had added `Copia de Arturia.md` (untracked) and edited `clauses.test.mjs` and `tools/lib/clause-names.json`. None of it is from this change.
**Fix:** open, and not this change's: left to the session that owns those files; the #208 change touches none of them.
