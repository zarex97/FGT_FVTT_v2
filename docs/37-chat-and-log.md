# 37 — Chat cards, the game log and card visibility

## What it is

Attack cards are the visible surface of the whole engine. The card itself is the audit record: the process state and the damage breakdown live on message flags, so a match can be replayed from its chat log alone (`module/apps/chat/cards.mjs:2-8`). That is also what lets the reaction ladder resume after a reconnect.

Cards are not documents; they are ephemeral by Foundry's design — they scroll away, get cleared, interleave with out-of-character talk. The game log is the record that survives all three, shaped from the same events but stored durably on the Combat document (`module/engine/game-log.mjs:1-12`). The log records what happened, with optional GM overrides that show both the original and changed value.

A single card is read by many viewers, and each reads a different version of the same message. The redaction is by side, not by name: a row nobody claimed is a fact about the board (a facing bonus, terrain) and stays visible to everyone — dropping it would change the arithmetic a viewer can check, which is worse than revealing it (`module/rules/card-visibility.mjs:16-19`). Two visibility modes exist: "filtered" is one message that every client renders differently (fast, simple), and "strict" creates separate whispered messages per audience (slower, actually secure) (`module/rules/card-visibility.mjs:32`).

## Where it lives

| File | Role |
|---|---|
| `module/apps/chat/cards.mjs` | Creating and updating attack cards; redacting breakdowns per viewer |
| `module/rules/card-visibility.mjs` | Computing what each viewer should see: `cardFor`, `skillEffectsFor`, `redactBreakdown` |
| `module/rules/roll-log.mjs` | Roll records: every roll, what moved it, and what replaced it |
| `module/rules/game-log.mjs` | Log entries, appending, GM overrides, export payload (rules layer) |
| `module/engine/game-log.mjs` | Writing the log, flushing to Journal, exporting (engine layer) |
| `module/rules/explain.mjs` | Rendering damage breakdown into displayable rows |
| `module/apps/log-viewer.mjs` | The game log viewer — filtering, searching, exporting, applying overrides |

## How it works

### Building and updating cards

`renderAttackCard` creates a new attack message with the card context and stores process state on message flags (`module/apps/chat/cards.mjs:26-50`). `updateAttackCard` re-renders the card when the process advances, pulling state from the message flag and refreshing the template context (`module/apps/chat/cards.mjs:57-74`). The deadline for timeouts is stored on the message itself, so two clients cannot disagree by clock drift (`module/apps/chat/cards.mjs:67-69`).

### Card visibility

`cardFor` determines what one viewer should see, given a result and their role (`module/rules/card-visibility.mjs:44-75`). The attacker and defender see the header and their own damage total; a bystander sees only the header. The breakdown is shown only to those involved; the defender learns what effects landed by name (`module/rules/card-visibility.mjs:55-67`). Each roll carries its own visibility flag; a GM-only Discover roll on a card everyone can read would give away the Assassin's panel for free, so rolls are filtered per-viewer (`module/rules/card-visibility.mjs:71`).

`redactBreakdown` removes side-specific contributors but preserves the arithmetic: stage deltas and running totals stay visible so a viewer can check the numbers add up (`module/rules/card-visibility.mjs:139-155`). Contributors with no side are board facts and remain visible to everyone. `hiddenContributors` is a count rather than silence — something happened here and it was not yours (`module/rules/card-visibility.mjs:150-152`).

### The game log

Log entries are validated by kind on construction — a typo'd kind ends up invisible in the very place someone is looking for it (`module/rules/game-log.mjs:29-38`, `module/rules/game-log.mjs:56-74`). The last 200 entries live on `Combat.system.log` for quick access; older ones flush in batches of 100 to a JournalEntry (`module/engine/game-log.mjs:7-12`).

A GM override records both the original and changed value, with a required reason — an unexplained override is indistinguishable from a bug, so a log that permits one cannot be trusted (`module/rules/game-log.mjs:92-97`, `module/engine/game-log.mjs:55`). Sequence numbers are stable; an override references the entry it modified by `seq`, so renumbering on append would silently repoint every override at a different entry (`module/rules/game-log.mjs:14-16`).

### Rolls and rerolls

