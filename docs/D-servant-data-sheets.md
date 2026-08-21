# Appendix D — Servant Data Sheets

The **twenty-nine** reference Servants as system data. This is the acceptance content for
**SC-7**: if all of them are playable with full automation, the system is done.

The appendix is in two halves. **D.1–D.14** cover the original twelve (the acceptance set the
architecture was designed against). **D.15–D.33** cover the seventeen added in `0.2.0`, whose
bounded fields are specified in Chapter 43, whose terrain interactions are in Chapter 42, and
whose other novel mechanisms are in Chapter 44.

Each entry gives the statistical block, the ability inventory with its system mapping, and the
mechanisms it exercises. Full conversions for the six hardest of the original twelve are in
Chapters 31–36; this appendix is the consolidated reference.

**Mapping key:**
- **RE** — expressible with existing rule elements.
- **RE+** — needs a rule element added to the catalogue (named).
- **S** — needs a `Script`.

---

## D.1 Statistical summary — the original twelve

| Servant | Class | STR | END | AGI | MAG | LUC | HP | MOV | Range | BA(STR) | BA(MAG) | Sus. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Van Gogh | Foreigner¹ | E | B | C | A | D | 1250 | 5 | 3 | 50 | 200 | 2◈ |
| Mannanán mac Lir | Alter Ego | A | B | B | EX | D | 1250 | 6 | 1 | 150 | 250 | 2◈ |
| Kingprotea | Alter Ego | EX | EX | A | D | B | 2000 | 7 | 1 | 200 | 125 | 7◈ |
| Castor | Avenger | A | A++ | B | C | C | 1500 | 6 | 3 | 150 | 150 | 2◈ |
| Pollux | Avenger¹ | A | A++ | B | C | C | 1500 | 5 | 1 | 200 | 150 | 2◈ |
| Semiramis | Caster/Assassin | E | D | D | A | A | 750 | 4 | 2 or 3² | 45 | 200 | 2◈/4◈² |
| Scáthach | Lancer¹ | B | A | A | C | D | 1500 | 7 | 2 | 125 | 150 | 2◈ |
| Karna | Lancer | B | C | A | B | D | 1000 | 7 | 2 | 125 | 175 | 2◈ |
| Kiritsugu | Assassin¹ | D | C | A+ | B | EX (E)³ | 1000 | 7 | 3 | 65 | 175 | 8◈ |
| Francis Drake | Rider | D | C | B | E | EX | 1000 | 6 | 3 | 75 | 100 | 2◈ |
| Penthesilea | Berserker¹ | A+ | B+ | C | A | D | 1250 | 4 | 2 | 160 | 200 | 2◈ |
| Nemo | Rider¹ | C | B | C | A | A | 1250 | 6 | 3 | 100 | 200 | 2◈ |
| Heracles | Berserker¹ | A+ | A | A | B | A | 1500 | 6 | 1 | 160 | 175 | 2◈ |

¹ Class inferred from the ability set; not stated on the sheet.
² Depends on the `Double Summon: Caster` coin flip.
³ Base E, raised to EX by *Affection of the Holy Grail* unless under Skill Seal.

Thirteen rows for twelve Servants — the Dioscuri are two units.

### Attribute distribution

| Attribute | Bearers |
|---|---|
| `Female` | Van Gogh, Mannanán, Kingprotea, Pollux, Semiramis, Scáthach, Drake, Penthesilea |
| `Male` | Castor, Karna, Kiritsugu, Nemo, Heracles |
| `[Man]` | Van Gogh, Kiritsugu |
| `[Sky]` | Mannanán, Castor, Pollux, Karna, Nemo |
| `[Earth]` | Kingprotea, Semiramis, Penthesilea, Heracles |
| `[Star]` | Scáthach, Drake |
| `King` | Mannanán, Semiramis, Penthesilea |
| `Humanoid` | all thirteen |
| `Non-Hominidae` | Kingprotea |
| `Giant` (⟹ `Large`) | Kingprotea |
| `Mechanical` | Kingprotea |
| `Animalistic` | Kingprotea |
| `Living Human` | Mannanán (Pseudo-Servant) |
| `Threat to Humanity` | Van Gogh |
| `Child` | Van Gogh |
| `Anti-Hero` | Kiritsugu |
| `Divine` (via Divinity) | Van Gogh, Mannanán, Kingprotea, Castor, Pollux, Semiramis, Karna, Penthesilea, Nemo, Heracles |

**Ten of thirteen have Divinity.** So Karna's *Vasavi Shakti* (Anti-Divine, ×3 against Divinity
B+) and Scáthach's *God Slayer* (+30%/+100% against Divine) are extremely live against this
roster — which is presumably deliberate on the part of whoever assembled the set.

**Nobody has the `Dark` attribute**, so the day/night rule (Ch. 19 §19.2) is inert for the
acceptance set.

---

## D.2 Van Gogh

Full conversion: Ch. 35.

| Ability | Type | Mapping |
|---|---|---|
| Existence Outside The Domain (A) | Class, passive | **RE+** `SuppressForeign` — negates Mad Enhancement's modifiers on the opponent |
| Item Construction (B−) | Class, passive aura | RE (`ApplicationChance` + `Aura`, `highestOnly`) |
| Divinity (B+) | Passive | RE (`FlatDamage` 45) |
| Insanity (C) | Passive | RE (`DamageModifier` +6% incl. NP) |
| Sunflower's Curse (A) | Passive | **RE+** `Immunity` scoped to Command Spells; `DamageNegation` `floorAtOne` predicated on the Curse source |
| Imaginary Numbers Arts (B+) | Active | RE (Guts, 3× Curse self-application, scaled cooldown reduction) |
| Het Gele Huis (A+) | Active | RE (5×5 orthogonal-adjacent debuff, 2-panel ally buff) |
| Channel Marker Soul (EX) | Passive | RE (`OnEvent: curseStageChanged`) |
| Shadow of Longing… (EX) | Active | **RE+** `transferTo` + `stageMode: sum` on a removal phase |
| De Sterrennacht (EX, NP) | Non-damaging NP | **RE+** `@count(targets where …)` in the expression language |
| Het Gele Huis: The Yellow House (A+, NP) | Non-damaging NP | RE (mutual exclusion with the skill form) |

**Exercises:** self-harm as a resource, >100% application chance, stage stacking, mass transfer,
source-scoped damage floors, Command Spell immunity, target-set-dependent magnitudes, mirrored
skill/NP exclusion.
**Scripts: 0.**

---

## D.3 Mannanán mac Lir

Full conversion: Ch. 33.

| Ability | Type | Mapping |
|---|---|---|
| Alter Ego | Passive | RE (`DamageModifier` ±50% vs Outsiders, both directions) |
| Magic Resistance (B) | Class, passive | RE (Appendix B table) |
| Riding (A) — "Fragarach Enbarr" | Class | RE (3 passives + active MOV +5) |
| Divinity (B) | Passive | RE (`FlatDamage` 40) |
| God's Holder: Tradition Carrier (EX) | Passive | **RE+** `OptionalCost`, `DurationExtension` |
| Sealing Designation Enforcer (A) | Active | RE (Agility restore + 3 buffs incl. `Atk Up (Magus)`) |
| Sea God's Rune (EX) | Active | RE (NP cooldown −2◈ + 2 buffs) |
| Successor of the Red Branch (B) | Active | RE (self Evade/Debuff Immune + ally `S.Crit Up`) |
| Toole Fragarach | Attack Skill | RE (3-hit, `evadeFailCascades`, token cost) |
| Fragarach Enbarr (EX, NP) | Non-damaging NP | RE (applies the `Fragarach` status + self Decoy) |
| Fragarach (EX, NP) | Counter NP | **S** — "strongest NP" comparison |
| God's Holder: Possession | Active / on-defeat | **RE+** `RevivalSource` with `EnterMode`; `ReplaceAbility` |
| Hallowed Sea God's Sword | Attack Skill (Holder Mode) | RE (combined base attack, MR exemption) |

**Exercises:** token economies, counters triggered by debuffs, unblockable attacks, divergent NP
scoping, interrupting another unit's NP, mode-on-defeat, range-banded attacks, ability
replacement.
**Scripts: 1.**

---

## D.4 Kingprotea

Discussed: Ch. 36 §36.7.

| Ability | Type | Mapping |
|---|---|---|
| Alter Ego | Passive | RE |
| Mad Enhancement (A+) | Class, mode | RE (Appendix B; 55%/25% taken, 85% dealt) |
| Territory Creation (EX) | Class, passive | RE (6d20 / 3d10+30, `highestOnly`) |
| Independent Action (B) | Class, passive | RE (Sustainability 7◈, ZON +2, 3 contract rolls) |
| Goddess's Divine Core (A) | Passive, `countsAs: divinity` | RE (`FlatDamage` 100, debuff resist −30%) |
| Self-Suggestion (EX) | Passive + active | RE (nvDebuff resist −60%, cleanse + further −60%) |
| Huge Scale (B) | Passive + active | **RE+** `SizeStep` with `every: 3`; cascading knockback |
| Infantile Regression (C) | Active | **RE+** `ignoresRemovalProtection` on a self-targeted removal |
| Monstrous Strength (EX) | Active, `damageStepStart` | RE (`DamageModifier` +150%/+75% NP) |
| Giant Monster of the Great River (B) | Passive | RE (`NP DmUp (GAO)` stacks with per-turn decay) |
| Earth Mother's Wail | Attack Skill | RE (Range +2, BA(MAG)) |
| Airavata King Size (E, NP) | Damaging NP | RE (size-scaled NP DmUp, 3×3 orthogonal-adjacent, 2×) |

**Exercises:** growing multi-panel units, two independent stack economies, self-dispel through
one's own removal protection, size-scaled damage.
**Scripts: 0.**

**Note the NP rank:** `Airavata King Size` is **Rank E**, so its Master cost is only 10/20 —
the cheapest NP in the set, on the highest-END Servant. Deliberate.

