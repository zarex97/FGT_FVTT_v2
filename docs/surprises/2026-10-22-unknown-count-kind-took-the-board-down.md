---
id: 2026-10-22-unknown-count-kind-took-the-board-down
found: live press
kind: unknown-value-falls-to-default
status: fixed
reviewed: true
pattern: unknown-value-falls-to-default
---
**Expected:** a Skill made in the editor with `count: {of: "bogus"}` greys its own slot on the bar, refused
`unknownCountKind` and naming "bogus" (plan Task 9, L1-15). The rest of the Unit, and the board, stay as they were.

**Actual:** pressed live as Player1 on Test Count Bench. The GM created the Skill by eval, and the bar never showed
it. The portrait kept the old Aria (6/9 after it was set to 0). Asked on Player1's client, `unitOf(bench,
currentBoard())` threw *"UnknownCountKind: FGT | Unknown count kind "bogus""*. The whole board's projection failed,
so every reader of it went stale.

**Cause:** `module/rules/count.mjs:84 @ 6d902c0f`. `countOf` throws for an unknown kind, and the element's value is
read through `rules/elements.mjs#stackScaled` during collection. Nothing between the element and `snapshotBoard`
catches it. The use gate's refusal (`rules/costs.mjs`) is never reached, because the bar builds its slots from the
board that failed. `rules/elements.mjs`'s own StatDelta comment already states the rule this broke: *"a bad
magnitude should cost its own clause, not the match"*.

**Fix:** `module/rules/elements.mjs:181 @ 33bd34e9`. `collectContributions` catches an `UnknownCountKind` per element: the clause is dropped with a console error naming it, and the board projects. The bar then shows the slot refused `unknownCountKind`. Test in `count-validation.test.mjs`.
