---
id: 2026-10-21-repo-sheets-differ-from-drive
found: tooling
kind: assumed-shape
status: fixed
reviewed: true
pattern: source-outside-the-repo
---
**Expected:** Exporting all 469 Character Sheets from the roster's Drive folders for the sheet survey, I took the
48 `char_orig_sheets/Copia de *.md` files to be the same text: every build and audit has cited them as *the* sheet.

**Actual:** 5 match the Drive export line for line, once trailing spaces are ignored. 43 differ. Some differences are
rules. Gawain's Drive sheet adds a `N.Atk Type` line and a 25% Burn on a Galatine Normal Attack. It applies Nightless as
a buff, and it carries no-Day-Night alternates and an "Old Effect" Numeral of the Saint. Francis Drake differs on 88
lines, Achilles and Penthesilea on 63 each.

**Cause:** `char_orig_sheets/by-class/Saber/Gawain.md` (exported 2026-10-21) against `char_orig_sheets/Copia de
Gawain.md @ 3530fb5b`. The repo copies are snapshots taken when each sheet was added. Nothing tracks the Drive text
after that, so a sheet edited in Drive leaves its built Servant on the old text unseen. Which side is newer for each
sheet is not yet known. The user said some Drive files needed adjusting before they could be read.

**Fix:** the user ruled on 2026-10-21: *"The new text, for now."* The Drive export in `char_orig_sheets/by-class/`
governs. A built Servant whose sheet changed is behind its sheet until it is re-audited against the new text.