---

## D.5 The Dioscuri (Castor and Pollux)

Full conversion: Ch. 34.

### Shared binding
`LinkedUnitGroup`: leash 2, linked death (ignoring revival), 0.5 budget weight, shared cooldowns
by ability name, `zonSatisfaction: any`.

### Castor

| Ability | Type | Mapping |
|---|---|---|
| Avenger (B) | Class, passive | RE (damage taken **+80** flat; counter damage +80) |
| Oblivion Correction (C) | Class, passive | RE (crit chance +15%) |
| Self-Replenishment (Mana) (D) | Class, passive | RE (+40 HP, NP cooldown −2 **turns**, per own/acted turn end) |
| Mad Enhancement (B−) | Class, mode | RE (35%/15% taken, 55% dealt; **halved Master drain when adjacent to Pollux**) |
| Twin God's Divine Core (B) | Passive, `countsAs: divinity` | RE (+80 flat; 5% NP cooldown chance on successful normal attacks) |
| Stars of the Chief God (A) | Active | RE (paired `Castor`/`Pollux` buffs on both twins) |
| Guardians of Navigation (B) | Active | RE (3 party buffs incl. 1-time Debuff Immune) |
| Mana Burst (Light/Ancient) (A+) | `whenAttacking` | **RE+** `kind: choice` phase |

### Pollux

