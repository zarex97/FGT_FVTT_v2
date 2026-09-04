# The Combat Lock — Design

**Status:** approved for planning
**Chapters touched:** 12, 18, 27 §27.5, 29 §29.5, 45

Sub-project 3 of the three named when Counter-as-a-full-attack was scoped. The other two
— the Counter itself and the pending-decisions window — are built.

---

## 1. The problem

**Nothing stops anybody acting in the middle of somebody else's Combat Process.** There is
no `inFlight`, no gate, and no chapter that discusses one. While a reaction ladder sits open
waiting for a defender to choose, every other player at the table may move, attack, use
Skills and fire Noble Phantasms, and every one of those writes lands on a board the open
Process is still reading.

That is not a cosmetic race. `resolveAttack` snapshots the board at declaration and the
damage pipeline reads a snapshot taken later; an effect applied between the two changes the
arithmetic of an exchange already under way. The reaction ladder was built as *"an
asynchronous, multi-party, resumable negotiation"* (Ch. 27) on the assumption that the rest
of the board holds still, and nothing ever made it hold still.

## 2. What locks the table

**A Combat Process with a prompt awaiting a human.** Not "any unfinished Process" — the
difference matters, and it is what stops this feature from being able to freeze a game.

A Process spends most of its life inside synchronous engine work: rolling, computing damage,
applying effects, writing documents. That is not a decision and holds no lock. What holds
the lock is a rung that has stopped and asked somebody a question — precisely what
`pendingPrompt` already reports and what the pending-decisions window already lists.

**It is therefore self-healing.** Every prompting rung carries §27.5's `AwaitPolicy`, whose
deadline is stored on the message so no two clients disagree, and whose expiry default is
always the option that spends nothing. A player who closes their browser mid-ladder releases
the table on their own clock. A Process that errors mid-resolution never prompts, so it
never holds the lock at all — the worst it can do is leave a card looking unfinished, which
is what it does today.

The alternative — locking on any Process that is not `done` — has no such release. A
Process that throws mid-damage would freeze every player until a GM edited message flags by
hand. Rejected for that reason alone.

## 3. What it refuses

Everything on the action bar and the actor sheet:

| Refused | Why |
|---|---|
| Attack, Noble Phantasm, attack Skill | writes to a board an open Process is reading |
| Move | same, and movement is what `onPreMove` already gates |
| Active Skills, Spells | same |
| Mode toggles | a mode changes damage arithmetic mid-exchange |
| **Facing** | see below |
| End turn | advances the scheduler out from under an open ladder |
| Field reshape / deactivate | a bounded field's panels are board state |

**Facing is refused too.** §29.5 calls the dial *"a correction a player makes while
thinking"* and it spends nothing and ends nothing, which is a real argument for exempting
it — and §14.5's directional Evade modifiers mean a defender might genuinely want to turn
mid-exchange. It is refused anyway: **one rule with no exceptions is worth more than the
correction it costs.** A lock with a carve-out invites the next carve-out, and the first
question a player asks about a rule they cannot see is which parts of it are real. The dial
returns the moment the prompt is answered.

## 4. What it does not need to allow — the surprise

The obvious hard part of this feature is the exception list: *"except for those abilities
and actions that would allow you to — for example, EMIYA's Rho Aias."*

**There is no exception list to build, because every such ability is already offered
somewhere else.** This is worth stating plainly, because it is the whole reason this
sub-project is small:

- **Rho Aias** — `allyReactions` gathers it and `offeredReactions` appends it to **the
  defender's reaction rung**, labelled with the projector's name so whoever answers knows
  whose Health it costs. It is an option in the ladder. It is never pressed from the bar.
