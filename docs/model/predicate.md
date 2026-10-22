---
shape: Predicate
parent: none
code: module/rules/predicate.mjs, module/rules/options.mjs
---
**What it is:** a condition an Element, a Phase or a Cooldown branch is gated on, tested against a Unit's options.

**Fields:**
- `all` `any` `not` and option strings such as `target:attribute:dragon`. Known.
  keys: `requirement.predicate`, `option.target:attribute`
- `countOf` (**Attribute**, Saber 2026-10-21): how many of a listed set of conditions hold, read as a number by a
  magnitude, a cost or a cooldown. Excalibur Proto (Arthur, Saber), Rhongomyniad (Gray, Assassin) and
  Rhongomyniad (Lanceturia, Lancer) list five or more *criteria*, such as *"At least two DUs have the 'Evil'
  Alignment"*. Damage rises 0.5x, the Master's cost 10 and the cooldown ½◈ per criteria met. Nothing counts
  predicates today. Not run, #283.
  keys: none (#283)

  Diarmuid (Saber) counts the same way: *"if the enemy Unit has at least 3 Parameters of the same or higher Rank
  than himself"* picks his sword.
- `class` option (**Variant**, Saber 2026-10-21): a Unit's Class as an option, `target:class:caster`. Rules
  read it: *"All damage dealt to Caster-class Servants is reduced by 50%"*, *"Can only be used on Saber-class
  Servants"* (Musashi), *"damage taken from Standard Class Servants"* (Summer Passionlip), *"against
  Beast-class Servants"* (Arthur). `rules/options.mjs` emits `attribute`, `skill`, `order`, `morality` and more,
  but no Class. Alter Ego 2026-10-21 adds two forms. Draco reads a Class group, *"non-Standard Servant
  Classes"*. Kazuradrop reads the bearer's own Class, *"the same Servant Class as herself"*. Pretender 2026-10-21
  adds a Class chosen at use: Pretender (>X), on 6 sheets, has the bearer pick a standard Class. Run since #314 (`class`, `classGroup`, `target:class:same`); Pretender's choice waits on #315.
  keys: `option.self:class`, `option.target:class`, `option.target:classGroup`; Pretender's chosen Class: none (after #315)

- `warRegion` option (**Variant**, Caster 2026-10-21): the War's Region as an option. Anastasia's Kremlin lasts 3◈
  *"If the Grail War region is Russia"*. Marie's Crystal Palace grows in France, Tamamo's Amaterasu Area in Japan,
  Osakabehime's castle lasts longer in Japan. 14 sheets carry such text. `rules/options.mjs` emits a Unit's own
  Region; the War's is `war:region` since #314.
  keys: `option.war:region`

**Kin:** Saber: countOf on K135, K142, K143, K148, K172, K174, K187, K250, K182, R105, 4 sheets. `class` on K335,
R238, R436, R133, 5 sheets.
