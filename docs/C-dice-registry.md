# Appendix C — Dice Registry

Every named roll in F/GT, its formula, its modifiers, and its consumers. Entries are marked
**stated** (given in the source), **inferred** (derived from a worked example or a sheet), or
**placeholder** (unknown — see Ch. 41 Q1).

The registry is a settings-backed data table (Ch. 14 §14.4). Correcting a placeholder is a
settings change, never a code change.

---

## C.1 Combat rolls

| id | Formula | Source | Consumers |
|---|---|---|---|
| `attack+` | **×1.5** | **placeholder** | Damage pipeline stage 3 (crit) |
| `attack-` | **×1.0** | **placeholder** | Damage pipeline stage 3 (non-crit) |
| `block` | **5d10** | **placeholder** | Damage pipeline stage 14 |
| `evade` | **1d20** | inferred | Combat step 2; compared against current Agility |
| `evade-` | **1d20+4** | **placeholder** | Combat step 2, unfavourable table |
| `luckCheck` | `1d20` | **stated** | All eight named Luck Checks |
| `luckCheck-` | **1d20+4** | **placeholder** | Luck Checks, unfavourable table |
| `injury` | **1d4** | **placeholder** | Combat step 4; reduces Agility |
| `damageModifier` | `5d10` | **stated** | ZON penalty (stage 9); Luck Check: Increased/Reduced Damage (stages 10, 13) |
| `coinFlip` | `1d2` | **stated** | Crit determination, Overpower, Underpower, Presence Concealment AoE, setup rolls, day/night start |

**`attack+` / `attack-` / `block` are the three highest-impact unknowns in the system.** They
scale every damage number. Ch. 41 Q1.

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
| `healthS` | **2d100** | **placeholder** | Servant Max Health variance (± by coin flip) |
| `healthM` | **1d100** | **placeholder** | Master Max Health variance |
| `agilityM` | **2d6** | **placeholder** | Master Max Agility |
| `luckM` | **1d10** | **placeholder** | Master Max Luck |
| `agilityRankEX` | `20+1d4` | **stated** | Rank EX Agility |
| `luckRankAny` | `1d4` | **stated** | The `+X` in every Luck rank row |
| `agilityCoin` | `1d2` → 2 or 1 | **stated** | The `X` in Agility rank rows E–A |
| `turnOrder` | `1d20` | inferred | Faction turn-order determination |
| `servantPickCount` | `1d4` | **stated** | How many Servants each faction picks per class |
| `masterRankCoin` | `1d2` | **stated** | High/Low Rank when essences are not used |

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

## C.5 Placeholder calibration notes

For whoever supplies the real values, here is the reasoning behind each placeholder, so a
correction can be sanity-checked against the design's assumptions.

**`attack+` / `attack-`.** The rulebook calls them *rolls*, not multipliers, so they are probably
dice expressions applied to Base Attack rather than flat multipliers. The Beginner difficulty
rule — *"just use Base Attack for damage calculation instead of Attack+/Attack−"* — implies both
are transformations *of* Base Attack, and that `attack-` is meaningfully above 1.0 (otherwise
Beginner would be identical to always rolling `attack-`). Our ×1.5 / ×1.0 placeholders are the
simplest assumption that preserves the crit/non-crit distinction.

**`block`.** Must be on the same scale as damage (hundreds), not on the scale of Agility (tens),
because it is subtracted from Total Damage. `5d10` (mean 27.5) matches `damageModifier`'s scale
and makes Block meaningful without being dominant. Doubled against NP by rule, so a mean of 55
against a 2,000-damage NP is a small but real mitigation — which feels right for an action that
costs nothing.

**`evade` / `evade-`.** Compared against current Agility, which ranges 10–24 at setup and
degrades with injuries. A `1d20` gives a base success rate of roughly 50–95% depending on
Agility, which is high — but Evade rolls accumulate large penalties (+3 NP, +2 AoE, +2 from
behind, +2 to +4 from Presence Concealment), so the effective rate against a serious attack is
much lower. The `+4` on `evade-` is a guess calibrated so that being the slower unit is a real
penalty without being decisive.

**`injury`.** Reduces Agility, which is 10–24. A `1d4` (mean 2.5) means roughly 5–8 significant
hits degrade a Servant from reliable evasion to unreliable — which matches the attrition arc the
game seems to intend. A `1d6` or `1d10` would make Agility collapse far too fast.

**`healthS`.** Applied to base health of 500–2000, so a `2d100` (mean 101, range 2–200) gives
roughly ±5–20% variance. Enough to matter, not enough to invert the END ranking.

**Master rolls.** No base values are given for Master Health at all, only *"Flip a Coin, then
Roll for Health(M)"* against an unstated base. We assume a base in the low hundreds; the
placeholder produces Masters who die to two or three Servant attacks, which matches their
described fragility and the existence of Overpower.

---

## C.6 The registry API

```js
export class DiceRegistry {
  static get(id): DiceEntry;
  static roll(id, modifiers = [], options = {}): Promise<RollRecord>;
  static isPlaceholder(id): boolean;
  static placeholders(): DiceEntry[];
  static override(id, formula): void;        // GM settings
  static export(): string;                   // shareable JSON
  static import(json): void;
}
```

Every roll in the system goes through `DiceRegistry.roll()`. Inline formula strings are
forbidden by lint, so no roll can escape the registry — which is what makes a global correction
a single settings edit.

A world with any placeholder in use shows a dismissible banner:

> **F/GT — provisional dice formulas in use.** 11 of 34 named rolls are using placeholder
> values, including `Attack+`, `Attack−` and `Block`. Damage numbers are provisional until the
> real formulas are supplied. `[ Open dice settings ]` `[ Dismiss ]`

---

**Next:** [D — Servant Data Sheets](D-servant-data-sheets.md)
