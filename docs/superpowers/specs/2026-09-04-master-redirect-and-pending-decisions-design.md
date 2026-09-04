# Master Redirect, and the Pending-Decisions Window — Design

**Status:** approved for planning
**Chapters touched:** 12 §12.8, 27 §27.5, 29, 41, 45

Two independent pieces, specified together because they were asked for together. They
share no code and no data. **They can be planned and executed apart, in either order**, and
the plan should keep them as separate task runs.

- **Part A** — §12.8's Master redirect. A rules gap: specified since the chapter was
  written, implemented nowhere.
- **Part B** — the pending-decisions window. Sub-project 2 of the three named when
  Counter-as-a-full-attack was scoped.

---

# Part A — The Master redirect (§12.8)

## A1. The rule

> *"If a Master performs an Attack on an enemy Unit and the enemy Unit decides to Counter,
> the Counter Attack cannot be used on the Master if its Servant is within a 2 panel area of
> itself, the Counter Attack is **redirected** to that Master's Servant instead."*

Two effects, and the second is the one nothing in this system does yet:

1. The Master **takes nothing** — it is dropped from the Counter's targets even when the
   area covers it.
2. The Servant becomes the unit the Counter **must** catch — it inherits `requiredTargetId`.

## A2. What already exists, and why it is not this

`rules/targeting/resolve.mjs#isProtectedMaster` drops a Master from any target list when a
Servant of its faction stands **adjacent** — `chebyshev <= 1`. That is §16.4's general
protection, not this rule, and the difference is exactly two things:

| | §16.4 general protection | §12.8 Counter redirect |
|---|---|---|
| Radius | 1 panel | **2 panels** |
| Applies to | every attack | a Counter only |
| Effect | the Master is untargetable | the Master is untargetable **and the Servant is required** |

So the redirect adds behaviour in the band where the guarding Servant stands at exactly 2
panels, and adds the retarget everywhere. Inside 1 panel the general rule already drops the
Master; the redirect still supplies the *retarget*, which the general rule has no concept of.

`rules/relations.mjs#guardsOf` is the right reader for "that Master's Servant": it already
handles Pale Rider, whose Kagome Spirits guard in his place and who does not guard his own
Master at all.

## A3. Reach

**DECISION, narrowing D12.8.** The chapter says the redirect *"succeeds regardless of
range, because the rule is written as an absolute protection."* That was written when a
Counter was always an auto-aimed Normal Attack against one unit. It no longer has a clear
meaning: the counterer now chooses an ability and aims it, and the ability's reach is
enforced by targeting like every other legality clause.

So: **the chosen ability's reach still applies.** The Servant becomes the required target
and an ability that cannot reach it refuses under the cursor, exactly as a mis-aimed area
does. The player picks a different ability or Declines.

This does not weaken the protection — it completes it. The Master takes nothing either way;
if the counterer cannot reach the Servant either, they counter nobody. Recording the change
in Ch. 41 so anyone who read the old text can see what replaced it.

## A4. Where it is decided

On the Process, at the counter rung, beside `counterAvailable` — the same pattern and for
the same reason the existing comment gives:

> *"eligibility is decided first (by the orchestrator, which can see positions and ranges)
> and recorded on the state."*

A new field, `counterRedirectId`: the unit the Counter must catch, `null` when there is no
redirect. Computed once by `engine/attack.mjs`'s counter-rung handler and read by both
consumers, so the UI and the resolution cannot disagree about who is being protected.

```js
// module/rules/counter.mjs — pure
counterRedirect(target, board) -> string|null
```

`null` unless `target.kind === "master"`, and otherwise the nearest guarding Servant within
2 panels — nearest so a Master flanked by two Servants has one answer rather than an
arbitrary one.

## A5. What changes downstream

| Reader | Today | With the redirect |
|---|---|---|
| `ActionBar.armForCounter` | `requiredTargetId: state.attackerId` | `state.counterRedirectId ?? state.attackerId` |
| `pickPlacementFor`'s `requireUnitId` | the attacker | the same, via the bar |
| `runCounter` | `requiredTargetId: state.attackerId` | the redirect target |
| targeting | — | `limits.excludeUnitIds` drops the protected Master |

`limits.excludeUnitIds: string[]` is new and is the mechanism for effect (1). It sits beside
`requireUnitId` in `resolve.mjs`, uses the existing `drop(unit, why)` recorder so the
exclusion shows up in the targeting preview with its reason, and reads *"protected by its
Servant; the Counter is redirected"*.

**Automatic counters inherit the redirect, and need nothing here.** `Auto Counter`,
`Dodge Counter` and `Guard Counter` are real effects of the game: they carry rank and
valence entries in `docs/A-effect-catalogue.md`, and Ch. 10's D10.2 settles that two of them
are both offensive and defensive. What does not exist yet is **content** — none of the 75
files in `packs/_source/effects/` authors one, because no Servant carrying one has been
built — and no engine reads them.

They are out of this spec's scope for that reason and no other. When a Servant needs one,
the automatic counter fires through `runCounter` like the manual rung does, so it picks up
`counterRedirectId` without a second implementation. The one thing whoever builds them must
not do is give them their own path to `beginCounter`: that is how a rule ends up enforced on
one branch and forgotten on the other.

---

# Part B — The pending-decisions window

## B1. The problem

