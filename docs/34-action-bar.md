# 34 — Action bar, turn panel and pending decisions

## What it is

The **action bar** is one persistent panel showing the controlled unit's options: available actions (Move, Attack, etc.), clickable abilities (Skills and Noble Phantasms), toggleable modes, and field control buttons. It exists only when the player owns the selected token.

The **turn panel** is the action bar's right-hand segment, displaying the acting faction's budget state as pips, unmet compulsions (if any) that block End Turn, and the turn order with declared delays.

The **pending-decisions panel** is a separate floating list, showing every prompt awaiting this player's answer — Counters, Reactions, Luck Checks — ordered by soonest deadline first and linked to the chat cards that hold the buttons and their refusal reasons.

## Where it lives

| File | Role |
|---|---|
| `module/apps/hud/action-bar.mjs` | The persistent bar: renders controlled unit's actions and abilities. Singleton; debounced refresh on selection change, budget update, effects, items. |
| `module/apps/hud/present.mjs` | Action bar's view-model: pure functions that build slot state and row layout without Foundry globals or documents. Testable in isolation. |
| `module/apps/hud/turn-panel.mjs` | Budget context builder and three handlers (End Turn, Delay, Pan To). Faction-scoped, while the bar is unit-scoped. |
| `module/apps/hud/pending-panel.mjs` | Scans chat log for pending prompts by message flag. Shows only rows the viewer owns or can answer via Command Spell. Scrolls to card on jump. |
| `module/apps/hud/pending-present.mjs` | Pending panel's view-model: decides what is shown, in what order (soonest deadline first), and ownership rules. Pure. |
| `module/apps/prompt.mjs` | Renders a prompt spec to a DialogV2. Keyed renderers for `luckCheck` and `choose`; callers hand a spec, receive the answer. |

## How it works

### The action bar

The bar's singleton opens when a controlled token is selected and the player owns it (`module/apps/hud/action-bar.mjs:72-96`). It debounces refresh across selection changes, budget updates, active effects, item changes, and combat updates so that a cascade of changes (selecting a unit can raise `controlToken`, `updateActor`, and `fgtBudgetChanged` at once) renders once, not three times (`module/apps/hud/action-bar.mjs:86-105`).

Its context packs a single snapshot per render, threaded through every builder, so all state decisions see consistent data (`module/apps/hud/action-bar.mjs:129-131`). Portrait concealment checks the unit's identity state; the name shown respects Presence Concealment. Budget, affordances, cooldowns, and field deactivation eligibility are computed inline against the snapshot.

When armed for a Counter (Ch. 21), actions are recategorized: Normal Attack lights up and glows as available; every other action dims with a message. Abilities that are not Attacks dim; Riding Attack dims because it is a MOVE as well, and Counter is not a move opportunity (`module/apps/hud/action-bar.mjs:136-155`). The bar's refresh logic protects against losing the Counter prompt if the player clicks empty canvas — an armed bar stays armed until disarmed explicitly (`module/apps/hud/action-bar.mjs:88-90`).

### The view-model seam

`present.mjs` exists because the bar must render exactly what the rules decide, with no asymmetry between the bar and the sheet. Three pure functions build state without Foundry:

- **`portraitBlock`** returns which image and name the viewer is entitled to, applying Presence Concealment (`module/apps/hud/present.mjs:31-38`).
- **`slotFor`** builds one ability or action slot's state: cost, cooldown, ring (on/built), disabled flag, and reason why if it is disabled (`module/apps/hud/present.mjs:52-90`). A slot carries its refusal reason so the tooltip never lies.
- **`rowsFor`** groups abilities into rows (pinned, skills, noble phantasms, modes), omits empty rows, and lists action buttons (`module/apps/hud/present.mjs:107-128`). Pins are shortcuts that duplicate an ability into the pinned row; they never hide it.

Because these are pure, every slot state is testable with literals (`test/unit/action-bar-present.test.mjs`). The bar rendering becomes a dumb template spraying the result.

### The turn panel

`turnContext()` supplies faction-scoped state: the acting faction's name, round, tick, the budget rows from `engine/budget.mjs`, units in the faction with their move/attack flags, and the End Turn gate (`module/apps/hud/turn-panel.mjs:38-83`).

The End Turn button is gated on `budget.endTurnVerdict`, which checks unmet compulsions: Berserk, Decoy, and Hatred require action under specific conditions. A button disabled by unmet compulsion is disabled by gate, not by CSS, so it cannot be clicked — and the bar shows the compulsions immediately, even mid-turn, so a player can plan (`module/apps/hud/turn-panel.mjs:71`). See Chapter 19 for compulsion rules.

Three actions live here: `endTurn` (proxies to GM), `onDelay` (proxies delay declaration), and `onPanTo` (camera). The panel is now the bar's right segment, not a separate window, but handles remain functions because the bar owns the rendering (`module/apps/hud/turn-panel.mjs:91-95`).

### Pending decisions

`PendingPanel` is a singleton that opens only when something waits on this viewer. It scans the chat log for messages flagged `{"fgt", "attack"}` and reads their `{"fgt", "process"}` state. For each one, it deserializes the combat state and extracts the pending prompt (`module/apps/hud/pending-panel.mjs:95-107`).

A row appears when: the viewer owns the unit being asked (most Reactions, Counters), the viewer is the GM (who answers for absent players per Ch. 23), or the viewer has Command Spells to spend into the rung — Ch. 33 lets a Master interrupt somebody else's prompt (`module/apps/hud/pending-present.mjs:42-69`).

