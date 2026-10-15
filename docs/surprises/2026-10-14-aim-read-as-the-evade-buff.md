---
id: 2026-10-14-aim-read-as-the-evade-buff
found: user
kind: rule-word-read-one-way
status: fixed
reviewed: true
pattern: rule-word-read-one-way
---
**Expected:** Aim *"ignores Dodge and the Evade action"* (Appendix A §A.3), so Brahmastra on Heracles offers him no Evade.
**Actual:** Heracles rolled Evade against Brahmastra. The build had read "the Evade action" as the `Evade` buff: `evade.yml` says *"an automatic evasion is the Evade action taken without a die"*. The same appendix's Dodge line, *"Cannot use the Evade action"*, uses the words for the rolled Evade. The user ruled the second reading: no Evade at all.
**Cause:** `module/rules/checks.mjs:263 @ 7333e08` — `attackHasAim` only switched Dodge off and forced the roll, and nothing closed the Evade rung at declaration. One reading of a rule phrase was built without checking how the same document used it elsewhere.
**Fix:** `module/rules/checks.mjs:233 @ 95b91ea` — Aim fails the check first, *"Aim: cannot be Evaded"*; `module/engine/attack.mjs` closes the Evade rung at declaration and `evadePermit` empties the permit, so Trofa and the Evade buff evade nothing. Block still answers.
