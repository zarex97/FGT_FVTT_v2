# 38 — Authority: the GM proxy socket and typed operations

## What it is

Authority is the permission to write. A player owns their own Servants and Master — and nothing else. This rules out half the attack surface of a distributed system: a player cannot write documents they do not own, so they cannot reach into an opponent's Servant and damage it directly. The system enforces this rule in two places: statically, through ownership checks on the documents themselves, and dynamically, through the socket proxy.

When a player's action requires a write they lack authority for — an attack affecting an opponent's Servant, spending a command spell on the shared Combat document — the write is routed through the GM client via a **typed socket** instead of being refused. A typed operation is a declared, validated, authorized unit of work: not a free-form payload, but a named operation with an authorization predicate that checks whether the asker is entitled to it, and an executor that runs on the GM and applies the change. The table of operations is closed — there is no path from a socket message to arbitrary code — and every operation is recorded in one place (`module/net/operations.mjs:76-358`).

## Where it lives

| File | Role |
|---|---|
| `module/net/socket.mjs` | The GM proxy socket class — `request`, `ask`, `broadcast` |
| `module/net/operations.mjs` | The typed operation table `OPERATIONS` and `authorizeIntents` |
| `module/engine/applier.mjs` | `planApplication` splits a batch into local/remote/prompts by authority |
| `module/engine/io.mjs` | `proxy` and `prompt` route writes through the socket |
| `module/rules/schedule-claim.mjs` | Election of which connection runs a scheduler boundary |
| `module/engine/faction-ownership.mjs` | Keeping actor ownership in sync with faction assignments |

## How it works

### The GM proxy

A player client calls `FGTSocket.request(op, payload)` when it needs the GM to perform an operation (`module/net/socket.mjs:64`). The method checks that an active GM is connected; if the caller is the GM itself, the operation runs locally (because a client never receives its own broadcast). Otherwise, the socket emits a timestamped request and waits for a response with a sixty-second timeout (`module/net/socket.mjs:64`, `module/net/socket.mjs:76-90`).

The GM's receiver unmarshals the message and calls `#execute`, which looks up the operation in the `OPERATIONS` table, runs its authorizer against the payload and sender ID, and then — only if authorized — runs its executor (`module/net/socket.mjs:196-203`). A failed authorization throws `FORBIDDEN` without executing; a failed executor surfaces as a rejected promise with a code and message (`module/net/socket.mjs:175-188`).

The timeout message is deliberately phrased as a noncommittal notice rather than a failure: *"It may still have gone through — check the chat log before trying again"* (`module/net/socket.mjs:87-88`). A timeout does not cancel the GM's work, which may be hours into a resolution sequence; retrying a completed operation applies it twice.

### Authority and intents

When a client calls `applyWorldIntents` with a batch, the applier first resolves any unresolved effects, then validates every intent against the frozen type list (`module/engine/applier.mjs:76-88`). A validation failure aborts the whole batch. If validation passes, `planApplication` divides the batch into three categories (`module/engine/applier.mjs:83`):

- **Local**: intents this client may write directly — ones targeting units it owns, plus `log` entries which carry no authority.
- **Remote**: intents requiring GM authority — ones targeting units the client does not own, except `log` and `prompt`.
- **Prompts**: `prompt` intents that ask a human a question.

`planApplication` is **pure** — it takes a `canWrite` predicate and an `isGM` flag and makes the routing decision without touching documents (`module/engine/applier.mjs:38-62`). A GM takes everything locally; a player takes what it owns and proxies the rest.

Local intents are written through `io` directly. Remote intents are sent to `io.proxy`, which calls `FGTSocket.request("applyIntents", ...)` on the GM (`module/engine/io.mjs:1104-1106`). Prompts are sent to `io.prompt`, which calls `FGTSocket.request("prompt", ...)` to route the question to the named user (`module/engine/io.mjs:1112-1114`).

### The typed operation table

`OPERATIONS` is a frozen registry of named operations (`module/net/operations.mjs:76`). Each entry declares an `authorize` and an `execute` function. The authorizer is the load-bearing half: a client can ask the GM to do anything, so the GM must verify before acting.

