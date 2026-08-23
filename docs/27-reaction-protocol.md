# 27 — The Reaction Protocol

> **Implemented (Ch. 45 A4, B1).** Interrupt injection (§27.9) works: a Command Spell arriving
> mid-ladder is validated and paid on the GM client, then `applyInterrupt` mutates the Process
> and the ladder resumes — possibly at a different rung, which is the point. Escape jumps to
> `noDamage`; Teleport Servant replaces the defender and restarts at `react` with
> `forbiddenReactions: [evade, block]`, per this section.
>
> The counter sub-process (§27.10) is a fresh Process with the roles swapped, marked `isCounter`
> so it cannot be countered in turn, and running the full ladder.
>
> Timeouts (§27.5) exist for the Command Spell offer specifically. The counter rung is
> **conditionally prompting** — it asks only when the defender could actually counter, so an
> ineligible one is never stopped to answer a question with one answer.

The reaction ladder (Ch. 12) is an asynchronous, multi-party, resumable negotiation that can
span five prompts across three clients, with a Command Spell interrupt possible from a fourth.
This chapter specifies the wire protocol that drives it.

---

## 27.1 Requirements

1. **No client writes a document it does not own.** A defender deciding to Evade must not need
   write access to the attacker's data or to a shared resolution document.
2. **Resumable across reload.** A player who refreshes mid-ladder must be able to continue.
3. **Ordered.** Step 2.2 must not resolve before step 2.1.
4. **Interruptible.** A Command Spell can arrive at any point (Ch. 17).
5. **Auditable.** Every decision and roll is recorded, in order.
6. **Bounded.** A disconnected player must not hang the table.
7. **Information-safe.** The defender must not learn the attacker's hidden modifiers.

---

## 27.2 The message-chain design

**DECISION.** Adopt and formalize the prototype's insight: **each ladder transition creates a
new `ChatMessage`** whose flags carry the serialized process state, whispered to the user whose
decision is next.

```
ChatMessage #1  "Karna attacks Heracles"           → whisper: Heracles's controller
   flags.fgt.process = { state: "react", … }
        │  defender clicks "Evade"
        ▼
ChatMessage #2  "Heracles evades — success"        → whisper: Karna's controller
   flags.fgt.process = { state: "s21_luckyHit", rolls: [...], … }
        │  attacker clicks "Contest (1 Luck)"
        ▼
ChatMessage #3  "Karna's Lucky Hit — failed"       → public
   flags.fgt.process = { state: "noDamage", … }
        │
        ▼
ChatMessage #4  "No damage. Heracles may Counter." → whisper: Heracles's controller
```

Why this shape rather than a resolution document:

| Property | How the chain provides it |
|---|---|
| No unowned writes | Every client creates its *own* message; nobody updates another's |
| Resumable | The latest message in the chain **is** the state |
| Ordered | Message creation is server-serialized; the chain is a total order |
| Auditable | The chat log is the audit trail, permanently |
| Information-safe | Each message's content is rendered per-viewer (Ch. 26 §26.7) |

The cost is chat noise: one exchange can produce four to six messages. Mitigated by collapsing
resolved steps into a single summary card at the end (§27.7).

---

## 27.3 The serialized state

```ts
interface ProcessState {
  v: 1;                              // schema version
  phaseId: string;                   // groups the messages of one Combat Phase
  processIndex: number;              // 0 = initiating, 1 = counter

  attackerUuid: string;
  defenders: Array<{
    uuid: string;
    state: LadderState;
    reaction: "none" | "block" | "evade" | null;
    blockValue: number;
    concealedAoE: boolean;
    band: number;
  }>;

  context: AttackContextWire;        // ability id, multipliers, flags — NOT the full snapshot
  rolls: RollRecord[];
  luckChecksUsed: Record<string, string[]>;
  interrupts: InterruptRecord[];
  precomputed: {
    damageByDefender: Record<string, number>;   // GM-computed, sealed
    seal: string;                                // HMAC-ish integrity marker
  } | null;
  awaiting: { userId: string; deadline: number } | null;
}
```

Two points deserve emphasis.

