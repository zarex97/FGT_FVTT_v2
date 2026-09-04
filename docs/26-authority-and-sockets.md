# 26 — Authority and Sockets

> **The Skill card had no visibility model at all (Ch. 45).** §26.7 describes `filtered` and
> `strict`, and the attack card uses `cardFor`; the Skill card listed every effect it applied to
> everybody. A Servant buffing ITSELF announced each buff to the table, which tells an opponent
> exactly what it just gained.
>
> It runs `filtered` properly now, and is the first card that does: the message content ships
> with a COUNT, the flags carry each row with the users entitled to read it, and
> `renderChatMessageHTML` fills the list per viewer. The caster's controller and the GM see
> everything; everyone else sees what landed on a unit they control, and a count for the rest.
>
> The documented trade stands and is worth restating: a filtered card still ships the full list
> in its flags to every client that can read them. `strict` — a whisper per audience — is the
> setting for a table that wants more than that, and remains unimplemented.
>
> **The attack card is still baked by the acting client.** `cardFor` is called with
> `game.user.id` at build time, so the redaction is computed for whoever pressed the button and
> then stored for everyone. Giving it the same flags-and-hook treatment is the obvious next step
> and is not done.

> **Implementation note (Ch. 45).** `FGTSocket.ask(userId, spec)` joins `request` and `broadcast`
> as a third routing shape: a question for **one named user**, awaiting their answer. `request`
> sends everything to the active GM, which is right for anything that writes and exactly wrong for
> a prompt — the whole point of a prompt is that a *particular* player answers it. Its absence had
> left `io.prompt` emitting a `"prompt"` operation that `OPERATIONS` never contained, so every
> prevention Luck Check threw `UNKNOWN_OP` instead of asking anyone anything.
>
> The answering client renders through `module/apps/prompt.mjs`, a kind table rather than a dialog
> class per question: the asker is a rule that knows what it needs answered, not what the answer
> looks like, and a rule that imported a dialog would put layer 4 inside layer 2. A dismissed
> window resolves to `null` — declining is an answer, and the caller decides what it means.
>
> **Implementation note (Ch. 45 B1).** A `spendCommandSpell` typed operation joins the table,
> authorized to the Master's **owner** rather than to any player: a Command Spell can interrupt a
> resolution another client is participating in, so it is executed GM-side for the same reason
> `resolveAttack` is (Model B, §26.4).
>
> That interrupt is the sharpest case this chapter's argument covers — the GM arbitrates the
> ladder even though each individual rung is answered by its owner.

Players must drive resolutions that write to actors they do not own — applying a debuff to an
enemy, damaging a defender, moving a knocked-back unit. Foundry's permission model forbids it.
This chapter specifies the GM proxy protocol that bridges the gap, and is honest about what it
can and cannot guarantee.

---

## 26.1 The problem

Foundry permissions are per-document. A player owns their own Servants and Master —
**mechanically**, this means `engine/faction-ownership.mjs` (Ch. 45) grants a faction's assigned
user OWNER on every actor with that `factionId`, kept in sync with `apps/faction-config.mjs`.
That statement used to describe only the intent: the config dialog recorded the assignment and
nothing ever turned it into an actual `ownership` write, so a player assigned to a faction had
`NONE` on their own Servant regardless — unable to open it with real permission, drag its token
(Foundry's own permission gate, distinct from this chapter's proxy and from this system's own
MOV/budget legality), or pass the `isOwner` exemption Ch. 04 §4.2's identity concealment checks.

An attack resolution needs to:

- reduce the **defender's** health,
- apply effects to the **defender**,
- reduce the **defender's** agility from the injury roll,
- change the **defender's** facing,
- possibly move a **third party** (knockback, Cover shove),
- update the **shared** Combat document's log.

The attacking player owns none of those documents.

### Why `actor.isOwner` is not a safe fast path

The prototype documented this precisely and it is the single most valuable operational finding
it produced:

> `isOwner` can return true (OWNER on the base actor) while the `ActorDelta` still blocks
> writes, producing *"User X lacks permission to create Item […] in parent ActorDelta […]"*.