`applyIntents` is the primary operation for proxied writes. Its authorizer calls `authorizeIntents`, which checks that every intent in the batch targets a unit the caller owns or does not move a document the caller has no business writing to (`module/net/operations.mjs:33-54`). An intent targeting `unitId` or `masterId` must pass an ownership test via `actor.testUserPermission(user, "OWNER")` — except for `log` and `prompt` intents, which carry no authority (`module/net/operations.mjs:45`, `module/net/operations.mjs:49-51`). If any single intent fails, the whole batch is refused (`module/net/operations.mjs:40-41`).

Other operations carry narrower authorizers. `setBudget` lets a player only modify the budget for a faction they control, and only while it is that faction's turn (`module/net/operations.mjs:209-231`). `declareCounter` checks that the Process is actually offering a counter rung before granting a free attack (`module/net/operations.mjs:167-187`). `resolveAttack` and `advanceProcess` check ownership of the unit at the center of the decision (`module/net/operations.mjs:124-156`). `spendCommandSpell` lets only the Master's owner spend its spell (`module/net/operations.mjs:105-122`). `createTargetRegion` and `deleteTargetRegion` check that only transient, grid-shaped regions can be created or deleted, so a player cannot author permanent scenery (`module/net/operations.mjs:281-324`).

The `prompt` operation exists because the question asking happens on the GM client (where the resolution runs) but the answer must come from the named player. The GM forwards the request to that user via `FGTSocket.ask`, which renders a dialog and waits for their choice (`module/net/operations.mjs:338-347`).

`module/net/operations.mjs` is one of three recorded exceptions to the layer boundary (`tools/check-layers.mjs:108-111`): the socket operation table statically imports `validate` from the engine layer (because every proxied batch must be validated immediately), while the individual operation executors are dynamically imported to avoid a static cycle through `applier → io → socket → operations`.

### Shared actions and the scheduler boundary

Some actions happen once per boundary and must run on exactly one connected client: scheduler hooks, effect expiries, the faction turn order. The system uses an election to pick one client.

`boundaryKey` names a boundary by its round and turn (`module/rules/schedule-claim.mjs:33`). `alreadyClaimed` checks whether that exact boundary has already been claimed by comparing the key and a per-scale election token in the Combat document's `scheduleClaim` flag (`module/rules/schedule-claim.mjs:52-61`). Each scale — turn and round — reads its own token so a round change (which is always also a turn change) does not short-circuit the round's own hooks (`module/rules/schedule-claim.mjs:45-50`).

The scheduler hook in the engine layer reads the boundary's numbers *before* they are advanced (because Foundry advances them before firing `updateCombat`), writes a new election token, and proceeds if this client is the winner (`module/engine/scheduler-hooks.mjs`). A losing client's hook reads the token the winner wrote and rejects.

### Ownership and factions

A player owns their Servants through faction assignment. `FactionOwnership` keeps every actor's Foundry `ownership` object in sync with `game.settings.get("fgt", "factions")` (`module/engine/faction-ownership.mjs:44-75`). When a faction is assigned a player via `setFactions`, or when an actor's `factionId` changes, `syncOne` rewrites that actor's ownership to grant the owning player full permission and revoke everyone else's (`module/engine/faction-ownership.mjs:40-42`).

The sync is GM-only: a player assignment takes effect only on the GM's client, because only the GM can write ownership on behalf of another user (`module/engine/faction-ownership.mjs:18`). Hooks fire on all connected clients and no-op for players.

## Invariants & edge cases

1. **Authority is checked on the GM client.** A player cannot bypass the check by opening DevTools or sending a malformed packet; the GM verifies every proxied write before applying it (`module/net/socket.mjs:196-203`).

2. **A malformed batch is refused whole.** Validation happens before splitting by authority, so a batch with one smuggled unauthorized intent is rejected in its entirety (`module/engine/applier.mjs:84-88`).

3. **Log entries carry no authority.** They are written by whoever produced them, duplicating one is harmless, and dropping one loses audit history. A player writes `log` intents locally even if they target units they do not own (`module/engine/applier.mjs:51-53`).

4. **Only the active GM's requests execute.** The receiver checks `game.users.activeGM?.isSelf` before handling a request, so requests from a player or a backgrounded GM tab are silently dropped (`module/net/socket.mjs:156-157`).

5. **Prompts route through the GM.** `io.prompt` calls `FGTSocket.request("prompt", ...)` instead of asking the user directly, because the question is usually being asked by a rule resolving on the GM client (`module/engine/io.mjs:1112-1114`).