- **Reaction abilities** (Medea's Trofa, Argos) — `reactionAbilities` puts them on the same
  rung, prefixed `ability:`, because *"the defender is choosing between Evade and Trofa in
  one list, and they are the same kind of decision."*
- **Attacker windows** (Karna's Uncrowned Arms Mastership) — `offerAttackerWindow` asks at
  `combatPhaseStart` and `damageStep`.
- **Command Spells** — §17.4's interrupt, offered on the card, routed through
  `spendCommandSpell`.

Every one of those reaches its owner **through the Process**, as a prompt or a card button.
The action bar and the sheet are exactly the two surfaces that have no business being live
mid-exchange, and they are exactly what the lock refuses. The exceptions need no gate
because they are not on the locked surfaces at all.

### The declaration that already exists and is read by nobody

`timing.window` is authored on 58 abilities as `ownTurn`, 5 as `anyTime`, and the rest at
specific windows. For **abilities**, that declaration is read only to match a named window
(`abilitiesAtWindow`) — nothing reads `ownTurn` to mean "not now" and nothing reads
`anyTime` to mean "any time". Only `rules/command-spells.mjs` uses the two as a gate, for
Command Spells.

The lock does not need it: refusing the surfaces is sufficient and simpler. But it is
recorded here because the next person to look will assume `ownTurn` is load-bearing, and it
is not — for abilities it is decoration, and a fifty-eight-fold decoration is the kind that
gets trusted by mistake.

## 5. Who is exempt

**The Gamemaster.** `engine/movement-hooks.mjs#onPreMove` already states the principle for
movement — *"a GM arranging a scene is not spending a turn budget, and a system that fights
them while they set up is a system they turn off"* — and the same holds here. The GM is also
the one §27.5 asks to decide for absent players, and the only one who can repair an exchange
that has gone wrong. Locking them removes the escape hatch exactly when it is wanted.

**Out of combat, nothing is enforced**, following the same precedent: no active Combat, no
lock.

## 6. Where the gate lives

Three layers, because the UI can be bypassed and the engine is the authority.

```js
// module/rules/combat-lock.mjs — pure
lockedBy(prompts, viewer) -> {locked: boolean, prompts: Array<{unitName, kind}>}
```

`prompts` are the same entries `apps/hud/pending-panel.mjs` already builds. The pure module
decides nothing about Foundry and can be tested without one.

1. **The engine refuses.** `resolveAttack`, `useSkill` and `onPreMove` each already refuse
   things and each already knows the combat; the lock check joins the refusals they make.
   This is the authoritative gate.
2. **The bar dims.** Every slot disabled, with a reason that **names who the game is waiting
   for** — "Waiting on Lancer's reaction", not "unavailable". The pending window already
   holds that information; a refusal that does not say whose decision it is, is a refusal a
   player reads as a bug.
3. **The pending window is the escape.** It is already on screen when the lock is on, by
   construction: the same condition produces both. A locked player looks up, sees exactly
   what the table is waiting for and whether it is theirs, and clicks through to it.

That last point is why this sub-project came third. The lock without the window is a game
that stops responding for reasons the player cannot see.

## 7. What the player sees

Locked, the bar keeps its shape and greys out, with a single line above it: **"Waiting on
Lancer — Choose a reaction"**, naming the first outstanding prompt by its **public** name.
When several are outstanding it names the count as well. The pending window sits top-right
with the full list.

Nothing pops up, nothing steals focus, and nothing is hidden — the same discipline the
action bar already follows for a refused ability: dimmed with a reason, never removed.

---

## Files

- `module/rules/combat-lock.mjs` *(new, pure)*
- `test/unit/combat-lock.test.mjs` *(new)*
- `module/engine/attack.mjs` — refuse in `resolveAttack`
- `module/engine/skill-use.mjs` — refuse in `useSkill`
- `module/engine/movement-hooks.mjs` — refuse in `onPreMove`
- `module/engine/actions.mjs` — refuse in `performAction`, which covers the bar's actions row including facing and end turn
- `module/apps/hud/action-bar.mjs`, `module/apps/hud/present.mjs`, `templates/hud/action-bar.hbs` — the dimming and the reason
- `module/apps/hud/pending-panel.mjs` — expose its scan so the lock and the window agree
- `lang/en.json`, `styles/src/_apps.scss`
- `docs/12-combat-process.md`, `docs/18-action-economy.md`, `docs/27-reaction-protocol.md` §27.5, `docs/29-user-interface.md` §29.5, `docs/45-implementation-status.md`, `CHANGELOG.md`

---

## Testing

**Pure** — locked when any prompt is outstanding; not locked when none is; never locked for
a GM; not locked out of combat; the reported prompt is the one that names the blocker.

**Engine** — `resolveAttack`, `useSkill` and `performAction` each refuse while locked and
each say who they are waiting for; each proceeds once the prompt is answered.

**Drift** — every entry point that writes board state is covered. The failure mode this
guards is a *new* action path shipping unlocked, which is invisible until two players race.
The test enumerates the action ids in `rules/actions.mjs#UNIT_ACTIONS` and asserts each is
refused while locked, so a new action fails the test by existing.

**Live, three sessions, visually** — Player1 attacks Player2. While Player2's reaction rung
is open: Player1's bar is dimmed and says it is waiting on Lancer; Player1 cannot move,
attack or turn; the GM can do all three. Player2 answers, and Player1's bar returns in the
same frame the window empties. Then the interruption that must still work: with the rung
open, EMIYA is offered **Rho Aias on the defender's rung** and it fires — proving the lock
refuses the bar without touching anything routed through the Process.

---

## Decisions

| # | Decision |
|---|---|
| D1 | The lock is held by a Process **awaiting a human**, not by any unfinished Process. Self-healing through §27.5's timeouts. |
| D2 | It refuses every action-bar and sheet surface: attack, move, skills, NPs, modes, fields, end turn. |
| D3 | **Facing is refused too.** One rule with no exceptions beats the correction it costs. |
| D4 | No exception list is built: every ability that may act mid-Process is already offered through the Process, not on the bar. |
| D5 | The GM is exempt, following `onPreMove`'s existing principle. Out of combat, nothing is enforced. |
| D6 | The engine is the authority; the bar's dimming is an affordance, not the gate. |
| D7 | A refusal names the unit and rung it is waiting on, by public name. |
| D8 | `timing.window`'s `ownTurn` / `anyTime` stay unread for abilities. Recorded as decoration so it is not mistaken for a gate. |
