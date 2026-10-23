---
id: 2026-10-22-form-area-hit-enemies-only
found: live press
kind: qualifier-quoted-not-checked
status: fixed
reviewed: true
pattern: qualifier-quoted-not-checked
---
**Expected:** the Gigantic Horror's Normal Attack is a 3×3 *"hitting every Unit in it but himself"* (#323 reading
11g), and it must Attack the nearest Unit, any side, its own Horror included (12).
**Actual:** "Illegal attack: No legal targets: Horror is an ally — same faction as Gilles (faction-1); this ability
targets enemy (and 1 more excluded)."
**Cause:** `module/rules/ability-use.mjs:434 @ d97795b9` — a shaped Normal Attack's fallback targeting selects
`relations: ["enemy"]` for every area, Kagome's and the form's alike, and no test aimed the form at an ally:
"every Unit" was quoted and never checked.
**Fix:** `module/rules/ability-use.mjs:434 @ uncommitted` — the area reads `normalAttack.relations`, which a form's
override may name; the Gigantic Horror's says `[enemy, ally, neutral]`; test "its Normal Attack hits every Unit in
the 3x3 but himself, its own Horror too".
