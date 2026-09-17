# 18 — Items and Equipment

## What it is

An **item** is an ability with a quantity: a discrete object a unit can hold in some number, pass to allies, consume, or pick up from the board (`module/rules/items.mjs:2`). The default is that **items cannot be passed between units unless stated**: *"Items cannot be traded/given/passed to other Units unless stated."* Only one item in the reference set declares itself transferable (`[Semiramis' Poison]`), so the permissive default would have been wrong for everything except that single exception (`module/rules/items.mjs:8-12`).

The system recognizes one exception that **redirects** acquisition: Pale Rider holds nothing at all, and *"all Items that would be obtained by Pale Rider are instead obtained by his Master if he/she is within a 2 panel area."* The redirect runs through one seam every acquisition route passes through — transfer, pickup, or future drop — so the clause is stated once rather than duplicated at each site (`module/rules/items.mjs:58-75`). Two halves are separable: `cannotHoldItems` refuses acquisition outright, and `itemHandling: "redirectToMaster"` re-routes it when a Master stands in range (`module/rules/items.mjs:110-120`). If a Servant has the redirect set but no Master in reach, acquisition falls back to the refusal (`module/rules/items.mjs:78-80`).

## Where it lives

| File | Role |
|---|---|
| `module/rules/items.mjs` | Transfer gates, acquisition targeting, pickup logic, requirement kinds |
| `module/engine/items.mjs` | Descriptor-to-intent conversion and effect resolution |
| `module/data/item/ability.mjs` | `EquipmentData` — item fields and schema |
| `module/engine/movement-hooks.mjs` | `pickUpItemHere` — triggered when a unit moves |
| `module/engine/intents.mjs` | `itemQuantity` and `itemGrant` intent types and ordering |
| `module/engine/applier.mjs` | Batch writer for both intent types |
| `module/engine/io.mjs` | `adjustItemQuantity` and `grantItem` — concrete document updates |

## How it works

### The two intent types

**`itemQuantity`** adjusts an existing stack by a delta: `(unitId, itemId, delta)` (`module/engine/intents.mjs:446-447`). It requires the item to exist on the unit — the applier calls `io.adjustItemQuantity`, which finds the document by either `itemId` or `contentId` and increments its quantity; if the result reaches zero or below, the document is deleted (`module/engine/io.mjs:971-980`). Used for consumption and giving away.

**`itemGrant`** adds to a unit that may not hold that item yet: `(unitId, contentId, delta)` (`module/engine/intents.mjs:456-457`). The applier calls `io.grantItem`, which checks whether the unit already holds an item with the same `contentId`; if it does, the quantity is incremented on the existing document; if not, a new document is created from the pack, stamped with the delta as its quantity, and embedded (`module/engine/io.mjs:993-1011`). Used for acquisition by transfer, pickup, and rewards.

The distinction matters because two documents for the same item would each carry their own turn-spent counters, allowing a unit to transfer twice in one turn by giving half away and having a new document land elsewhere (`module/engine/io.mjs:984-987`).

Both types have `ORDER` rank 2, executed in the bookkeeping phase, so an item whose effect kills its bearer is already spent — the alternative loses its cost when the consumer dies to its own consumption (`module/engine/intents.mjs:64-67`).

### Transferring an item

`canTransferItem` checks four gates in order, by intent: does the item allow it, is there any quantity left, is the recipient close enough, and has this unit already passed its allowance this turn (`module/rules/items.mjs:22-48`). Range is Chebyshev distance and defaults to 1 panel; `transfersPerTurn` defaults to 1 (`module/rules/items.mjs:40, 44`). The allowance is tracked on the giver's turn state rather than on the item, because a limit on the giver's action would otherwise travel to the recipient with their remaining budget (`module/engine/items.mjs:7-11`).

