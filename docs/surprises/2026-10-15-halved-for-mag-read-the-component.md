---
id: 2026-10-15-halved-for-mag-read-the-component
found: test
kind: rule-word-read-one-way
status: fixed
reviewed: false
---
**Expected:** *"halved for Attacks which use Base Attack (MAG)"* reaches Mana Burst, which sums BA(STR) + BA(MAG): Castor's +55% from Mad Enhancement is halved on it. The ticket assumed the halving was simply not applied; the plan assumed `component: mag` was the word to key on.
**Actual:** the arena press of Castor's Mana Burst with Mad Enhancement on added the full figure: `expected [ 55 ] to deeply equal [ 25 ]` (the pure pipeline pin read the same).
**Cause:** `packs/_source/class-skills/mad-enhancement.yml:80 @ 7231295` — the halved half of the pair is `predicate: [attack:component:mag]`. "Uses" was read as the component an attack COUNTS AS; Mana Burst declares `component: str` on purpose (so that "not affected by Magic Resistance" is stated once), while its base is STR + MAG. The two words had one reader and meant two things.
**Fix:** `module/rules/damage/pipeline.mjs:376 @ b122ab9` derives `attack:usesBase:<component>` from the sources stage 1 sums, `module/rules/facets.mjs @ b122ab9` declares it, `mad-enhancement.yml:73,90 @ b122ab9` reads it. A corpus sweep pins who else it could touch: no attack of a Mad Enhancement bearer but Castor's Mana Burst.
