# Counter as a Full Attack — Design

**Status:** approved for planning
**Chapters touched:** 12 §12.8, 18, 21 §21.9, 29 §29.5, 45
**Sub-project 1 of 3.** The pending-decisions window and the combat lock are separate
specs; this one neither needs nor blocks them.

---

## 1. The problem

Choosing **Counter** today produces exactly one thing: a single-target Normal Attack,
built by `runCounter` in `module/engine/attack.mjs` and immediately advanced past its
own `declare` rung.

That is not what a Counter is. The rulebook says the DU *"may use the 'Counter' Action
and **declare an Attack** on the AU"* — an Attack, not *the* Normal Attack. A Servant
holding a Noble Phantasm or an attack-shaped Skill may answer with it, and that is the
whole tactical point of the rung: countering is the one moment you may attack when it
is not your turn.

The machinery is half-built already, in the shape this project keeps turning up:

```js
export function beginCounter(s, attack = { abilityId: null, kind: "normal" }) {
```

`beginCounter` has taken the attack as a parameter since it was written. **No caller
has ever passed one.** The default is the entire feature.

---

## 2. What a Counter becomes

A Counter is an ordinary attack declaration with three differences:

| | Normal declaration | Counter |
|---|---|---|
| Turn budget | spent | **not spent** |
| Ability's own cost | paid | **paid** |
| Whose turn | yours | anyone's |
| Target freedom | the ability's shape | the ability's shape, **plus the attacker must be caught** |
| Can be countered | yes | governed by §4 |

Everything else — targeting, the reaction ladder, damage, injury, caster phases,
events — is the same code path, and §6 says how that is enforced rather than copied.

---

## 3. Which abilities qualify

`module/rules/counter.mjs` (layer 2, pure, no Foundry globals):

```js
counterAttacks(unit) -> Array<{ id, name, img, isNP }>
```

An ability qualifies when `classifyAbility(item).isAttack` is true. That predicate
already excludes passives, modes and dialog abilities, and already includes every
Noble Phantasm — including the non-damaging ones, which still cost the Servant's
attack. Reusing it means "what is an Attack" has exactly one definition in the system.

The **Normal Attack** is always offered, first, and costs nothing.

Eligibility to *use* the chosen ability is `canUseAbility` — the same call
`resolveAttack` makes. An ability the counterer cannot pay for is offered **disabled
with its reason**, never hidden: a player deciding whether to counter needs to know the
Noble Phantasm exists and why it is unavailable.

---

## 4. The chain rule

The safety property. Written as one predicate, in `rules/counter.mjs`:

```js
mayCounterAgain(process, defenderId, mode) {
  if (!process.isCounter) return true;                        // normal §12.8 rules
  if (defenderId === process.requiredTargetId) return false;  // Rule 1 — always
  return mode === "collateral";                               // the setting
}
```

**Rule 1, true in both modes:** the unit a Counter was aimed at may never counter it
back. A attacks B; B counters A; A cannot counter B's counter. Without this, two
Servants in range of each other counter one another until one of them dies.

**The setting**, `fgt.counterChain`:

- **`collateral`** *(default)* — a bystander caught in a Counter that was not aimed at
  them keeps their own right to counter. C is hit by B's area Counter aimed at A; C may
  counter B. C's counter is itself a Counter aimed at B, so Rule 1 stops B from
  answering it.
- **`strict`** — nobody caught in a Counter may counter, aimed at or not.

### Why this terminates

Not by structure — by cost. Extending the chain requires catching a *bystander*, which
requires an **area** ability, and §2 says an ability pays its own price. Every hop burns
Sustainability, a use, or a cooldown. A Normal Attack cannot catch a bystander, so the
free option cannot extend the chain at all.

That argument is good but it is not a proof, and a free area ability would break it. So
the Process also carries `counterDepth`, incremented by `beginCounter`, and
`canCounter` refuses beyond `MAX_COUNTER_DEPTH = 8`. A constant, not a setting: it is a
backstop against a content bug, and a group that reaches depth 8 legitimately has found
something worth reading about rather than configuring.

