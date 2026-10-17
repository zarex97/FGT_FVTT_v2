# Arjuna — the Clause list

**Draft, 2026-10-16.** The audit issue's body, before it is opened. Built by hand, line by line, from
`char_orig_sheets/Copia de Arjuna.md` as it stands in the working copy (an untracked file until this
audit commits it). The generated draft was not used.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a
die or a condition of its own. A Clause stating *"if NP"* needs a Noble Phantasm reading.

**Built 2026-10-16, pressed 2026-10-17.** 66 Clauses `Pressed` or `Observed` live, 8 pressed in the engine; the
evidence per Clause is on #234, the case chapter Ch. 46 §46.35. Karna's side of Fated Rivals is live with him.

**Built to be reused.** Each piece is authored on the generic path other sheets already use, or
extends it so the next Servant with the same wording reuses it. Arjuna is Karna's mirror, and most of
him is Karna's: Fated Rivals is Karna's `Compulsion` with `target:contentId:karna`; Magic Resistance C
is `class-magic-resistance`, word for word Karna's; Mana Burst (Flames) is Karna's
(`karna-mana-burst-flames`: a combined base, `ignoresMagicResistance`, `sameTurnExclusive`); Roar of
the Flame God is Flash of the Sun God with Luck for Agility and the Agni buff; Agni Gandiva is
Brahmastra's `aim` with Brahmastra Kundala's combined base, `requirements: abilityOffCooldown` and
`alsoTriggers`. Independent Action A is Kiritsugu's (4 contract rolls, `rules/contract.mjs`). Divinity B
is Proto Gil's `divinity-fixed`. Clairvoyance's passive is EMIYA's (`TableOverride` to Evade−) at 90%;
its Range Up follows EMIYA's Range Up (Hawkeye). The Awarded Hero's Regen is Appendix A's, its Area
CritUp Van Gogh's, its NP Regen the common `npRegen` 1. The Agni buff is Raikou's counted buff
(`raikouBuff`: `stacking: count`, `uses: 3`, `consumesUse`). Pashupata's Death ladder is Karna's
Divinity ladder (`vasaviActivated`: one row per grade cleared) on Enkidu's `chanceModifiers`; its Def
Dwn is Appendix A's.

### Already ruled

