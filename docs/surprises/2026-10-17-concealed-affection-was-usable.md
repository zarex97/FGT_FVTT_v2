---
id: 2026-10-17-concealed-affection-was-usable
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Concealed, Kiritsugu cannot use Affection of the Holy Grail's Active: it inflicts Debuff ResDwn on *"all
Units within a 2 panel area"*, enemies among them, and Presence Concealment clause 7 refuses an Active Skill
*"targeting/affecting an enemy Unit"*.
**Actual:** `canUseWhileConcealed` on his live Affection answered `{ok: true}`.
**Cause:** `module/rules/concealment.mjs#canUseWhileConcealed @ a27e058f` read only the ability's own `targeting`
(himself); the phase that reaches the enemies carries a `targeting` of its own, which the use path reads
(`skill-use.mjs#phaseTargets`) and clause 7 did not.
**Fix:** `module/rules/concealment.mjs#canUseWhileConcealed @ 5101f86f` reads every phase's targeting as well.