### New Process fields

| Field | Meaning |
|---|---|
| `requiredTargetId` | the unit that had to be in the target list; `null` outside a Counter |
| `counterDepth` | 0 for a declaration, +1 per Counter |

`requiredTargetId` has to be written down now. Today a Counter has exactly one defender
so "who was this aimed at" is implicit in `defenderId`; with an area Counter it is not.

`canCounter` currently opens with `if (s.isCounter) return false;`. It becomes a call to
`mayCounterAgain` plus the depth check, with `mode` passed in the args object — the file
is pure and takes every derived fact as an argument, and the setting is read by
`engine/attack.mjs#counterAvailable` alongside the board facts it already derives.

---

## 5. The required target

A Counter's placement is refused unless the original attacker is among the **resolved**
units. Not "unless it is the anchor" — an area may be centred anywhere as long as it
catches them.

```js
legalCounterPlacement(resolved, requiredUnitId) -> { ok, reason }
```

The target spec gains an optional `requireUnitId`, checked by
`rules/targeting/resolve.mjs#validate` alongside every other legality clause. Data, not
a callback: it is testable without a canvas, and it means the refusal is **drawn while
the player is still aiming** — the illegal tint with a reason, exactly as §28.8 already
does for range and leash — rather than rejected after they commit.

### Range is checked twice, on purpose

`counterAvailable` decides whether the rung is offered at all, using the **unit's** range
(`defender.range`) as §12.8 specifies. An individual Noble Phantasm may reach further or
less far than that, so the chosen ability's own reach is enforced a second time by
targeting. The two are not redundant: the first answers *"may this unit counter?"*, a
rulebook question about the unit, and the second answers *"can this attack land there?"*,
a question about the ability. It follows that the rung can be offered while every
individual ability still refuses — a Servant in range with nothing that reaches. That is
correct, and the player reads the reason on each greyed slot rather than being told the
Counter is simply unavailable.

Friendly fire is legal, as it is on your own turn. A Counter is an attack; catching an
ally in it is a decision, not an error.

**Out of scope, and a known gap:** §12.8's *Master redirect* — countering a Master whose
Servant is within 2 panels redirects the Counter to the Servant — is specified in the
chapter and implemented nowhere. It bears directly on this feature, because it changes
*which* unit is the required target. It is deliberately not smuggled in here.

---

## 6. One declaration path, not two

`resolveAttack` already does: resolve targets → fan out one Process per defender →
record each defender's reaction offer and concealment refusals → render a card → set
flags → fire `attackDeclared` and `attacked` → run caster phases → fire `abilityUsed`.

