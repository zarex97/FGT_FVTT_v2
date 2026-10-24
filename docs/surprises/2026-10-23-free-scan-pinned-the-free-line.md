---
id: 2026-10-23-free-scan-pinned-the-free-line
found: test
kind: source-scan-pins-text
status: fixed
reviewed: false
---
**Expected:** the full suite green after `freeAtWindow` (#330): a free action on the Skill path is still free, so
nothing guarding it should move.
**Actual:** `pale-rider.test.mjs` "a free action on the Skill path is neither checked against nor charged to a
pool" failed on `/const free = Boolean\(ability\.system\?\.freeAction\);/`. The free action behaved the same.
**Cause:** `test/unit/pale-rider.test.mjs:308 @ 630495df` pins the whole line, semicolon included;
`module/engine/skill-use.mjs:154 @ 2f18de06` added `|| (atWindow && ...freeAtWindow)` before it.
**Fix:** `test/unit/pale-rider.test.mjs:306 @ 2f18de06` matches the named `freeAction` read, with any narrower
free beside it, in both files it scans.
