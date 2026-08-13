# Appendix C — Dice Registry

Every named roll in F/GT, its formula, its modifiers, and its consumers. Entries are marked
**stated** (supplied by the game's author or given in the source) or **inferred** (derived from a
worked example or a sheet).

**As of `0.2.0` every formula is stated.** The registry remains a settings-backed data table
(Ch. 14 §14.4) so that any future gap is a settings change, never a code change.

---

## C.1 Combat rolls

| id | Formula | Source | Consumers |
|---|---|---|---|
| `attack+` | `5d10`, **added** | **stated** | Damage pipeline stage 3 (crit) |
| `attack-` | `5d10`, **subtracted** | **stated** | Damage pipeline stage 3 (non-crit) |
| `block` | **not a roll — flat 25%** | **stated** | Damage pipeline stage 14 |
| `evade` | `1d20` | **stated** | Combat step 2; compared against current Agility |
| `evade-` | `1d20+4` | **stated** | Combat step 2, unfavourable table |
| `luckCheck` | `1d20` | **stated** | All eight named Luck Checks |
| `luckCheck-` | `1d20` | **stated** | Identical to `luckCheck` — the variant carries no penalty |
| `injury` | `1d4` | **stated** | Combat step 4; reduces Agility |
| `damageModifier` | `5d10` | **stated** | ZON penalty (stage 9); Luck Check: Increased/Reduced Damage (stages 10, 13) |
| `coinFlip` | `1d2` | **stated** | Crit determination, Overpower, Underpower, Presence Concealment AoE, setup rolls, day/night start |

**Every formula is now supplied.** There are no placeholders left in the registry.

Three consequences worth restating:

**`attack+` and `attack−` are the same die pool; the sign is the difference.** A crit adds
`5d10`, a non-crit subtracts it. Crit *damage* percentages are stage-4 bucket entries gated on
`attack:crit`, not multipliers of this roll (Ch. 13 §13.3).

**`block` is not in the dice registry at all** any more. It is a constant, `BLOCK_BASE_PERCENT =
25`, and it is the same against Noble Phantasms. The entry is retained above only so that a
lookup of `"block"` fails loudly rather than silently returning a stale formula.

**`luckCheck-` is identical to `luckCheck`.** The favourable/unfavourable distinction therefore
has no mechanical effect for Luck Checks, which makes `Luck Boost` and `Luck Loss` inert. See
Ch. 14 §14.4 and Ch. 41 Q40.

### Evade roll modifiers

Applied per Ch. 14 §14.5. Positive deltas make the evade **harder** (success is rolling under).

| Source | Delta | Scope |
|---|---|---|
| Attack is an NP | +3 | evade |
| Attack is AoE | +2 | evade |
| Attacked from the left or right | +1 | evade |
| Attacked from behind | +2 | evade |
| AU has active Presence Concealment | +2 to +4 by rank | evade |
| `Slow` | +2 | evade |
| `Blind` | +3 (+2 with Clairvoyance) | evade |
| `Immobilize` | +4 | **all** Agility Checks |
| `Crystallize` | +1d6 | **all** Agility Checks |
| `Deafen(Y)` on the DU | +Y | evade |
| `Deafen(Y)` on the AU | −Y | evade |
| `TEC Up` / `Focus` on the AU | +X | evade |
| `TEC Dwn` / `Distracted` on the AU | −X | evade |
| `AGL Up` / `AGL Dwn` on the DU | −X / +X | all Agility Checks |
| `Toad` | −3 | evade |
| Penthesilea's *Goddess of War* | −1d4 | evade |
| Mannanán's *Toole Fragarach* / *Hallowed Sea God's Sword* | +3 | evade, that ability only |

### Luck Check modifiers

| Source | Delta |
|---|---|
| `LUC Up` / `LUC Dwn` | −X / +X |
| Kiritsugu's *Affection of the Holy Grail* aura | +4 to everyone within 2 panels **except himself** |
| Kiritsugu under `Skill Seal` | +20 to his own rolls |
| Scáthach's *Gate of Skye* | −2 if the target's MAG is **exactly** Rank B; −4 if **exactly** Rank A |

