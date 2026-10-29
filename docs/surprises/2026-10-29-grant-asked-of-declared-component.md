---
id: 2026-10-29-grant-asked-of-declared-component
found: live press
kind: passes-for-the-wrong-reason
status: fixed
reviewed: false
---
**Expected:** Witchcraft's `AttackProperty: ignoresMagicResistance` on `attack:component:mag` reaches her MAG Normal
Attack; `tamamo-353.test.mjs` said so.

**Actual:** Player1's Normal Attack on Arturia at Range 3: *"Negated by Magic Resistance"*, `resistance:magicResistance
−211.4`, 0 dealt.

**Cause:** `module/engine/attack.mjs:8193 @ 60958e67`: the conditional grant was asked of the component the declaration
stamps (`str`, before any distance), filled from the band only when it was missing. The test handed `attackFacts` a
state with no component, which no caller does.

**Fix:** `module/engine/attack.mjs:8193 @ uncommitted`: a Normal Attack's grant is asked of the band at this distance,
always. The test now states `component: "str"` as the declaration does, and a second plays the Attack.
