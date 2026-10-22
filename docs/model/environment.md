---
shape: Environment
parent: none
code: module/rules/environment.mjs
---
**What it is:** the board-wide state a War runs under: Day or Night, Terrain, Weather.

**Fields:**
- `phase`: `day` `night`, a pure function of the Round and the opening coin flip. Known.
  keys: `option.self:phase`, `requirement.roundPhase`
- `phase` set by an effect (**Variant**, Caster 2026-10-21): Kuonji Alice's NP turns a Day Round into Night *"until
  the end of the Round"*. Tamamo Goth's turns Night into Day. Run since #314: a `phaseOverride` for the Round in progress, read by `roundPhase`. See also #287, a War without the cycle.
  keys: `phase.setRoundPhase`, `option.war:phase`

**Kin:** Caster: R4, R51, 2 sheets.
