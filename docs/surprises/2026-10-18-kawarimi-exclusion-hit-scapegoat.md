---
id: 2026-10-18-kawarimi-exclusion-hit-scapegoat
found: test
kind: special-case-leaks-into-generic-path
status: fixed
reviewed: false
---
**Expected:** Kawarimi's partner is never Danzō herself, so `chooseReactionTarget` was given her id to exclude; nothing else changes.
**Actual:** `kiritsugu-243-arena.test.mjs`, "Scapegoat at the rung": *"Cannot read properties of undefined (reading 'options')"* -- Scapegoat, `aimedAt: chosen`, may pick Kiritsugu himself (#243 reading 4), and the exclusion was passed for every chosen reaction.
**Cause:** `module/engine/attack.mjs#answerRung @ dfcaa421` -- the new `exclude` was passed whenever the user picked, not only for `chosenIfSelf`, so one Servant's rule reached a shared door.
**Fix:** `module/engine/attack.mjs#answerRung @ dfcaa421` -- `exclude` only for `aimedAt: chosenIfSelf`.
