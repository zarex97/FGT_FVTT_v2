---
id: 2026-10-16-instinct-asked-only-on-the-evade-rung
found: live press
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** Medea's Normal Attack on Arturia rolls Instinct first: 70% she Evades automatically, otherwise the Combat Process goes on (#230 IN.1, IN.1.fail). My own Ch. 13 note said "every Attack rolls 70%".
**Actual:** the card went straight to "Choose a reaction" with no roll. Read through: chosen, her Evade succeeded outright every time, at 100% and not 70.
**Cause:** `module/rules/checks.mjs:137 @ b4464ed` — an `AutoSucceed` is granted on the Evade RUNG (`checks.mjs#evadeCheck` ignores its `chance`), and the one place a chance is rolled, `engine/attack.mjs#autoEvadeFrom`, runs only after a reaction ability like Trofa is used. I authored Instinct as Trofa's element and wrote the doc from the element, never from the path; the projection test passed on the element's shape.
**Fix:** `module/engine/attack.mjs:6985 @ 9d0ab57` — `instinctOf` rolls an `AutoSucceed` marked `whenAttacked` at the reaction rung's door, success an Evade that succeeded, failure a line on the card; `checkPlan` leaves `whenAttacked` out of the rung, so an Evade chosen after a failure is rolled. Arena tests play all three.