---

## C.2 Setup rolls

| id | Formula | Source | Use |
|---|---|---|---|
| `healthS` | **not used** | **stated** | Servant Max Health has no variance roll |
| `healthM` | Master Base Health **250**, ± the roll | **stated** | Master Max Health |
| `agilityM` | `4+1d8` | **stated** | Master Max Agility (range 5–12) |
| `luckM` | `8+1d12` | **stated** | Master Max Luck (range 9–20) |
| `agilityRankEX` | `20+1d4` | **stated** | Rank EX Agility |
| `luckRankAny` | `1d4` | **stated** | The `+X` in every Luck rank row |
| `agilityCoin` | `1d2` → 2 or 1 | **stated** | The `X` in Agility rank rows E–A |
| `turnOrder` | `1d100` | **stated** | Faction turn order, **re-rolled every Round** |
| `turnOrderTiebreak` | `1d100` | **stated** | Re-rolled among tied factions for the contested positions only |
| `servantPickCount` | `1d4` | **stated** | How many Servants each faction picks per class |
| `masterRankCoin` | `1d2` | **stated** | High/Low Rank when essences are not used |

**Masters are numerically fragile by design.** Base Health 250 against Servant base health of
500–2000; Max Agility 5–12 against a Servant's 11–24; Max Luck 9–20, which is actually
*competitive* with a Servant's. So a Master is roughly one Servant attack from death, has poor
evasion, and contests Luck Checks respectably — which is exactly the profile that makes
Overpower, `Master's Luck`, ZON and Master protection the load-bearing rules they are.

---

## C.3 Skill and NP rolls

All **stated** unless noted.

| id | Formula | Owner |
|---|---|---|
| `contractServant` | `1d6` | Contract rules (6 for Unbound, 5–6 for Free) |
| `territoryCreationAtk` | `6d20` / `5d20` / `5d10` / `5d8` / `5d6` / `5d4` by rank | Territory Creation |
| `territoryCreationDef` | `3d10 + {30,20,15,10,5,0}` by rank | Territory Creation |
| `battleContinuationDef` | `2d10 + {30,20,15,10,5,0}` by rank | Battle Continuation |
| `battleContinuationRevive` | `{6,5,4,3,2,1}d20` by rank | Battle Continuation |
| `godHandRevive` | `10d20` | Heracles |
| `primordialRune` | `2d8`, per-die table lookup | Scáthach |
| `hgobConstructionRound` | `1d4+2` | Semiramis |
| `hgobConstructionSummon` | `1d6 × 1d6` (**multiplied**, not summed) | Semiramis |
| `itemConstructionSemiramis` | `1d4` | Semiramis |
| `dragonWingWarriorsHits` | `1d6+4` | Hanging Gardens |
| `quickfire` | `6d6`, count dice ≥ threshold | Nemo |
| `penthesileaGoddess` | `1d4`, ×10% | Penthesilea |
| `shockAction` | `1d6`, fail on 3 or 4 | `Shock` |
| `knockbackCollision` | by END rank (Appendix B §B.4) | Knockback keyword |
| `boardHGoB` | `1d12`, success on 12 (modified) | Hanging Gardens |
| `boardHGoBLevitating` | `1d8`, success on 8 | Hanging Gardens |
| `boardGoldenHind` | `1d10`, success on 10 | Golden Hind |
| `enterStormBorder` | `1d20`, success on ≥18 | Nemo |
| `hgobFallDamage` | `10 × 2d6` | Hanging Gardens |
| `discover` | `1d100` or `1d10`/`1d20` vs the PC rank table | Presence Concealment |
| `struggle` | `1d100` vs 10% (+5% per failure; 20% base if STR ≥ B) | `Webbed` |
| `grailDestruction` | `1d100` vs `damage / 20` | The Holy Grail |
| `confusedAction` | `1d4` action class, `1d4` direction, uniform target | `Confuse` |

### `hgobConstructionSummon` — a note

