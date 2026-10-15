---
id: 2026-10-14-sealed-mode-still-switched
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Under Skill Seal, *"The effects of this Skill are negated"*: Uncrowned Arms Mastership contributes nothing and cannot be switched, as its file's `negatedBy: [skillSeal]` comment says ("both halves").
**Actual:** Under a staged Skill Seal its crit modifiers were gone, but the bar slot stayed lit and Player1's press switched Effect 2 → 1 (toggledAt 11, a Round use recorded).
**Cause:** `module/rules/modes.mjs:65 @ 7333e08` — `canToggleMode` never read `negatedBy`; the window offer (`abilitiesAtWindow`) and the rules collection did.
**Fix:** `module/rules/modes.mjs:82 @ 95b91ea` — a negated mode refuses "negated", worded "{name} is negated and cannot be switched."
