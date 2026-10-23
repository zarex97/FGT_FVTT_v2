---
id: 2026-10-22-nearest-bound-skills-too
found: live press
kind: qualifier-quoted-not-checked
status: fixed
reviewed: true
pattern: qualifier-quoted-not-checked
---
**Expected:** *"When the Gigantic Horror Attacks, it always Attacks the nearest Unit"*: his Attacks are bound; his
Evil Gaze, a Skill, hits the 5×5 the GM turns; his 3×3 on the nearest hits every Unit in it (11g).
**Actual:** the Evil Gaze north was refused: "No legal targets: ... (and 9 more excluded)", each enemy "the attacker
is compelled to attack another unit"; and the 3×3 kept the nearest Unit alone.
**Cause:** `module/rules/compulsion.mjs:41 @ d97795b9` — the `nearest` compulsion carried neither `attacksOnly` nor
`areaMustInclude`, so `compulsionNarrowing` narrowed every resolution to the nearest Units. "When it Attacks" was
quoted in the comment and never checked; no test aimed a Skill or a full area.
**Fix:** `module/rules/compulsion.mjs:45 @ uncommitted` — `attacksOnly: true, areaMustInclude: true`; test "the nearest
binds his Attacks only, and his 3x3 on it hits the rest of the area".