| Ability | Type | Mapping |
|---|---|---|
| Magic Resistance (A) | Class, passive | RE — **and extends to Castor when adjacent** (`Aura` radius 1, partner only) |
| Riding (B) | Class | RE (MOV +4; passives unlocked on activation) |
| Twin God's Divine Core (B) | Passive | RE (+80 flat, crit +5%) |
| Stars of the Chief God (A) | Active | RE (shared cooldown with Castor's) |
| Guardians of Navigation (B) | Active | RE (shared cooldown) |
| Mana Burst (Light/Ancient) (A+) | `whenAttacking` | RE (BA 350 combined; applies Evade instead of Castor's cooldown reduction) |

### Joint

| Ability | Mapping |
|---|---|
| Dioscures Tyndaridae (B, NP) | **RE+** `modifierSources: [castor, pollux]`; base = half of each twin's BA(STR); requires adjacency; counts as **both** twins' attack |

**Exercises:** linked units, fractional budgets, shared cooldowns, cross-unit modifier
combination, partner-conditional auras, mid-ability choice.
**Scripts: 0.**

---

## D.6 Semiramis

Full conversion: Ch. 32.

| Ability | Type | Mapping |
|---|---|---|
| Double Summon: Caster (B) | Summon-time variant | **RE+** `summonVariants` |
| Presence Concealment (C+) | Class, mode | RE (35% discover, +3 evade) |
| Item Construction (C) | Class, active | RE (1d4 `[Semiramis' Poison]` items) |
| Territory Creation (EX) | Class, passive | **S** — `TerritoryCreationScope` (HGoB EX / home base C split) |
| Divinity (C) | Passive | RE (+30 flat) |
| Double Summon (B) | Active | RE (NP Regen, `Construction` status, conditional `DSC` buff) |
| Familiar: Doves (D) | Passive + active | **RE+** `unitFirstSeen` event, `RevealPosition` |
| Arrogant King's Poison (B+) | Active, item cost | RE (3×3 within range, Poison + Def Dwn (B)) |
| Scales of the Sacred Fish | Spell, `combatPhaseStart` | RE (Shield 200 on self or a nearby ally) |
| Summoning: Bašmu | Spell | **RE+** `kind: conditional` phase (damage spell vs summon) |
| Sikera Ušum (B+, NP) | Zone NP | **RE+** `ImmunityDowngrade`, `PeriodicOverride`, `VulnerabilityAmplifier` |
| Hanging Gardens of Babylon (EX, NP) | Channelled platform NP | **RE+** channelled activation; platform model; compound anchor |

**Exercises:** conditional class skills, multi-source counters, channelled abilities, 9×9
platforms with sub-zones, bound summons, transferable items, zones that rewrite the effect
system.
**Scripts: 1.**

---

## D.7 Scáthach

Discussed: Ch. 36 §36.4.

| Ability | Type | Mapping |
|---|---|---|
| Magic Resistance (A) | Class, passive | RE |
| Primordial Rune (−) | Active, unranked | **RE+** `kind: roll` phase with a table, `duplicateBehaviour: applyTwice` |
| Primordial Rune Spells | Passive | RE (PRS token spend skips cooldown; mutual exclusion of the three spells) |
| Ár | PRS spell | RE (ally Agility +4, `Atk Up` 50%/30%) |
| Þurs | PRS damage spell | RE (2×, Shock 2◈, Lightning) |
| Úr | PRS damage spell | RE (2×, Slow 1◈, Water) |
| Wisdom of Dún Scáith (A+) | Copy mechanism | **S/RE+** — `copyable` flags on all content; a GM setup dialog |
| — (Skill 1) / (Skill 2) | Granted, copied | RE (`GrantedAbility` with `copiedFrom`) |
| — (Clairvoyance) | Active | RE (80%-chance Crit DmUp/Crit Up, Dodge) |
| God Slayer (EX) | Passive + active | RE (+30% vs Undead/Divine; `Dmg Up (Gods)` +70%; `Alpi` 3-use NP cooldown buff) |
| Gáe Bolg Alternative (B+, NP) | Damaging NP | RE (500% Stun, 75% Instakill, else 3.5× + 100) |
| Gate of Skye (A+, NP) | AoE NP | **RE+** rank-**equality** save modifiers; chosen-subset targeting; `alsoTriggers` |

**Exercises:** unranked abilities, random effect tables with a choice outcome, ability copying,
rank equality predicates, subset targeting, NPs that cost other abilities' cooldowns.
**Scripts: 0** (the copy setup is a dialog, not a script).

**Note:** *Gáe Bolg Alternative* inflicts Instakill with **BA(STR)**, so Magic Resistance does
**not** protect against it (Ch. 10 §10.6). *Gate of Skye* inflicts Death with **BA(MAG)**, so it
does. A deliberate and easily-missed asymmetry.

**AUTHORED.** `packs/_source/servants/scathach.yml` plus eleven abilities and fifteen effects; all
eleven verified individually in a live world. The mapping above survived contact almost intact,
with three corrections worth recording:

- *"PRS token spend skips cooldown"* is `cooldownWaiver` on **each Spell**, not a rule on the
  passive. A gate has to be read by the ability it gates, and the passive is the sheet entry a
  player reads rather than the mechanism.
- *"Mutual exclusion of the three spells"* likewise: an `abilityOffCooldown` requirement with
  `excludeSelf`, on each Spell. Without `excludeSelf` a Spell gates on its own cooldown, which
  `canUseAbility` already checks — so the rule would say nothing.
- `alsoTriggers` on *Gate of Skye* names *"Wisdom of Dún Scáith"*, and that is **not** an ability
  with a clock. It is the grant — the button that opens the curation dialog. The clause means her
  three Wisdom **slots**, so the entry names their `exclusionSet`. Naming the grant put nothing on
  cooldown at all.

`duplicateBehaviour: applyTwice` turned out not to be needed as a field: resolving the dice **per
die** rather than as a set makes *"apply the effect twice"* the ordinary reading, and it is
collapsing them that would take extra code.

---

## D.8 Karna

Discussed: Ch. 36 §36.1.

| Ability | Type | Mapping |
|---|---|---|
| Fated Rivals of the Mahabharata | Passive | RE (`ForceTarget` on a named unit; CS-negatable) |
| Magic Resistance (C) | Class, passive | RE |
| Riding (A) | Class | RE (MOV +5, 3 passives) |
| Divinity (A) | Passive | RE (+50 flat) |
| Discernment of the Poor (A) | Active | RE (NP Seal + Debuff ResDwn 50%) |
| Uncrowned Arms Mastership (−) | Passive toggle | RE (crit +20% **or** crit damage +40%; switchable once per Round) |
| End of Charity (−) | Active | RE (`Charity` buff enabling **both** UAM effects; ally `S.Crit Up`; a choice of NP cooldown reduction) |
| Mana Burst (Flames) (A) | Passive + `whenAttacking` | RE (25% Burn on normals; Burn immunity; Fire damage taken −50%; combined BA; MR exemption) |
| Flash of the Sun God (EX) | Active | RE (Agility +3, Atk Up, NP DmUp) |
| Brahmastra (A+, NP) | Damaging NP | RE (the five-parameter comparison predicate; Aim) |
| Kavacha and Kundala (A, NP) | **Passive NP** | RE (−90% damage taken; Master upkeep with floor 1; lost on Vasavi activation) |
| Vasavi Shakti (EX, NP) | Multi-mode NP | **RE+** `modes` on an ability; permanent activation status |
| Brahmastra Kundala (A+, NP) | AoE NP | RE (7×7 within Range 5; combined BA; `alsoTriggers` Mana Burst's cooldown) |

**Exercises:** four Noble Phantasms on one Servant, passive NPs, permanent one-way activation,
toggleable passives, cost superseding, the most complex predicate in the set.
**Scripts: 0.**

**Note:** Karna has the most abilities of any reference Servant (13) and the most Noble
Phantasms (4). He is the practical benchmark for SC-6's "author a Servant in under an hour".

---

## D.9 Kiritsugu

Discussed: Ch. 36 §36.2.

| Ability | Type | Mapping |
|---|---|---|
| Presence Concealment (A+) | Class, mode | RE (5% discover, +4 evade, 2◈ cooldown) |
| Independent Action (A) | Class, passive | RE (Sustainability 8◈, ZON +3, 4 contract rolls) |
| Magecraft (B) | Passive | RE (one Thaumaturgy per turn; extends `Suppression` by 1◈ per use) |
| Thaumaturgy: Reinforcement | Spell, `combatPhaseStart` | RE (Normal Attack damage +40% for the phase) |
| Thaumaturgy: Penetration | Spell | RE (`Ignore Def` + halved Invuln for ⅓◈) |
| Thaumaturgy: Familiars | Spell | RE (Range +2; crit +30% at Range ≥3) |
| Affection of the Holy Grail (A+) | Passive + active | **RE+** conditional `RankShift` with a Skill-Seal fallback; a Luck-Check-worsening aura excluding self |
| Scapegoat (C) | Active, also `whenAllyAttacked` | RE (`Decoy (Scapegoat)` on an ally; ally `S.Crit Up`) |
| Lethal Gunfire Suppression (B+) | Passive + active | **RE+** `OfferAbilityUse` inside a trigger; out-of-turn attack |
| Chronos Rose (B+, NP) | Damaging NP | RE (3.5× + 100, Ignore Def, Crit Dwn, **+1◈ to the DU's NP cooldown**) |
| Phantasm Punishment (C+, NP) | Damaging NP | RE (3× + 100, 35% Instakill, the unremovable resistance-ignoring `Kiritsugu` debuff) |

**Exercises:** out-of-turn triggered attacks, nested optional ability use, buff stripping with
conditional rewards, conditional rank overrides with fallbacks, debuff-shaped auras, an NP that
increases an enemy's NP cooldown.
**Scripts: 0.**

**Note:** `Range: 3` with `BA(STR) 65` and `BA(MAG) 175` — but his NPs both use **BA(STR)**.
So his Noble Phantasms are far weaker in raw numbers than his normal attacks, and his value is
control and support. An unusual profile that the damage pipeline handles without comment.

---

## D.10 Francis Drake

Discussed: Ch. 36 §36.3.

| Ability | Type | Mapping |
|---|---|---|
| Magic Resistance (D) | Class, passive | RE |
| Riding (B) | Class | RE (MOV +4) |
| Voyager of the Storm (A+) | Passive + active | RE (conditional anchor: 2-panel radius **or** the whole ship) |
| Pioneer of the Stars (EX) | Active | RE (NP cooldown −1◈+⅔◈, Pierce, ally `S.Crit Up`) |
| Blazing Golden Rule (A) | Passive + active | RE (NP cooldown −1 per crit; NP Regen, Atk Up, Ignore Def) |
| Golden Hind: Wild Hunt (A+, NP) | Platform NP | RE (platform model; per-round Master upkeep superseding the NP cost) |
| Golden Wild Hunt (A+, NP) | Damaging NP | **RE+** `@elapsedSince(abilityId)`; conditional anchor with a no-platform fallback |

**Exercises:** platforms with capacity and upkeep, damage modified by another ability's elapsed
cooldown, conditional anchors, `Luck: shared` between a unit and its platform.
**Scripts: 0.**

**Note:** `LUC: EX` with `MAG: E`. She is the luckiest Servant in the set by a wide margin,
which makes every Luck Check contest lopsided in her favour — and the reaction ladder
(Ch. 12 §12.3) is where that matters. Whoever plays Drake should contest everything.

---

## D.11 Penthesilea

Discussed: Ch. 36 §36.5.

| Ability | Type | Mapping |
|---|---|---|
| Hatred of Achilles | Passive | **RE+** `ForceAction` with `overridesPlayerControl`; forced mode activation by a positional predicate |
| Mad Enhancement (EX) | Class, mode | RE (75%/30% taken, 100% dealt; drain floor 30) |
| Divinity (B) | Passive | RE (+40 flat; raised to A by her NP) |
| Charisma (B) | Passive + active | RE (+20 flat for **other** allies; `Atk Up (Charisma)`; negated under ME) |
| Golden Rule (Beauty) (A) | Active | RE (Debuff Immune + NP Regen) |
| Howl of the War God (A+) | Active | RE (ally `Atk Up (STR)`; self `Atk Up (GreekMale)` +100%) |
| Goddess of War (A, NP) | **Passive NP**, ME-gated | RE (1d4-scaled damage bonus and reduction; evade −1d4; Divinity B → A) |
| Outrage Amazon (B, NP) | Damaging NP, ME-required | RE (3.5×, Def Down 30%) |

**Exercises:** compulsions that override player control entirely, forced mode activation,
passive NPs gated on a mode being *off*, dice-scaled passive modifiers, mutually exclusive NPs
(one requires ME on, the other requires it off).
**Scripts: 0.**

**Note the design tension:** her two Noble Phantasms are mutually exclusive by Mad Enhancement
state, and `Hatred of Achilles` forces ME on whenever a Greek male is within 4 panels. Castor,
Pollux (female), and Heracles are Greek; Castor and Heracles are male. So against this roster her
`Goddess of War` is frequently disabled. The UI must make the current state and its cause
extremely visible.

---

## D.12 Nemo

Discussed: Ch. 36 §36.6.

| Ability | Type | Mapping |
|---|---|---|
| (normal attack) | — | RE (BA(MAG), Water damage, 10% Slow) |
| Riding (A+) — "Storm Border" | Class | RE (MOV +5, 3 passives) |
| Divinity (A) | Passive | RE (+50 flat) |
| Poseidon's Protection (B) | Passive | RE (MAG crit damage +10%; −50/−100 damage in Waterside or Imaginary Numbers) |
| Voyager of the Storm (C++) | Active | RE (conditional anchor; terrain-conditional extra buff; **conditional cooldown**) |
| Indomitable (B+) | Active | RE (NP cooldown −1◈; Guts 20%; `Indomited` cooldown reward on revival) |
| Journey's Guidance (C++) | Active | RE (terrain-conditional double application) |
| Storm Border: Zero Sail | Active, platform | **RE+** `relocateOnExit`; entry rolls; ability restrictions inside |
| Quickfire | Attack Skill | **RE+** `kind: diceCount` formula; two-sided `bypassModifiers`; per-ability Evade override |
| Triton's Conch | Attack Skill | **RE+** `kind: banded` shape with per-band effect chances |
| Barrel Bombing | Attack Skill | RE (3×3 orthogonal-adjacent, 150 Fire, Burn 2◈, attacker-side modifier bypass) |
| Great Ram Nautilus (A, NP) | Damaging NP | RE (terrain-conditional self-buffs; +150% vs `Large`) |

**Exercises:** terrain tags, conditional cooldowns, dice-counting damage, banded AoE, pocket
dimensions, ability restrictions on occupants.
**Scripts: 0.**

**Note:** *Voyager of the Storm*'s cooldown is `2◈−⅔◈` normally and `3◈−⅔◈` if the terrain
clause fires — a **cooldown that depends on which branch of the ability executed**. The ability
model handles it because cooldown is set in a phase, not declared statically.

---

## D.13 Heracles

Full conversion: Ch. 31.

| Ability | Type | Mapping |
|---|---|---|
| Mad Enhancement (B) | Class, **permanent** mode | RE (40%/20% taken, 60% dealt; drain floor 20; `cannotDeactivate`) |
| Divinity (A) | Passive | RE (+50 flat) |
| Battle Continuation (A) | Class, passive | RE (2d10+20 reduction, **doubled dice** vs NP; 5d20 revival) |
| Indomitable (A) | Active | RE (`Undying` 25% Guts; `Indomitable` on-revival Atk Up) |
| Bravery (A+) | Passive + active | RE (`blockedWhen`/`suppressedWhen` on his own Mad Enhancement) |
| Eye of the Mind (False) (B) | Passive + `whenAttacked` | RE (self-reducing cooldown on successful evade; Dodge ⅔◈; Crit DmUp) |
| God Hand (B, NP) | **Passive NP** | **RE+** `RevivalSource` with cascading overkill; `RecordAttackIdentity`; `floorAtOne` |
| Nine Lives (A+, NP) | Damaging NP | RE (4× + 100, Def Dwn 30%) |

**Exercises:** four revival mechanisms with an explicit priority chain, cascading overkill
absorption, attack-identity recording, permanent non-toggleable modes, abilities disabled by
their owner's own other ability.
**Scripts: 0.**

---

## D.14 Aggregate — the original twelve

| Metric | Value |
|---|---|
| Servants | 12 (13 units) |
| Total abilities | ~72 |
| Noble Phantasms | 21 |
| Passive Noble Phantasms | 3 (Kavacha and Kundala, Goddess of War, God Hand) |
| Class skills instantiated | 26 |
| Distinct targeting declarations | 24 |
| Distinct effects referenced | ~55 of the 126 catalogued |
| Rule elements needed | ~30 base + ~28 added by these conversions |
| **Script elements** | **2** (Mannanán's Fragarach, Semiramis's Territory Creation scope) |

**~3% of abilities need a script**, against a 15% target (Ch. 24 §24.3). The 28 rule elements
added during conversion are all general-purpose and available to future content — which is the
point of doing the conversions before building the engine rather than after.

### The mechanisms the twelve do *not* exercise

Worth recording, because they are the gaps a thirteenth Servant might expose. **Struck entries
were closed by the expanded roster** — see §D.33.

- ~~No Servant has the `Dark` attribute (day/night is untested by content).~~
- ~~No Servant uses `Charm`, `Petrify`, `Drowning`.~~ No Servant uses `Confuse`, `Webbed`,
  `Pigify`, `Toad`, `Crystalfreeze`, or `Seared`.
- No Servant uses `STR Reflect`, `MAG Reflect`, `Anti-Purge`, or `Substitution`.
- No Servant uses `DblAtk Up` or `TrplAtk Up`.
- No Servant uses `Delay`.
- No Magic Crests appear at all (they are a Master ability and no Master sheets were supplied).
- No `ring` targeting shape is used.
- No even-dimensioned self-centred shape appears (Ch. 41 Q27).

These are implemented from the rules text and covered by unit tests, but they have no content
validating them end to end. Adding seventeen Servants closed four of the eight lines — which is
roughly the rate a reasonable person would predict, and the argument for keeping the list.

---

## D.15 Statistical summary — the expanded roster

Seventeen Servants added in `0.2.0`.

| Servant | Class | STR | END | AGI | MAG | LUC | HP | MOV | Range | BA(STR) | BA(MAG) | Sus. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Nursery Rhyme | Caster¹ | E | E | C | A | B | 500 | 4 | 2 | 50 | 200 | 4◈ |
| Hassan of Serenity | Assassin¹ | D | D | A+ | C | A | 750 | 7 | 3 | 65 | 100 | 8◈ |
| Jack the Ripper | Assassin¹ | C | C | A | C | E | 1000 | 7 | 2 | 85 | 150 | 2◈² |
| Yan Qing | Assassin¹ | B | D | A+ | D | B | 750 | 7 | 1 | 105 | 125 | 2◈ |
| Katō Danzō | Assassin¹ | D | D | A | C | B | 750 | 7 | 3 | 65 | 150 | 2◈ |
| Hundred-Faced Hassan | Assassin¹ | C | D | A | C | E | 750 | 7 | 3 | 85 | 150 | 2◈ |
| Medea | Caster | E | D | C | A+ | B | 750 | 4 | 3 | 50 | 210 | 4◈ |
| Achilles | Rider | B+ | A | A+ | C | D | 1500 | 7 / 8³ | 2 | 135 | 150 | 2◈ |
| Ozymandias | Rider | C | C | B | A | A+ | 1000 | 6 | 3 | 100 | 200 | 2◈ |
| Medusa | Rider | B | D | A | B | E | 750 | 7 | 2 | 125 | 175 | 6◈² |
| Pale Rider | Rider | E | A | B | A | C | **—**⁴ | 6 | **—**⁵ | 50 | 200 | 2◈ |
| Anastasia & Viy | —⁶ | D++ | E | B | C | C | 500 | 6 | 3 | 95 | 150 | **N/A**⁷ |
| Quetzalcoatl | Rider | B | B | B+ | EX | A+ | 1250 | 7 | 2 | 125 | 250 | 2◈ |
| EMIYA | Archer¹ | D | C | C | B | E | 1000 | 4 | 4 | 75 | 175 | 7◈ |
| Proto Gil | Archer¹ | C | C | B | A | A | 1000 | 6 (5)⁸ | 5 | 100 | 200 | **N/A**⁷ |
| Asterios | Berserker | A++ | A++ | C | D | E | 1500 | 4 | 2 | 170 | 125 | 2◈ |
| Raikou | Berserker | A | B | D | A | C | 1250 | 4 | 4 | 150 | 200 | 2◈ |

¹ Class inferred from the class-skill set; not stated on the sheet.
² Grows with kills: Jack `+1◈` per Human killed as a Free Servant; Medusa `+1◈` per Civilian.
³ 7 Dismounted, 8 Mounted.
⁴ `health: null` — cannot be damaged or healed (Ch. 44 §44.1).
⁵ No Range because it cannot perform Normal Attacks; its reach is the Contagion aura.
⁶ Independent Action is her only class skill, and Independent Action does not identify a class.
⁷ Independent Action A+/EX: *"Sustainability does not apply."*
⁸ Base 5, raised to 6 by `Levitation` — which is negated by `NP Seal`.

### What the second roster changes about the distribution

**The stat spread widened at both ends.** Asterios is the first `A++` in *two* parameters at
once; Quetzalcoatl is the first `MAG: EX` outside Mannanán; Medusa's `Divinity E−` is the first
**sub-E rank in the corpus**, which exercises the rank grammar's negative steps below the floor
(Ch. 05 §5.3) for the first time in content rather than in tests. Anastasia's `STR: D++` is the
first double-plus on a *low* rank.

**Two Servants have no Sustainability at all.** Both by Independent Action at A+ or EX, which
also grants absolute contract immunity. That combination — no upkeep clock, cannot be stolen —
is strictly stronger than the original roster's best (Kiritsugu's 8◈), and it makes the
Sustainability subsystem optional content rather than universal content. The scheduler already
tolerates `sustainability: null`; the UI did not, and now must.

**Alignment gained a value the rulebook does not list.** Anastasia is *"Chaotic Summer"*.
`Alignment.moral` is therefore an open string with a suggested enumeration, not a closed enum —
a one-line schema change that would have been an expensive one to discover after content
authoring began.

### Attribute distribution — the expanded roster

| Attribute | Bearers |
|---|---|
| `Female` | Nursery, Serenity, Jack, Danzō, Medea, Medusa, Anastasia, Quetzalcoatl, Raikou |
| `Male` | Yan Qing, Achilles, Ozymandias, EMIYA, Proto Gil, Asterios |
| `Male/Female` | Hundred-Faced Hassan (the pool contains both) |
| *(no gender)* | Pale Rider |
| `[Man]` | Nursery, Serenity, Jack, Yan Qing, Danzō, H-F Hassan, Anastasia, EMIYA |
| `[Earth]` | Medea, Achilles, Medusa, Asterios |
| `[Sky]` | Ozymandias, Quetzalcoatl, Proto Gil, Raikou |
| `[-]` | Pale Rider — an explicit **null** axis, not an absent one |
| `King` | Ozymandias, Quetzalcoatl, Proto Gil |
| `Humanoid` | all but Pale Rider |
| `Non-Hominidae` | Nursery, Medusa |
| `Giant` (⟹ `Large`) | Asterios |
| `Mechanical` | Danzō |
| `Animalistic` | Asterios |
| `Child` | Nursery |
| `Anti-Hero` | Serenity, Jack, H-F Hassan, Medea, Medusa, EMIYA, Asterios |
| `Divine` (via Divinity) | Achilles (C), Ozymandias (B), Medusa (E−), Proto Gil (B), Raikou (C), Quetzalcoatl (Divine Core EX) |

**New attribute values introduced:** `Fairytale` (Nursery), `Wraith` (Jack), `Liangshan`
(Yan Qing), `Gorgon` (Medusa), `Demonic Beast` (Asterios), and — on summons rather than on
Servants — `Spirit`, `Dark`, `Beast`, `Demonic`, `Levitating`. All are plain tag values; none
required a schema change, which is the payoff of having modelled attributes as an open tag set
in Chapter 04 rather than as an enum.

**Only six of seventeen have Divinity**, against ten of thirteen in the original roster. That is
not a curiosity — it is the single most consequential fact about this roster, because
**Achilles' `Andreias Amarantos` reduces damage from a non-Divine attacker to zero.** Eleven of
the seventeen simply cannot hurt him until his Heel is struck. `Divinity` has gone from a damage
bonus to a targeting prerequisite, and any AI or UI hinting must surface it.

**`Dark` is now live.** Pale Rider's Kagome Spirits carry it and Ozymandias's `Mesektet` doubles
damage against it, so the day/night rule and the `Dark` predicate finally have content
validating them end to end — the first gap on the D.14 list to close.

---

## D.16 Nursery Rhyme

Bounded field: none. Time mechanics: Ch. 43 §43.11 (state history).

| Ability | Type | Mapping |
|---|---|---|
| Territory Creation (A) | Class, passive | RE (5d20 in Home Base; 3d10+20 ally reduction, `highestOnly`) |
| Self-Modification (A) | Passive + active | RE (crit damage +40%; `Crit Up` 60%) |
| Shapeshift (A+) | Passive | RE (damage taken −30%, −15% NP) |
| Tommy Thumb's Secret Picture Book (A+) | Active | RE (six clauses, two of them **attribute-scoped party buffs** — `Child` and `Fairytale`) |
| Meanwhile… (A) | Active | RE (NP cooldown, heal 15%, self-cleanse) |
| Plains of Winter | Damage Spell | RE (Ice, 50% `Disable`) |
| Frenzied March Hare | Damage Spell | RE (Wind, 50% `Sap`) |
| White Queen's Enigma | Spell | **RE+** `Enigma` — an on-attack rider **gated on which base attack the attack used** |
| Trump Soldiers (C, NP) | Summon NP | RE (`1d8+4` summons; free-action units; adjacency protection for Nursery and her Master) |
| Nameless Forest (C, NP) | **Passive** field NP | **RE+** `Nameless Forest Token`: a counter that degrades Max Health, both Base Attacks and Max Luck; a per-turn escape Luck Check modified by MAG rank *and* Home Base; a `1d12` disappearance check at ≥3 tokens; and an **escalating immunity** (−10% acquisition chance per successful removal) |
| A Tale for Somebody's Sake (C, NP) | Damaging NP | RE (3×3 within Range 4, `Def Dwn`, enemy NP cooldown +1◈) |
| Jabberwock (C, NP) | Summon NP | **RE+** a summon with its own ability, self-extending existence, heal-on-damage-**from-Servants**, and a push-move; plus the `[Vorpal Blade]` counter-item |
| The Queen's Glass Game (C, NP) | Passive NP | **S** `nurseryRhyme.rewind` |

**Exercises:** attribute-scoped party targeting, per-component attack riders, counters that
degrade *maximum* values irreversibly, escalating resistance to reapplication, a summon that
spawns a counter-item, and state rollback across a unit set.
**Scripts: 1.**

**Note.** `Nameless Forest` is the only effect in the corpus that reduces a Max value and
explicitly states the lost current value is *not* restored on removal. `Max HpDwn` (Appendix A
§A.9) already says this; Nursery is the content that proves the rule matters.

---

## D.17 Hassan of Serenity

| Ability | Type | Mapping |
|---|---|---|
| Presence Concealment (A+) | Class, mode | RE (5% discover, +4 evade) |
| Independent Action (A) | Class, passive | RE (Sustainability 8◈, ZON +3, 4 contract rolls) |
| Shapeshift (Infiltration Spec.) (C) | Active | **RE+** `usableWhileConcealed` with a per-ability **deactivation chance** (20%) |
| Projectile (Poisoned Daggers) (C++) | Passive | RE (crit +15%; Poison on Normal Attacks; 25% `Deadly Poison`) |
| Silent Dance (B) | Passive | RE (debuff chance +10%; **Instakill and Death** chance +10%) |
| Danse Macabre (A) | Active | RE + the `Macabre` buff (crits inflict an extra Poison **stage**) |
| Zabaniya: Delusional Poison Body (C+, NP) | Passive + active | **RE+** `Secret Poison` — `deferredUntil` visibility (Ch. 44 §44.4) |

**Exercises:** abilities usable from concealment at a probabilistic cost, buffs that modify a
*stage* rather than a magnitude, deferred-disclosure effects, and terminal-debuff chance boosts
outside the Item Construction ladder.
**Scripts: 0.**

**Note.** `BA(MAG) 100` against `BA(STR) 65` — but her NP uses BA(MAG) and is explicitly *"not
affected by Magic Resistance"*. Serenity is the cleanest example in the corpus of the
MR-exemption flag doing real work: without it her only damaging NP is negated outright by any
Magic Resistance of Rank C or better.

---

## D.18 Jack the Ripper

Bounded field: **The Mist** (Ch. 43). Terrain interaction: Ch. 42.

| Ability | Type | Mapping |
|---|---|---|
| Presence Concealment (A+) | Class, mode | RE |
| Murderer of the Misty Night (A) | Passive + active | **RE+** `attackFirst` on being attacked, gated on a **phase-conditional** Luck Check (required by day, free by night); active magnitudes, duration *and* cooldown all vary by whether she is inside her own field |
| Mental Pollution (C) | Passive | RE (inflict +15%; Mental resist +60%) |
| Information Erasure (B) | Passive + active | Passive **deferred** to closed-info mode (Ch. 44 §44.4); active is RE |
| Surgical Procedure (E) | Active | RE (5% heal, +1 Agility, self or adjacent ally) |
| The Mist (C, NP) `[Barrier]` | Bounded field | **RE+** free-form footprint ≤25 panels within 4 of Jack, reshapeable once per acted turn, with a **skill-based exemption list** (`Instinct` B+ and five named equivalents) |
| Maria the Ripper (D~B+, NP) | Damaging NP, two modes | RE (`modes` with a three-clause gate; range-banded outcome — damage at 1–2, Instakill-only at 3–4) |

**Exercises:** free-form field footprints, reaction pre-emption, day/night as a *cost* modifier,
skill-name-keyed immunity lists, mode gates compounding three unrelated conditions, and
Sustainability that **grows** rather than only draining.
**Scripts: 0.**

**Note.** The `Instinct` exemption is the first place a rule refers to abilities by a
*category* that is asserted at the bottom of a character sheet rather than declared on the
abilities themselves. We model it as a tag (`categorizedAs: [instinct]`) on the five named
skills, which puts the list in the content pack where it can be extended without a code change.

---

## D.19 Yan Qing

| Ability | Type | Mapping |
|---|---|---|
| Presence Concealment (C) | Class, mode | RE (40% discover — the worst in the corpus) |
| Zhōng Guó Quán Fǎ (EX) | Passive | RE — but note the **◈-dependent magnitude**: NP cooldown −1 turn, or −2 **if ◈ > 4** |
| Yan Qing Fist (EX) | Active | RE (`Dmg Up (Lawful)` **flat 30**, `Dmg Up (Evil)` **30%** — alignment-predicated, and the two clauses are deliberately different kinds) |
| Ruffian (A) | Passive | **RE+** `OptionalCost` paying **Agility** for damage (+5% per point, cap 5, excluded from NP) |
| Espionage (A) | Active | **RE+** `RankShift` applied to **his own Presence Concealment** (C → A) |
| Doppelganger (B+) | Active | **RE+** `Disguise` (Ch. 44 §44.4), with a stated no-Fog-of-War fallback |
| Skillful Star (A+) | Active | RE (self `Crit Dwn` paid for an ally `S.Crit Up`) |
| Shí Miàn Mái Fú (EX, NP) | Damaging NP | RE (`kind: roll`, `2d4`, `duplicateBehaviour: reroll`, "a 4 applies all three") |

**Exercises:** the first magnitude that reads the ◈ operator directly, Agility as a spendable
combat resource, rank shifts targeting a class skill, cosmetic identity swaps, and the third
`duplicateBehaviour` variant.
**Scripts: 0.**

**Note.** `Espionage` and `Doppelganger` are mutually exclusive by an explicit note, and both
rewrite the same class skill. The mode system (Ch. 15 §15.6) handles this with a shared
exclusion group; without one, a player could stack a rank shift onto a disguise and become
untargetable *and* unidentifiable at once.

---

## D.20 Katō Danzō

| Ability | Type | Mapping |
|---|---|---|
| Presence Concealment (A) | Class, mode | RE |
| Synthetic Limbs (Doll) (A++) | Passive + active | RE (`Sap`/`Bleed` immunity — the `Mechanical` attribute already halves the chance; this makes it absolute) |
| Ninjutsu (A) / Karakuri Genpō (B+) | Grouping headers | No mechanics — modelled as ability **tags**, which is what the mutual-exclusion clauses key on |
| Ninjutsu: Tobikatō | Active | RE (`Dodge` ×3 + `Crit Up`; same-turn exclusion with two siblings) |
| Ninjutsu: Harisenbon | Active | RE (**fallback chain**: 50% `Disable`, else `Slow`; `usableWhileConcealed` at 50%) |
| Karakuri Ninpou: Fuuma Funshindan | Attack Skill | RE (3×3 within Range 4, Fire, 50% `Burn`) |
| Karakuri Genpō: Fubatsu | Active | RE (`Invuln` ×3; **cross-ability cooldown gating** — blocked while either sibling is on cooldown) |
| Karakuri Genpō: Kawarimi | Reaction | **RE+** `SwapPositions` mid-Combat-Process, in two forms (self-swap, ally-swap) |
| Karakuri Genpō: Kirihanasu | Reaction on fatal damage | **RE+** `FakeDefeat` — the GM-mediated shadow state (Ch. 44 §44.1). Cooldown gated on a **health threshold** as well as a duration |
| Subversive Activities (C) | Active | RE (3×3 orthogonal-adjacent) |
| Karakuri Genpō: Dongyū (C+, NP) | Two-mode NP | **RE+** mode 1 grants Presence Concealment to an *area*; mode 2 is a line whose **length shortens on the diagonal** (1×5 cardinal, 1×4 diagonal) |
| Youjutsu Zanhou・Yuugao (C, NP) | Command-Spell NP | **RE+** `commandSpellCost` on an ability; damage equal to the DU's **current Health**; evadable only by Lucky Evasion |

**Exercises:** three mutually-gating reactions sharing one cooldown pool, position swapping,
deliberate client desynchronization, diagonal length shortening, granting a class-skill status
to other units, an NP that costs a Command Spell, and damage defined as a fraction of the
target's own state.
**Scripts: 0** — `Kirihanasu` is a **protocol**, not a script; it is the one mechanic in either
roster carrying a *"requires GM comfort"* flag and a per-world disable.

---

## D.21 Hundred-Faced Hassan

Unit shape: `membership: pool` (Ch. 44 §44.1).

| Ability | Type | Mapping |
|---|---|---|
| Presence Concealment (A+) | Class, mode | RE — plus a **unique ninth clause**: `Skill Seal` deactivates PC immediately |
| Librarian of Stored Knowledge (C) | Passive + active | RE (crit +20% passive, +20% active, `NP Regen`) |
| Expert of Many Specializations (A+) — passive | Passive | **RE+** `RollAdjustment`: modify **any out-of-combat roll** by up to ±3, for herself or allies within 2. A player-facing prompt on an arbitrary roll |
| Expert of Many Specializations (A+) — active | Active | RE (`kind: choice` **or** `kind: roll`, player's option, `4` grants all three — and the **cooldown differs by branch**) |
| Battle Retreat (B) | Reaction | RE (cancel the attack, move 7, heal 40%, then **strip her own buffs**) |
| Zabaniya: Delusional Illusion (B++, NP) | Pool + AoE NP | **RE+** the 100-body pool; active hits 3×3 orthogonal-adjacent for 3.5× + 200 and **costs `4d6` bodies** |

**Exercises:** unit pools, per-group linked-death and shared-cooldown inversions, fractional
turn-budget weights, choice-or-roll ability phases, resource costs denominated in *units*, and a
player prompt that can retroactively adjust another unit's die roll.
**Scripts: 0.**

**Note.** Her sheet carries two open bracket-questions — *"maximum of ten (twenty?)"* and
*"0.5 (0.25?) of a Unit"*. Both ship as ruleset settings defaulting to the un-bracketed value
(**Q46**). She is also the only Servant whose Presence Concealment text differs from the shared
block, which is why PC is modelled as a **parameterized template** with per-Servant overrides
rather than as one shared effect.

---

## D.22 Medea

| Ability | Type | Mapping |
|---|---|---|
| Item Construction (A) | Class, passive aura | RE — with the **halving ladder** in *both* directions: debuff 50% / Instakill 25% / Death 10%, inflicting and resisting alike |
| Territory Creation (A) | Class, passive | RE (`highestOnly`) |
| High-Speed Divine Words (A) | Active | **RE+** `ResetCooldownGroup` scoped to `tag: spell`; negated by `Silence` |
| Golden Fleece (−) | Active, unranked | RE (30% heal, +3 Agility) |
| Teachings of Circe (A) | Active | RE (cleanse, 10% heal, `NP Regen`) |
| Αερο (Aero) | Damage Spell | RE (2×, Wind, `Bleed`) |
| Μαρδοξ (Argos) | Spell | RE (`Def Up`, usable on your turn **or** when attacked) |
| Κεραινο (Keraino) | Spell | RE (`MOV Up` 3; same-turn exclusion with Tροψα) |
| Tροψα (Trofa) | Reaction Spell | RE (automatic Evade; **50% only** against an NP, otherwise the process continues) |
| Ατλας (Atlas) | Spell | RE (`Stun` with **two independently-stacking −25% reductions**, one keyed on MAG rank and one on Magic Resistance rank) |
| Dragon Tooth Warriors | Spell | **RE+** `1d6` count, then `1d4` **per summon** for its type (with a "your choice" face), and a **count-scaled cooldown** (`N × ⅔◈`) |
| Rain of Light | Damage Spell | RE (Range +1 for the phase, 3×3, 3×) |
| σπάσιμο κανόνα (Rule Breaker) (C+, NP) | Damaging NP | **RE+** contract `seize` (Ch. 44 §44.5) |

**Exercises:** class-skill auras with per-severity halving, cooldown resets scoped by tag,
spell suites with pairwise same-turn exclusions, resistances that stack from unrelated sources,
variable-size summon batches with per-member type rolls, cooldowns computed from a roll result,
and hostile contract transfer.
**Scripts: 0.**

**Note.** `BA(MAG) 210` is the highest MAG base attack in either roster apart from Quetzalcoatl,
on a Servant with `STR: E` and `MOV: 4`. Medea is the purest artillery profile in the corpus and
the reason the `Silence` debuff needed the careful three-case treatment in Appendix A §A.14: it
turns her off entirely.

---

## D.23 Achilles

Bounded fields: **Diatrekhōn Astēr Lonkhē** (duel) and **Akhilleus Kosmos** (Ch. 43).
Novel mechanisms: Ch. 44 §44.1 (stance), §44.2 (the Heel), §44.3 (bidirectional lines).

| Ability | Type | Mapping |
|---|---|---|
| Mount stance | Per-action declaration | **RE+** `stance` (Ch. 44 §44.1) — free to change, but only at declared transition points, and forced to Dismounted outside his own turn |
| Riding (A+) | Class | RE, entirely gated on Mounted **except** Double Move |
| Magic Resistance (C) | Class, passive | RE |
| Divinity (C) | Passive | RE (+30 flat) |
| Battle Continuation (A) | Class, passive | RE (2d10+20, doubled dice vs NP; 5d20 revival) |
| Bravery (A+) | Passive + active | RE (Mental resist 50%; `Atk Up (STR)`) |
| Affections of the Goddess (EX) | Active | RE (three-clause self-buff) |
| Andreias Amarantos (B, NP) | **Passive NP** | **RE+** `AttackerPropertyTier` keyed on the **attacker's Divinity rank**, with **total immunity as the default case** |
| Troias Tragōidia (A+, NP) | Riding-Attack NP | **RE+** 13-panel **bidirectional** line (one direction on the Large Board); `@remainingMov` and `@count(hitTargets)` magnitudes; per-turn Master upkeep while Mounted |
| Dromeus Komētēs (A+, NP) | **Passive NP** | RE, gated on Dismounted (Double Move; Evade rolls −4) |
| Runner Comet (A+) | Active | RE (Dismounted only, Combat-Phase-start only, blocked by either Seal) |
| Achilles' Heel | Weak point | **S** `achilles.heel` (Ch. 44 §44.2) |
| Diatrekhōn Astēr Lonkhē (B+, NP) | Consent-gated duel field | **RE+** `duel` (Ch. 43) with a parameter-comparison gate, a gender gate, and a **three-name exclusion list** |
| Akhilleus Kosmos (A+, NP) | Push + one-shot barrier | **RE+** forced displacement on **his own** movement with collateral damage; a once-per-game 5×5 negation of an incoming Rank A+ AoE NP |

**Exercises:** stances, defensive tiers keyed on an attacker property, permanent irreversible
self-damage states, magnitudes computed from the result of the ability's own targeting, duels
with negotiated terms, and abilities that are permanently expended.
**Scripts: 1.**

**Note.** Five Noble Phantasms — tying Nursery Rhyme and EMIYA for the corpus record, and
displacing Karna's four. Three of the five are non-damaging and two are passive. He is the
benchmark for the ability model's **gating** machinery the way Karna is the benchmark for its
predicate machinery.

---

## D.24 Ozymandias

Bounded field: **Ramesseum Tentyris** (Ch. 43). Terrain: Ch. 42 (Sunlight, Day conversion).

| Ability | Type | Mapping |
|---|---|---|
| Riding (A+) | Class | RE (no Passenger Seat clause on his sheet — a deliberate per-Servant omission) |
| Magic Resistance (B) | Class, passive | RE |
| Divinity (B) | Passive | RE (+40 flat) |
| Pharaoh of the Hot Sands (A) | Active, `categorizedAs: Charisma` | RE — two of three clauses gated on a **Day Round**, which is now a **per-panel** query (Ch. 42 §42.3) |
| Imperial Privilege (A) | Active | RE (guaranteed heal; two independent 60% buff clauses) |
| Protection from Ra (A+) | Active | RE (party NP cooldown −⅔◈; `Buff ChUp`) |
| Mesektet (A+, NP) | Passive + AoE NP | RE — **the source of his Normal Attacks** (BA(MAG), Light, ×2 vs `Dark`); active is 3×3 for 4× + 100 |
| Ramesseum Tentyris (EX, NP) | Bounded field | **RE+** 11×11; a **second Home Base**; tiered curse by unit class; blanket NP suppression with a Divinity-rank exemption; Sustainability paused; ZON ignored; **three distinct termination paths** with different consequences; `npGateRound: 8` |
| Dendera Electric Bulb | Replaced Normal Attack | **RE+** a Normal Attack **substituted while inside a field**, with a two-method choice, a compound range (inside the field, **or** within 4 of its border / 3 diagonally), a per-use Master cost, and an explicit refusal to benefit from his own `Atk Up` |
| Pyramid Drop (EX, NP) | Once-per-game NP | RE (5×5, 5×, `NP Seal` 3◈, `Def Dwn` 3◈; converts the area to **Day** for 2◈; consumes Ramesseum Tentyris permanently) |
| The Sphinx of Abu el-Hol (A, NP) | Summon NP | RE (three distinct statlines; `Luck: shared` with Ozymandias; **stat persistence across field deactivation and reactivation**) |

**Exercises:** per-ability NP round gates, fields that grant Home Base status, curses tiered by
unit class, normal attacks replaced by a field, compound anchors combining "inside X" with
"within N of X's border", summons that survive their field's deactivation as saved state, and
an NP whose use permanently destroys another NP.
**Scripts: 0.**

**Note.** *"Damage dealt is not affected by `Atk Up` or other damage increasing effects on
Ozymandias"* on the Dendera Electric Bulb is the corpus's only **self-directed** modifier bypass.
Every other `bypassModifiers` in the game points at the *opponent*. The damage pipeline takes it
without comment because bypass is a two-sided flag (Ch. 13 §13.6), which was speculative when
written and is now load-bearing.

---

## D.25 Medusa

Bounded field: **Blood Fort Andromeda** (Ch. 43).

| Ability | Type | Mapping |
|---|---|---|
| Riding (A+) | Class | RE — but note Riding Attack and Passenger Seat are **unlocked by the Active** rather than being permanent passives, unlike Achilles' and Ozymandias's |
| Magic Resistance (B) | Class, passive | RE |
| Divinity (E−) | Passive | RE (+5 flat) — the **first sub-E rank in the corpus** |
| Independent Action (C) | Class, passive | RE (Sustainability 6◈, ZON +2, 2 contract rolls, +1◈ per Civilian killed) |
| Monstrous Strength (B) | Active, `damageStepStart` | RE (+80% STR, +40% NP) |
| Monstrous Snake Metamorphosis (B) | Active | RE — including `Dmg Up (Bind)`, a **family-predicated** damage bonus |
| Mystic Eyes (A+) | Active | **RE+** `requiresClearPath` + `requiresFacing` (Ch. 44 §44.3); a **nested** Agility Check ladder (the middle tier rolls twice); `ignoresResistanceFrom: [magicResistance]` |
| Blood Temple (B) | Active | RE (magnitude conditional on her own field being active) |
| Blood Fort Andromeda (B, NP) | Mark-built bounded field | **RE+** built by placing **four corner Bloodmarks** as separate turn actions; drain-to-heal with a shared pool cap; **halved against `Mechanical`**; marks visible only within 3 panels and destroyable **only by Masters** |
| Bellerophon (A+, NP) | Line NP | **RE+** 1×13 **diagonal-capable, bidirectional**, board-size-dependent |

**Exercises:** the only line-of-sight requirement in the game, facing as a targeting
prerequisite, resistance bypass scoped to one *source*, multi-turn field construction, fields
built from placed markers with their own visibility and destructibility, and diagonal lines.
**Scripts: 0.**

**Note.** Blood Fort Andromeda is the only bounded field that **has no duration at all** — it
runs until Medusa is defeated. Chapter 43's `expiry: onOwnerDefeat` exists solely for it.

---

## D.26 Pale Rider

Bounded field: **Doomsday Come** (Ch. 43). Unit shape: Ch. 44 §44.1.

| Ability | Type | Mapping |
|---|---|---|
| Riding (EX) | Class, passive | **RE+** `health: null`; `cannotAttack`; `cannotReact`; ZON increased by **its own MOV** (a derived value feeding another derived value) |
| Magic Resistance (C) | Class, passive | RE — vestigial, since it cannot be damaged |
| Contagion (A) | Passive aura + active | **RE+** an aura that reduces Health *without the reduction counting as damage*; expands from 5×5 to 9×9 on the active; **rewritten entirely** while `Doomsday Come` is up (unbounded range, higher chances, higher magnitude near its Master) |
| Innocent World (EX) | Passive, field-scoped | **S** `paleRider.innocentWorld` — highest-parameter determination with tie and no-parameter branches |
| Guidance of the Netherworld (EX) | Active | **RE+** `GotN`, a status that **stores an unapplied effect bundle** and discharges it when the bearer later enters a specific area |
| Doomsday Come (EX, NP) | Bounded field | **RE+** `2+1d4` panels, anchored to the **Master** and **moving with them**; sealed in both directions; asymmetric permeability (allies free, enemies one-way); paid extension; a per-turn **drag-in attack**; an `[Anti-World]` escape clause that ends it and halves its own damage |
| Kagome Kagome (A, NP) | Summon NP | **RE+** one `1d4` summon **per enemy unit**, with persistent per-enemy identity across reactivation; four `health: null` statlines; a Light/`Dark`-keyed **temporary banishment** on a coin flip |
| — | Relationship rules | **RE+** `relationshipProxy: summons`; `itemHandling: redirectToMaster` |

**Exercises:** units with no health resource, health loss that is not damage, fields anchored to
a moving unit, one-way permeability, per-target summon assignment with memory, effects stored
for later discharge, and Master-protection rules redirected to a proxy.
**Scripts: 1.**

**Note.** Pale Rider is the strongest argument in the corpus for the Snapshot/Intent boundary
(Ch. 03 §3.6). Almost none of its text describes an *attack*; it describes conditions under
which the world changes around a unit. A design that had grown outward from "attacker hits
defender" would need a special case for every line of this sheet.

---

## D.27 Anastasia & Viy

| Ability | Type | Mapping |
|---|---|---|
| (normal attack) | — | **RE+** **range-banded combined base attack**: BA(STR) at Range 1–2; BA(STR) + 10% BA(MAG) at Range 3+, dealing Ice and MR-exempt |
| Swimsuit! | Passive | RE (Total Water damage −50% including NP) |
| Independent Action with Viy (EX) | Class, passive | RE (**no Sustainability**; ZON +3; **absolute** contract immunity; crit chance and crit damage +10%) |
| Fae Contract (B+) | Passive | RE (+5% / +5%) |
| Shvibzik (Summer) (B+) | Active | RE |
| Freezing Summertime (A) | Active | RE — including `BuffRemoval ResUp` at **100%**, the only absolute instance |
| Full Acceleration: Spirit Eyes (B) | Active | RE — `Crit Up (Viy)` is **crit chance scoped to attacks that use BA(MAG)**, with a separate NP magnitude |
| Watermelon Splitting Master | Passive + active | RE (self-inflicted `Blind` reinterpreted as an offensive buff — Ch. 44 §44.3) |
| Rock Snowball | Passive | RE — `½◈` duration, the **finest tick granularity in the corpus** |
| Ice Bucket Challenge for You | Attack Skill | **RE+** the `Soaked` status: **additive** Freeze chance on Ice damage, consumed by Fire in exchange for −50% Fire damage, and expiring at the end of a **Day Round** |
| Snegleta・Snegurochka (B, NP) | Damaging NP | RE — note the debuff is applied **before** the damage, so the `Def Dwn` affects the NP that applied it |
| Ice Block Launcher (C, NP) | Damaging NP | **RE+** `@distance`-scaled Instakill chance (5% **per intervening panel**) |

**Exercises:** base attacks that change composition by range band, self-debuff as a resource,
statuses that modify another effect's *chance* additively, half-tick durations, ordering within
an NP's own effect list, and terminal-debuff chance scaled by geometry.
**Scripts: 0.**

**Note.** `Sustainability: N/A` and `Base Health: 500` on the same sheet. She never runs out of
time and dies to almost anything — a shape the original roster had no example of, and one that
makes the "can this unit still act" predicate (Ch. 16 §16.4) independent of the Sustainability
clock in a way that was previously only theoretical.

---

## D.28 Quetzalcoatl

Bounded field: **Piedra Del Sol** (Ch. 43). Platform: **Quetzalcoatlus** (Ch. 20).
Terrain: Ch. 42 (Burning, Sunlight).

| Ability | Type | Mapping |
|---|---|---|
| Riding (EX) | Class | RE (MOV +6 active) |
| Magic Resistance (A) | Class, passive | RE |
| Goddess's Divine Core (EX) | Passive, `countsAs: divinity` | RE (+120 flat; debuff chance −50%) |
| Charisma of the Sun (EX) | Active | **RE+** the `Sol` buff: **the 5×5 around her is Day even during a Night Round** — a per-panel terrain phase override (Ch. 42 §42.3) |
| Good God's Wisdom (A+) | Active | RE (`Guts` 10% + `Atk Up` on one ally) |
| Lucha Libre (EX) | Active | RE (reduces **one named NP's** cooldown by 1◈) |
| Xiuhcoatl (A, NP) | Damaging NP | **RE+** combined BA (250); **unconditional splash** to a 2-panel radius *whether or not the primary hit*; and **terrain creation** — used within or beside a `[Fortress]` NP, that area and its border become `Burning` |
| Quetzalcoatl: Winged Serpent (A, NP) | Platform NP | **RE+** a mount that **replaces her Move and Normal Attack**; three mount-only Spells on a shared cooldown; tiered AoE soak (mount full / Quetz 50% Total / Master none); ignores obstacles and stacks on occupied panels; a **2◈ deactivation lockout** |
| Piedra Del Sol (EX, NP) | Levitating bounded field | **RE+** a 7×7 `Burning` zone anchored above her with a **permanent-while-inside** Burn, upkeep, and a movable footprint |

**Exercises:** per-panel day overrides from a buff, splash damage decoupled from the primary
resolution, NPs that create terrain conditioned on *another* NP being present, mounts that
substitute a unit's whole action set, three-tier AoE protection, and fields that occupy a level
above the board.
**Scripts: 0.**

**Note.** `Sol`, `Xiuhcoatl`'s Burning conversion, and `Piedra Del Sol` are three different
routes to the same outcome — changing the terrain a panel has. Chapter 42's overlap matrix is
what keeps them from contradicting one another when two of them cover the same panel.

---

## D.29 EMIYA

Bounded field: **Unlimited Blade Works** (Ch. 43). NP copying: Ch. 44 §44.5.

| Ability | Type | Mapping |
|---|---|---|
| (normal attack) | — | RE+ range-banded combined BA (STR at 1–2; STR + 20% MAG at 3+, MR-exempt) |
| Independent Action (B) | Class, passive | RE (Sustainability 7◈, ZON +2, 3 contract rolls) |
| Magic Resistance (D) | Class, passive | RE |
| Clairvoyance (C) | Passive | **RE+** forces the DU onto the **unfavourable Evade table** with 80% probability at Range 3+ — the only consumer of `evade−` outside Mad Enhancement |
| Hawkeye (B+) | Active | RE (range-conditional crit chance and crit damage) |
| Eye of the Mind (True) (B) | Passive + reaction | **RE+** `RankShift` triggered by a **health threshold** (<20%), swapping the **entire ability** for its EX version |
| Eye of the Mind (True) (EX) | Conditional ability | RE (four clauses; usable on your turn *or* as a reaction) |
| Magecraft (C) | Passive | RE (unlocks Thaumaturgy; each use applies `Range Up`, **extending rather than stacking**) |
| Thaumaturgy: Reinforcement | Spell | RE |
| Thaumaturgy: Tracing | Spell | **RE+** cooldown reduction selected by **ability-name substring** (`Projection`), with a two-for-one-each or one-for-two choice |
| Projection Magic (A+) | Passive | RE (a `Silence` gate over a **named ability group**) |
| Trace, On (EX) | Active | **RE+** `AC`/`BC` mutually-exclusive statuses with **cascading removal** (they die when a separate buff dies); an **escalating self-cost** (free the first time, 5% Max Health thereafter); and a **Max Luck** increase |
| Kanshou & Bakuya (C−, NP) | Passive NP | RE (`RankShift` +1 on **his own Magic Resistance** for the turn; suppressed while Overedge is on cooldown) |
| Overedge | Attack Skill, *categorized as NP* | RE (two Normal Attacks in a row, each +50%) |
| Caladbolg II (A, NP) | AoE NP | RE (3×3 **around the targeted unit**, `Pierce` on the primary only, **caster excluded from its own area**) |
| Hrunting (A, NP) | Damaging NP | RE (`Aim`, MR-exempt, **minimum range** restriction) |
| Rho Aias (?, NP) | Shared shield NP | **RE+** `shieldScope` / `bleedThrough` / `indestructibleAgainst` / decaying reuse (Ch. 44 §44.2) |
| Unlimited Blade Works (E~A++, NP) | Bounded field | **RE+** field + the `Aria` resource (0/6, one per Combat Phase, spent entirely) |
| Projection: Unlimited Blade Works | Runtime NP copying | **S** `emiya.brokenPhantasm` |

**Exercises:** ability-swapping rank shifts, statuses whose lifetime is bound to another effect,
minimum ranges, self-exclusion from your own AoE, shields that protect third parties and damage
a fourth, per-Servant resources, and runtime copying of enemy content into an Item.
**Scripts: 1.**

**Note.** Nineteen entries — the largest inventory in either roster, ahead of Karna's thirteen.
Five Noble Phantasms, one of which has no Rank at all (`Rank: ?` on Rho Aias) and one of which
has no `[tag]` (`[???]` on UBW). Both are stored as `null` with a display fallback; nothing in
the engine requires an NP to have either, which is a small design decision that this sheet
retroactively justifies.

---

## D.30 Proto Gil

Bounded field: **Enki** (`kind: schedule`, Ch. 43 §43.9). Defence: Ch. 44 §44.2.

| Ability | Type | Mapping |
|---|---|---|
| Independent Action (A+) | Class, passive | RE (no Sustainability; ZON +3; **absolute** contract immunity) |
| Magic Resistance C (E) | Class, passive | **RE+** `mode: dice` — `3d20`, doubled dice vs NP, **never negates**. Also the second instance of the `displayRank (baseRank)` notation |
| Divinity (B) | Passive | RE (+40 flat) |
| Charisma (A+) | Passive + active | RE — note the magnitudes are **27** flat and **27%** / 12%, the only non-round values in the corpus |
| Golden Rule (A) | Passive + active | **RE+** a **fallback target** for cooldown reduction: crits reduce his NP cooldown, and when nothing is on cooldown the reduction is redirected to `Enki`'s countdown |
| Treasury of Babylon (EX) | Active | RE |
| Levitation | Passive | **RE+** the `Levitating` attribute; MOV +1; move-through-obstacles (but not past Master protection); Evade −3; **all of it negated by `NP Seal`** — a passive that a *debuff* switches off |
| Bab-ilu (E~A++, NP) | Passive + AoE NP | **RE+** the passive is a **mid-phase reposition and second attack** with a `reactionLock` (Ch. 44 §44.3); the active is `3d20` against a **twenty-entry** debuff table with stacking duplicates and one count-scaled entry |
| Enkidu (???) | NP-adjacent attack | RE (a six-step Divinity-rank ladder for both damage and Stun chance; the `Divine` attribute without a Divinity skill is **treated as Rank A**; against `Divine` units, `Debuff Immune` cannot prevent the Stun — but `Debuff Resist` still reduces its chance) |
| Enki (EX, NP) | Scheduled detonation | **RE+** `kind: schedule`: marks a panel, then **7◈ later** hits 13×13 from that mark for 5× + 700 with a 500% `Drowning` chance, converts the area to `Waterside` for 7◈, exempts `Levitating` units, and is **cancelled outright if he dies first** |

**Exercises:** dice-based resistance that never negates, elevated ranks with a recorded base,
cooldown reduction with an overflow target, passives disabled by a debuff, defender reaction
locking, twenty-entry random tables, immunity that is bypassed while resistance is not, and
scheduled area effects decoupled from the caster's continued presence.
**Scripts: 0.**

**Note.** The `500%` Drowning chance is not a typo in our transcription — it is the sheet's way
of saying "certain, and it stays certain after every reduction in the game has been applied".
The `d100 < percent` convention (Appendix C §C.4) handles it without a special case, which is
why chances are stored uncapped and clamped only at roll time.

---

## D.31 Asterios

Bounded field: **Chaos Labyrinthos** (Ch. 43). Terrain: `Labyrinth` (Ch. 42).

| Ability | Type | Mapping |
|---|---|---|
| Mad Enhancement (B) | Class, mode | RE (Appendix B: 40%/20% taken, 60% dealt halved for MAG, drain floor 20) |
| Monstrous Strength (A) | Active, `damageStepStart` | RE (+100% STR, +50% NP) |
| Natural Monster (A++) | Passive + active | RE — including `Off.Debuff ResUp` at **100%**, an offensive-scoped resistance at full magnitude |
| Avyssos of Labrys (C) | Active | RE — including `Bleed Atk`, an **on-Normal-Attack rider buff** (10% `Bleed`) |
| Chaos Labyrinthos (EX, NP) | Bounded field | **RE+** a **region-dependent footprint** (9×9, or 11×11 if the Region is Greece); an escape ladder with a 20% base, +5% per failure, and a **permanent learned-route memory** that raises a repeat visitor to 100% and **propagates to adjacent allies** |

**Exercises:** footprints that depend on the scenario's Region, escape mechanics as a repeated
check with memory, knowledge that transfers between units by adjacency, and paid duration
extension that also re-applies debuffs.
**Scripts: 0.**

**Note.** Five abilities — the smallest inventory in either roster, and by some distance the
largest *rules* surface per ability. Chaos Labyrinthos alone has ten numbered clauses. Ability
count is not a proxy for conversion cost, which is why Chapter 37's content-pipeline estimates
are per-clause rather than per-ability.

---

## D.32 Raikou

| Ability | Type | Mapping |
|---|---|---|
| Mad Enhancement (EX) | Class, mode | **RE+** a **positionally forced permanent mode**: constantly active and undeactivatable while her Master is within 2 panels, with a Command-Spell override lasting 1◈ that lapses back if the condition still holds. Magnitudes per Appendix B: 75%/30% taken, 100% dealt, drain 30 |
| Riding (A+) | Class | RE (all three passives unlocked by the Active) |
| Magic Resistance (D) | Class, passive | RE |
| Divinity (C) | Passive | RE (+30 flat) |
| Genji-clan Martial Arts Discipline (EX) | Passive + active | **RE+** *"the magnitude of all `Atk Dwn` effects on Raikou is halved"* — a **modifier acting on other modifiers' magnitudes**, by family. Active magnitudes are ME-conditional (30% with, 60% without) |
| Mana Burst (Lightning) (A) | Passive + `whenAttacking` | RE (`Shock` immunity; Lightning taken −50%; combined BA 350, MR-exempt; ME-**exclusive**) |
| Thunder God's Embodiment (A+) | Active | RE — the `Raikou` buff is a **count-limited on-attack rider** (3 uses: +40 Lightning, 40% `Shock`, NP cooldown −⅓◈) |
| Mystery Slayer (A) | Passive + active | RE (attribute-predicated `Dmg Up` with a **Demi-/Pseudo-Servant exclusion** carrying a single named exception) |
| Goō Shōrai・Tenmōkaikai (A+, NP) | Clone NP | **RE+** four clones on the four orthogonal-adjacent panels, each with a **different Range, element and rider**; halved Max Health; a restricted ability set (Passives only, Normal Attacks only); Master upkeep on any acted turn |
| Goō Shōriki・Dohatsu Tenshou (B++, NP) | Compound NP | **RE+** four separately-blockable/evadable `0.5×` Normal Attacks in four elements **explicitly not modified by Mad Enhancement**, then a `3.5× + 200` NP portion — one ability spanning both sides of the Normal/NP divide |

**Exercises:** modes forced by position rather than by choice, modifiers whose subject is
another modifier's magnitude, mutual exclusion between a class skill and an ordinary skill,
count-limited attack riders, clone summons with per-clone parameterization, and a single ability
that resolves as five separate attacks under two different rule sets.
**Scripts: 0.**

**Note.** `Dohatsu Tenshou` is the hardest single ability in either roster to log legibly. Five
damage instances, four of which can be independently Blocked or Evaded and none of which use
the mode that is definitionally active while the ability is usable. Chapter 30's audit format
was designed around exactly this: one entry per damage instance, with a shared parent id.

**Confirmation of Appendix B.** Asterios at B and Raikou at EX reproduce the Mad Enhancement
table derived from Heracles (B) and Penthesilea (EX) **exactly** — 40%/20%/60%/drain 20 and
75%/30%/100%/drain 30 respectively. Two independent sheets agreeing with a table inferred from
two others is the strongest validation any of the rank tables has received.

---

## D.33 Aggregate — both rosters

| Metric | Original twelve | Expanded seventeen | Total |
|---|---|---|---|
| Servants | 12 | 17 | **29** |
| Reference units (excl. summons) | 13 | 17 | **30** |
| Total abilities | ~72 | ~130 | **~202** |
| Noble Phantasms | 21 | 42 | **63** |
| Passive Noble Phantasms | 3 | 8 | **11** |
| Bounded fields | 2 | 10 | **12** |
| Platforms | 3 | 1 | **4** |
| Class skills instantiated | 26 | ~35 | **~61** |
| Distinct targeting declarations | 24 | 18 | **42** |
| Rule elements | ~30 base + ~28 | +~22 | **~80** |
| **Script elements** | **2** | **4** | **6** |

**Six scripts across ~202 abilities — 3.0%**, against the 15% budget in Ch. 24 §24.3. The ratio
held across a roster that is substantially more exotic than the one the architecture was
designed against, which is the strongest available evidence that the rule-element vocabulary is
the right shape.

The 22 rule elements added for the expanded roster are, as before, general-purpose:
`stance`, `weakPoint`, `Disguise`, `membership: pool`, `relationshipProxy`, `health: null`,
`Resistance mode: dice`, `shieldScope`, `bleedThrough`, `reactionLock`, `requiresClearPath`,
`requiresFacing`, `RollAdjustment`, `SwapPositions`, `FakeDefeat`, `OptionalCost` (extended to
Agility), `ResetCooldownGroup`, `AttackerPropertyTier`, `commandSpellCost`, `kind: schedule`,
`deferredUntil`, and `SustainabilityGain`.

### Record holders

| | |
|---|---|
| Most abilities | EMIYA (19), then Karna (13) |
| Most Noble Phantasms | Achilles, EMIYA, Nursery Rhyme (5 each) |
| Fewest abilities | Asterios (5) |
| Highest BA(MAG) | Quetzalcoatl (250), then Medea (210) |
| Highest BA(STR) | Kingprotea (200), then Asterios (170) |
| Highest Max Health | Kingprotea (2000) |
| No Max Health at all | Pale Rider |
| Longest Sustainability | Kiritsugu and Serenity (8◈); **none at all** — Proto Gil, Anastasia |
| Largest bounded field | Ramesseum Tentyris (11×11), or 13×13 counting Enki's detonation |
| Longest delay before an effect resolves | Enki (7◈ after activation) |

### The mechanisms twenty-nine Servants still do *not* exercise

- `Confuse`, `Webbed`, `Pigify`, `Toad`, `Crystalfreeze`, `Seared`.
- `STR Reflect`, `MAG Reflect`, `Anti-Purge`, `Substitution`.
- `DblAtk Up`, `TrplAtk Up`.
- `Delay`.
- Magic Crests (a Master ability; no Master sheets have been supplied).
- The `ring` targeting shape.
- An even-dimensioned **self-centred** shape (Ch. 41 Q27). Ozymandias's Dendera Electric Bulb
  is a 2×2, but it is *placed*, not self-centred, so the ambiguity Q27 asks about is still open.
- Nine of the twenty-one terrain types in Chapter 42 have no content that creates them; they
  are scenario-authoring tools rather than Servant abilities.

These remain implemented from the rules text and covered by unit tests, with no content
validating them end to end.

---

**End of appendices.** Back to the [index](00-index.md).