A Counter needs every one of those. If `runCounter` grows its own copy, the copy is the
one nobody updates — and this file has been bitten by exactly that before (`resolveAttack`
kept no use record; an attack's rider phases ignored `target`).

So the shared body is **extracted** into:

```js
declareProcesses({ attackerId, ability, placement, spendsBudget,
                   isCounter, requiredTargetId, counterDepth })
```

`resolveAttack` calls it with `spendsBudget: true` and the counter fields null.
`runCounter` calls it with `spendsBudget: false`, `isCounter: true`, and the required
target. The budget spend stays in `resolveAttack`, above the extraction, so a Counter
does not merely skip it — the call is not on that path at all, which is the property
worth preserving rather than re-deciding.

This is a targeted extraction inside a 3,500-line file, not a restructuring of it.

---

## 7. The interaction

On reaching the `counter` rung, on the client that owns the countering unit:

1. **Select the token and open its bar.** `canvas.tokens.get(...).control()`, then
   `ActionBar.armForCounter({ token, messageId, requiredTargetId })`.
2. **Glow what can answer.** Qualifying slots get `fgt-slot--counter` — a soft outer
   glow — and a hover hint, *"Available as a Counter"*. Every other slot dims and
   refuses with *"Not an Attack"*.
3. **Pick one.** The ordinary targeting session opens, with `requireUnitId` set, so an
   area that misses the attacker refuses under the cursor with the reason.
4. **Confirm.** `FGTSocket.request("declareCounter", { messageId, abilityId, placement })`.

The card keeps a **Decline** button and a **Counter** button that only re-arms the bar,
for a player who closed it. Cancelling targeting returns to the armed state; declining
is always explicit. §27.5's timeout default remains Decline, which spends nothing.

The bar disarms when the parent Process leaves the `counter` rung, when the player
declines, or when the token is deselected — whichever happens first.

### Authority

New socket operation `declareCounter`, authorized like `advanceProcess`: the caller must
own the responding unit, **and** the parent Process must actually be on its `counter`
rung. The second half matters — without it any owner could declare a free attack at any
time by posting the operation directly.

Execution on the GM: `runCounter(parentState, { abilityId, placement })`, then advance
the parent with `counter` and the new message id, as today.

---

## 8. Files

**New**
- `module/rules/counter.mjs` — `counterAttacks`, `mayCounterAgain`,
  `legalCounterPlacement`, `MAX_COUNTER_DEPTH`
- `test/unit/counter.test.mjs`

**Changed**
- `module/engine/combat-process.mjs` — `beginCounter` honours the attack and its area;
  `requiredTargetId` and `counterDepth`; `canCounter` calls `mayCounterAgain`
- `module/engine/attack.mjs` — extract `declareProcesses`; `runCounter` takes the choice;
  `counterAvailable` reads the setting
- `module/rules/targeting/resolve.mjs` — `requireUnitId`
- `module/apps/hud/action-bar.mjs`, `module/apps/hud/present.mjs` — counter mode
- `module/apps/chat/cards.mjs` — arm on the rung, disarm off it
- `module/net/operations.mjs` — `declareCounter`
- `module/settings.mjs`, `lang/en.json`, `templates/chat/attack.hbs`,
  `templates/hud/action-bar.hbs`, `styles/src/_apps.scss`
- `docs/12-combat-process.md` §12.8, `docs/18-action-economy.md`,
  `docs/21-system-skeleton.md`, `docs/29-user-interface.md` §29.5,
  `docs/45-implementation-status.md`, `CHANGELOG.md`

---

## 9. Testing

**Pure** — `counterAttacks` filtering; `mayCounterAgain` across both modes and both
roles; `legalCounterPlacement`; the depth cap.

**Process** — an area Counter fans out with one shared `groupId`; every Process in that
fan-out carries `isCounter` and the same `requiredTargetId`; a bystander's ladder offers
Block and Evade in both modes and offers Counter only in `collateral`.

**Drift** — `requiredTargetId` is set on every Process `beginCounter` produces. This is
the invariant that survives review and dies to a refactor, so it gets a test rather than
a comment.

**Live, per task, two clients plus a GM** — one Chrome, `isolatedContext` per session.
The end-to-end check: Player1 attacks Player2, Player2 counters with a Noble Phantasm
that catches a third unit, the third unit counters back in `collateral` mode and cannot
in `strict`, and Player2 is refused a counter on the counter in both.

---

## 10. Decisions

| # | Decision |
|---|---|
| D1 | A Counter is any ability `classifyAbility` calls an Attack. The Normal Attack is always offered. |
| D2 | The ability pays its own cost; no turn budget is spent. |
| D3 | An area Counter fans out normally; the original attacker must be among the resolved units. |
| D4 | Rule 1 is absolute: the unit a Counter was aimed at never counters it back. |
| D5 | `fgt.counterChain` defaults to `collateral`; `strict` forbids every counter-of-a-counter. |
| D6 | The chain terminates on resources; `MAX_COUNTER_DEPTH = 8` is a backstop, not a rule. |
| D7 | Automatic counters (Auto/Dodge/Guard, Fragarach) keep firing a fixed attack with no prompt. |
| D8 | The choice is made on the token's action bar, armed automatically, not on the card. |
| D9 | `resolveAttack`'s declaration body is extracted and shared rather than copied. |
| D10 | The Master redirect stays unimplemented and is recorded as a known gap. |
