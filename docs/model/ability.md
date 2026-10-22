---
shape: Ability
parent: Character
code: module/rules/authoring/ability.mjs, module/rules/ability-use.mjs
---
**What it is:** a named rule set on a Character Sheet: a Class Skill, a Skill or a Noble Phantasm.

**Fields:**
- `kind`: `classSkill` `skill` `noblePhantasm`. Known before the survey.
- `use`: `attack` `mode` `active` `passive` `windowed`. Known before the survey.
- `category`: what the Ability counts as for other rules, such as *"categorized as 'Charisma'"* or *"counts as
  'Divinity'"*. Known: `categorizedAs`.
- `delivery` (**Attribute**, Saber 2026-10-21): `ranged` `melee` `special`, from the `{R}`, `{M}` and `{S}` at the head
  of an attack, and per distance band on a Normal Attack (`N.Atk Type: STR, Melee (1pan); MAG, Ranged (2+pan)`).
  90 Saber Clauses carry it. The engine has no such field: a rule that asks for a ranged Attack measures distance
  against the War Rule `rangedMinimumRange`, and Moralltach's `{M}` at Range 3 reads ranged by that measure.
  *Special* is neither Melee nor Ranged (ruled 2026-10-21): a rule that asks for either refuses it. #281. Surprise `2026-10-21-ranged-is-stated-not-measured`.

- `variant by War Rule` (**Variant**, Saber 2026-10-21): *"If playing without Day or Night Rounds, the effect of
  this Skill is…"* (Gawain; also Mozart, Bunny Lion King, Melusine Ondine). The Day/Night cycle is always on today
  (`rules/environment.mjs#phase`): no War Rule turns it off, so the alternative text can never apply. Not run, #287.
- `mode: extension` and `mode: endsAfter` (**Attribute**, Saber 2026-10-21): a mode the user may extend by paying,
  repeatedly, and one that ends after a count of events. Saitou Hajime's Chikai no Haori lasts 2◈, or until seven
  successful Attacks, and extends 1◈ for 100 Health. Shinpachi's counts five Crits. Medusa Chrysaor extends
  Athena Mode for 100 Health and 30 of her Master's. Bounded Fields already extend by payment
  (`rules/bounded-fields.mjs#extensionFor`); modes do not, and nothing ends a mode on a count. Not run, #288.

- `useFailChance` (**Attribute**, Caster 2026-10-21): a use that may fail when pressed. Charlotte (Summer)'s
  Illusionist fails 30% of the time and then cannot be used again that Turn. Merlin bites his tongue 10% of the time
  (20% below half Health), cancelling the Spell or NP. Neither enters Cooldown. Sei Shōnagon (both sheets) may perform a random
  other Action on a 1 in 10. Okita's Weak Constitution cancels any Action and stays Own. Not run, #300.

**Kin:** Saber: every `{R}` `{M}` `{S}` attack head, 58 sheets. Mode extension: K213, R66, 3 sheets.