An AoE attack already fans out to one ladder **per defender**. Own four units and a Noble
Phantasm catches three of them, and you have three prompts in a scrolling log — each on its
own card, each with a clock running, and §27.5's default on expiry is the option that
spends nothing. Counter-as-a-full-attack makes this worse rather than better: countering is
now a decision worth thinking about, and it is the easiest one to scroll past.

There is no surface anywhere that answers *"what is the game waiting for me to do?"*

## B2. Scope

**Card-borne prompts only**: reaction-ladder rungs, Counter rungs, and Command Spell offers.
Those live on a chat card and are missable.

Modal prompts — a Luck Check routed through `FGTSocket.ask` into `apps/prompt.mjs` — are
deliberately **excluded**. They already open a dialog in front of the player; listing them
in a second place would be a queue entry for something that is currently blocking the
screen.

The window shows **your own** decisions. Not the table's. A dimmed "waiting on Player1" list
was considered and dropped: it is information a player does not own, and the GM already has
§27.5's countdown and its "decide for them" control on the card itself.

## B3. What a row is

```js
// module/apps/hud/pending-present.mjs — pure
pendingRowsFor(entries, viewer) -> Array<{
  messageId, unitName, unitImg, kind, label, countdown, expired, isCounter,
}>
```

`entries` are already-read `{messageId, state, prompt, countdown, commandSpells}` tuples, so
the pure half is testable without a canvas and the Foundry half is a scan.

Ordering: **expiring soonest first**, then by message age. A player with three prompts and
one clock about to run out should not have to find it.

`unitName` is the **public** name, through `publicIdentityOf` — the window is a viewer's own
list, but a concealed Servant's true name must not leak into it from a card that is
correctly hiding it. Same for `unitImg`.

## B4. Behaviour

- **It appears when there is something to answer and disappears when there is not.** No
  chrome to manage, no empty panel taking space. A player who has nothing pending has no
  window.
- **A row jumps to its card**: scrolls the chat log to that message and flashes it. It does
  not answer the prompt itself — the card is where the buttons and their reasons are, and a
  second set of buttons would be a second place to keep in step.
- **Position**: top-right of the canvas, clear of the action bar at the bottom and the
  sidebar at the right.
- **Refresh** rides the same debounced pattern the action bar uses, on
  `createChatMessage` / `updateChatMessage` / `deleteChatMessage`, plus a 1s tick while any
  row shows a countdown, because a clock that does not move is worse than no clock.

## B5. Interaction with the armed bar

They answer different questions and both should be visible: the window says *what* is
waiting, the armed bar says *how* to answer the one you have jumped to. A Counter row is
marked, so a player can tell the rung that arms their bar from the ones that do not.

---

## Files

**Part A**
- `module/rules/counter.mjs` — `counterRedirect`
- `module/rules/targeting/resolve.mjs` — `limits.excludeUnitIds`
- `module/engine/combat-process.mjs` — `counterRedirectId` on the state
- `module/engine/attack.mjs` — compute it at the rung; `runCounter` reads it
- `module/apps/hud/action-bar.mjs`, `module/apps/chat/cards.mjs` — arm on the redirect target
- `docs/12-combat-process.md`, `docs/41-open-questions.md`, `docs/45-implementation-status.md`

**Part B**
- `module/apps/hud/pending-present.mjs` *(new, pure)*
- `module/apps/hud/pending-panel.mjs` *(new)*
- `templates/hud/pending-panel.hbs` *(new)*
- `module/fgt.mjs`, `styles/src/_apps.scss`, `lang/en.json`
- `docs/27-reaction-protocol.md` §27.5, `docs/29-user-interface.md`

---

## Testing

**Part A, pure** — `counterRedirect` returns null for a non-Master; null when no guard is
within 2; the guard at exactly 2; the *nearest* of two; nothing for a guard that
`canAct === false`; nothing for Pale Rider guarding his own Master.

**Part A, targeting** — `excludeUnitIds` drops the named unit and records the reason;
combined with `requireUnitId`, an area covering both Master and Servant resolves to the
Servant with the Master listed as excluded.

**Part B, pure** — ordering by soonest expiry; a prompt for a unit the viewer does not own
is absent; a concealed Servant appears under its public name; an empty list is empty.

**Live, both parts, three sessions** — Part A: a Master attacks, the defender counters, and
the bar arms with the **Servant** as the required target while the Master is drawn as
excluded under the cursor. Part B: own three units, have an area attack catch all three,
and confirm three rows sorted by clock, each jumping to its own card, the window vanishing
as the last is answered.

---

## Decisions

| # | Decision |
|---|---|
| A1 | The redirect drops the Master from the Counter's targets **and** makes the Servant the required one. |
| A2 | 2 panels, via `guardsOf`, nearest guard wins. Distinct from §16.4's 1-panel general protection, which stays. |
| A3 | **Narrows D12.8:** the chosen ability's reach still applies. The Master is protected either way. |
| A4 | Decided by the orchestrator at the counter rung and recorded as `counterRedirectId`, beside `counterAvailable`. |
| A5 | Automatic counters are specified effects with no content authoring them yet. Out of scope, and they inherit the redirect through `runCounter` when built. |
| B1 | Card-borne prompts only. Modal prompts already block the screen. |
| B2 | Your own decisions, not the table's. |
| B3 | A row jumps to its card; it does not answer the prompt. |
| B4 | The window exists only while something is pending. |
| B5 | Public names and images, through `publicIdentityOf`. |
