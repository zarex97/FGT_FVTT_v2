---
shape: Item
parent: Character
code: module/rules/items.mjs, module/engine/items.mjs
---
**What it is:** an object a Unit carries or equips, with its own effects, uses and transfer rules.

**Fields:**
- equipped effects, holder variants, give and receive between allies (`transferItem`). Known.
- steal from an enemy (**Variant**, Rider 2026-10-21): take an Item from an enemy Unit against its will.
  Bartholomew's Plundering Gale lets Normal Attacks *"Steal a random Item from the enemy Unit"*, and names *"the
  actual Steal action"*. Columbus's Santa Maria steals up to three Items, by a STR-against-AGI table, and hands them
  to allies. Theseus's Martial Retribution *"counts as 'Stealing' the target Unit's 'Weapon'"*. Items move only
  between willing allies today. Not run, #307.
- `wear` (**Variant** `breaks with use`, Berserker 2026-10-21): use wears the Item down until it breaks and is gone.
  Beowulf's Naegling has a break chance from 10%, +5% per successful Attack, capped at 90%. Mandricardo's Wooden Sword
  has a durability count that a Normal Attack and an NP spend. Proto Cú's spear rolls to break after he attacks,
  Blocks or Evades. Mooncancer: Jinako's Giant Statue God breaks the same way when she takes damage, and it is a
  Skill, not an Item. Nothing counts an Item's use today. Not run, #309.
- `stowed` (**Variant**, Foreigner 2026-10-21): an Item kept but inert. Summer Ereshkigal's Spatial Storage and
  Pseudepigrapha Solomon's Imaginary Numbers Bag hold Items that *"cannot be Stolen, but have no effect and
  cannot be Equipped"*. Stow and retrieve are an Action the bearer or an adjacent ally takes on their Turn.
  Items are only held or equipped today. Not run, #311.

**Kin:** Rider: Bartholomew, Columbus, 8 Clauses; Saber: Theseus. Breaks with use: Beowulf (Berserker), Mandricardo
(Rider), Proto Cú (Lancer), 4 Clauses. Stowed: K6, 2 sheets.
