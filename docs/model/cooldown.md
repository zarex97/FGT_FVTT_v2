---
shape: Cooldown
parent: Ability
code: module/engine/cooldown.mjs
---
**What it is:** how long an Ability waits before its next use.

**Fields:**
- `max`: a tick expression, `4◈-⅓◈`. Known.
  keys: `field.cooldown.max`
- `countFrom`: the use, or the end of a mode or field. Known.
  keys: `field.cooldown.countFrom`
- `branches`: one length chosen by a predicate on the user. Known: Summoning: Bašmu, and Charlemagne's
  *"3◈-⅓◈ Turns if he had Invuln"*.
  keys: `field.cooldown.branches`
- `conditionalBonus`: a length added by a predicate on the user. Known: Raikou's Dohatsu Tenshou, and Suzuka
  Gozen's doubled Kenmyouren.
  keys: `field.cooldown.conditionalBonus`
- `byOutcome` (**Attribute**, Saber 2026-10-21): a length that reads what the use did. Sétanta adds ⅓◈ *"for each
  effect activated/applied by this Skill"*. The Trung Sisters' Punji Trap adds ½◈ *"for every debuff inflicted"*.
  Kurohime's NP costs 3◈ when its Normal Attack misses. Arthur's Excalibur Proto adds ½◈ per criteria met. Both
  Gilles (Caster)'s Summoning: Horrors waits ⅔◈ per Horror summoned. Eli Brave's Mana Burst waits 3◈ or 4◈ by
  her die. Nero's Goblet of Wealth waits 3◈ when its effect failed. **Run since #320**: the clock settles from the
  Use record once the use is over. `branches` and `conditionalBonus` see its `use:` options (`use:missed`,
  `use:evaded`, `use:applied:<effect>`, `use:die:<face>`), and `countBonus` reads its facts as a Count
  (`{of: use, fact: debuffsInflicted}`).
  keys: `field.cooldown.countBonus`, `field.cooldown.branches`, `field.cooldown.conditionalBonus`

- `byOutcome`, more from Caster: Medea Lily's Dragon Tooth Warriors and Nitocris's Mummies wait per summon, Nursery
  Rhyme's Trump Soldiers ⅓◈ each, Tamamo Goth's NP 4◈ when it was Evaded, Sieg's Shapeshifter 3◈ plus the Turns he
  was transformed. Per summon runs (`perUnit`, now the record's `summoned`), and Evaded is `use:evaded`. Sieg's
  Turns transformed are not a fact of the use and stay open on #285.
  keys: `field.cooldown.perUnit`, `field.cooldown.conditionalBonus`; Turns transformed: none (#285)
- `reductionBonus` (**Attribute**, Caster 2026-10-21): every cut to a Unit's NP Cooldown cuts one Turn more.
  Merlin, Proto Merlin and Lady Avalon: *"Whenever … NP Cooldown is reduced, whether through natural reduction
  … or an effect, it is reduced by 1 extra Turn."* Barghest (UDK)'s Thundercloud Eater makes natural NP regen 2 Turns
  instead of 1 (Archer). **Run since #299**: `CooldownCutBonus {kinds, extra, on}`, `on: any` for Merlin and
  `on: natural` for Barghest, read at the applier's one cut door.
  keys: `element.CooldownCutBonus`

- `cutOverride` (**Attribute**, Saber 2026-10-26): a buff that lengthens one named cut while held. Siegfried's
  Rheingold makes a successful Golden Rule cut 1◈ *"instead of 1 Turn"*; Edmond Dantès's Monte prints the same at ⅓◈
  (Avenger). **Run since #341**: `CooldownCutOverride {slot, ticks}` on the buff, `overriddenBy` on the cut.
  keys: `element.CooldownCutOverride`

- `bypassForCost` (**Attribute**, Lancer 2026-10-21): a use allowed while on Cooldown, for a price. Arturia's and
  Lanceturia's Mana Burst *"Can be used while on Cooldown, but she has to be within her Master's ZON and her Master
  loses 20 Health; does not reset Cooldown"*. `cooldownWaiver` spends a resource to skip the cooldown; this pays
  the Master's Health and needs the ZON. **Run since #230** (corrected 2026-10-22: #306 claimed a gap the engine
  already fills; `rules/costs.mjs#canUseAbility` reads `cooldownOverride`, Arturia's Mana Burst authors it).
  Lanceturia's copy is content for her own build.
  keys: `field.cooldownOverride`, `field.cooldownWaiver`

**Kin:** Saber: 6 groups on 6 sheets, plus the criteria Clauses in [predicate.md](predicate.md).
