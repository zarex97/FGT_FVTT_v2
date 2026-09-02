# 25 — The Turn System

> **Note (Ch. 45 C2).** `MatchData` now also carries the war's Region, the difficulty, and the
> Holy Grail's full runtime state (threshold, count, materialization, position, contest,
> destruction). The Grail is a property of the *match*, so the Combat document is its owner —
> `grailCounter` had lived there since the schema was written with nothing incrementing it.
> See Ch. 19 §19.4.

Turns belong to **players**, not tokens. This chapter specifies the player-based `Combat`
document, turn order and its mutation by `Delay`, the scheduler that fires time-based effects,
and the reconciliation between F/GT's model and Foundry's assumptions.

---

## 25.1 The mismatch with Foundry

Foundry's `Combat` assumes: one combatant per token, an initiative roll per combatant, and turn
order sorted by initiative descending. F/GT assumes: one combatant per **player**, turn order
fixed by a setup roll, and a player commanding up to fourteen units on their turn.

The prototype's solution — model combatants as users, detected by the presence of
`system.user` — is correct and is carried forward. v14 makes it cleaner, because `Combatant`
now genuinely supports subtypes with typed system data (Ch. 22 §22.9).

```
Foundry model                    F/GT model
─────────────                    ──────────
Combat    = an encounter    →    Combat    = the whole match
Combatant = a token         →    Combatant = a player (or the GM)
Round     = everyone acts   →    Round     = everyone acts        ✓ (same)
Turn      = one token acts  →    Turn      = one player acts with up to 7 units
Initiative= a roll          →    Initiative= a fixed setup order + Delay
```

Only the Combatant and Initiative rows differ, so we override those two and inherit the rest.

---

## 25.2 `FGTCombat`

```js
export class FGTCombat extends foundry.documents.Combat {

  /** Combatants are players. */
  async addPlayer(user, { factionId } = {}) {
    if (this.combatants.some(c => c.system.userId === user.id)) {
      ui.notifications.warn(`${user.name} is already in the match.`);
      return null;
    }
    const [created] = await this.createEmbeddedDocuments("Combatant", [{
      type: "player",
      name: user.name,
      img: user.avatar,
      system: { userId: user.id, factionId, isGM: user.isGM },
    }]);
    return created;
  }

  async addAllPlayers() {
    for (const u of game.users.filter(u => u.active && !u.isGM)) await this.addPlayer(u);
    await this.addGM();
  }

  /** The GM always occupies the final slot. */
  async addGM() { /* … isGM: true … */ }

  get currentPlayer() {
    const c = this.combatant;
    return c ? game.users.get(c.system.userId) : null;
  }

  /** Tokens the current combatant may act with. */
  get currentUnits() {
    const user = this.currentPlayer;
    if (!user) return [];
    return canvas.tokens.placeables.filter(t =>
      t.actor?.testUserPermission(user, "OWNER")
      || t.actor?.system.charmedBy === user.id);        // Charm transfers control
  }

  /** @override — no initiative in this game. */
  async rollInitiative() { return this; }
  async rollAll() { return this; }
  async rollNPC() { return this; }

  /** @override — order comes from MatchData, not initiative. */
  setupTurns() {
    const order = this.system.turnOrder;               // derived (Ch. 22 §22.8)
    this.turns = order.map(id => this.combatants.get(id)).filter(Boolean);
    if (this.turn !== null) this.turn = Math.min(this.turn, this.turns.length - 1);
    return this.turns;
  }

  async nextTurn() {
    await Scheduler.endTurn(this);
    const r = await super.nextTurn();
    await Scheduler.beginTurn(this);
    return r;
  }

  async nextRound() {
    await Scheduler.endRound(this);
    const r = await super.nextRound();
    await Scheduler.beginRound(this);
    return r;
  }
}
```

### Suppressing initiative

Overriding `rollInitiative` to a no-op and `setupTurns` to read our order is enough. The
initiative column is hidden by the combat tracker CSS, and `CONFIG.Combat.initiative` is set to
`{formula: "0"}` so nothing tries to evaluate a formula.

