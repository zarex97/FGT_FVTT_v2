# Mannanán mac Lir — Design

**Source:** `char_orig_sheets/Copia de Mannanán mac Lir.md`
**Chapter:** `docs/33-case-mannanan.md`

She is the acceptance test for *reactive* mechanics: a counter that fires on being attacked
**or debuffed**, a Noble Phantasm that cancels an incoming Noble Phantasm, a token economy
with four producers and three consumers, and a mode entered on her own defeat.

---

## 1. Statline

```
Alter Ego · Ireland · Neutral Good
STR A  END B  AGI B  MAG EX  LUC D
Attributes: Female, Servant (Pseudo Servant), [Sky], King, Humanoid, Living Human
Base Health 1250 · MOV 6 · Range 1/1 · BA(STR) 150 · BA(MAG) 250 · Sustainability 2◈
Fragarach Tokens 5/5
```

`STR A → 150` and `MAG EX → 250` both derive from `domain/tables.mjs`, so the sheet and the
table agree and no warning is expected.

**Pseudo Servant.** Ch. 02 §2.10's implication table gives `Servant ⟹ Spirit` *unless*
Demi-Servant or Pseudo-Servant. The closure has never been implemented — no unit in the corpus
carries `spirit` — so `Pseudo Servant` meant nothing and `Living Human` had to be authored by
hand on every sheet that wanted it. §1 of this design builds the closure as a pure domain
function so the exemption is a rule rather than an authoring convention.

---

## 2. What the engine is missing

| Clause | Missing | Design |
|---|---|---|
| Alter Ego, ±50% vs Outsider / EOtD | A `direction: taken` predicate that names the **attacker** | `defer: true` on a rule element forces its predicate to travel to the pipeline, where `self:` is the attacker |
| Tradition Carrier P3 (`+5% crit damage per token`) | Arithmetic in an `@` expression | `resolveExpression` accepts `N * @path` and `@path * N` |
| Tradition Carrier P2 (spend 1 token for +30% crit) | A passive that *offers* a spend at a timing window | `OptionalCost` element + an offer at `combatPhaseStart` |
| Tradition Carrier P4 (buffs last ⅓◈ longer on her) | A modifier on the application pipeline | `DurationExtension` element, read at step 6 of `effect-applier` |
| Toole Fragarach (three hits, Evade +3, no Evade after a failure) | Per-attack evade modifiers and a cross-sibling evade lock | `damage.evadeModifier`, `damage.noEvadeAfterFail`, carried on the attack spec |
| Fragarach Counter (unblockable, Dodge-only) | Per-attack reaction restrictions | `damage.unblockable`, `damage.evadableOnlyBy`; the first removes Block from the rung, the second short-circuits `rules/checks.mjs#evade` |
| `Fragarach` status | A counter that fires on **two** events, automatically | `engine/fragarach.mjs`: one entry point called from `combatProcessEnd` and from the effect applier's write boundary |
| Fragarach (the NP) | Interrupting another Unit's Noble Phantasm | The pre-emption machinery, generalised: `whenTargetedByNP` is offered at declaration and **cancels** rather than defers |
| "strongest NP" | Cross-ability comparison | `rules/np-strength.mjs#expectedDamage` against a synthetic neutral defender, plus the one `Script` the chapter budgets for |
| Holder Mode | A mode entered on defeat that rewrites the Servant | `RevivalSource` gains `optional` and `enterMode`; the rewrite reuses `VariantOverride` |
| Holder Mode clause 5 | Ability replacement | `negatedWhile: {modeActive/modeInactive}` + the matching `requirements`, both already-declared vocabulary |
| Decoy on herself | Self/ally application bypassing resistance | `allySelfBypassesResistance` on the effect definition, read at steps 1 and 3 of the applier |

Everything above is general. Nothing keys on her id.

---

## 3. The Fragarach Token economy

One pool, `resources.fragarachTokens`, `{value: 5, max: 5}`.

**Producers** — `roundEnd` (+1, Tradition Carrier), the Fragarach Counter (+1), and
`actedTurnEnd` (+1, Holder Mode only).
**Consumers** — 1 for the Combat-Phase crit offer, 3 for *Toole Fragarach*, 5 for *Fragarach*.

The ceiling is the pool's own `max`, clamped by `io.adjustResource`. Holder Mode raises it by
writing `resources.fragarachTokens.max +2` **once**, at activation: the mode is permanent and
one-way, so a derived cap would be machinery for a state that never reverts.

Crit damage scales with what is *held* — `CritModifier aspect: damage, value: "5 * @self.system.resources.fragarachTokens.value"` — which is the tension the sheet is built around.

---

## 4. The `Fragarach` status

Applied by *Fragarach Enbarr* for ⅓◈; `unremovable`, polarity `status`.

1. **No normal Counter.** `canCounter` already refuses a defender holding `fragarach`.
2. **The automatic counter**, on being attacked *or* debuffed:
   - 2.5× BA(STR), `categorizedAsNP` (NP damage) but no NP-Seal scope,
   - `unblockable`, `evadableOnlyBy: [dodge]`,
   - then Def Dwn (C) 1◈ on the target, S.Crit Up ⅓◈ to allies within 2, her NP cooldown −⅓◈,
     +1 token.
3. Fires **once per provocation**. An attack that also lands a debuff pays one counter, not two:
   the debuff path is suppressed for the duration of a Combat Process the attack path will
   already answer.

It is authored as a hidden Attack Skill (`mannanan-fragarach-counter`) that the engine declares
on her behalf, because a counter is a full Combat Process (§12.8's ruling) and the alternative
is a second, weaker damage path that no reaction ladder reaches.

---

## 5. `Fragarach` — the NP-cancelling Noble Phantasm

Offered when a damaging, non-passive Noble Phantasm is declared against her, at exactly the
point `offerPreemption` is offered: after the attacker has paid, before any Combat Process
exists. Costs 5 tokens and 8◈.

- The incoming attack is **cancelled** — no damage, no effects, to anybody.
- If it was the user's strongest damaging NP (or their only one), the user is inflicted with
  `instakill`.
- Otherwise the user takes what that NP would have dealt: the pipeline is pure, so the
  counterfactual is the same call with the defender swapped.
- Effective at any Range, and `cannotBeRespondedTo` — there is no ladder at all.

`expectedDamage` runs the pipeline against a synthetic neutral defender with expected roll
values (`5d10 → 27.5`), taking the **best** branch of any conditional, so the ranking is stable
and identical on every client.

---

## 6. Holder Mode

`God's Holder: Possession` is a mode ability, usable when Health < 30% **or** she is defeated,
and while she holds ≥ 1 token.

- As a `RevivalSource` with `optional: true`, priority 250, restoring 50% of max.
- On entry: all tokens removed, `max` raised to 7, the mode switched on.
- While on: `RangeDelta +2` (1 → 3), `VariantOverride branch: holder` swaps in the range-banded
  normal attack (STR + 30% MAG at 1–2, ignoring Magic Resistance; MAG at 3+), an `actedTurnEnd`
  token gain, and the *Toole Fragarach* / *Hallowed Sea God's Sword* swap.
- No duration, no way back.

---

## 7. Effects to author

`fragarach` (status), `decoy`, `evade`, `defDwnC`, `atkUpMagus`. `atkUp`, `critUp`, `critDmUp`,
`sCritUp`, `debuffImmune` and `instakill` already exist.

`evade` is **not** `dodge`: the Fragarach Counter *"cannot be Evaded except with Dodge"*, so the
two have to be distinguishable, and `evadableOnlyBy: [dodge]` is what tells them apart.
