---
shape: Statblock
parent: Character
code: module/data/actor/, module/rules/damage/pipeline.mjs
---
**What it is:** a Unit's Parameters, Attributes, Health, MOV, Range, Base Attack and Sustainability.

**Fields:**
- `visibility` (**Variant** `hidden from other players`, Saber 2026-10-21): Mordred's Secret of Pedigree keeps her
  Health, Agility and Luck off what other players see, and all her notes but Parameters and Class Skills. The GM
  sees them. Lancelot (Berserker) carries the same text. Effects already have a per-instance visibility; a
  statblock has none. Not run, #289.
- `injuryThreshold` (**Attribute**, Berserker 2026-10-21): the damage that forces an Injury Roll. Tamamo Cat and
  Summer Habetrot double it to 200. Tamamo Cat's *Agility Roll* is a typo for Injury Roll (the user, 2026-10-21). Today it
  is the constant `INJURY_THRESHOLD` in `module/rules/damage/pipeline.mjs`. Assassin 2026-10-21: Danzō and Kashin
  raise it to 150. Charlotte's Determination of Steel gates the roll on a d20 instead: 1 to 9 rolls for Injury. Avenger:
  Edmond Dantès's Determination of Steel gates it on a d4, so only a 1 rolls. Not
  run, #310.
- `Sustainability`: a number of ◈ Turns, or *N/A*. Known.

**Kin:** Saber: K211, 2 sheets. Berserker: K32, 2 sheets. Assassin: K40, 2 sheets, and Charlotte.
