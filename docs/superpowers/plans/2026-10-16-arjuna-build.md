# Arjuna (#234) — the build plan

Worktree `../wt-arjuna`, branch `claude/arjuna-audit` from `623a3db`. 74 Clauses, 18 readings
(`docs/superpowers/specs/2026-10-16-arjuna-clauses.md`). Reuse first; every new piece is generic.

## A1 — Content from existing pieces

- `servants/arjuna.yml`: Archer, the statblock, `sustainability: "8◈"`, `region [india]`,
  `normalAttack { mode: fixed, component: str }`. Abilities: `class-independent-action` A,
  `class-magic-resistance` C, `divinity-fixed` B, and the seven below.
- `arjuna-fated-rivals`: Karna's `Compulsion` with `target:contentId:karna`, `within: range`,
  `attacksOnly`, `restrictsOnly`, `areaMustInclude`, `suspendWhileBound` (readings 2, 3).
- `arjuna-clairvoyance-bowman`: EMIYA's `TableOverride` at 90 (reading 14); Active: `critUp` 25 1◈,
  `debuffImmune` 1◈+⅔◈, new `rangeUpClairvoyance` (`stacking: noneRefresh`, reading 5); 4◈−⅓◈.
- `arjuna-awarded-hero`: `CooldownDelta np 1◈+⅓◈`, `regen` 15, new `areaCritUpAwarded`, `npRegen` 1.
- `arjuna-mana-burst-flames`: Karna's minus his passive; Burn 50% 2◈ on the hit, whole Fire.
- `arjuna-roar-of-the-flame-god`: Flash of the Sun God with `luck.value +3`; new `agni` effect.
- `arjuna-agni-gandiva`: Brahmastra's `aim` + Kundala's combined base, `requirements`,
  `alsoTriggers`, `sameTurnExclusive`; new `magicResistanceFactor: 0.5` (reading 10).
- `arjuna-pashupata`: 5x5 `withinRange` 4, every relation, `includeSelf: false` (reading 12); 4x +100;
  Death 30 with Enkidu's `chanceModifiers` on Karna's six grade rows +10 each (reading 11); `defDwn` 40.

## A2 — Generic engine pieces

| Piece | Where | Reading |
|---|---|---|
| The Range wall: a `withinRange` area keeps only panels in Range | `rules/targeting/resolve.mjs` after `expand`; preview, zone and field read the same `panels` | 13, 16–18 |
| `regen` reads `@magnitude`, default 10; `then` actions substitute `percentOfMax` | `effects/regen.yml`, `rules/snapshot.mjs#resolveRuleValues` | 6 |
| A granted element honours its predicate | `engine/attack.mjs#grantedElementIn` | 15 (Agni must not make Pashupata Fire) |
| `magicResistanceFactor` on a damage spec | `rules/damage/pipeline.mjs` stage 11 + the attack facts | 10 |
| `agni`: `count`, `uses: 3`, 1◈, `AttackProperty element: fire` + Burn 30% 1◈, both `not:attack:madeWith:arjuna-mana-burst-flames` | `effects/agni.yml` | 8, 15 |
| Area CritUp (Awarded): self 10, aura `[ally]` 5 | `effects/area-crit-up-awarded.yml` | 7 |

Each with a lang descriptor, the DataModel and `survival.test` route, `RULE_ELEMENT_KEYS` where new.

## A3 — Tests

- `test/unit/arjuna-234.test.mjs`: projection (statblock, MR, Divinity, the effects, Fated Rivals on
  both sides with Karna), the Range wall over the 22 `withinRange` abilities' shapes, Regen 5/10/15,
  MR halved, Agni not granting Fire to Pashupata.
- `test/unit/arjuna-234-arena.test.mjs`: Mana Burst + Agni consumption, Agni Gandiva cooling Mana
  Burst, Pashupata's Death ladder and self-sparing, Evade− at 90.
- Fix any existing assertion the wall or Regen overturns, naming why (Gogh's 5%).

## A4 — Docs

Ch. 10, 15, 20 (the wall), 22 (MR factor), 13 (Evade−), Appendix A (new effects), Appendix D (§D for
Arjuna; Karna's Fated Rivals no longer inert), Ch. 46 §46.35.

## A5 — Gates, then live

`npm test`, lint, `validate:content`, `check:templates`. Then live on `fgt2026`: the junction to
`wt-arjuna`, packs rebuilt with Foundry closed, a war with Arjuna (Player1) against Karna and others;
every Clause pressed or observed, logged to `press234.md`; Surprises recorded; #234 filled; #112 updated.
