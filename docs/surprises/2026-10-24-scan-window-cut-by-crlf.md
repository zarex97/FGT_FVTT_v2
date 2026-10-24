---
id: 2026-10-24-scan-window-cut-by-crlf
found: test
kind: source-scan-assumes-linux-checkout
status: fixed
reviewed: false
---
**Expected:** the field-visibility branch, which never touches `attack.mjs`, runs as green as the Vlad branch did.
**Actual:** `drake.test.mjs` "fireDamageDealt skips the record when the condition fails" failed on
`/if \(spec\.predicate && !testPredicate\(spec\.predicate,/`. Behaviour was unchanged.
**Cause:** `test/unit/drake.test.mjs:863 @ 6832257e` sliced 5000 characters after `fireDamageDealt`. The merge's
checkout rewrote `attack.mjs` from LF to CRLF, one more character a line, and the window stopped short of the
check, which lives in `rollChances`.
**Fix:** `test/helpers/source.mjs#functionBody @ 399ffa21` reads a function from its header to the next
top-level function, line endings normalised. The Drake scan names both functions, and the nine other fixed
windows in five files use the helper.