`transferItem` produces three descriptors: a negative `itemQuantity` delta on the giver, an `itemGrant` on the receiver, and a log entry (`module/rules/items.mjs:206-212`). The range check is measured to the recipient unit, not to any redirected Master — if a redirect is planned, the receipt point is adjusted **before** the range check, but the throw is still measured from the original target (`module/engine/items.mjs:61-62`).

### Consuming an item

`consumeItem` produces an `itemQuantity` delta minus one, the item's `consumeEffect` descriptors placed after it, and a log entry (`module/rules/items.mjs`). It is reached by the `useItem` action in the Unit-action registry, offered whenever the Unit holds a consumable with quantity remaining; a Unit carrying more than one is asked which. An item is **consumable** exactly when it authors a `consumeEffect`, and the unit projection carries that as a `consumable` flag so the registry can decide from a snapshot alone. Effects are authored in the short-form vocabulary — `{id, duration}` — and are resolved to absolute expiries at descriptor-to-intent time; the applier reads `intent.effect.defId` and `intent.effect.expiry`, so unresolved effects are silently lost (`module/engine/items.mjs:98-146`).

### Spending an item as an ability's cost

Distinct from consuming it, and the distinction is load-bearing: an ability may declare an `itemCost`, which is spent when the ability is used and **does not fire the item's `consumeEffect`** (`module/engine/skill-use.mjs`). Arrogant King's Poison *"Requires 3 [Semiramis' Poison] to use"* and inflicts its own effects; consuming one poison on its own grants `Queen's Poison` instead. Both are authored on the same item and neither is a special case of the other — paying with something and using it are different acts.

### Picking up an item

The rulebook placed the first item on a board via `[Vorpal Blade]`: *"…the [Vorpal Blade] Item appears on a random panel on the game board, this Item can be picked up by a Unit walking onto its panel."* This triggers automatically whenever a unit finishes moving (`module/engine/movement-hooks.mjs:282-295`). The item is carried by a **structure** — a unit with `kind: "structure"` and a `carriesItemId` field — that occupies the same panel.

`itemPickupIntents` finds a structure at the unit's new position and asks `acquisitionTarget` whether the unit may actually obtain it (`module/rules/items.mjs:147-167`). If the answer is yes, the intents are an `itemGrant`, a `dismiss` to delete the structure, and a log entry. If the answer is no (e.g., `[Vorpal Blade]` refuses Nursery), nothing happens — the sword stays exactly where it lies (`module/rules/items.mjs:138-141`).

### Acquisition targeting

`acquisitionTarget` is the one seam every acquisition route passes through, returning `{ok, unitId, redirected, reason}` (`module/rules/items.mjs:91-120`). It checks, in order:

1. **Item refusal:** If the item names roles via `barredFrom` (a role pair `{ofUnit, roles}` against a content id, not document ids), and the unit fills one of those roles, acquisition is refused (`module/rules/items.mjs:106-108`). *"Cannot be obtained by Nursery or her Master"* is a **property of the item**, stated once.

2. **Redirect:** If the unit has `itemHandling: "redirectToMaster"` and that Master is not defeated, holds items, and stands within `ITEM_REDIRECT_RANGE` (2 panels), the target is the Master and `redirected: true` is set (`module/rules/items.mjs:110-116`). Used only by Pale Rider (`module/rules/items.mjs:78-80, 84`).

3. **Refusal:** If the unit has `cannotHoldItems`, acquisition is refused (`module/rules/items.mjs:118`).

4. **Default:** The unit obtains its own item, `redirected: false` (`module/rules/items.mjs:119`).

## Invariants & edge cases

1. **`itemQuantity` requires an existing document.** It finds the item by `itemId` or `contentId` and updates its quantity; if the item is not held, nothing happens (`module/engine/io.mjs:972-975`).

2. **`itemGrant` creates a document if needed.** It checks for an existing item with the same `contentId` and either increments that or creates a new one. Two documents for the same item would each track `transfersThisTurn`, defeating the per-turn limit (`module/engine/io.mjs:997-1010`).