Rows are sorted by soonest deadline first, so a player with three prompts and one expiring in 4 seconds finds it immediately. Each row links to the chat card; clicking it jumps and flashes the card. The buttons and their refusal reasons live on the card, not here — a second set of buttons would be a second place to keep in step, and the first thing to fall out of step is the reason a button is disabled (`module/apps/hud/pending-panel.mjs:218-229`).

The panel shows 8 rows, and everything beyond is a count `+N more` — a GM in a long match can have 100+ pending prompts, which would cover the canvas. The list is a call to ACTION, so it shows what is urgent and hides noise while scrolling stays available (`module/apps/hud/pending-panel.mjs:188`).

## Invariants & edge cases

1. **One snapshot per render.** The bar threads a single `unitSnapshot(actor, token.document)` through every builder so all decisions see consistent data, even if Combat changes mid-preparation (`module/apps/hud/action-bar.mjs:129-131`).

2. **Master cost defaults dangerously.** `canUseAbility` defaults `master` to `null`, which reads as a Master with 0 Health and refuses every Master-cost ability. The bar must resolve it from the board, not trust the default (`module/apps/hud/action-bar.mjs:173-175`).

3. **A Counter arms for a player, not a rung.** The bar is armed FOR the player so they need not wait to select the token — the bar opens, the abilities that could answer glow. Once armed, closing the bar on a canvas click would lose the prompt they are being asked to answer (`module/apps/hud/action-bar.mjs:88-90`).

4. **The pending panel shows only what this viewer can answer.** Ownership, GM status, and Command Spell access are the three gates. A row visible means this viewer has business with it — either they own it or they can spend into it (`module/apps/hud/pending-present.mjs:42-69`).

5. **Prompts have no second set of buttons here.** The cards hold the buttons and their refusal reasons; a second UI would be a second place to keep in sync. A jump opens the card where the real buttons live (`module/apps/hud/pending-panel.mjs:207-213`).

## Traps and anti-patterns

**The action bar measured every Noble Phantasm against Round 1.** `canUseAbility` defaults the round number to 1, and `module/apps/hud/action-bar.mjs` was the one caller in the codebase that never passed it. Every other site — `actor-sheet/context.mjs`, three in `engine/attack.mjs`, `skill-use.mjs` — passes `combat.round` explicitly. The bar computed Chapter 7's Noble Phantasm gate against Round 1 for the entire match. A Servant's Noble Phantasm read "Ready from Round 6 (5 away)" while the combat WAS in Round 6 — the right gate, a distance that could never decrease, a button greyed permanently — while the sheet showed the same ability as available. Two surfaces, same ability, opposite answers. **Round should travel as ambient context alongside turn and clock state**, not as an argument at each call site. `round` now rides `gateContext()` in `module/engine/board.mjs:294` so the omission cannot recur. The explicit `round:` at the other callers is the same value and stays harmless (`module/engine/board.mjs:281-295`).

**The action bar held the wrong unit after a Counter.** `armForCounter` rebinds `bar.token` to whoever is being offered the Counter so targeting is offered immediately. `disarmCounter` cleared the rung without giving the token back — the bar went on showing that unit's whole kit regardless of what the player selected. Found with Kiritsugu selected and the defending Caster's abilities on his bar. **Disarming must restore the bar to the current SELECTION**, not leave it bound to whoever was asked. The fix runs in `disarmCounter` at `module/apps/hud/action-bar.mjs:423-438`.

**The action bar refused every Noble Phantasm its Master pays for.** `gateContext()` has no unit, so it cannot carry a Master, and `canUseAbility` defaults it to `null` — which reads as a Master with 0 Health and refuses every Master-Health cost. The bar was the one caller that did not resolve the Master from the board. Drake's two Noble Phantasms were greyed "The Master cannot pay the Health cost" while her Master sat at 250 of 250 and the sheet offered them happily. It stayed hidden because Free Servants pay nothing, and most test boards carry them. **The Master must be resolved from the board, using the same path the sheet uses.** Fixed in `module/apps/hud/action-bar.mjs:173-175`, matching `actor-sheet/context.mjs`.

## Open questions

- **Confirmed live.** `pendingRowsFor` sorts on
  `(a.countdown?.ms ?? Infinity) - (b.countdown?.ms ?? Infinity)`
  (`module/apps/hud/pending-present.mjs:68`), and `Array.prototype.sort` has been stable by
  specification since ES2019. Exercised with five rows where four shared a deadline: the ordering came
  back `d a b c e` -- the soonest clock first, then the tied rows in exactly the order they were read
  off the messages. A separate run with unclocked rows returned `y x z`: the clocked row first, the
  two without a clock last and in their original order, which is what `?? Infinity` is for.

- **Resolved: it cannot re-enter, and the close is deliberate.** `disarmCounter` is documented as
  *idempotent*: it returns immediately when no rung is armed, clears `bar.counter`, then rebinds the
  bar to whatever the player currently has **selected** -- and only if they own it
  (`module/apps/hud/action-bar.mjs:424-437`). With nothing owned selected the bar closes rather than
  lingering on the defender. The rebinding is the whole point, and the comment records the bug that
  forced it: clearing the rung alone left `bar.token` pointing at the unit that had been offered the
  Counter, so *"the bar went on showing that Unit's abilities no matter who the player selected"* --
  found with one Servant selected and a defending Caster's entire kit on his bar.
