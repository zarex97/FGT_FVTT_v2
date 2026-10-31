---
id: 2026-10-29-disc-radius-key-read-nowhere
found: test
kind: unknown-value-falls-to-default
status: fixed
reviewed: true
pattern: unknown-value-falls-to-default
---
**Expected:** Kōnisshō's phase targeting `shape: { kind: chebyshevRadius, radius: 2 }` reaches every other ally within
2, and `validate:content` refuses any targeting it cannot read.

**Actual:** `validate:content` passed with 0 errors, and the test found the ally beside her without NP DmUp:
*"expected undefined to be 30"*.

**Cause:** `module/rules/targeting/shapes.mjs:84 @ 60958e67`: the disc reads its radius as `shape.r`; `radius` was read by
nothing, so the disc had no size. The validator checked the shape's `kind` and none of its keys.

**Fix:** `tools/lib/content.mjs:1932 @ ebad7a6b`: a `chebyshevRadius` with no numeric `r` is refused (proved by
putting `radius` back: the build names `phases[2].targeting`); the content now says `r: 2`.