**Elsewhere:** Base Attack and Max Health derive from the tables (§46.6) · *"NP Cooldown"* naming no
NP reaches every NP (#197 reading 6) · *"all allied Units"* includes the user unless the sheet says
*"other"* · an effect with no NP figure applies its full value against an NP (#204 reading 5) · Crit
Up reaches an NP only when an NP figure is stated (#131) · an NP used on its owner's own Turn consumes
his Attack, on another's Turn nothing (§46.4-AZ) · two different Atk Ups stack (#230 reading 4) ·
only the MAG share of a combined base meets Magic Resistance, and an NP meets it by its own Rank (#206
reading 10) · *"Cannot be used on the same Turn as"* is `sameTurnExclusive` (Karna) · *"NP Regen,
reduced by 1 Turn at the end of every Turn"* is `npRegen` 1 on top of the natural 1 (Medusa,
Penthesilea) · Fixed Divine Damage is added after everything and counts toward no Injury roll (#232
reading 16) · a sheet binds only its owner: what Karna does under Fated Rivals is Karna's sheet.

### Readings to settle

Asked by grilling, 2026-10-16. All built and pressed (Ch. 46 §46.35).

**Round 1, ruled 2026-10-16.**

1. **Class** (`SB`). **Ruled:** Archer; the sheet names none.
2. **Whose Command Spell** (`FR.cs`). **Ruled:** Arjuna's own Master's. *"Karna's Master"* is a slip for
   the mirror of Karna's clause (#206 reading 2): Suspend Skill on Fated Rivals, offered only while it
   binds him, freeing Arjuna alone.
3. **Fated Rivals' reach** (`FR.1`, `FR.lift`). **Ruled:** as Karna's (#206 reading 2): within Arjuna's
   current Range; every Attack must target Karna; an area Attack must catch Karna and still hits the
   rest; Skills that are not Attacks stay free; it never makes him Attack.
4. *(Evade−: explained, asked again in round 2.)*
5. **Range Up (Clairvoyance)** (`CV.a.3`, `CV.a.3.stack`). **Ruled:** its own effect; stacks with other
   Range Ups; reapplying it resets it to 1◈.
6. **Regen's size** (`AH.2`). **Ruled:** `regen` reads its own percent, 10 when none is stated. Van
   Gogh's two 5% Regens, which healed 10%, heal 5%; Pale Rider's stays 10%.
7. **Area CritUp (Awarded)** (`AH.3.*`). **Ruled:** its own effect: +10% on Arjuna, +5% on each other
   allied Unit within 2 of him; it stacks with Van Gogh's Area CritUp and with Crit Up.
8. **What spends an Agni charge** (`RF.4`). **Ruled:** a Normal Attack that deals damage, as Raikou's
   buff. A miss or an Evade spends none.
9. *(Agni's Fire, whole or half: explained, asked again in round 2.)*
10. **"Magic Resistance is halved"** (`AG.mr`). **Ruled:** damage only. A Magic Resistance that would
    negate takes half the MAG share; one that cuts a percent cuts half that percent (30% → 15%). Its
    cut to the Burn's inflict chance is untouched.
11. **Rank in Divinity** (`PA.death.div`). **Ruled:** Karna's count: E 1, D 2, C 3, B 4, A 5 (A+ and A++
    as A), EX 6. *"Divine"* with no Divinity adds nothing.
12. **Who Pashupata hits** (`PA.area`, `PA.death`). **Ruled:** every Unit in the area, allies included,
    except Arjuna himself; each Unit hit rolls its own Death.
13. **"Within Arjuna's Range"** (`PA.area`). **Ruled, for every ability with this wording unless its
    sheet says otherwise:** every panel the area would affect must be within Range, not only its
    centre. A panel beyond Range is not affected, as if a wall contained the area.

**Round 2, ruled 2026-10-16.**

14. **Evade−** (`CV.p`, `CV.p.near`). **Ruled:** when the DU of his Normal Attack declared at Range 3 or
    more chooses Evade, a d100: on 1–90 its Evade rolls on the unfavourable table (`1d20+4`, the Evade−
    of Mad Enhancement and Pigify), else as normal. Mana Burst and Agni-buffed swings are Normal Attacks;
    his NPs and Skills are not. Block and taking the hit are untouched. EMIYA's Clairvoyance at 90.
15. **Fire, whole** (`RF.4.fire`, `MB.fire`, `AG.fire`). **Ruled:** the whole damage is Fire: every Fire
    rule (a Fire resistance, Freeze, a Fire-to-healing conversion, a Fire boost) meets all of it. The
    sheet says *"(half)"* where it means half, as Karna's does.
16. **What the Range wall clips** (reading 13). **Ruled:** everything the area touches: hits, effects,
    painted terrain and fields (Pyramid Drop's).
17. **The wall's measure** (reading 13). **Ruled:** each panel is measured as the anchor is, by the
    ability's Range rule from any panel the caster stands on.
18. **A Unit across the wall** (reading 13). **Ruled:** caught if any of its panels is inside, as an
    area catches a large Unit today.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX` — play-time tracking fields.
- *"(e.g. BA=325)"*, twice — the worked sum of `MB.ba` and `AG.ba`.
- *"(example: Divinity Rank C, 30% + 30% = 60%)"* — the worked sum of `PA.death.div`.
- ~~*"Agni Gandiva cannot be used if Pashupata is on Cooldown, and vice versa"*~~ — struck through on
  the sheet: withdrawn.
- *"Otherwise, the Combat Process proceeds as normal."* — the absence `CV.p.near` states.
- `Items held:` — an empty slot.

## Statblock

- [ ] **SB** · True Name Arjuna, Region India, Lawful Neutral, STR A, END B, AGI B, MAG B, LUC A++, Base Health 1250, MOV 5, Range 4 panels / 1 target, BA(STR) 150, BA(MAG) 175, Sustainability 8◈ · *Untouched*
- [ ] **SB.attr** · Attributes Male, Servant, [Sky], Humanoid · *Untouched*

## Fated Rivals of the Mahabharata *(Passive)*

- [ ] **FR.1** · If Karna is in the opposing Faction and within Arjuna's Range, Arjuna can only Attack Karna · *Untouched*
- [ ] **FR.lift** · …and is free again once Karna is out of his Range or not an enemy · *Untouched*
- [ ] **FR.cs** · His Master can spend one Command Spell to negate it for 1◈ (the sheet: *"Karna's Master"*, reading 2) · *Untouched*
- [ ] **FR.cs.only** · …and the negation affects only Arjuna · *Untouched*

## Independent Action — Class Skill, Rank A *(Passive 1 + 2 + 3)*

- [ ] **IA.1** · High Sustainability: 8◈ · *Untouched*
- [ ] **IA.2** · His Master's ZON is increased by 3 panels · *Untouched*
- [ ] **IA.3** · Requires 4 successful 'Contract Servant' rolls to be contracted by enemy Masters and Casters · *Untouched*

## Magic Resistance — Class Skill, Rank C *(Passive 1 + 2)*

- [ ] **MR.1** · MAG damage from a MAG Rank of up to C is negated · *Untouched*
- [ ] **MR.1.over** · …otherwise MAG damage taken is reduced by 30% · *Untouched*
- [ ] **MR.1.np** · …also affects NP · *Untouched*
- [ ] **MR.2** · The chance of being inflicted by debuffs is reduced by 15% · *Untouched*
- [ ] **MR.2.death** · …Instakill and Death too, unless from an Attack, Attack Skill, Spell or NP that deals STR damage or is not affected by Magic Resistance · *Untouched*
- [ ] **MR.2.erase** · Erase is completely unaffected · *Untouched*
- [ ] **MR.2.note** · Other debuffs from STR or 'not affected by Magic Resistance' sources still have their chance reduced · *Untouched*

## Divinity — Rank B *(Passive)*

- [ ] **DI.1** · All damage dealt is increased by 40, including NP · *Untouched*
- [ ] **DI.fixed** · …dealt as Fixed Divine Damage · *Untouched*
- [ ] **DI.injury** · …and it does not count towards the amount required for an Injury Roll · *Untouched*

## Clairvoyance (Bowman) — Rank B+ *(Passive + Active)*

- [ ] **CV.p** · When Arjuna performs a Normal Attack at Range 3 or more, the DU has a 90% chance of using Evade− when Evading · *Untouched*
- [ ] **CV.p.near** · …below Range 3 the Combat Process proceeds as normal · *Untouched*
- [ ] **CV.a** · Active, used during his Turn · *Untouched*
- [ ] **CV.a.1** · Applies Crit Up for 1◈: Crit Chance +25% · *Untouched*
- [ ] **CV.a.2** · Applies Debuff Immune for 1◈+⅔◈ · *Untouched*
- [ ] **CV.a.2.except** · …which does not affect Instakill, Death or Erase · *Untouched*
- [ ] **CV.a.3** · Applies Range Up (Clairvoyance) for 1◈: Range +1 panel · *Untouched*
- [ ] **CV.a.3.stack** · …which does not stack · *Untouched*
- [ ] **CV.cd** · Cooldown 4◈−⅓◈ · *Untouched*

## The Awarded Hero — Rank A+ *(Active)*

- [ ] **AH** · Used during his Turn · *Untouched*
- [ ] **AH.1** · NP Cooldown is reduced by 1◈+⅓◈ · *Untouched*
- [ ] **AH.2** · Applies Regen for 1◈+⅔◈: Health restored by 15% of its maximum · *Untouched*
- [ ] **AH.2.when** · …at the end of his Turn, at the end of any Turn he Acts, and at the end of the Round · *Untouched*
- [ ] **AH.3.self** · Applies Area CritUp (Awarded) for 1◈+⅔◈: Crit Chance +10% for himself · *Untouched*
- [ ] **AH.3.allies** · …and +5% for other allied Units within a 2-panel area of him · *Untouched*
- [ ] **AH.4** · Applies NP Regen for 1◈+⅔◈: NP Cooldown reduced by 1 Turn at the end of every Turn · *Untouched*
- [ ] **AH.cd** · Cooldown 4◈−⅓◈ · *Untouched*

## Mana Burst (Flames) — Rank A *(Active)*

- [ ] **MB** · Used when Arjuna performs a Normal Attack · *Untouched*
- [ ] **MB.ba** · For that Combat Process his Base Attack is BA(STR) and BA(MAG) combined, 325 · *Untouched*
- [ ] **MB.burn** · 50% chance of inflicting Burn for 2◈ on the DU · *Untouched*
- [ ] **MB.mr** · Not affected by Magic Resistance · *Untouched*
- [ ] **MB.fire** · Fire damage · *Untouched*
- [ ] **MB.cd** · Cooldown 3◈ · *Untouched*
- [ ] **MB.excl** · Cannot be used on the same Turn as Roar of the Flame God · *Untouched*

## Roar of the Flame God — Rank EX *(Active)*

- [ ] **RF** · Used during his Turn · *Untouched*
- [ ] **RF.1** · Restores 3 Luck · *Untouched*
- [ ] **RF.2** · Applies Atk Up for 1◈: all damage dealt +40% · *Untouched*
- [ ] **RF.2.np** · …if NP, 30% · *Untouched*
- [ ] **RF.3** · Applies NP DmUp for 1◈: NP damage dealt +20% · *Untouched*
- [ ] **RF.4** · Applies the 'Agni' buff for 1◈, 3 times · *Untouched*
- [ ] **RF.4.fire** · …his Normal Attacks deal Fire damage · *Untouched*
- [ ] **RF.4.burn** · …with a 30% chance of inflicting Burn for 1◈ · *Untouched*
- [ ] **RF.4.mb** · …which does not apply to, and is not consumed by, Attacks made with Mana Burst (Flames) · *Untouched*
- [ ] **RF.cd** · Cooldown 4◈ · *Untouched*
- [ ] **RF.excl** · Cannot be used on the same Turn as Mana Burst (Flames) · *Untouched*

## Agni Gandiva: Flame God's Yell — Rank A, NP, Anti-Unit

- [ ] **AG** · A Noble Phantasm, Rank A, Anti-Unit · *Untouched*
- [ ] **AG.excl** · Cannot be used on the same Turn as Mana Burst (Flames) · *Untouched*
- [ ] **AG.mbcd** · Cannot be used if Mana Burst (Flames) is on Cooldown · *Untouched*
- [ ] **AG.ba** · BA(STR) and BA(MAG) combined, 325 · *Untouched*
- [ ] **AG.mr** · The effect of Magic Resistance is halved · *Untouched*
- [ ] **AG.range** · Range 7 · *Untouched*
- [ ] **AG.aim** · Has the Aim effect · *Untouched*
- [ ] **AG.dmg** · Deals 4x damage · *Untouched*
- [ ] **AG.burn** · Inflicts Burn for 2◈ on the DU · *Untouched*
- [ ] **AG.fire** · Fire damage · *Untouched*
- [ ] **AG.cd** · Cooldown 7◈ · *Untouched*
- [ ] **AG.mb** · When Agni Gandiva is used, Mana Burst (Flames) also enters Cooldown · *Untouched*

## Pashupata: Raised Arm of the Destruction God — Rank A+, NP, Anti-Unit

- [ ] **PA** · A Noble Phantasm, Rank A+, Anti-Unit · *Untouched*
- [ ] **PA.ba** · BA(MAG) is used · *Untouched*
- [ ] **PA.area** · Hits a 5x5 area within Arjuna's Range · *Untouched*
- [ ] **PA.dmg** · 4x damage plus 100 · *Untouched*
- [ ] **PA.death** · 30% chance of inflicting Death on the DU · *Untouched*
- [ ] **PA.death.div** · …+10% for every Rank in Divinity the DU has · *Untouched*
- [ ] **PA.defdwn** · Then inflicts Def Dwn for 1◈ on all affected Units: all damage received +40% · *Untouched*
- [ ] **PA.cd** · Cooldown 7◈+⅓◈ · *Untouched*
