---
shape: Effect
parent: none
code: module/rules/registry.mjs, docs/A-effect-catalogue.md
---
**What it is:** a buff, debuff or status on a Unit, with polarity, volatility, valence, stacking and visibility.

**Fields:**
- the axes in Ch. 14, `replaces`, and tagged copies such as `Burn (Pilgrim)`. Known.
  keys: `effectDef.polarity`, `effectDef.volatility`, `effectDef.valence`, `effectDef.stacking`, `effectDef.replaces`
- `magnitudeDecay` (**Attribute**, Caster 2026-10-21): a magnitude that falls while the Effect stands. Merlin's
  Crit DmUp (Illusion) loses 5% per successful Crit. Tomoe (Summer)'s Crit DmUp (Nightowl) is 100%, then 75%,
  then 50% over its three ◈ Turns. A magnitude is fixed at application today. Not run, #296.
  keys: none (#296)

- `polarity` by the recipient's side (**Variant**, Lancer 2026-10-21): one Effect that is a debuff on enemies and a
  buff on allies. Romulus Quirinus's Roma Stacks *"are categorized as a debuff when applied to enemy Units and are
  categorized as a buff when applied to allied Units"*. Francesca Prelati's Berserk (Folly) *"applied on allied
  Units by this Skill is treated as a buff instead of a debuff"*. Polarity is fixed on the definition today. Not
  run, #303.
  keys: none (#303)
- `stacking` one on the field (**Variant**, Lancer 2026-10-21): only one instance may stand on the whole board.
  Nezha: *"Only one Stun (Sash) debuff can exist on the field at any time."* Summer Passionlip: only one of the
  Prince or Princess effects at any time, a new one removing the old. Stacking today is per bearer. Not run, #304.
  keys: none (#304)
- `pausedWhile` (**Attribute**, Lancer 2026-10-21): a duration that stops counting while a condition holds. Santa
  Suzuka's Seiya buffs do not lose duration during a Night Round. Miyu (Summer)'s Inshū effect pauses while she
  meets Milk Mode's own conditions. A duration always counts down today. Not run, #305.
  keys: none (#305)

**Kin:** Caster: R300. Saber: Tomoe (Summer) R301. Lancer: K3, R14, R231, R32; Caster: Francesca Prelati;
Saber: Summer Passionlip.
