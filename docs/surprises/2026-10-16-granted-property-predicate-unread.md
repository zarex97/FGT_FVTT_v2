---
id: 2026-10-16-granted-property-predicate-unread
found: test
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Agni's `AttackProperty element: fire`, predicated on `attack:kind:normal`, makes Arjuna's Normal
Attacks Fire and leaves Pashupata, which has no element, alone (#234 reading 15).
**Actual:** reading the granted-element path showed `grantedElementIn` took the first `element` property whatever
its predicate, and `attackerGrants` did the same for `pierce`: Anastasia's Watermelon, *"at a Range of 1 to 2 while
inflicted with Blind"*, granted Pierce to every Attack she made.
**Cause:** `module/engine/attack.mjs:740 @ uncommitted` — `AttackProperty` stores its predicate as deferred, "a
property conditioned on the attack cannot be answered when the buff is applied", and no reader ever answered it.
**Fix:** `module/engine/attack.mjs:752 @ uncommitted` — the declaration reads only unconditional grants;
`attackFacts` adds the conditional ones whose predicate this attack on this defender meets (`conditionalGrants`).
