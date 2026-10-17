---
id: 2026-10-17-instakill-rode-a-hit-for-zero
found: retraction
kind: passes-for-the-wrong-reason
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** Mystery Bisection's *"35% chance of inflicting Instakill if damage was dealt"* rolls only on damage.
`kiritsugu.test.mjs` said the rider gate already refused a hit that dealt nothing, so no `requiresDamage` was needed.
**Actual:** Since §46.4-LI riders land on a hit, not a hurt: a Block to 0 rolls the Instakill. The test still passed,
because it asserted that the key was absent, not what a 0 hit did.
**Cause:** `module/engine/attack.mjs#applyAbilityEffects @ a27e058f` gates riders on `ridersFire` (hit), and
`packs/_source/abilities/kiritsugu-mystery-bisection.yml @ a27e058f` stated no gate of its own.
**Fix:** `module/engine/attack.mjs:5889 @ 5101f86f` reads `requiresDamage` on a phase; the Instakill has its own
phase with it, the mark none (#243 readings 15, 16).
