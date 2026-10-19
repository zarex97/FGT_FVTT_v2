---
id: 2026-10-19-copied-sheets-joined-audit-scan
found: test
kind: source-scan-pins-text
status: fixed
reviewed: false
---
**Expected:** copying fifteen new Character Sheets into `char_orig_sheets/` changes nothing until one of them is audited; unskipping Yan Qing in `clauses.test.mjs` is the only change that test should see.
**Actual:** `names every opening Clause in the audit programme's scope` failed with "Anastasia: expected [ 'MEC.pre', 'SH.pre', 'SK.pre' ] to deeply equal []".
**Cause:** `test/unit/clauses.test.mjs:71 @ 27ef5aa0` builds "the audit programme's scope" from every `.md` in the folder, so a sheet joins the programme the moment it is copied in, before anyone has named its Clauses.
**Fix:** `test/unit/clauses.test.mjs:68 @ uncommitted` — a named `NOT_YET_AUDITED` list of the fifteen; a name leaves it when its audit issue opens.
