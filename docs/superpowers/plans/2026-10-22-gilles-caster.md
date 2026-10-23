# Gilles (Caster) Build Plan

**Goal:** build Gilles (Caster) to his 154 Clauses (#323) and press every one live.

**Spec:** `docs/superpowers/specs/2026-10-22-gilles-caster-clauses.md` (every reading ruled 2026-10-22).

**Branch:** `claude/gilles-caster`, main checkout, no worktree, no agents. Commit and push only when the user says.

## Global constraints

- Silent Drop steps for every new authored key (DataModel, `AUTHORED_*_KEYS`, survival route, ledger, subjects).
- Every outcome a player must know is a card line; every new refusal reason a lang string.
- Docs change with the code: Ch. 17, 21, 23, 24, 25, 30, 31, 46, Appendix A, `docs/model/*`.
- A Surprise is recorded the moment one happens.
- Each slice ends green: `npm test` (4 workers), `npm run lint`, `npm run validate:content`, `npm run check:templates`.

## Slices

| # | Slice | Clauses | Engine pieces |
|---|---|---|---|
| S1 | Content on the existing engine | SB, TC, IC, MP, BL, EG, PS.a, HO, EH | shared `mental-pollution` (Jack migrates); `dmgUpCurse`, `gazing` effects |
| S2 | Appreciation of the Arts | AA | `artistic` NP tag on 7 NPs; True Name learned per player, whispered card, Notebook journal (#297) |
| S3 | The Spellbook as a target | PS.aim to PS.lc.after, SB.attr | weak point of kind `object`: AGI-rank gate, the `bookResolve` rung, a destroyed mark |
| S4 | Substitution | PS.sub.* | a reaction that pays another ability's clock, Moves, summons round the old panel and rebinds the Process |
| S5 | The Spellbook destroyed | PS.d.* | Spells and Active locked, his Horrors removed without splitting, the 10% die |
| S6 | Gilles defeated | PS.f.*, GH.save | the 10% die replaces the defeat; X Elder Horrors that outlive him |
| S7 | The Gigantic Horror's form | GH.gate to GH.keep, GH.storm, GH.spells, GH.final | a mode entering a `summonVariant` branch whose overrides grow (Health, Agility, MOV, Base Attack, Attributes, Detect, no Sustainability, area Normal Attack); named skills off, unnamed gone |
| S8 | The Gigantic Horror's GM | GH.ctrl to GH.reset | a Unit the GM controls, on a side of its own, acting in the GM slot (#293); nearest-Unit compulsion; growing Range |
| S9 | Live presses | all 154 | world `fgt2026`, Player1 his side |

Ledger: `.superpowers/sdd/2026-10-22-gilles-caster/progress.md`.