Every roll is recorded with raw roll, total, and modifiers (`module/rules/roll-log.mjs:25-35`). A GM re-roll keeps the original in the log — Principle P6 permits it; the log shows **both** so a re-roll passes unnoticed (`module/rules/roll-log.mjs:97-107`). A roll and everything it replaced form a chain, oldest first (`module/rules/roll-log.mjs:116-125`).

`visibleTo` filters rolls by their own visibility flag; hidden rolls are hidden for a reason — a Discover roll a player can read gives away the Assassin's panel without anyone rolling anything (`module/rules/roll-log.mjs:140-147`).

### Export and replay

`fullLog` reads back flushed entries from the journal and returns one continuous history (`module/engine/game-log.mjs:78-87`). `exportLog` produces a self-contained JSON export with the ruleset settings, roster setup rolls, and all recorded rolls — with them replay is exact; without them it is re-simulation, which proves nothing about the bug being reported (`module/engine/game-log.mjs:100-123`).

## Invariants & edge cases

1. **Process state on message flags survives reconnect.** The card IS the audit record; replaying a match means re-executing from the log, not from saved state, so the process must be readable from flags alone (`module/apps/chat/cards.mjs:2-8`).

2. **Visibility is by-side, not by-name.** A row with no side belongs to the board and is shown to everyone. Dropping it would silently change the arithmetic, which reads as a bug rather than as discretion (`module/rules/card-visibility.mjs:181-183`).

3. **Arithmetic stays visible even when contributors are redacted.** Stage delta, running total, and index stay visible so a viewer can check the numbers add up (`module/rules/card-visibility.mjs:120-124`).

4. **Sequence numbers never renumber.** Adding an override would silently repoint every earlier override at a different entry, so new entries are numbered one past the last, never renumbered (`module/rules/game-log.mjs:14-16`).

5. **A bystander learns something happened without learning what.** Effects are shown as a count; rolls are filtered; the summary is public. Silence reads as "the Skill did nothing", which is a different fact (`module/rules/card-visibility.mjs:89-90`).

## Traps and anti-patterns

**Registering a setting nobody reads.** `closedInfo` was registered in `settings.mjs` and read by nothing — a GM who turned it on or off changed no behaviour anywhere. Settings without readers are invisible configuration, and an invisible switch is not a control. **Read every setting you register, and make the code that reads it fail obviously if the setting vanishes.** (`module/settings.mjs:144-147`, `module/apps/chat/cards.mjs:175-182`, now fixed.)

**Computing a redaction and never using it.** `redactBreakdown` was computed and cached for years but never called to filter the breakdown that was displayed — the card showed the full result to everyone, including viewers who should not have seen it. The function was mathematically correct and never read, which made the defect invisible at review. **Redactors must be called at the point of rendering, and the template must receive the redacted output.** (`module/rules/card-visibility.mjs:163-164`, fixed at `module/apps/chat/cards.mjs:216`.)

## Open questions

- **Partly settled: the state is carried as a message flag, and both clients read the same document.**
  169 messages in the live world carry an `fgt.process` flag holding the full machine -- `attackerId`,
  `defenderId`, `attack`, `reaction`, `evaded`, `isAoE`, `groupId`, `isCounter`, `counterDepth`,
  `counterRedirectId`, `history` and `rolls`. Because the flag lives on the ChatMessage rather than in
  a client's memory, a reconnecting client rebuilds the card from the document instead of from
  anything that crossed a socket. `readProcess` tolerates both shapes it can arrive in, string or
  object (`module/net/operations.mjs:67-74`). What remains unexercised is a reconnect *mid-ladder*,
  which needs a client to drop between two rungs of a live exchange.

- **Confirmed self-contained; replay itself remains untested.** A live export returns
  `{format, exportedAt, systemVersion, settings, roster, entries, summary}` -- a format version, the
  system version it was produced by, the ruleset settings, the roster (3 rows here) and the entries
  (21). So the three things the claim names are all present, and the export does not depend on the
  world it came from. Whether they are *sufficient* to reproduce a match exactly is a stronger claim
  that nothing can settle today, because no replayer exists to consume the format.

- **Two visibility modes, one never chosen.** "Strict" creates separate whispered messages for security; "filtered" uses client-side rendering and is faster. The latter ships all the full result to every client that can read the flags, even those who should not see it. A compromised client or a careful look at the Foundry source could read fields the card template does not display. Most tables use "filtered" by default, making security opt-in and therefore not chosen (`module/rules/card-visibility.mjs:22-31`).
