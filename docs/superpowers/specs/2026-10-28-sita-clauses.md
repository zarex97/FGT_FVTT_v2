# Sita (Archer) — the Clause list

*Sita*, the Archer, built from `char_orig_sheets/by-class/Archer/Sita.md`. Started by the user 2026-10-28.

**Audit opened 2026-10-28 (#348).**
**Read by hand, line by line.** No generated draft was used. No older `Copia de Sita.md` exists to compare with. The
sheet prints no `N.Atk Type` and no `{R}`/`{M}`/`{S}` tag on its NP.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own.

**Built to be reused.** Kin found with `node tools/sheet-kin.mjs kin "Archer/Sita"`, each confirmed by reading:

- **Magic Resistance A** is `class-magic-resistance` at A, as Arturia's and Rama's.
- **Independent Action D** is `class-independent-action` at D: the tables give 5◈, ZON +1 and 2 rolls, the figures
  the sheet prints.
- **Goddess's Divine Core**'s +60 and its *"counts as 'Divinity'"* are Kingprotea's and Quetzalcoatl's Skill: the
  `divineCore` table at C (twice Divinity C, 60), the `divinity` category and the `divine` Attribute. Its −20% is a
  literal `ApplicationChance`, as theirs.
- **Janaka**'s Normal Attack is EMIYA's blend (`sources`: STR 1, MAG 0.2) and Arjuna's Agni Gandiva's
  `magicResistanceFactor`. Its *"for each 'Janaka' buff"* is Proliferation's count of instances (`magnitudeStacks`,
  `perStack`). Its trigger is `abilityUsed`, as EMIYA's and Kiritsugu's Magecraft.
- **Jewel of the Earth**'s Def Up is `defUp` with an NP figure; its Debuff Immune is `debuffImmune`.
- **Pilgrimage**'s Decoy is `decoy`, its Invuln *"3 times"* Danzo's counted Invuln (`uses: 3`, `stacking: count`), its
  Burn Immune Karna's `Immunity` on `burn`.
- **Curse of Separation** is Rama's Dream of Reunion (#347): `gutsHealth` at 100 and a `heal` phase at 25% of the
  maximum, plus `regen` at 5%.