Foundry has two kinds of actor: linked (living in `game.actors`) and synthetic/unlinked (living
inside a `TokenDocument`'s `ActorDelta`). Ownership on the base actor does not imply write
permission on the delta.

**DECISION.** No `isOwner` fast path. **Every** cross-actor write routes through the proxy. The
proxy short-circuits to a local call when the caller *is* the active GM, so there is no
performance cost in the common single-GM case, and there is exactly one code path to reason
about.

---

## 26.2 The GM proxy

```js
export class FGTSocket {
  static NS = "system.fgt";
  static #pending = new Map();          // requestId → {resolve, reject, timer}

  static initialize() {
    game.socket.on(this.NS, this.#onReceive.bind(this));
  }

  static async #onReceive(msg, senderId) {
    switch (msg.kind) {
      case "request":
        if (!game.users.activeGM?.isSelf) return;      // only one client handles it
        return this.#handleRequest(msg, senderId);
      case "response":
        return this.#handleResponse(msg);
      case "event":
        return this.#handleEvent(msg, senderId);
    }
  }

  /** Public entry point. Returns a promise resolving to the operation's result. */
  static async request(op, payload, { timeout = 15_000 } = {}) {
    if (!game.users.activeGM) throw new FGTError("NO_ACTIVE_GM",
      "No Game Master is connected. This action requires a GM.");

    const id = foundry.utils.randomID();
    const msg = { kind: "request", id, op, payload, userId: game.user.id };

    // We are the GM: execute locally. The emitter never receives its own broadcast.
    if (game.users.activeGM.isSelf) return this.#execute(op, payload, game.user.id);

    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new FGTError("TIMEOUT", `Operation "${op}" timed out.`));
      }, timeout);
      this.#pending.set(id, { resolve, reject, timer });
    });
    game.socket.emit(this.NS, msg);
    return promise;
  }
}
```

Three improvements over the prototype's version, all of which matter:

1. **Request/response, not fire-and-forget.** The prototype's `gmProxy()` returns nothing; the
   caller cannot know whether the operation succeeded. Ours returns a promise, so a failed
   effect application surfaces as an error instead of a silent no-op.
2. **Timeouts.** A GM whose tab is throttled would otherwise hang the caller forever.
3. **Typed operations with server-side validation** (§26.3), rather than a switch over
   free-form payloads.

---

## 26.3 The operation protocol

Every operation is a declared, validated, authorized unit of work.

```js
export const OPERATIONS = {
  applyIntents: {
    schema: { intents: "Intent[]", source: "string" },
    authorize: (payload, userId) => IntentAuthorizer.check(payload.intents, userId),
    execute:   (payload) => IntentApplier.applyAll(payload.intents, { trusted: true }),
  },

  createEffects: {
    schema: { targetUuid: "string", effects: "EffectData[]" },
    authorize: (p, uid) => canApplyEffectsTo(p.targetUuid, uid),
    execute:   async (p) => (await fromUuid(p.targetUuid))
                              ?.createEmbeddedDocuments("ActiveEffect", p.effects),
  },

  deleteEffects:      { /* … */ },
  updateActor:        { /* … */ },
  moveToken:          { /* … */ },
  createSceneDocs:    { /* Regions, Levels for platforms */ },
  deleteSceneDocs:    { /* … */ },
  createLevel:        { /* platform activation */ },
  advanceCombat:      { /* … */ },
  updateCombatLog:    { /* … */ },
  rollHidden:         { /* Discover rolls, concealed-AoE flips */ },
  resolveCombatStep:  { /* the reaction ladder — Ch. 27 */ },
};
```

### Authorization is not optional

The naive proxy — "the GM executes whatever a player asks" — makes every player a de-facto GM.
Any client can emit a socket message; nothing stops a modified client from asking the GM to set
an enemy's health to zero.

**DECISION.** Every operation authorizes against the requesting user before executing.

```js
const IntentAuthorizer = {
  check(intents, userId) {
    const user = game.users.get(userId);
    if (user?.isGM) return { ok: true };

    for (const intent of intents) {
      const reason = this.#checkOne(intent, user);
      if (reason) return { ok: false, reason };
    }
    return { ok: true };
  },

  #checkOne(intent, user) {
    // 1. Is there an operation in flight that legitimises this write?
    const ctx = ActiveContexts.forUser(user.id);
    if (!ctx) return "No active resolution authorises this write.";

    // 2. Does the intent fall within that context's declared effect scope?
    if (!ctx.affects(intent)) return `Intent targets ${intent.unitId}, outside the declared scope.`;

    // 3. Is the magnitude within what the context computed?
    if (intent.t === "damage" && intent.amount > ctx.maxDamageFor(intent.unitId))
      return "Damage exceeds the computed value.";

    return null;
  },
};
```

The key concept is an **ActiveContext**: when a player declares an attack, the GM client records
what that resolution is permitted to do (which units, up to what damage, which effects). Intents
arriving outside a matching context are rejected and logged.

**RISK.** This is defence in depth, not a security boundary. A determined cheater with a
modified client can still declare a legitimate attack and manipulate the *inputs* to the
computation on their own client. Full protection requires GM-side recomputation of every
resolution (§26.5).

---

## 26.4 Where computation happens

Three options, each with a different trade-off:

| Model | Latency | Trust | Complexity |
|---|---|---|---|
| **A. Attacker computes, GM applies** | Best | Weakest | Lowest |
| **B. GM computes and applies** | One extra round trip | Strong | Medium |
| **C. Both compute, GM verifies** | Best, with async check | Strong | Highest |

**DECISION.** Model **B** for anything contested, Model **A** for anything self-affecting.

```js
function computationSite(op) {
  if (op.affectsOnlySelf) return "local";        // buffing your own Servant
  if (op.isContested)     return "gm";           // attacks, debuffs, checks
  return "gm";                                   // default to the safe option
}
```

Rationale: the extra round trip is ~20–80 ms on a LAN or decent connection, which is invisible
next to the human decision time in the reaction ladder. Buying strong correctness for that price
is obviously right. Self-buffs are computed locally because they are frequent, uncontested, and
their inputs are all owned by the caller.

The pure-pipeline design (Ch. 13) makes this trivial: the same `computeDamage(ctx)` runs on
either client, and the GM's snapshot is authoritative.

---

## 26.5 Hidden rolls

Two situations require a roll that the players must not observe.

### The Discover roll

> *"The Overseer will perform the Discover rolls, since if either Player performs the roll, that
> would mean that they would already know there is a Unit with Active Presence Concealment in
> the area."*

The rule is explicit that the *existence* of the roll leaks information. So:

- The roll is performed on the GM client.
- **No message is created on failure.** Nothing is broadcast at all.
- On success, a message announces the discovery.

```js
async function discoverCheck(concealed, observer) {
  if (!game.users.activeGM?.isSelf) return;      // GM only, silently
  const pct = PC_DISCOVER_CHANCE[concealed.pcRank];
  const roll = await new Roll("1d100").evaluate();
  if (roll.total <= pct) {
    await FGTSocket.broadcast("event", { kind: "discovered",
      unitId: concealed.id, byId: observer.id });
  }
  // failure: nothing. Not even a GM-only message, since a GM watching the log
  // would learn nothing they don't already know, but the absence keeps the log clean.
}
```

### Concealed units caught in AoE

A concealed unit inside an AoE resolves by coin flip (Ch. 09 §9.5). The attacker must not learn
that a concealed unit was present. So all AoE coin flips resolve in one GM-side batch, and the
attacker's result card shows only the units they could already see.

**RISK.** Timing leaks. A resolution that takes noticeably longer implies a hidden roll.
Mitigation: AoE resolutions always run the hidden-roll batch, even when there are no concealed
units (a zero-length batch), so the timing profile is uniform. Cheap and effective.

---

> **Status: §26.6's own decision stands, and §26.7 is built.** The shadow-actor pattern is
> **deliberately not implemented** — this section assesses it and defers it to Ch. 40, and that
> assessment has not changed: Foundry cannot hide part of a document, the workaround doubles the
> document count, and its failure mode leaks the wrong thing. Building it would compromise the v1
> architecture for a mode most groups will not use. This row is a **decision**, not a gap.
>
> What *is* built is the half this section says covers most of the practical benefit at a fraction
> of the cost: the card. `module/rules/card-visibility.mjs` implements §26.7, and it is wired into
> `module/apps/chat/cards.mjs`.

## 26.6 Closed-information play

The rulebook supports Closed Info games where enemy stats and abilities are hidden. This is the
hardest requirement in the chapter and it deserves an honest assessment.

### What Foundry can do

Document ownership gates data delivery. An actor with `NONE` ownership for a user is not sent to
that user's client at all. An actor with `LIMITED` sends only name and image.

### What Foundry cannot do

Hide *part* of a document. If a client can see an actor on the canvas, it has the whole actor,
including every embedded effect and ability. There is no field-level permission.

### The shadow-actor pattern

**DECISION.** In Closed Info mode, each unit has two documents:

```
Real actor         ownership: OWNER for the controller, NONE for everyone else
  ↕ synchronised by the GM client
Shadow actor       ownership: OBSERVER for everyone
                   contains: name (or alias), current/max health, position,
                             publicly-revealed effects only
```

Tokens on the canvas reference the **shadow** for non-owners and the **real** actor for the
owner and GM. The GM client keeps them in sync on every relevant change.

Costs, stated plainly:

| Cost | Detail |
|---|---|
| Document count | Doubles (28 → 56 actors) |
| Sync overhead | One extra write per public state change |
| Complexity | Every UUID reference must resolve to the right one for the caller |
| Failure mode | A sync bug leaks or hides the wrong thing |

**DECISION.** Closed Info is **opt-in, off by default, and clearly labelled experimental** in
v1. Open Info play — the rulebook's other supported mode — has none of these costs and is what
most groups will use. Building the shadow-actor machinery is deferred to a later milestone
(Ch. 40) rather than compromising the v1 architecture for it.

The rulebook's information-leak rules (a player learns *that* a skill was used, and learns the
effects applied to *their own* units) are implemented at the **chat card** level regardless of
mode — the card whispers different content to different users. That covers most of the practical
benefit at a fraction of the cost.