**`context` is a wire format, not a snapshot.** It carries identifiers and computed scalars, not
the attacker's full effect list. A defender's client can render "Karna attacks with Brahmastra
Kundala, Rank A+" without learning that Karna has `Atk Up 40%` active.

**`precomputed` is filled by the GM client** once the ladder reaches the damage step, per the
Model B decision (Ch. 26 §26.4). The `seal` lets the applying client verify it did not
originate from a player client.

---

## 27.4 The flow

```
1. DECLARE  (attacker's client)
   ├─ validate ability, budget, targeting
   ├─ request GM: createContext(attackerId, targetIds, ability)
   ├─ GM computes the target set authoritatively and returns it
   └─ create ChatMessage #1, whispered to each defender's controller

2. REACT  (each defender's client, in parallel for AoE)
   ├─ render the reaction card: Evade / Block / Do nothing
   │    with a damage estimate and the relevant command-spell offers
   ├─ defender chooses
   ├─ if Evade: request GM: rollCheck(defender, "evade", modifiers)
   │    (rolled GM-side so evade modifiers from hidden attacker effects stay hidden)
   └─ create the next message with the updated state

3. LADDER  (alternating clients, per §12.3's transition table)
   └─ each rung: whisper to the deciding user, they choose, next message

4. DAMAGE  (GM client)
   ├─ build the authoritative board snapshot
   ├─ probe pass → determine required rolls → roll them
   ├─ computeDamage() per defender
   ├─ seal into precomputed
   └─ create the damage message

5. APPLY  (GM client)
   ├─ applyIntents batch
   ├─ injury rolls
   ├─ facing updates
   └─ on-hit effects

6. COUNTER  (defenders' clients, sequentially in turn order)
   └─ eligible defenders are offered a counter; each accepted counter
      starts processIndex 1 with the counter step omitted
```

### Parallel AoE reactions

For an AoE, step 2 whispers to every defender simultaneously and collects their choices before
proceeding. Implemented as N messages, each whispered to one defender, with a small GM-side
collector that advances when all have responded or timed out.

**DECISION.** The collector lives on the GM client and is keyed by `phaseId`. It is transient;
if the GM disconnects, the defenders' individual choices are still recorded in their messages
and a reconnecting GM rebuilds the collector by reading them.

---

