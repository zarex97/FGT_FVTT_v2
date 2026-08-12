# 30 — Chat and Audit

Success criterion **SC-5**: any damage number in the log expands into the ordered list of every
stage that produced it, and a GM can answer "why?" in under ten seconds. This chapter specifies
how.

---

## 30.1 Why audit is a first-class feature

In a game with a sixteen-stage damage pipeline, ~120 interacting effects, and five different
scopes for "does this apply to NP", the question *"why is that number 2,071?"* will be asked
constantly — during play, during balance discussions, and during bug reports.

A system that cannot answer it has three failure modes:
1. Players do not trust the automation and recompute by hand, defeating the purpose.
2. Bugs are reported as "the damage felt wrong", which is unactionable.
3. Rule disagreements cannot be settled without reading the code.

The breakdown data already exists — the pipeline produces it as a byproduct (Ch. 13 §13.1). The
work is presenting it.

---

## 30.2 The card hierarchy

```
Combat Phase card                    one per attack exchange, permanent
 ├── summary line                    "Karna ⚔ Heracles — 2,071 damage"
 ├── outcome lines                   evade result, crit, effects applied
 ├── ▸ Full trace                    every ladder step and roll
 └── ▸ Damage breakdown              the 16 stages, per defender

Ability card                         one per non-attack ability use
 ├── summary                         "Van Gogh used Het Gele Huis"
 ├── targets                         who was affected
 └── ▸ Effects applied               per target, with resistance rolls

Scheduler card                       one per turn/round boundary, collapsed by default
 ├── expiries
 ├── periodic damage
 └── regeneration

System card                          contracts, defeats, Grail state, victory
```

Four types. Everything else is a notification, not a message.

---

## 30.3 The damage explainer

The centrepiece. Rendered from the `Stage[]` array the pipeline returns.

```
┌─ Karna ⚔ Heracles ─────────────────── Brahmastra Kundala (A+) ─┐
│                                                                 │
│  2,071 damage    958 magical · 1,113 physical      ✦ CRIT       │
│  + Burn (3◈)  + Def Dwn (B) (1◈)                                │
│                                                                 │
│  ▾ Damage breakdown                                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  1  Base                                          300     │  │
│  │       BA(STR) 125 + BA(MAG) 175                           │  │
│  │  2  Ability multiplier            × 4 + 100     1,300     │  │
│  │  3  Crit (Attack+)                    × 1.5     1,950     │  │
│  │  4  Combined percent                    +40%    2,730     │  │
│  │       Atk Up (NP)          Flash of the Sun God    +30    │  │
│  │       NP DmUp              Flash of the Sun God    +20    │  │
│  │       Home Base            Heracles's home base    −10    │  │
│  │  5  Component amplification              —      2,730     │  │
│  │  6  Band                                 —      2,730     │  │
│  │  7  Flat attack bonuses                  +50    2,780     │  │
│  │       Divinity A           Karna                  +50     │  │
│  │  8  Environment                          —      2,780     │  │
│  │  9  ZON penalty                          —      2,780     │  │
│  │       Karna is inside his Master's ZON                    │  │
│  │ 10  Luck: Increased Damage               —      2,780     │  │
│  │       ✕ blocked for Noble Phantasms                       │  │
│  │ 11  Resistance                          −40%    2,131     │  │
│  │       Magic Resistance B vs NP Rank A+                    │  │
│  │       B (300) < A+ (401) → not negated, −40% on MAG       │  │
│  │ 12  Flat reductions                      −32    2,099     │  │
│  │       Territory Creation B  3d10+15 → 32                  │  │
│  │ 13  Luck: Reduced Damage                 —      2,099     │  │
│  │ 14  Block                                −28    2,071     │  │
│  │       Block 5d10 → 14, doubled for NP → 28                │  │
│  │ 15  Total-damage modifiers               —      2,071     │  │
│  │ 16  Clamp                                       2,071     │  │
│  │       Injury threshold (pre-Def Crk): 2,071 > 100 → YES   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ▸ Not applied (4)                                              │
│  ▸ Rolls (5)                                                    │
└─────────────────────────────────────────────────────────────────┘
```

Three properties that make this useful rather than merely thorough:

