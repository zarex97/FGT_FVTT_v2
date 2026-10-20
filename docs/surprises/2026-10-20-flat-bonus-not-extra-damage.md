---
id: 2026-10-20-flat-bonus-not-extra-damage
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** an Attack whose attacker carries Excalibur's passive (*"50 if the DU has the 'Dark'
Attribute"*) is *"an Attack that deals extra damage to 'Dark' Units"*, so a Horror it defeats does not
split, and a Kagome Spirit it hits is banished.

**Actual:** pressing Arturia's Normal Attack on a Horror, the option set never held
`attack:vsAttribute:dark`. That press happened to be correct, because her Invisible Air was on and
switches the passive off; the engine probe showed the reader could not have seen the bonus either way.

**Cause:** `module/rules/options.mjs:178 @ 48916996` reads only modifiers whose `direction` is `"dealt"`,
and `module/rules/elements.mjs#FlatDamage @ 48916996` pushed its contribution with no `direction` at all,
so every flat bonus against an Attribute was invisible to the reader.

**Fix:** `module/rules/elements.mjs#FlatDamage @ uncommitted` states `direction: "dealt"`; nothing else
reads a modifier's direction. Test: `test/unit/gilles-260-rulings.test.mjs`, "counts a flat bonus whose
predicate names the Attribute".