---

> **Implemented.** `module/rules/card-visibility.mjs`. Redaction is **by side**, and a row with no
> side is kept: an unattributed row is a fact about the board — a facing bonus, terrain — and
> dropping it would leave a breakdown whose numbers do not add up, which is worse than revealing
> it. A viewer who is both attacker and defender (an AoE that caught its caster, a charmed Servant
> attacking its own faction) sees everything, because there is no side to hide it from.
>
> `VISIBILITY_MODES` names the two this section documents. The default is `filtered` — one
> message, rendered differently per client — and the honest caveat is recorded in the module: a
> filtered card still *ships* the full result to every client that can read the flags, so `strict`
> is the one that is actually secure.

## 26.7 Chat card visibility

```js
function buildCard(result, viewer) {
  const isAttacker = viewer.id === result.attackerController;
  const isDefender = result.defenderControllers.includes(viewer.id);
  const isGM = viewer.isGM;

  return {
    header: result.summary,                        // always
    damage: (isAttacker || isDefender || isGM) ? result.total : "—",
    breakdown: isGM ? result.fullBreakdown
             : isAttacker ? redactDefenderSources(result.fullBreakdown)
             : isDefender ? redactAttackerSources(result.fullBreakdown)
             : null,
    effectsApplied: isDefender || isGM ? result.effects : result.effects.length,
    rolls: result.rolls.filter(r => canSee(r, viewer)),
  };
}
```

