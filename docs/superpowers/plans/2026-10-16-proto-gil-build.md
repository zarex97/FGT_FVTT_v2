# Proto Gil — the build plan

**2026-10-16.** Builds the 103 Clauses of `docs/superpowers/specs/2026-10-16-proto-gil-clauses.md` (issue
#232) under its 22 rulings, then presses every one live. Worktree `../wt-protogil`, branch
`claude/protogil-audit`, from `d490972`. Built by me, one piece at a time, no agents.

**The rule for every piece:** reuse the generic path another sheet already uses; where it falls
short, extend it generically so the next sheet with the same words gets it for free. Each extension
lands with its test (subjects through `test/helpers/subject.mjs`), its survival route, its doc
chapter, and a mutation check.

## 0. Set-up

1. Commit his sheet as edited 2026-10-16 (`char_orig_sheets/Copia de Proto Gil.md`) with the Clause spec.
2. Appendix D §D.30 rewritten for the edited sheet (Magic Resistance by table, not `3d20`; Charisma 25/10).

## 1. Reused as they stand (content only)

| Piece | Reuses |
|---|---|
| `servants/proto-gil.yml`: Archer, `mov: 5` (Levitation adds 1), `sustainability: null`, `region: [mesopotamia, middleEast]`, attributes `male, servant, sky, king, humanoid` (`divine` from Divinity) | Ozymandias, Anastasia, Semiramis |
| Magic Resistance C (`MR.*`) | `class-magic-resistance {rank: C}` |
| Independent Action A+ (`IA.*`) | a `class-independent-action` variant with Viy's passives 1–3, slug `independentAction` (contract immunity reads the slug) |
| Charisma (`CH.*`) | Penthesilea's passive aura (27) and Active `atkUpCharisma` 25/10, `cooldown: "4◈-⅓◈"` |
| Golden Rule's Crit cut (`GR.p`) | Drake's `OnEvent damageDealt attack:crit` → `CooldownDelta {scope: np, delta: -1}` |
| Golden Rule's Active (`GR.a`) | `npRegen` magnitude 2 (reading 17) |
| Treasury of Babylon (`TB.*`) | Arturia's Radiant Road: `cooldown` phase −1◈, then `critUp` 60 |
| Levitation MOV +1, `levitating`, NP Seal (`LE.1`, `LE.4`, `LE.seal`) | `StatDelta mov`, `StatDelta attributes`, `negatedBy: [npSeal]` |
| Levitation's rolls (`LE.3`) | two `CheckModifier`s, `agility` and `evade`, −3 (reading 15) |
| Bab-ilu's Active area, cost, rank (`BI.ba`, `BI.area`, `BI.dmg`, `BI.cost`) | Nursery Rhyme's 3x3 within Range; EMIYA's `rank: null` and `masterHealthByNPRank E` |
| Bab-ilu's existing debuffs (13 of 20) | `atkDwn`, `defDwn`, `critDwn`, `critDmDwn`, `npDmDwn`, `debuffResDwn`, `debuffChDwn`, `noBuff`, `npSeal`, `skillSeal`, `npDegen`, `terror`, `decoy` |
| Enkidu's damage ladder (`EC.EX`…`EC.E`, `EC.divine`) | Karna's Vasavi Shakti `conditionalMultipliers` on `target:skillRank:divinity` |
| Enkidu's Stun ladder | Medea's Atlas `chanceModifiers` |
| Enki's cost, gate, single use (`EK.cost`, `EK.gate`, `EK.once`) | Ozymandias: `masterHealthFractionOfMax 0.5 supersedes npCost`, `masterHealthFraction above 0.5`, `maxUses: 1 expendsPermanently` |
| Enki's Waterside (`EK.waterside`) | Pyramid Drop's `zone` phase, `shape: reuse` |

## 2. Generic extensions

| # | Extension | His Clauses | Next users |
|---|---|---|---|
| G1 | A Fixed flag on `FlatDamage`: added after the Injury snapshot beside Def Crk, no modifier touches it, an element label | `DI.fixed`, `DI.injury` | any *"Fixed … Damage"* bonus |
| G2 | Passing through Units and blocking terrain on a Move, stopping on neither, the enemy Master's area still closed | `LE.2.*` | any *"Move through obstacles"* |
| G3 | A follow-up Normal Attack: a queue beside the auto-counter one, drained in the same Combat Phase, an optional adjacent-panel pick, never re-triggering | `BI.p`, `BI.p.atk` | any *"perform an additional Attack"* |
| G4 | A forced Block read from the sibling Process (Toole Fragarach's reader): no Evade, no taking the hit; reaction NPs and Counters kept | `BI.p.block`, `BI.p.evade` | any *"has to Block"* |
| G5 | `rollTable` on the attack path, once per defender, and a per-application `extend` stacking for the non-stacking rows | `BI.roll`, `BI.same.*` | any NP with a die table |
| G6 | Seven debuffs from Appendix A: Buff ChDwn, AGL Dwn, LUC Dwn, MOV Dwn, TEC Dwn, Bal Dwn, Heal Dwn; a healing-received modifier and its reader on every heal path; No Buff with uses | `BI.8`, `BI.9`, `BI.12`…`BI.17` | every sheet naming them |
| G7 | An entry-level immunity bypass behind a predicate, passing id-specific immunity, resistance kept | `EC.immune`, `EC.resist` | any *"Debuff Immune cannot prevent"* |
| G8 | Drowning: heal block (G6's reader at 100%), −50 at Turn end, its own 80% failure with no Cooldown spent, MOV −1, Swimsuit −20% to inflict | `EK.drown` | every Water NP that names it |
| G9 | A status that stops all Acting, Evade and Block included | `EK.stop` | any *"cannot Act"* |
| G10 | A scheduled hit: a mark on a panel holding an absolute fire tick, a 13x13 anchored on it, run as his NP Attack when the tick comes, cancelled when he leaves the board, the use spent | `EK.mark`, `EK.delay`, `EK.area`, `EK.cancel` | the unbuilt `kind: schedule` (Blood Fort Andromeda) |
| G11 | Area exclusions: the caster's own Master, an attribute, a named content id and its allies within N | `EK.spare.*` | Medusa's *"excluding … her Master"* |
| G12 | A Crit cut with a fallback: when no NP is on Cooldown, the cut goes to the pending Enki's fire tick | `GR.p.enki` | any overflow target |

## 3. Gates

`npm test`, `npm run lint`, `npm run validate:content`, `npm run check:templates`, all green, each failure's
cause named. Docs: the rule chapters each extension touches, Ch. 46 §46.34, Appendix D §D.30.

## 4. Live press

Foundry closed, the packs built in the worktree, the system junction to `wt-protogil`, a fresh scene by
the wizard. Every Clause pressed as Player1 or Observed with its differential, logged to the press file,
each defect a Surprise and a fix. Noah's exception pressed with a stand-in. Issue #232 filled, #112's
line updated, the junction back to the main checkout after the merge.
