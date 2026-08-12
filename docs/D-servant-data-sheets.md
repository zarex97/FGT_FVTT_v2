# Appendix D — Servant Data Sheets

The twelve reference Servants as system data. This is the acceptance content for **SC-7**: if
all twelve are playable with full automation, the system is done.

Each entry gives the statistical block, the ability inventory with its system mapping, and the
mechanisms it exercises. Full conversions for the six hardest are in Chapters 31–36; this
appendix is the consolidated reference.

**Mapping key:**
- **RE** — expressible with existing rule elements.
- **RE+** — needs a rule element added to the catalogue (named).
- **S** — needs a `Script`.

---

## D.1 Statistical summary

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

## D.14 Aggregate

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

Worth recording, because they are the gaps a thirteenth Servant might expose:

- No Servant has the `Dark` attribute (day/night is untested by content).
- No Servant uses `Charm`, `Confuse`, `Petrify`, `Webbed`, `Pigify`, `Toad`, `Drowning`,
  `Crystalfreeze`, or `Seared`.
- No Servant uses `STR Reflect`, `MAG Reflect`, `Anti-Purge`, or `Substitution`.
- No Servant uses `DblAtk Up` or `TrplAtk Up`.
- No Servant uses `Delay`.
- No Magic Crests appear at all (they are a Master ability and no Master sheets were supplied).
- No `ring` targeting shape is used.
- No even-dimensioned self-centred shape appears (Ch. 41 Q27).

These are implemented from the rules text and covered by unit tests, but they have no content
validating them end to end. The first thirteenth Servant that uses one of them is the real test.

---

**End of appendices.** Back to the [index](00-index.md).