> **Implemented.** `module/rules/await-policy.mjs` holds the table and
> `module/engine/await-timeout.mjs` runs the clock. This section's decision — *every timeout
> default is the option that spends nothing* — is asserted as a **property over the whole table**
> rather than reviewed row by row, because the tempting mistake ("they would probably have
> countered") is individually reasonable every time.
>
> Three implementation notes. The timer runs on the **GM client only**: every client starting its
> own would race, and the first to fire would answer a prompt the others were still counting on.
> The deadline is stored **on the message** rather than computed per client, so the countdown a
> player sees is the one the GM is acting on. And the GM's "decide for them" button applies the
> **same** default the timeout would, so a GM tired of waiting cannot accidentally make a costlier
> choice than the clock would have.

## 27.5 Timeouts and absence

A player who has closed their browser must not block the table.

```ts
interface AwaitPolicy {
  deadline: number;                  // ms since epoch
  onExpiry: "default" | "gmDecides" | "hold";
  defaultChoice: string;             // e.g. "none" for a reaction
}
```

| Situation | Default on timeout |
|---|---|
| Reaction choice | `"none"` — take the hit. The safest default: it never spends a resource the player might have wanted. |
| Luck Check contest | `"declined"` — never spends Luck |
| Command Spell offer | `"declined"` |
| Counter opportunity | `"declined"` |
| Facing choice | Face the attacker |

Default timeout 60 s for reactions, 45 s for optional contests, configurable. The GM sees a
"waiting for X (0:23)" indicator with a "decide for them" button.

**DECISION.** Every timeout default is the option that **spends nothing**. A player who was
disconnected should never come back to find their Luck and Command Spells drained by
auto-decisions.

---

## 27.6 Resumption

The latest message in a `phaseId` chain is the state. Resumption is therefore:

```js
async function resumePhase(phaseId) {
  const msgs = game.messages.filter(m => m.flags.fgt?.process?.phaseId === phaseId);
  const latest = msgs.at(-1);
  const state = latest.flags.fgt.process;
  if (state.awaiting?.userId === game.user.id) renderPrompt(state);
}
```

Run on `ready` and on `renderChatMessage`. A player reloading mid-ladder sees their pending
prompt reappear.

**Stale-chain cleanup.** A phase whose latest message is older than a configurable threshold
(default 10 minutes) and is not in a terminal state is marked abandoned by the GM client, with a
log entry. Abandoned phases apply nothing.

---

## 27.7 Card collapsing

Six messages per attack is too noisy for a game where a turn can contain six attacks.

**DECISION.** Intermediate messages are created with `flags.fgt.transient = true`. When the
phase reaches a terminal state, the GM client:

1. Creates one **summary card** containing the full ordered trace.
2. Deletes the transient messages.

The summary card is the permanent record, and it is what the audit trail (Ch. 30) reads. The
transient messages exist only to carry state during resolution.

```
┌──────────────────────────────────────────────────────────────┐
│  Karna  ⚔  Heracles                    Normal Attack          │
├──────────────────────────────────────────────────────────────┤
│  Heracles evaded                                              │
│    Evade−  1d20+4 → 14, +1 from the left  = 15  vs Agility 16 │
│  Karna contested (Lucky Hit)                        FAILED    │
│    Luck Check−  1d20+4 → 9  vs Luck 6                         │
│  No damage.                                                   │
│  Heracles turned to face Karna.                               │
│  Heracles may Counter.                       [ Counter ] [ ✕ ]│
├──────────────────────────────────────────────────────────────┤
│  ▸ Full trace (11 steps)                                      │
└──────────────────────────────────────────────────────────────┘
```

One card per Combat Phase, expandable. Six messages become one.

---

## 27.8 Prompt rendering

Reaction prompts are ApplicationV2 dialogs anchored to the chat card, not modals — a modal
blocks the player from examining the board, which is exactly what they need to do to decide.

```
┌─ Heracles is attacked ───────────────────────────────┐
│  Karna — Normal Attack, Range 2                       │
│  Estimated damage: 412 – 618                          │
│                                                       │
│  Your Agility 16 / 19    Karna's Agility 19           │
│  → you would roll Evade−  (unfavourable)              │
│  → +1 (attacked from your left)                       │
│  → Mad Enhancement forces Evade−                      │
│  Estimated evade chance: ~35%                         │
│                                                       │
│  [ Evade ]   [ Block ]   [ Do nothing ]               │
│                                                       │
│  Command Spells available:                            │
│  [ Damage Block — 1 CS ]  take no damage              │
│                                                       │
│  ⏱ 0:47                                               │
└───────────────────────────────────────────────────────┘
```

The estimated chance is computed from the same modifier collection the roll will use, so it is
exact rather than approximate — and it is the difference between a player making an informed
decision and guessing.

**Information safety:** the estimate is computed GM-side and sent as a number. The defender
learns "~35%" without learning which of the attacker's effects contributed.

---

## 27.9 Interrupt injection

A Command Spell arriving mid-ladder (Ch. 17 §17.4):

```
Current state: s23_acceptOrEscape, awaiting Heracles's controller
   │
   ├─ Heracles's Master's controller clicks "Escape (1 CS)"
   │     └─ request GM: spendCommandSpell({ masterUuid, command: "escape", phaseId })
   │
   ├─ GM validates: does the Master have the spell? is the command legal at this state?
   ├─ GM applies the command's phases (moves Master and Servant to the home base)
   ├─ GM mutates the process state: defenders[0].state = "noDamage"
   └─ GM creates the next message, resuming the ladder at the new state
```

The interrupt is a **GM-side state mutation**, not a client-side one, because it changes a
process another client is participating in. This is why the GM is the arbiter of the ladder even
though individual decisions are made by their owners.

For `Teleport Servant`, the mutation includes replacing the defender entry entirely:

```js
state.defenders[i] = {
  uuid: servantUuid,
  state: "react",
  reaction: null,
  forbiddenReactions: ["evade", "block"],       // per the rule
  band: state.defenders[i].band,
};
```

**As built, that field had no reader** — it was written here and consulted nowhere, so a Servant
teleported into an attack it never saw coming could still Block and Evade it. It is honoured now
in **two** places, and both are needed: the chat card filters the buttons, and `advance` refuses
the transition outright. The card is a client; the transition is the boundary. A stale card, a
macro, or a second player's window must not be able to declare a reaction the Process has already
taken away.

Presence Concealment writes the same field, for a different rule (Ch. 12, *Reactions the Process
refuses*), which is why it is a list rather than a boolean.

---

## 27.10 The counter sub-process

A counter is a new `CombatProcess` within the same `CombatPhase`:

```js
async function offerCounters(phase) {
  const eligible = phase.defenders
    .filter(d => canCounter(d, phase))
    .sort(byTurnOrder);                    // deterministic sequencing for AoE

  for (const d of eligible) {
    const accepted = await promptCounter(d, phase, { timeout: 45_000, default: "declined" });
    if (!accepted) continue;
    await runProcess({
      phaseId: phase.id,
      processIndex: phase.processes.length,
      attackerUuid: d.uuid,
      defenders: [{ uuid: phase.attackerUuid, state: "react" }],
      context: { ...counterContext(d), isCounter: true },
    });
  }
}
```

Counters run **sequentially**, not in parallel, because each may kill the original attacker and
change whether subsequent counters are legal. Sorting by turn order makes the sequence
deterministic across clients.

`isCounter: true` suppresses the counter step in the nested process — *"Counters cannot be
Countered again."*

### Instant Counters

`Instant Counter`, `Dodge Counter`, `Guard Counter`, `Auto Counter`, and Mannanán's Fragarach
skip the prompt entirely and skip to Step 3 (for `Instant Counter`) or run a full process (for
the others). They are resolved GM-side without a message chain, because there is no decision to
make — only their results are reported.

---

## 27.11 Failure modes and recovery

| Failure | Detection | Recovery |
|---|---|---|
| GM disconnects mid-ladder | The `awaiting` deadline passes with no GM | New GM (or the same, reconnected) reads the latest message and resumes |
| Player disconnects | Deadline expiry | Default choice applied, logged |
| Two clients respond to the same prompt | Message creation is serialized; the second sees a state mismatch | The later response is rejected with "this step has already resolved" |
| Message chain forks | Two messages with the same `phaseId` and `processIndex` | GM keeps the first by creation timestamp, deletes the other, logs |
| State schema mismatch after an update | `v` field check | The phase is abandoned with a clear message; nothing applies |

The forked-chain case is the one worth guarding carefully: it is the natural consequence of a
race, and silently applying both branches would double-apply damage. The `v`-and-index check on
every transition makes it detectable.

---

## 27.12 Performance

| Metric | Target |
|---|---|
| Messages per simple attack | 3 (declare, react, resolve) — collapsed to 1 |
| Messages per full ladder | ≤ 8 — collapsed to 1 |
| Round trips per simple attack | 2 (declare→GM, react→GM) |
| Latency added per rung | ≤ 150 ms on a typical connection |
| AoE, 12 defenders | 1 declare + 12 parallel reactions + 1 batch apply |

The AoE row is the important one: parallel reaction collection means twelve defenders cost
roughly the same wall-clock time as one, bounded by the slowest human.

---

## 27.13 Summary of decisions

| # | Decision |
|---|---|
| D27.1 | Each ladder transition creates a new chat message carrying serialized state, whispered to the deciding user. |
| D27.2 | The wire `context` carries identifiers and scalars, never the attacker's effect list. |
| D27.3 | Damage is computed GM-side and sealed into the state before application. |
| D27.4 | AoE reactions are collected in parallel by a transient GM-side collector, rebuildable from messages. |
| D27.5 | Every timeout default is the option that spends no resource. |
| D27.6 | Intermediate messages are transient and are replaced by one summary card at terminal state. |
| D27.7 | Prompts are anchored, non-modal, and show exact computed odds. |
| D27.8 | Command Spell interrupts mutate the process state GM-side, not client-side. |
| D27.9 | Counters run sequentially in turn order; automatic counters skip the message chain. |
| D27.10 | Forked chains are detected by `(phaseId, processIndex)` and resolved by creation timestamp. |

---

**Next:** [28 — Targeting Implementation](28-targeting-implementation.md)
