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
  Gilles (Caster)'s Summoning: Horrors waits ⅓◈ per Horror summoned. Eli Brave's Mana Burst waits 3◈ or 4◈ by
  her die. Nero's Goblet of Wealth waits 3◈ when its effect failed. `branches` and `conditionalBonus` test the
  user's options at cooldown time, never the use's outcome. Not run. #285.
  keys: none (#285)

- `byOutcome`, more from Caster: Medea Lily's Dragon Tooth Warriors and Nitocris's Mummies wait per summon, Nursery
  Rhyme's Trump Soldiers ⅓◈ each, Tamamo Goth's NP 4◈ when it was Evaded, Sieg's Shapeshifter 3◈ plus the Turns he
  was transformed. #285.
  keys: none (#285)
- `reductionBonus` (**Attribute**, Caster 2026-10-21): every cut to a Unit's NP Cooldown cuts one Turn more.
  Merlin, Proto Merlin and Lady Avalon: *"Whenever … NP Cooldown is reduced, whether through natural reduction
  … or an effect, it is reduced by 1 extra Turn."* Barghest (UDK)'s Thundercloud Eater makes natural NP regen 2 Turns
  instead of 1 (Archer). Not run, #299.
  keys: none (#299)

- `bypassForCost` (**Attribute**, Lancer 2026-10-21): a use allowed while on Cooldown, for a price. Arturia's and
  Lanceturia's Mana Burst *"Can be used while on Cooldown, but she has to be within her Master's ZON and her Master
  loses 20 Health; does not reset Cooldown"*. `cooldownWaiver` spends a resource to skip the cooldown; this pays
  the Master's Health and needs the ZON. Not run, #306.
  keys: none (#306); the resource form is `field.cooldownWaiver`

**Kin:** Saber: 6 groups on 6 sheets, plus the criteria Clauses in [predicate.md](predicate.md).