**RISK.** Core code paths and modules sometimes assume `combatant.initiative` is a number.
Mitigation: set it to the combatant's position in `baseOrder` (descending), so it is a valid
number that happens to reproduce the correct sort. Belt and braces.

---

## 25.3 Turn order

**Re-rolled at the start of every Round** (Ch. 19 §19.8): every faction rolls `1d100`, highest
first, ties re-rolled for the contested positions only, GM always last. The result is written to
`system.baseOrder` for that round and then mutated only by `Delay` within it.

```js
async function rollTurnOrder(combat) {
  const factions = combat.system.factions.map(f => f.id);
  const rolls = new Map();
  for (const f of factions) rolls.set(f, await roll("turnOrder"));   // 1d100

  // Sort descending, then resolve ties for the contested positions only.
  let ordered = [...factions].sort((a, b) => rolls.get(b) - rolls.get(a));
  ordered = await resolveTies(ordered, rolls);

  await combat.update({
    "system.baseOrder": [...ordered, gmCombatantId(combat)],
    "system.delays": {},                       // Delay does not carry across rounds
    "system.takenThisRound": [],
    "system.lastOrderRolls": Object.fromEntries(rolls),   // shown in the HUD
  });
}
```

`resolveTies` re-rolls only the members of each tied group and orders them among the positions
that group occupies, leaving every other faction's slot alone.

```js
export function computeTurnOrder(baseOrder, delays, takenThisRound, gmId) {
  const taken   = baseOrder.filter(id => takenThisRound.has(id) && id !== gmId);
  const pending = baseOrder.filter(id => !takenThisRound.has(id) && id !== gmId);

  for (const [id, x] of Object.entries(delays)) {
    if (takenThisRound.has(id)) continue;              // applies next round instead
    const i = pending.indexOf(id);
    if (i < 0) continue;
    pending.splice(i, 1);
    pending.splice(Math.min(i + x, pending.length), 0, id);
  }
  return [...taken, ...pending, gmId];                 // GM always last
}
```

Properties, all property-tested (Ch. 38):
- No id appears twice.
- Every id in `baseOrder` appears exactly once.
- The GM is always last.
- A player who has already acted never moves.
- `Delay+X` moves a player at most X positions later, and never past the GM.

`Delay` entries are removed at the end of the round in which they took effect
(Ch. 07 §7.8), by the round-end scheduler.

---

## 25.4 The scheduler

> **Turn state expires; it is not cleared.** Every write to a Unit's `turnState`
> is stamped with the ◈ tick it happened on, and a state whose stamp is not the
> current tick reads as blank. The scheduler still writes a fresh state at each
> boundary, but only so the stored data matches what the rules see — **nothing
> depends on that write landing**.
>
> This is deliberate and load-bearing. The clearing write is the single most
> failure-prone step in the whole turn cycle: it needs a hook to fire, on the
> right client, for the right faction, against a Combat whose data preparation
> did not throw. When it did not land, a Unit was left with no movement for the
> rest of the match and no message said why — the failure was silent, permanent
> and indistinguishable from a rules refusal. Deciding staleness on *read*
> cannot fail in that direction: the worst a missing stamp does is forget
> something a Unit had already done, which self-corrects on the next write.

Runs on the **active GM client only** — the same election used by the socket proxy
(`game.users.activeGM.isSelf`), so exactly one client fires each effect.

