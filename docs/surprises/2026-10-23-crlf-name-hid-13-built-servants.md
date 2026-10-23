---
id: 2026-10-23-crlf-name-hid-13-built-servants
found: tooling
kind: assumed-shape
status: fixed
reviewed: true
pattern: source-scan-assumes-linux-checkout
---
**Expected:** `node tools/sheet-kin.mjs` marks every sheet with a Servant file as built, so a survey and a
leverage ranking skip what is already built.
**Actual:** ranking unbuilt sheets on 2026-10-23, only 20 of 33 built Servants read as built. Achilles,
Arjuna, Arturia, Asterios, EMIYA, Heracles, Karna, Kingprotea, Medea, Proto Gil, Quetzalcoatl, Scáthach
and Semiramis read as unbuilt, so their Kin groups were offered as having no precedent.
**Cause:** `tools/sheet-kin.mjs:37 @ 1ba28f15`. The name was read with `[^"\n]+`, and those 13 files are
saved with CRLF. The name kept its `\r` and matched no sheet title.
**Fix:** `tools/lib/kin.mjs#builtServantNames @ 28e231ce`. One reader, which drops `\r` too, and
`sheet-kin.mjs` calls it. `sheet-kin.test.mjs` "which sheets are built" was red first, quoting `'Achilles\r'`.
