---
id: 2026-10-29-committed-before-full-suite
found: test
kind: committed-before-full-suite
status: fixed
reviewed: false
---
**Expected:** Karl's first build stage was green: `karl-351.test.mjs` and the few files beside it passed, so
`cf74f35b` was committed.

**Actual:** the full suite later showed failures from that commit: *"expected [ …(2) ] to deeply equal [
'module/engine/landing.mjs' ]"* (Ceremonial Reformation's grants called `applyEffect` around the one door);
*"build new subjects with test/helpers/subject.mjs: expected 59 to be less than or equal to 58"* (a hand-built God's
Resolution target); `npsHeld` missing from the frozen `COUNT_KINDS` list. The commit also carried no docs.

**Cause:** `module/engine/aura-grants.mjs:39 @ cf74f35b`: the repo's guards are scattered across the whole suite, one
per piece, so a new piece is checked by tests far from its own file. A focused run proves the feature works, and
none of the guards.

**Fix:** `module/engine/aura-grants.mjs:40 @ 45232543`: the grants land through `landEffect`, God's Resolution's test is
built on real content (`packs/_source/effects/test-stun-resist.yml`), `npsHeld` joined the frozen list, and the docs
landed with it. Before any commit, run the full suite at four workers, lint and `validate:content`.
