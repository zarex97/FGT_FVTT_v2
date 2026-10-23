---
shape: Character
parent: none
code: module/data/actor/
---
**What it is:** a Unit a Character Sheet states: the Servant, and any summon, partner or form it brings.

**Fields:**
- `controller` (**Variant** `GM`, Caster 2026-10-21): a Unit the GM moves and attacks with, on the GM's Turn. Eli
  Brave's Green Slime is summoned as an enemy Unit the GM controls. Gilles (Caster) turned Gigantic Horror is *"no
  longer controlled by Gilles' Master"* and acts on the GM's Turn, always attacking the nearest Unit. Known for a
  form since #323: a `transform` phase's `form.controller: gm` puts the Unit on a side of its own
  (`rules/control.mjs#GM_SIDE`), hands its player's controls to the GM, acts in the GM's slot and must Attack the
  nearest Unit. A summoned enemy the GM controls (the Green Slime) is still not run, #293.
  keys: `phase.transform`

**Kin:** Saber: Eli Brave, 8 Clauses. Caster: R8, R125.
