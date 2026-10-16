# Arturia — the build plan

**2026-10-16.** Builds the 119 Clauses of `docs/superpowers/specs/2026-10-16-arturia-clauses.md` under
its 25 rulings, then presses every one live. Worktree `../wt-arturia`, branch `claude/arturia-audit`,
from `b4464ed`. Built by me, one piece at a time, no agents.

**The rule for every piece:** reuse the generic path another sheet already uses; where it falls
short, extend it generically so the next sheet with the same words gets it for free. Each extension
lands with its test (subjects through `test/helpers/subject.mjs`), its survival route, its doc
chapter, and a mutation check.

## 0. Set-up

1. Commit her sheet (`char_orig_sheets/Copia de Arturia.md`) with the Clause spec.
2. `tools/lib/clause-names.json`: `IA.pre → IA.lock`, `AV.pre → AV.gate`. `clauses.test.mjs` keeps her
   in scope.
3. Open the audit issue under #112 from the spec. Appendix D gets §D.33d *Arturia*.

## 1. Reused as they stand (content only)

| Piece | Reuses |
|---|---|
| `servants/arturia.yml`: Saber, attributes (`female`, `earth`, `saberface`, `dragon`, `king`, `humanoid`, `roundTable`), tables for Health and Base Attack (125/200) | every Servant file |
| Magic Resistance A (`MR.1`, `MR.2.*`) | `class-magic-resistance` |
| Riding B (`RI.*`) | `class-riding-unlocks` `{rank: B, cooldown: 2◈, mov: 4}` (Karna, Raikou) |
| Charisma B (`CH.*`) | Penthesilea's passive aura, `relations: [ally]`, negated by `atkUpCharisma` and `skillSeal` |
| Knight of Utopia 1–2 | attribute-filtered ally phases (Tommy Thumb), `categorizedAs: [charisma]` (Ozymandias) |
| Radiant Road 1–2, DRC 1–2 | `cooldown` phase (Tommy Thumb), `sCritUp` aura (Quetzalcoatl), `atkUp`, `npDmUp` |
| Mana Burst (`MB.ba`, `MB.mr`, `MB.excl`) | Karna's Mana Burst: two-source base, `ignoresMagicResistance`, `sameTurnExclusive` both ways with DRC |
| Strike Air | Nemo's Barrel Bombing: `fixedValue: 300`, `bypassModifiers: {attacker: true}`, `element: wind`, Range 3 |
| Excalibur's damage | Ozymandias' Mesektet: MAG ×4 +200, Light, Dark ×2 in the bracket; `blind` 40%; `antiFortress` |
| Invisible Air's Evade penalty (`IA.1`) | `CheckModifier {check: evade, direction: imposed}` with `target:paramVsSelf:agility:gt` (Jack) |

## 2. Generic extensions

| # | Extension | Her Clauses | Next users |
|---|---|---|---|
| E1 | `attack:tag:<tag>` option from an Attack's tags; a `Resistance` whose attack predicate **replaces** the base threshold instead of the stronger one winning | `MR.3.*` | any Anti-X Attack |
| E2 | Terrain penalty immunity: a grant naming a terrain whose negative entries drop, benefits kept | `VB.1` | any *"no negative effects from"* terrain |
| E3 | Passive `AutoSucceed` evade with a chance and an NP chance, negated by Skill Seal, no uses | `IN.1.*` | every Instinct |
| E4 | An aura that lends an ability's passive rules to allies, gated on the lender's Skill Seal; one roll when the ally has its own | `RR.3.*` | any *"gain the effects of her Skill"* |
| E5 | Modes: `startsActive` at summon, a once-per-Turn toggle on any Turn, and a phase that suspends a named mode for N | `IA.lock`, `IA.start`, `SA.ia`, `EX.ia`, `EX.gate` | any toggled NP |
| E6 | A magnitude scale read live, not stamped, so leaving the mode un-halves | `IA.2.*` | Raikou, Penthesilea, Mannanán, Achilles halvings |
| E7 | Use on Cooldown: within the Master's ZON, the Master pays N Health, the clock untouched; an Evade modifier lasting the Combat Phase | `MB.oncd.*`, `MB.evade` | any *"can be used while on Cooldown"* |
| E8 | `attack:source:<contentId>`: which ability made the Attack | `DRC.3.mb`, `EX.p` | any *"performed with"* exclusion |
| E9 | A counting buff: counts Attack declarations, then charges the next Normal Attack, which may be a whole ride | `KU.3.*` | any *"after N Attacks"* |
| E10 | `@unitsHit` on the Attack's end, read by a cooldown change | `KU.4`, `EX.cut` | any *"per Unit hit"* |
| E11 | Apply at the end of this Turn, lasting the rest of the Round | `DRC.3` | any deferred buff |
| E12 | A `chance` on `FlatDamage`, rolled once per strike | `EX.p.*` | any chance rider |
| E13 | The 6-wide rectangle's two placements beside her | `EX.area` | any even-sided area |

## 3. Avalon

| # | Piece | Clauses |
|---|---|---|
| A1 | A summon line that rolls a die and grants an Item on a result, at war setup and summon, with the GM re-roll | `AV.gate` |
| A2 | The `[Avalon]` Item: cannot be Stolen or dropped, gone with her if she falls holding it | `AV.keep`, reading 22 |
| A3 | Method 1, a reaction NP for her and allies next to her: from Round 9, no Master Health cost, negates the Attack (`antiPurge`), a 3x3 around her against an AoE | `AV.1.*` |
| A4 | Method 2 and the pass: adjacent, both in their Home Base, before either Attacks; after, neither Attacks nor Moves | `AV.2.*`, `AV.pass` |
| A5 | Inside a Master: Max Health, Max Luck, Base Attack; the heal at a Turn's end and after a damaging Damage Step (a defender-side event); her distance; surviving at 1; immune to Death and Erase; no Overpower; the values after her defeat and in another Master | `AV.a` to `AV.other` |
| A6 | The Master's Avalon: a reaction for a Master, damage −X%, the Master picks up to Y debuffs to negate, its Attack spent on its own Turn only | `AVM.*` |

**Unverified until built:** whether a Master can hold an Item and use a reaction at all. If not, A6
adds both, generically, for any Master Item.

## 4. Gates

`npm test`, `npm run lint`, `npm run validate:content`, `npm run check:templates`, all green, each failure's
cause named. Docs: the rule chapters each extension touches, Ch. 46 §46.33, Appendix D §D.33d.

## 5. Live press

Foundry closed, `npm run build` in the worktree, the system junction to `wt-arturia`, a fresh scene by
the wizard (the War tab's scene checked). Every Clause pressed as Player1 or Observed with its
differential, logged to the press file, each defect a Surprise and a fix. The issue filled, #112's
line updated, the junction back to the main checkout after the merge.