So a bystander sees *"Karna attacked Heracles"*; the defender sees the damage and the effects
applied to them; the attacker sees the damage and their own contributing modifiers; the GM sees
everything. Implemented with one message per audience, or a single message with
client-side filtering, depending on the strictness setting.

**DECISION.** Default to **one message with client-side filtering** (fast, simple), and offer a
strict mode that creates separate whispered messages (slower, actually secure). The distinction
is documented so a group can choose knowingly.

---

## 26.8 Error handling

Errors must reach the user who caused them, not vanish into the GM's console.

```js
static async #handleRequest(msg, senderId) {
  const op = OPERATIONS[msg.op];
  if (!op) return this.#respond(msg, { ok: false, error: { code: "UNKNOWN_OP" } });

  const auth = op.authorize(msg.payload, msg.userId);
  if (!auth.ok) {
    console.warn(`fgt | Rejected ${msg.op} from ${msg.userId}: ${auth.reason}`);
    return this.#respond(msg, { ok: false, error: { code: "FORBIDDEN", detail: auth.reason } });
  }

  try {
    const result = await op.execute(msg.payload, msg.userId);
    return this.#respond(msg, { ok: true, result });
  } catch (err) {
    console.error(`fgt | ${msg.op} failed:`, err);
    return this.#respond(msg, { ok: false, error: { code: "EXECUTION", detail: err.message } });
  }
}
```