```js
export class Scheduler {
  static attach() {
    if (!game.users.activeGM?.isSelf) return;
    Hooks.on("combatTurn", () => {});     // core hooks are informational; we drive explicitly
  }

  static async endTurn(combat) {
    const t = combat.system.globalTurn;
    const board = SnapshotService.board({ fresh: true });
    const intents = [];

    // 1. onTurnEnd for the active player's units
    intents.push(...fireEvent("turnEnd", board, unitsOf(combat.combatant)));

    // 2. onTurnEnd(acted) for EVERY unit that Acted, any faction
    intents.push(...fireEvent("actedTurnEnd", board,
      [...board.units.values()].filter(u => u.turnState.acted)));

    // 3. advance cooldowns at each ability's computed rate
    intents.push(...advanceCooldowns(board));

    // 4. periodic effects due at turnEnd (deduped by effectId+turn)
    intents.push(...tickPeriodics(board, "turnEnd", t));

    // 5. expiry — AFTER the final tick, unless skipFinalTurn
    intents.push(...expireEffects(board, t));

    // 6. death and disappearance checks (Sustainability, sustained damage)
    intents.push(...checkRemovals(board, t));

    await IntentApplier.applyAll(intents, { source: "scheduler:turnEnd" });
    await combat.update({ "system.globalTurn": t + 1 });
  }

  static async beginTurn(combat) {
    const board = SnapshotService.board({ fresh: true });
    const intents = [];

    // 8. reset the incoming player's budget
    intents.push({ t: "resetBudget", combatantId: combat.combatant.id });

    // 9. reset per-unit turn state for that player's units
    for (const u of unitsOf(combat.combatant))
      intents.push({ t: "resetTurnState", unitId: u.id });

    // 10. turn-start effects — Disorder's Skill Seal roll, Shock's action-loss roll
    intents.push(...fireEvent("turnStart", board, [...board.units.values()]));

    // 11. Delay reordering already reflected in derived turnOrder

    await IntentApplier.applyAll(intents, { source: "scheduler:turnStart" });
  }

  static async endRound(combat)   { /* the 8-step sequence from Ch. 07 §7.7 */ }
  static async beginRound(combat) {
    await rollTurnOrder(combat);                // §25.3 — every round, not just at setup
    /* then the 5-step sequence from Ch. 07 §7.7 */
  }
}
```

The ordering in `endTurn` is load-bearing and is asserted directly by the scheduler tests
(Ch. 38): step 5 must run after step 4, and step 2 must cover units of every faction.

### Why the GM client and not the server

Foundry has no server-side system logic. The GM client is the closest thing to an authority.
The consequences:

- If no GM is connected, the scheduler does not run. **DECISION.** Turn advancement is blocked
  with a clear message when no GM is active, rather than silently skipping effects. This is
  strictly better than the alternative (a match that quietly desynchronizes).
- If the GM disconnects mid-sequence, intents already applied are persisted and the remainder
  is re-derived on reconnect: each scheduler step is idempotent and keyed by
  `(globalTurn, stepName)`, recorded in `system.log`, so a re-run skips completed steps.

---

## 25.5 Idempotent scheduler steps

```js
async function runStep(combat, name, fn) {
  const key = `${combat.system.globalTurn}:${name}`;
  if (combat.system.completedSteps?.includes(key)) return;
  const intents = await fn();
  await IntentApplier.applyAll(intents, { source: `scheduler:${name}` });
  await combat.update({ "system.completedSteps": [...(combat.system.completedSteps ?? []).slice(-50), key] });
}
```

Capped at the last 50 keys — enough to cover a reconnection window without growing unbounded.

This matters more than it might seem. A GM whose browser tab throttles (which Chrome does to
background tabs) can produce a partially-executed turn boundary. Idempotent steps make the
recovery automatic instead of manual.

---

## 25.6 The turn HUD

The primary interface during play (mocked in Ch. 18 §18.9). Rendered as an ApplicationV2 pinned
to the viewport, showing:

- Current round, turn number, day/night phase, and the ◈ value.
- The turn order strip, with the current player highlighted and any `Delay` shifts marked.
- The three budget pools as pip rows.
- Outstanding compulsions as warnings.
- The end-turn button, disabled with reasons.
- NP/Magic Crest gate status (*"Noble Phantasms available from Round 6 — 2 rounds away"*).

It updates on `updateCombat`, `updateCombatant`, and our own `fgt.budgetChanged` hook.

---