*"roll 2 six-sided dice. HGoB Construction is increased by X, where X = the number of both
six-sided die multiplied together."* Standard dice notation cannot express a product, so this is
a registered helper (`multiplyDice`), not a formula string. Range 1–36, mean 12.25.

---

## C.4 Generic chance rolls

| id | Formula | Use |
|---|---|---|
| `d100` | `1d100`, success if **strictly under** the percentage | Effect application, crit chance, Overpower, Underpower, and every stated `X%` |

`< percent` rather than `≤` so 0% never succeeds and 100% always does, with no boundary
off-by-one (Ch. 14 §14.6).

---

## C.5 What the supplied values imply

All formulas are now authoritative. This section records what they mean for the game's shape,
because several were surprising and the implications matter for balance discussions.

**The crit swing is small in absolute terms but large after multiplication.** `Attack+` and
`Attack−` differ by `2 × 5d10`, a mean of 55 points. On a raw Base Attack of 150 that is a ±18%
swing *before* the stage-4 bucket — but the bucket multiplies it. A Servant at +190% turns a
44-point roll difference into a 128-point damage difference (Ch. 13 §13.5). Placing the roll at
stage 3, ahead of everything, is what makes a flat die pool behave like a scaling crit.

**Block is now the strongest single defensive action in the game.** A flat 25% off the finished
number, free, available every time you are attacked, undiminished against Noble Phantasms. Under
the old dice-based Block, blocking a 2,000-damage NP saved 55 points; it now saves 500. Expect
Block to be the default reaction for anything that cannot reliably Evade, and expect `Pierce`
and `Break` — which bypass it — to rise correspondingly in value.

**Evade is high-percentage but heavily taxed.** `1d20` against an Agility of 11–24 succeeds
55–95% of the time raw. But the modifier table (§C.1) routinely adds +3 to +9: an NP (+3) from
behind (+2) by a concealed attacker (+4) is +9, which turns a 20-Agility Servant's 95% into
roughly 50%. Agility attrition through Injury Rolls then compounds it. The system is designed so
that evasion is reliable against ordinary attacks and unreliable against prepared ones.

**Luck Checks are pure stat, with no positional or matchup component.** Because `luckCheck−` is
identical to `luckCheck`, there is no penalty for contesting a luckier opponent. A Luck 20
Servant (Drake, Kiritsugu, Semiramis, Quetzalcoatl) succeeds 95% of the time on every check
regardless of who they are contesting, until the per-check −1 grinds them down. That makes Luck
a *budget* far more than a *matchup*, and it makes high-Luck Servants disproportionately strong
in the reaction ladder.

**Masters die fast.** 250 base health ± a roll, against Servant base attacks of 50–250 before
multipliers. Two clean Servant hits, or one Overpower coin flip. Every Master-protection rule in
Chapter 16 exists to prevent that from being the whole game.

**Servant health is deterministic.** With `Health(S)` unused, two Servants of the same END rank
and steps have *identical* Max Health. Only Agility and Luck vary at setup. That makes matchups
far more predictable than the rulebook's text implies, and it removes an entire source of
pre-game variance.

---

## C.6 The registry API

```js
export class DiceRegistry {
  static get(id): DiceEntry;
  static roll(id, modifiers = [], options = {}): Promise<RollRecord>;
  static isPlaceholder(id): boolean;      // now always false — retained for future gaps
  static placeholders(): DiceEntry[];     // now always empty
  static override(id, formula): void;        // GM settings
  static export(): string;                   // shareable JSON
  static import(json): void;
}
```

Every roll in the system goes through `DiceRegistry.roll()`. Inline formula strings are
forbidden by lint, so no roll can escape the registry — which is what makes a global correction
a single settings edit.

No world currently shows the provisional-formulas banner, because there are no placeholders
left. The banner mechanism is retained: if a future content pack introduces a named roll without
a formula, the registry marks it `source: "placeholder"` and the banner returns.

---

**Next:** [D — Servant Data Sheets](D-servant-data-sheets.md)