3. **An item is spent before its effect runs.** Consumption first subtracts the quantity via `itemQuantity` (rank 2), then applies effects (rank 5), so an item whose own consumeEffect kills its bearer is still gone (`module/engine/intents.mjs:64-67`; `module/rules/items.mjs:219-220`).

4. **Acquisition targeting happens twice on transfer.** `giveItem` calls `acquisitionTarget` to decide what to refuse and inform the caller of a redirect (`module/engine/items.mjs:49-54`). The same question is asked again in the applier just before the write, because the Master's position may have changed between the call and the batch execution (`module/engine/applier.mjs:558-560`).

5. **A redirect requires Master in range at **write time**, not at call time.** The range is re-measured when the intent reaches the applier, so a Master who stepped out of range between the check and the write causes the grant to fail with a warning (`module/engine/applier.mjs:553-568`).

6. **`barredFrom` uses roles, not ids.** Content cannot name actor ids (which are random per world), so it names roles: `{ofUnit: "contentId", roles: ["self", "master"]}`. A unit not on the board matches no role and does not block acquisition (`module/rules/items.mjs:172-192`).

7. **The per-turn transfer allowance is on the giver's turn state, not the item.** An item that changes hands carries no record of how many times it was already passed (`module/engine/items.mjs:8-11`).

8. **An item that lands nowhere is warned, not silently dropped.** When `acquisitionTarget` returns `ok: false`, the applier logs the refusal and continues with the next intent in the batch, so a barred item stays on the board (`module/engine/applier.mjs:562-566`).

## Traps and anti-patterns

**A documented model with no entry point, beside an undocumented one that works.** Ch. 18 has
described consumption since it was written, `consumeItem` produced the right descriptors, and the
engine function that converts them existed — and **nothing had ever called it in any commit**. The
consequence was not abstract: `[Semiramis' Poison]` authors
`consumeEffect: applyEffect queensPoison 3◈`, and that is the **only** route to `queensPoison`
anywhere in the corpus, so a fully authored effect with its own definition file could never be
applied in play. Meanwhile `itemCost` — the mechanism that *did* work — appeared in no chapter at
all, so the reachable half was the undocumented half and the documented half was the dead one. Fixed
in [#30](https://github.com/zarex97/FGT_FVTT_v2/issues/30), and this chapter now covers `itemCost`.
**When two mechanisms answer nearby questions, the one with a chapter is not automatically the one
with a caller — check both directions.**

**Ordering by list position instead of by rank.** `consumeItem` emits the quantity delta first and
the effects after it, which reads as the invariant being satisfied by construction. It is not: a
batch is applied in ORDER **rank** order, and the list is only a tie-break within a rank. The
invariant that an item is spent before its own effect can kill its bearer rests entirely on
`itemQuantity` ranking below `applyEffect`, and nothing asserted that until #30 added a test that
sorts a deliberately reversed batch.

## Open questions

- **Confirmed by reading the path; the double check is deliberate.** `acquisitionTarget` returns
  `{ok, unitId, redirected, reason}` and is the single seam every acquisition route passes through
  (`module/rules/items.mjs:91`). It runs once before the write and again on the intent, so a Master
  who stepped out of range between the two moments is re-measured rather than trusted: the second
  call is the authority. The redirect radius is a named constant, confirmed live as
  `ITEM_REDIRECT_RANGE = 2`. Note the ordering inside it: an item's own bar is tested *before* the
  redirect, because a barred Servant who redirected to their Master would otherwise hand the sword
  straight to the second person the clause names (`module/rules/items.mjs:103-107`).

- **Confirmed by reading.** The distance is measured from the giver to the **intended recipient**,
  not to the Master the gift redirects to. That is the clause working as written: the redirect
  answers *who ends up holding it*, not *how far the giver had to reach*. A giver who can reach the
  Servant may hand it over even when the Master behind them is further away.