The requesting client turns a failed response into a visible notification naming the operation
and the reason. Rejections are also written to the GM's log, so a GM can see if a client is
behaving oddly.

---

## 26.9 Batching

An AoE Noble Phantasm against twelve units produces perhaps 60 intents. Sending 60 socket
messages would be pathological.

**DECISION.** Intents are always sent as one `applyIntents` batch per resolution, and the
applier groups them by document:

```js
async function applyAll(intents) {
  const byActor = groupBy(intents, i => i.unitId);
  const ops = [];
  for (const [uuid, group] of byActor) {
    const actor = await fromUuid(uuid);
    const updates = mergeStatIntents(group);              // one update() per actor
    const creates = group.filter(i => i.t === "applyEffect").map(toEffectData);
    const deletes = group.filter(i => i.t === "removeEffect").map(i => i.effectId);
    ops.push(
      updates && actor.update(updates),
      creates.length && actor.createEmbeddedDocuments("ActiveEffect", creates),
      deletes.length && actor.deleteEmbeddedDocuments("ActiveEffect", deletes),
    );
  }
  await Promise.all(ops.filter(Boolean));
}
```

Twelve defenders become at most 36 document operations issued in parallel, from one socket
message.

---

## 26.10 The `ActiveContext` lifetime

```
Player declares an attack
  └─▶ GM client creates an ActiveContext:
        { userId, attackerId, targetIds, maxDamagePerTarget, allowedEffectIds,
          expiresAt: now + 120s, ladderState }
  └─▶ context is consulted for every incoming intent
  └─▶ context is destroyed on resolution completion, timeout, or cancellation
```

Contexts are held on the GM client only and never persisted. A reconnecting GM loses them, so a
mid-flight resolution after a GM reconnect falls back to GM-recomputation (Model B), which is
what happens anyway for contested operations.

---

## 26.11 Summary of decisions

| # | Decision |
|---|---|
| D26.1 | No `isOwner` fast path; every cross-actor write goes through the proxy, which short-circuits locally when the caller is the GM. |
| D26.2 | The proxy is request/response with timeouts, not fire-and-forget. |
| D26.3 | Every operation declares a schema, an authorizer, and an executor. |
| D26.4 | Authorization is checked against an `ActiveContext` describing what the in-flight resolution may do. |
| D26.5 | Contested computation happens on the GM client (Model B); self-affecting computation is local (Model A). |
| D26.6 | Hidden rolls are GM-only and produce no message on failure; AoE always runs a hidden-roll batch so timing does not leak. |
| D26.7 | Closed Info uses shadow actors, is opt-in and experimental, and is deferred past v1. |
| D26.8 | Chat card redaction is per-viewer, defaulting to client-side filtering with a strict whisper mode available. |
| D26.9 | Intents are batched into one socket message and grouped into one document operation per actor. |
| D26.10 | Rejections and failures produce a visible notification to the requester and a GM log entry. |

---

**Next:** [27 — The Reaction Protocol](27-reaction-protocol.md)