> **Implemented.** `module/rules/control.mjs`. One correction to the sketch below: resolution
> **follows the chain** rather than stopping at the charmer's owner. If A charms B and B charms C,
> then C answers to whoever holds B — which is A's controller — and stopping after one hop would
> return B's *owner*, the player who at that moment controls nothing. A visited set guards the
> cycle, because an unguarded one hangs the turn HUD rather than producing a wrong answer.
>
> A charm whose source has left the board falls back to the **GM**, not to the victim's owner:
> handing control back to the player the charm just took it from would make a dead charmer's charm
> a no-op. This section's RISK is unchanged — permissions are not altered, so charmed-unit actions
> take the GM proxy, which is already the default path.

## 25.7 Charm and control transfer

`Charm` switches control of a unit to the charmer for X turns (Ch. 18 §18.5). The turn system
handles it by consulting a derived control map rather than raw ownership:

```js
function controllerOf(actor) {
  const charm = actor.effects.find(e => e.system.defId === "charm" && e.isActive);
  if (charm) return charm.system.source.unitId
    ? actorOf(charm.system.source.unitId)?.controller?.id
    : null;
  return actor.ownership.default === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
    ? null : firstOwnerId(actor);
}
```

So a charmed unit appears in the *charmer's* `currentUnits` during their turn and is absent from
its owner's. The token remains visually the owner's colour (its faction has not changed), with a
charm status icon.

> **Implemented (Ch. 45).** `rules/control.mjs` computed all of this correctly from the day it
> was written and **had no consumer anywhere in the system** — its only import was `fgt.mjs`,
> which never called it. Two further defects sat underneath, each of which alone would have
> been enough to make Charm inert:
>
> 1. **`unit.ownerUserId` was projected by nothing.** `controllerOf` read it, every unit
>    answered `undefined`, and the whole control map collapsed to the GM. It is now resolved in
>    `engine/board.mjs` (the rules layer may not touch `game`), skipping Gamemasters — Foundry
>    grants a GM `OWNER` on everything, so "the first owner" would have named a GM for every
>    unit in the world and a charm could never have moved control off one.
> 2. **`charmSource` looked in the wrong array, for a shape nothing produces.** It searched
>    `unit.effects` — a list of **bare defIds** — for an object carrying `source.unitId`. The
>    file's own unit tests were written against the same invention, so the suite was green and
>    the feature did nothing. The source lives on `effectInstances.sourceUnitId`.
>
> Two things transfer, and they are separate questions:
>
> | Question | Function | Consumer |
> |---|---|---|
> | Who may act with it | `controllerOf` | the turn HUD, `unitsControlledBy` |
> | **Whose Turn** it acts on, and whose budget it spends | `actingFactionOf` | `engine/movement-hooks.mjs`'s faction gate, `engine/budget.mjs` |
>
> `annotateControl` settles both once per board, for the same reason ZON is settled there: a
> charm points at another unit, so a unit projected alone cannot answer either.
>
> The two differ deliberately in one case. When the charmer has left the board, **control**
> falls back to the GM (handing it back to the victim's own player would make a dead charmer's
> charm a no-op) while the **Turn** falls back to the unit's own faction — there is no other
> faction left to act on, and a unit that can never be activated is a softlock, not a rule.
>
> Measured live: a faction-2 unit charmed a faction-1 Servant; the Servant's `factionId` stayed
> `faction-1` while its acting faction became `faction-2`, it left its owner's
> `unitsControlledBy` list and joined the charmer's, and a Move it spent came off **faction-2's**
> `servantMove` pool with faction-1's untouched.

**RISK.** Foundry permissions are not changed by Charm, so the charmer's client cannot write to
the charmed actor. Every action with a charmed unit routes through the GM proxy. This is already
the default path (Ch. 26), so no special case is needed — but it does mean charmed-unit actions
have one extra round trip.

---

## 25.8 Ending a turn

The end-turn flow (Ch. 18 §18.8) is a guarded operation:

```js
async function requestEndTurn(combat) {
  const checks = [
    validateCompulsions(combat),          // hard block
    validateFacingChoices(combat),        // prompt, then proceed
    validateConfusedUnits(combat),        // resolve random actions first
  ];
  const failures = checks.filter(c => !c.ok);
  if (failures.some(f => f.hard)) return showBlockDialog(failures);

  await resolveConfusedUnits(combat);
  await promptFacingChoices(combat);
  await sealJournal(combat);
  await combat.nextTurn();
}
```

Only the current player (or the GM) may end the turn. The button is hidden for everyone else.

---

## 25.9 Match lifecycle

```
   createMatch()
        │
        ▼
  ┌────────────┐  addAllPlayers, assign factions, roll turn order
  │   SETUP    │  summon rolls, deployment
  └─────┬──────┘
        │ startMatch()  → globalTurn = 0, round 1
        ▼
  ┌────────────┐
  │  RUNNING   │◀──── nextTurn / nextRound
  └─────┬──────┘
        │ victory condition met (Ch. 19 §19.4)
        ▼
  ┌────────────┐
  │  FINISHED  │  final log written to a JournalEntry
  └────────────┘
```

`startMatch()` locks the ruleset settings (Ch. 21 §21.5), because changing ◈ after any effect
has been applied would invalidate every stored expiry turn.

**Round 1 has no attacks.** The gate is enforced by the ability validator, and the HUD shows it
prominently so nobody wastes a turn discovering it.

---

> **Implemented.** The desync detector is `module/rules/desync.mjs` (the checksum) and
> `module/engine/invalidation-hooks.mjs` (the round-boundary broadcast). It hashes exactly the
> three things this section names — positions, health values, effect ids — sorted at both levels,
> because units arrive in canvas-enumeration order and effects in creation order, and neither
> difference is a desync. **Nothing else goes in**: every field added that can legitimately differ
> between clients turns the detector into a false alarm, and a detector that cries wolf is turned
> off.
>
> A **missing** broadcast counts as agreement rather than as drift — it is a client that connected
> after the boundary, and refreshing on one would make every reconnect look like a desync.

## 25.10 Reconnection and desync

Foundry synchronizes documents automatically, so most state recovers for free. The exceptions
are transient:

| Transient state | Recovery |
|---|---|
| In-flight Combat Process | Serialized in chat message flags (Ch. 27); the reconnecting client re-reads the latest message |
| Targeting preview | Discarded; the player re-targets |
| Command-spell offer | Expires by timeout; logged as missed |
| Scheduler mid-sequence | Idempotent steps (§25.5) |
| Aura index | Rebuilt on `canvasReady` |
| Snapshot cache | Rebuilt lazily |

A desync detector runs at each round boundary: the GM client computes a checksum over
`(unit positions, health values, effect ids)` and broadcasts it; clients that disagree log a
warning and request a refresh. Cheap insurance against the class of bug where one client's view
silently drifts.

---

## 25.11 Summary of decisions

| # | Decision |
|---|---|
| D25.1 | Combatants are players (v14 typed `Combatant` with `system.userId`); the GM occupies the final slot. |
| D25.2 | Initiative is suppressed but `combatant.initiative` is set to a sort-correct number for module compatibility. |
| D25.3 | `baseOrder` is re-rolled (1d100 per faction, GM last) at every round start; the live order is derived from it plus `delays` and `takenThisRound`. `Delay` does not carry across rounds. |
| D25.4 | The scheduler runs on the active GM client only; turn advancement is **blocked** if no GM is connected. |
| D25.5 | Scheduler steps are idempotent and keyed by `(globalTurn, stepName)` so a mid-sequence disconnect recovers automatically. |
| D25.6 | Control is derived (`controllerOf`), so Charm transfers a unit into the charmer's turn without changing ownership or faction. |
| D25.7 | Ruleset settings lock at `startMatch()`. |
| D25.8 | A per-round checksum detects client desync. |

---

**Next:** [26 — Authority and Sockets](26-authority-and-sockets.md)