1. **Stages with no contribution still appear**, marked `—`. Their absence would raise the
   question "was stage 9 even considered?"
2. **Blocked contributions are shown with the reason** (stage 10's `✕ blocked for Noble
   Phantasms`), not omitted.
3. **The rank comparison is shown as arithmetic** (`B (300) < A+ (401)`), because the ordinal
   scheme (Ch. 05 §5.3) is the single most confusing part of the rules and showing the numbers
   settles arguments instantly.

---

## 30.4 "Not applied"

The section that catches bugs. Every rule element that was *considered* and did not apply,
with the failing predicate clause:

```
▸ Not applied (4)
   Dmg Up (Gods)              Scáthach's God Slayer — not this attacker
   Atk Up (GreekMale)         requires target:region:greece
                              Heracles has: region:greece ✓, attribute:male ✓
                              → but this element is on Penthesilea, not Karna
   Insight                    Heracles does not have this buff
   Def Up                     Heracles has no Def Up effect
```

This is produced from the `Contribution` records with `predicateResult` traces (Ch. 24 §24.9).
In production it lists only elements present on the two participants; in dev mode it lists
every registered element that was evaluated.

**RISK.** This section can be long. It is collapsed by default and capped at 20 entries with a
"show all" link.

---

## 30.5 The roll section

```
▸ Rolls (5)
   Crit determination     coin flip (50% + 0%)         → Attack+
   Territory Creation     3d10+15  [7, 4, 6] +15       → 32
   Block                  5d10     [3, 1, 4, 2, 4]     → 14  ×2 (NP) = 28
   Burn resistance        1d100 → 34   vs 100%         → applied
   Def Dwn (B) resistance 1d100 → 71   vs 100%         → applied
```

Every roll shows its formula, its raw dice, its modifiers, and its final value. GM re-rolls
appear as a struck-through original with the replacement below and the reason.

---

## 30.6 The full trace

The ladder, reconstructed from the message chain (Ch. 27 §27.7):

```
▸ Full trace (11 steps)
   1   Karna declares Brahmastra Kundala, 7×7 within Range 5, anchored at f7
       Targets: Heracles, Enemy Master, Berserker
       Cost paid: Jinako −53 Health (118 → 65)
   2   Heracles chooses Block
   2   Enemy Master chooses Evade
   2   Berserker cannot React (Berserk)
       Evade (Enemy Master)  1d20 → 8, +3 (NP), +2 (AoE) = 13  vs Agility 9  → FAILED
   2.4 Enemy Master declines Lucky Evasion
   3   Damage Step
       Heracles      2,071    Enemy Master  412    Berserker  2,340
   3   Enemy Master: Overpower does not apply (this is an NP, not a Servant attack)
   4   Injury rolls: Heracles 1d4 → 3 (Agility 19 → 16)
                     Berserker 1d4 → 2 (Agility 14 → 12)
       Enemy Master defeated — no injury roll
   5   (no facing update — AoE)
   6   Counter: Heracles is in range (2), offered → declined
       Berserker cannot Counter (Berserk)
```

Every line is derived from `RollRecord`s and state transitions already stored. Nothing is
constructed for display.

---

## 30.7 Per-viewer content

Chapter 26 §26.7 specifies redaction. In the card:

| Viewer | Sees |
|---|---|
| GM | Everything |
| Attacker | Damage, their own contributing modifiers, their own rolls; defender modifiers shown as an aggregate (`defender reductions: −60`) |
| Defender | Damage taken, effects applied to them, their own modifiers and rolls; attacker modifiers as an aggregate |
| Bystander | The summary line only |

In open-info mode (the default) everyone sees everything and the redaction layer is a no-op.

---

## 30.8 The game log

Chat is ephemeral in practice — it scrolls, it gets cleared, and it interleaves with
out-of-character talk. A separate structured log serves the audit and post-game analysis needs.

```ts
interface LogEntry {
  seq: number;
  globalTurn: number;
  round: number;
  kind: "attack" | "ability" | "effect" | "movement" | "contract" | "commandSpell"
      | "defeat" | "scheduler" | "grail" | "gmOverride";
  actorIds: string[];
  summary: string;
  detail: unknown;                  // kind-specific payload
  rolls: RollRecord[];
  messageId: string | null;         // link back to the chat card
}
```

**Storage.** The last 200 entries live on `Combat.system.log` for quick access; older entries
are flushed in batches of 100 to a `JournalEntry` named after the match. This bounds the
document size (Ch. 22 §22.8's RISK) while keeping the full history recoverable.

**The log viewer** is an ApplicationV2 with filters by turn, actor, and kind, and a search box.
Its most-used function in practice will be "show me everything that happened to my Servant last
round".

---

## 30.9 Export and replay

`Combat.exportLog()` produces a self-contained JSON file: the ruleset, the roster with setup
rolls, and every log entry with its rolls.

Two uses:

**Bug reports.** A player attaches the export; the maintainer replays the exact sequence
against the same seeds. Because the rules layer is pure and consumes a roll map, replay is
exact — the same inputs produce the same outputs, byte for byte.

**Balance analysis.** Aggregate statistics across many exported matches: average damage by
Servant, crit rates, how often Luck Checks are contested, which Command Spells are actually
used. The kind of data that turns "Heracles feels too strong" into a measurement.

**Replay is not** a full match reconstruction with visuals; it is a deterministic re-execution
of the rules layer against recorded inputs, used to verify outputs. Building a visual replayer
is a possible later feature and is not needed for either use above.

---

## 30.10 GM overrides in the record

Principle P6 says the GM can override anything. Principle "report outcomes faithfully" says the
record must show it.

```
┌─ GM OVERRIDE ───────────────────────────────────────────┐
│  Original: Heracles takes 2,071 damage                   │
│  Changed to: 1,000 damage                                │
│  Reason: "Ruled that Territory Creation should apply     │
│           twice here — see the discussion in #rules"     │
│  By: GM (Alice) at Round 7, Turn 2                       │
└──────────────────────────────────────────────────────────┘
```

Overrides are visually distinct, always attributed, and always carry a reason (the field is
required). They appear in the log with `kind: "gmOverride"` and reference the entry they
modified.

Re-rolls follow the same pattern: the original roll remains in the record, struck through, with
the replacement and reason beneath.

---

## 30.11 Notifications vs messages

A frequent design error is putting everything in chat. Our split:

| Goes to chat | Goes to a notification |
|---|---|
| Anything another player needs to see | "You cannot move there: enemy Master protection" |
| Anything with a permanent record value | "Not enough Fragarach Tokens" |
| Anything requiring a decision | "Cooldown: 4 more turns" |
| Damage, effects, defeats | "Targeting cancelled" |
| Scheduler boundaries | Validation failures the player caused and can fix immediately |

The rule: if it is a consequence of the game state, it is a message; if it is feedback on your
own attempted input, it is a notification.

---

## 30.12 Chat card performance

| Concern | Mitigation |
|---|---|
| Transient ladder messages accumulating | Deleted on phase completion (Ch. 27 §27.7) |
| Large breakdown payloads in flags | The breakdown is rendered to HTML at creation and the raw payload stored only for the GM's copy |
| 12-defender AoE producing 12 breakdowns | One card with a per-defender accordion, not 12 cards |
| Re-rendering on scroll | Breakdown sections render lazily on first expansion |

---

## 30.13 Summary of decisions

| # | Decision |
|---|---|
| D30.1 | Four card types only; everything else is a notification. |
| D30.2 | The damage explainer shows all 16 stages, including those with no contribution, with reasons for blocked contributions. |
| D30.3 | Rank comparisons are displayed as ordinal arithmetic to settle the most confusing rule. |
| D30.4 | A "not applied" section lists considered-but-inapplicable elements with their failing predicate clause. |
| D30.5 | The structured log is separate from chat, capped on the Combat document, and flushed to a JournalEntry. |
| D30.6 | Export enables exact deterministic replay because the rules layer is pure and consumes a recorded roll map. |
| D30.7 | GM overrides and re-rolls are visually distinct, attributed, and require a reason. |
| D30.8 | An AoE produces one card with a per-defender accordion, not one card per defender. |

---

**Part III complete.** Next: [31 — Case Study: Heracles](31-case-heracles.md)