- **Haradhanu Janaka**'s cleanse is Kingprotea's Self-Suggestion (`removeEffect`, `selector: {polarity: debuff}`); its
  Heal Up is `healUp` (#260).

What she needs that nobody has yet, each to be built as a generic piece:

- **A counted Debuff Immune** (JE.di.two): *"2 times"*. Sixteen sheets print it (Passionlip, Monte Cristo,
  Nightingale …). Dioscuri's `applications: 1` is one application, not one charge.
- **A buff that changes the Normal Attack's Base Attack by its count** (JA.na, JA.na.per, JA.mr): Euryale's Glitter
  and Kiichi Hougen print the same shape at a fixed half.
- **A buff whose new instance resets its siblings' clocks** (JA.reset).
- **A `Burn Immune` effect** (PA.burn): the generic *"(Name) Immune"*; Summer Nagiko prints it too.

Rama's Curse of Separation summons her (#347, CS.sita, CS.contract, CS.panel). Those three are Rama's Clauses and stay
on his list; they are built and pressed under this audit, on his sheet.

**80 Clauses** across 6 Abilities, the NP and the statblock.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX`: play-time tracking fields.
- *"Has the following effects-"*, *"its effects are as follows-"*: headings.
- *"Peerless Bow of Reminiscence"*: a title.
- `Items held:`: an empty slot.

### Already ruled

**Elsewhere:** Base Attack and Max Health derive from the tables (§46.6); here they agree with the sheet: BA(STR) 75 at
STR D, BA(MAG) 200 at MAG A, Health 1000 at END C · *"all allied Units"* includes the user unless the sheet says
*"other"* · a Base Attack that combines STR with a share of MAG is a STR attack with a MAG top-up (EMIYA,
`rules/normal-attack.mjs`) · *"the effect of Magic Resistance is halved"* is the DU's Magic Resistance against that
hit, damage only: a negation takes the share off the MAG part, a cut takes the share of its percent (#234 reading
10) · an attack with no delivery tag is measured by its distance (#281) · *"removes all debuffs"* leaves an
Unremovable one (Self-Suggestion) · a counted Invuln spends a charge on every hit it touches, a halved NP included,
none on a pierced hit (#249 reading 40) · Heal Up does not reach Home Base or Command Spell healing (Appendix A) · a
handler on the end of her Turn and the end of a Turn she Acts heals once at one Turn's end (#198 reading 12, Avalon
reading 17).

## Readings to settle

Asked by grilling, 2026-10-28. **15 readings ruled** in two rounds.

**Built 2026-10-28** on `claude/sita` (`test/unit/sita-348.test.mjs`) and pressed as Player1 in Rama's audit War,
`At2JWRQAbMeTxd4Z` on the scene *Rama Audit*. The Sita pressed is the one Rama's Curse of Separation summoned there.
**80 of 80** Clauses end Pressed or Observed live. A case the board does not produce by chance was staged: dice on
the GM page, a Janaka clock, a cooldown set to 0, a debuff placed, a Master moved or given Health or Agility, an attack
budget reset.

Found live and fixed, each with a test that fails without it:

- A Regen tick under Heal Up wrote 75 and its card said 50: a boundary's heals are scaled before they are counted
  (`engine/applier.mjs#resolveHealing`, exported and idempotent).
- Haradhanu Janaka's cleanse left an Unremovable Curse in silence, and with nothing else to take posted no card: a
  held one is a line, "Curse stays: it is Unremovable" (`engine/skill-use.mjs#heldUnremovable`).
- An Evaded Haradhanu Janaka gave her no Heal Up: a phase may say `alsoOnMiss`, run on a missed or Evaded Process
  (`engine/attack.mjs#selfPhasesOnMiss`, ruling 8).
- A refused Burn read "burn Immune": an immunity is named by its effect's name.
- Rama's Curse of Separation said Sita came "beside" him when she stood two panels off: the nearest-panel case has its
  own line.

Found live and left open: a staged Curse ticked at the end of other sides' Turns as well as hers
(`docs/surprises/2026-10-28-curse-ticks-every-turn-end.md`), outside this audit.

**Round 1, ruled 2026-10-28 (the user).** Q2 and Q6 went against the recommendation.

| # | Ruling |
|---|---|
| 1 | A Janaka comes from a finished use of one of her Active Skills: Jewel of the Earth, Pilgrimage in Agni Pariksha, Curse of Separation. Her NP, a Normal Attack and a passive grant none (JA.when, JA.notskill). |
| 2 | **The user: the other reading.** The share is 20% and a further 20% for each Janaka: one Janaka is 40% (+80), two 60% (+120), three 80% (+160). With none the Normal Attack is BA(STR) alone (JA.na, JA.na.per, JA.na.none). |
| 3 | The DU's Magic Resistance meets her Janaka Normal Attack at X% of its effect, damage only, as *"the effect of Magic Resistance is halved"* (#234 reading 10). Her own Magic Resistance is untouched (JA.mr, JA.mr.x). |
| 4 | Each new Janaka resets every Janaka on her to 1◈: they end together (JA.reset). |
| 5 | #132 holds as it is: her own Decoy meets her Debuff Resist (25 + 20) and her Debuff Immune, and her NP's cleanse removes it (PA.decoy, NP.cleanse). |
| 6 | **The user:** a charge is spent only when the Debuff Immune *"ACTUALLY NULLIFIED a debuff"*: the debuff's die is rolled first, and a debuff that missed spends nothing. A buff never spends one. It ends at 0 charges or at 1◈ (JE.di.two). |
| 7 | Heal Up raises her Curse's 25% heal and her Regen by half. Guts's *"revived with 100 Health"* is a revival, not a heal: 100 (NP.healup.reach, NP.healup.guts). |
| 8 | The cleanse runs before the hit; Heal Up lands after it whether or not the DU Evades (NP.cleanse, NP.healup). |
| 9 | Summoned by Rama's Curse of Separation she arrives a fresh Servant: Health 1000, Agility and Luck rolled then on the card, every cooldown ready, no buffs. Rama's Master pays the multi-Servant tax when both Act and gains her ZON +1 (Rama CS.sita, CS.contract). |
| 10 | Another side's Sita on the board changes nothing: a second Sita arrives for Rama (Rama CS.sita). |
| 11 | She first Acts on her side's next Turn, never in the Turn she arrives in (Rama CS.sita). |
| 12 | The Curse is no Contract Servant roll: Rama's Master gains no Command Spells for her (Rama CS.contract). |

**Round 2, ruled 2026-10-28 (the user).** The frontier is empty: every reading is ruled.

| # | Ruling |
|---|---|
| 13 | The share has no cap (a fifth Janaka is 120%); X never passes 100%, Magic Resistance whole (JA.na.per, JA.mr.x). |
| 14 | Ruling 6 holds for every counted Debuff Immune, not Jewel's alone. An uncounted one refuses before any die, with no charge to spend (JE.di.two). |
| 15 | A debuff that lands for sure (100% or more after resistance, no die) and is refused has been nullified: a charge is spent (JE.di.two). |

## Statblock

- [x] **ST.name** · True Name: Sita · *Observed live* — Player1's sheet "Servant: Sita" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.class** · Class: Archer (the sheet's folder; no Class line is printed) · *Observed live* — her sheet "ARCHER · LAWFUL GOOD · INDIA" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.region** · Region: India · *Observed live* — her sheet "… INDIA" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.align** · Alignment: Lawful Good · *Observed live* — her sheet "LAWFUL GOOD" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.param** · STR D, END C, AGI A, MAG A, LUC EX · *Observed live* — her sheet STR D, END C, AGI A, MAG A, LUC EX (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.attr** · Attributes: Female, Servant, [Sky], Humanoid · *Observed live* — her sheet's Details: female, servant, sky, humanoid (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.hp** · Base Health 1000 (the table at END C) · *Observed live* — Health 1000 / 1000 at her arrival, on Player1's sheet (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.mov** · MOV 7 · *Observed live* — her sheet MOV 7 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.range** · Range 4 panels, 1 target · *Observed live* — her sheet RANGE 4, TARGETS 1 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.ba** · Base Attack STR 75, MAG 200 · *Observed live* — her sheet BA (STR) 75, BA (MAG) 200; her Normal Attack's breakdown base:str 75 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.na** · Normal Attack: STR (no type printed), its delivery measured by distance · *Pressed* — her sheet "Normal Attack: fixed component · STR"; with no Janaka, a Normal Attack on a Master: base:str 75 alone, "Ranged" at 2 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.items** · Items held: none · *Observed live* — no Item on her sheet (War At2JWRQAbMeTxd4Z, 2026-10-28)

## Magic Resistance — Class Skill, Rank A *(Passive 1 + 2)*

- [x] **MR.1** · MAG damage from a MAG Rank of up to A is negated · *Pressed* — Cú's Ansuz (MAG C) on her: the MAG negated, "magicResistance −73.6", only the Fixed Divinity 40 through (Invuln took it) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MR.1.over** · …otherwise MAG damage taken is reduced by 50% · *Pressed* — Medea's Aero (MAG A+): "magicResistance −172", half of the MAG (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MR.1.np** · …also affects NP · *Observed live* — board magicResistance {rank A, percent 50, includesNP: true} (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MR.2** · Chance of being inflicted by debuffs is reduced by 25% · *Pressed* — her own Decoy "rolled 84 vs 55%": 100 − 25 − 20; board applicationChances incoming 25 (Magic Resistance) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MR.2.death** · …also affects Instakill and Death · *Observed live* — board applicationChances incoming 25 for [instakill, death] (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MR.2.str** · …unless the Instakill or Death is from an Attack/Attack Skill/Spell/NP that deals STR damage or is not affected by Magic Resistance · *Observed live* — that 25 carries the attack predicate: not STR, not unaffected by Magic Resistance (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MR.2.erase** · Erase is completely unaffected · *Observed live* — no erase severity among her applicationChances (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MR.2.other** · Other debuffs from STR or *"not affected"* sources still have their chance reduced · *Observed live* — the normal-severity 25 carries no predicate: a STR Attack's debuffs are cut too (War At2JWRQAbMeTxd4Z, 2026-10-28)

## Independent Action — Class Skill, Rank D *(Passive 1 + 2 + 3)*

- [x] **IA.sus** · *(P1)* High Sustainability, 5◈ · *Observed live* — her sheet SUSTAINABILITY 5◈ (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **IA.zon** · *(P2)* Her Master's ZON +1 panel · *Pressed* — arrived contracted to Rama's Master: her ZON 4 against Rama's 3 from the same Master (+1) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **IA.contract** · *(P3)* 2 successful Contract Servant rolls to be contracted by an enemy Master · *Observed live* — the live board's contract rule: rollsRequired(Sita, by an enemy) 2, by an ally 1 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **IA.contract.caster** · …or by an enemy Caster · *Observed live* — the same rule for an enemy Caster's attempt (a Caster contracts as a Master does, Ch. 32): 2 (War At2JWRQAbMeTxd4Z, 2026-10-28)

## Goddess's Divine Core — Rank C *(Passive 1 + 2 + 3)*

- [x] **DC.1** · *(P1)* All damage dealt +60 · *Pressed* — her Normal Attack on Medea: "flatAttackBonuses: Divinity (Goddess's Divine Core) +60" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **DC.1.np** · …including NP · *Pressed* — Haradhanu Janaka's breakdown: the same +60 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **DC.2** · *(P2)* Chance of being inflicted by debuffs −20% · *Pressed* — her own Decoy at 55%: the 20 beside Magic Resistance's 25; board applicationChances incoming 20 (Goddess's Divine Core) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **DC.div** · This Skill counts as 'Divinity': a clause that names the Divinity Skill finds it · *Observed live* — the Skill's categorizedAs [divinity] (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **DC.div.attr** · …and she is Divine to a predicate on the Attribute · *Observed live* — board attributes include divine (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JA.when** · *(P3)* Whenever Sita uses a Skill, the 'Janaka' buff on herself (Q) · *Pressed* — Jewel of the Earth, Curse of Separation and Pilgrimage, each used from Player1's bar: a Janaka each (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JA.notskill** · …a Noble Phantasm or a Normal Attack is no Skill: no Janaka (Q) · *Pressed* — after Haradhanu Janaka and after a Normal Attack, no Janaka on her (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JA.dur** · …for 1◈ Turns · *Observed live* — a Janaka from tick 16 expires at 19 (1◈); gone after it (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JA.buff** · Janaka is a buff: buff removal takes it, an effect that prevents buffs refuses it · *Observed live* — Janaka's polarity: buff (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JA.stack** · Each use adds a Janaka: she holds several at once (Q) · *Pressed* — three Janaka held at once after the three Skills (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JA.reset** · Whenever a Janaka is applied, every Janaka on her has its duration reset (Q) · *Pressed* — a Janaka staged at expiry 18, then Curse of Separation: both at 19, the card "Janaka (1 other Janaka held start their duration again)" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JA.na** · Her Normal Attack uses BA(STR) and 20% of BA(MAG) combined (75+40=115) (Q) · *Pressed* — one Janaka, a Normal Attack on Medea: base:str 75 + base:mag 80 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JA.na.per** · …the share of BA(MAG) +20% for each Janaka on her (Q) · *Pressed* — three Janaka, a Normal Attack on Cú: base:mag 160 (80%) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JA.na.none** · …with no Janaka, BA(STR) alone · *Pressed* — no Janaka, a Normal Attack on a Master: base:str 75 alone (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JA.na.only** · …her Normal Attack only: her NP and her Skills are unchanged · *Pressed* — Haradhanu Janaka with Janaka held: base:mag 200 alone, no share (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JA.mr** · The effect of Magic Resistance is reduced to X% (Q) · *Pressed* — three Janaka on Cú (MR C): "−24% MAG (MR C < attack A) × 0.8 (this attack)" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JA.mr.x** · …X% = the share of BA(MAG) used (Q) · *Pressed* — that × 0.8 is the share of BA(MAG) used, 80% (War At2JWRQAbMeTxd4Z, 2026-10-28)

## Jewel of the Earth — Rank A *(Active)*

- [x] **JE.when** · Used during her Turn · *Pressed* — from Player1's bar on her Turn (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JE.area** · Affects all allied Units within a 2 panel area of herself · *Pressed* — Rama (1), EMIYA (2) and Rama's Master (2) took both (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JE.self** · …herself included · *Pressed* — Def Up and Debuff Immune on Sita herself (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JE.enemy** · …no enemy Unit (*"allied"*) · *Pressed* — Medea, an enemy at 2, took neither (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JE.defup** · Def Up for 1◈: all damage taken −20% · *Pressed* — Medea's Aero on her: "combinedPercent: defUp −20" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JE.defup.np** · …if NP, −10% · *Observed live* — the Def Up instance magnitude 20, npMagnitude 10 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JE.di** · Debuff Immune for 1◈ · *Pressed* — Debuff Immune for 1◈ on each, expiry 19 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JE.di.two** · …2 times (Q) · *Pressed* — ×2; her Decoy's die missed (84 vs 55%): still ×2; Aero's sure Bleed: "Bleed (Debuff Immune (1 left))", ×1 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JE.di.except** · …does not affect Instakill, Death and Erase · *Observed live* — debuffImmune's Immunity except [instakill, death, erase] (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **JE.cd** · Cooldown 4◈ · *Observed live* — the bar "Jewel of the Earth — Cooldown 4◈ (12 turns)" (War At2JWRQAbMeTxd4Z, 2026-10-28)

## Pilgrimage in Agni Pariksha — Rank B *(Active)*

- [x] **PA.when** · Used during her Turn · *Pressed* — from Player1's bar on her Turn (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **PA.decoy** · Decoy on herself for ⅔◈ (Q) · *Pressed* — the card "Decoy — rolled 84 vs 55%": her own Decoy meets her 45% (ruling 5) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **PA.invuln** · Invuln on herself for 1◈ · *Pressed* — Aero and Ansuz on her: "Negated by Invuln" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **PA.invuln.three** · …3 times · *Pressed* — Invuln ×3, then ×2 after Aero, ×1 after Ansuz (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **PA.burn** · Burn Immune on herself for 1◈ · *Pressed* — Ansuz's Burn on her: "Burn (Burn Immune)", her Debuff Immune unspent (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **PA.order** · The three in the sheet's order: Decoy, Invuln, Burn Immune · *Observed live* — the card: Decoy's die first, then the rows Invuln, Burn Immune (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **PA.cd** · Cooldown 4◈ · *Observed live* — her sheet ten Turns after use: Cooldown ⅔◈ (2 turns), 4◈ in all (War At2JWRQAbMeTxd4Z, 2026-10-28)

## Curse of Separation — Rank EX *(Active)*

- [x] **CO.when** · Used during her Turn · *Pressed* — from Player1's bar on her Turn (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **CO.guts** · Guts for 1◈: when defeated she is revived · *Pressed* — a Master's lethal hit at 10 Health: "Archer is defeated and revived by Guts, with 100 Health" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **CO.guts.flat** · …with 100 Health, not a percent · *Pressed* — 100, not a percent, under Heal Up too (ruling 7) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **CO.heal** · Restores her Health by 25% of its maximum · *Pressed* — "Health 500 → 750 (+250)" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **CO.regen** · Regen on herself for 1◈: 5% of her maximum Health · *Pressed* — Regen 5 on her for 1◈; "Archer regains 50 Health (Regen)" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **CO.regen.turn** · …at the end of her Turn · *Pressed* — at the end of her Turn, +50 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **CO.regen.acted** · …at the end of a Turn she Acts, once at one Turn's end · *Pressed* — her own Turn, which she Acted in: one heal, not two (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **CO.regen.round** · …at the end of the Round · *Pressed* — "End of the Round Archer regains 50 Health (Regen)" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **CO.cd** · Cooldown 4◈ · *Observed live* — her sheet after use: Cooldown 2⅔◈ (8 turns) four Turns on, 4◈ in all (War At2JWRQAbMeTxd4Z, 2026-10-28)

## Haradhanu Janaka: Peerless Bow of Reminiscence — Rank B *(NP)* [Anti-Unit]

- [x] **NP.rank** · Rank B, Anti-Unit · *Observed live* — the card "(B)"; npTags [antiUnit] (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **NP.range** · Range 7 · *Observed live* — the NP's anchor targetUnit, range 7 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **NP.target** · One Unit · *Pressed* — one target in its session, "1 target(s)" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **NP.delivery** · No tag printed: Ranged at a distance of 2 or more, Melee next to her · *Pressed* — the card "Ranged" at a distance of 2 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **NP.mag** · Base Attack (MAG) is used · *Pressed* — breakdown base:mag 200 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **NP.cleanse** · First, removes all debuffs from Sita (Q) · *Pressed* — "Burn removed", "Atk Dwn removed" before the hit, at the reaction step (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **NP.cleanse.unremovable** · …an Unremovable debuff stays · *Pressed* — a staged Unremovable Curse stayed; the card "Curse stays: it is Unremovable" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **NP.dmg** · …then deals 3.5x damage · *Pressed* — breakdown abilityMultiplier 3.5 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **NP.healup** · Next, Heal Up on Sita for 1◈ (Q) · *Pressed* — Heal Up 50 on her after the hit, and after an Evade (ruling 8): the card "Heal Up" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **NP.healup.50** · …the amount of Health restored to her +50% · *Pressed* — Curse of Separation under it: "Health 600 → 975 (+375)", a 250 heal raised by half (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **NP.healup.reach** · …her Curse of Separation's heal and her Regen included · *Pressed* — her Regen under it: "Archer regains 75 Health (Regen)" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **NP.healup.guts** · …her Guts's 100 Health (Q) · *Pressed* — Guts under it revived her with 100, not 150 (ruling 7) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **NP.cd** · Cooldown 6◈ · *Observed live* — her sheet: Cooldown 6◈ (18 turns) after use (War At2JWRQAbMeTxd4Z, 2026-10-28)