6. **A `null` response to a prompt means the player declined.** The promise resolves to `null` rather than rejecting (`module/net/operations.mjs:339-346`).

7. **Faction ownership is written by the GM.** A player's faction assignment is read from the settings and written to every actor's ownership by sync hooks that fire on all clients and no-op for anyone but the GM (`module/engine/faction-ownership.mjs:18`, `module/engine/faction-ownership.mjs:35-42`).

## Traps and anti-patterns

**Proxying a batch without checking who owns each intent.** The socket proxy is an attack surface: a player can construct a batch that damages an opponent's Servant and hand it to the GM. `authorizeIntents` checks ownership of every intent before the GM applies anything — the entire function exists to prevent one player from using the GM as a vector to write another player's documents (`module/net/operations.mjs:33-54`). **Every proxied write is gated through the authorizer.** This also means that `trusted: true` on a payload is only safe when the GM produced the intents (e.g., from a resolved attack); a player's untrusted payload is validated every time (`module/net/operations.mjs:80-82`).

**Taking `isSelf` for granted in a multi-tab scenario.** Two browser tabs on one Gamemaster each call `game.users.activeGM.isSelf` and both get `true`, so both run the whole election sequence and write the same boundary twice. §46.4-D's recorded two-scale issue was exactly this: the shared `token` field was compared by both scales at once, the turn's write landed last, and the round's loss was actually a foreign token (`module/rules/schedule-claim.mjs:8-10`, `module/rules/schedule-claim.mjs:45-50`). **Each scale reads its own election token, and an election without a token is not a claim** (`module/rules/schedule-claim.mjs:52-61`). (Fixed: schedule-claim now has separate token fields per scale; the check compares both the token and the boundary key.)

**Assigning a faction without updating actor ownership.** The system stated the design clearly — *"A player owns their own Servants and Master"* — but `game.settings.get("fgt", "factions")` held the assignment correctly while every actor's ownership stayed `{default: 0}` (`module/engine/faction-ownership.mjs:3-8`). A player with a faction could not open their own Servant's sheet with real Foundry permission, could not drag the token, and saw the standard image instead of the concealed one (because the concealment check reads `actor.isOwner`) (`module/engine/faction-ownership.mjs:8-12`). **Faction ownership is synced through hooks that fire every time the assignment changes, and these hooks are enforced only for the GM** (`module/engine/faction-ownership.mjs:35-42`). (Fixed: FactionOwnership sync hooks now rewrite actor ownership whenever the faction roster changes or an actor's factionId is modified.)

## Open questions

- **Tested with a real second client, and the answer is sharper than the claim.** A second browser
  joined the live world as **Player1** (both clients active and `game.ready`). Player1 then asked the
  proxy to write to an actor it does not own, and the request came back **`FGTError: FORBIDDEN`** --
  `authorizeIntents` requires the caller to own every non-`log`, non-`prompt` target
  (`module/net/operations.mjs:44-51`). A write to an actor Player1 *does* own returned
  `{applied: 1, proxied: 0}`: it went **local** and never touched the socket. So for a player the
  generic channel is either unnecessary or refused, and "applies identically" is true only of batches
  that were authorized in the first place -- the GM then runs the same `applyIntents` with
  `canWrite: () => true` (`module/net/operations.mjs:84-91`). Real play does not lean on this channel:
  contested attacks go through a dedicated `resolveAttack` operation *"computed on the GM client
  because the GM's snapshot is authoritative"*, and there are **eleven** typed operations in total,
  each authorizing on its own terms.

- **Structurally confirmed from both clients simultaneously.** With the Gamemaster and Player1 both
  connected, `tokenField("turn")` returns `"turnToken"` and `tokenField("round")` returns
  `"roundToken"` on **each** client -- two separate fields, so the two elections cannot overwrite one
  another. That is exactly the defect the separation fixed: a round boundary is always also a turn
  change, so a shared token let the turn's write land last and the round's comparison then found a
  stranger's token and concluded it had lost. What two connected clients cannot show without forcing a
  real boundary is the race itself; the field separation that prevents it is verified from both sides.

- **Why does `io.proxy` still exist as a separate method?** Now that every operation goes through `FGTSocket.request`, could `io.proxy` call it directly, or does the indirection serve testability?
