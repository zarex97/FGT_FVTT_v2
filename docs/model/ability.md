---
shape: Ability
parent: Character
code: module/rules/authoring/ability.mjs, module/rules/ability-use.mjs
---
**What it is:** a named rule set on a Character Sheet: a Class Skill, a Skill or a Noble Phantasm.

**Fields:**
- `kind`: `classSkill` `skill` `noblePhantasm`. Known before the survey.
  keys: `field.kind`
- `use`: `attack` `mode` `active` `passive` `windowed`. Known before the survey.
  keys: `field.isMode`, `field.isPassive`, `field.isAttackSkill`, `timing.ownTurn`
- `category`: what the Ability counts as for other rules, such as *"categorized as 'Charisma'"* or *"counts as
  'Divinity'"*. Known: `categorizedAs`.
  keys: `field.category`, `field.categorizedAs`, `field.categorizedAsNP`
- `delivery` (**Attribute**, Saber 2026-10-21): `ranged` `melee` `special`, from the `{R}`, `{M}` and `{S}` at the head
  of an attack, and per distance band on a Normal Attack (`N.Atk Type: STR, Melee (1pan); MAG, Ranged (2+pan)`).
  90 Saber Clauses carry it. The engine has no such field: a rule that asks for a ranged Attack measures distance
  against the War Rule `rangedMinimumRange`, and Moralltach's `{M}` at Range 3 reads ranged by that measure.
  *Special* is neither Melee nor Ranged (ruled 2026-10-21): a rule that asks for either refuses it. #281. Surprise `2026-10-21-ranged-is-stated-not-measured`.
  keys: none (#281)

- `variant by War Rule` (**Variant**, Saber 2026-10-21): *"If playing without Day or Night Rounds, the effect of
  this Skill is…"* (Gawain; also Mozart, Bunny Lion King, Melusine Ondine). A War's `phase` takes `none`, which turns the cycle
  off (`MatchData.phase`), but nothing writes it and no ability offers its alternative. Ruled 2026-10-22: in a War
  without the cycle the alternative *is* the ability. Run since #314: the `dayNightCycle` War Rule and `availableWhen` (corrected 2026-10-22).
  keys: `field.availableWhen`, `option.war:phase`
- `mode: extension` and `mode: endsAfter` (**Attribute**, Saber 2026-10-21): a mode the user may extend by paying,
  repeatedly, and one that ends after a count of events. Saitou Hajime's Chikai no Haori lasts 2◈, or until seven
  successful Attacks, and extends 1◈ for 100 Health. Shinpachi's counts five Crits. Medusa Chrysaor extends
  Athena Mode for 100 Health and 30 of her Master's. Bounded Fields already extend by payment
  (`rules/bounded-fields.mjs#extensionFor`); modes do not. **Ending on a count runs since #319**: `endsAfter:
  {event, when, count}` makes a `TallyMode` handler among the Mode's active rules, the Tally resets on each
  activation, shows "4/7" on the bar and the sheet, and ends the Mode by `tally` with a line. The paid extension is
  not run, #288.
  keys: `field.endsAfter`; extension: none (#288)

- `useFailChance` (**Attribute**, Caster 2026-10-21): a use that may fail when pressed. Charlotte (Summer)'s
  Illusionist fails 30% of the time and then cannot be used again that Turn. Merlin bites his tongue 10% of the time
  (20% below half Health), cancelling the Spell or NP. Neither enters Cooldown. Sei Shōnagon (both sheets) may perform a random
  other Action on a 1 in 10. Okita's Weak Constitution cancels any Action and stays Own. **Run since #300**:
  `UseFailure {of, chance, chanceWhen, then}`, `then: lockThisTurn` for Charlotte, `endActions` for Merlin. Merlin's
  *"below half Health"* needs a Health-threshold option no facet has yet; Sei Shōnagon's random Action stays open.
  keys: `element.UseFailure`; random other Action: none (#300)

**Kin:** Saber: every `{R}` `{M}` `{S}` attack head, 58 sheets. Mode extension: K213, R66, 3 sheets.
