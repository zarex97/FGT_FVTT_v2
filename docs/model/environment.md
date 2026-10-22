---
shape: Environment
parent: none
code: module/rules/environment.mjs
---
**What it is:** the board-wide state a War runs under: Day or Night, Terrain, Weather.

**Fields:**
- `phase`: `day` `night`, a pure function of the Round and the opening coin flip. Known.
- `phase` set by an effect (**Variant**, Caster 2026-10-21): Kuonji Alice's NP turns a Day Round into Night *"until
  the end of the Round"*. Tamamo Goth's turns Night into Day. A pure function leaves no room for an override. Not run, #294. See also #287, a War without the cycle.

**Kin:** Caster: R4, R51, 2 sheets.
