# 17 — Command Spells

Command Spells are the only mechanism in F/GT that can pre-empt an in-flight process. That
makes them architecturally significant out of proportion to their rules footprint: supporting
them correctly forces the entire resolution engine to be suspendable and resumable.

---

## 17.1 The interrupt property

> *"Command Spells can be used at **any time at all**, even if it were to interrupt an ongoing
> process, such as Combat. Command Spells **overwrite/interrupt all other processes** (Attack,
> Skill, NP, etc)."*

Three consequences for the architecture:

1. **Every resolution must be suspendable.** The Combat Process state machine (Ch. 12) has a
   suspend/resume path at every state. So does ability resolution (Ch. 15 §15.9) and movement.
2. **The interrupt can come from a player whose turn it is not.** A defender's Master spends
   `Escape` during the attacker's turn. So the reaction protocol (Ch. 27) must accept input
   from users outside the current turn.
3. **The interrupt window must be *offered*, not just permitted.** A player who does not know
   they could have spent a spell has effectively lost the option. The UI must surface relevant
   spells at the moment they apply.

Point 3 is the design challenge. "Can be used at any time" combined with "must be offered"
would mean prompting constantly. The solution is **contextual offering**: at each interruptible
point, the engine computes which spells would have a *meaningful* effect and offers only those.

```ts
function relevantCommands(state: LadderState, ctx: AttackContext, master: Master): CommandOffer[] {
  const out: CommandOffer[] = [];
  if (state === "react" && !ctx.isNP && master.hasSpells(1))
    out.push({ cmd: "damageBlock", cost: 1, note: "Take no damage from this Normal Attack" });
  if (state === "s23_acceptOrEscape" && servantNotAdjacent(master))
    out.push({ cmd: "teleportServant", cost: 1, note: "Redirect the attack to your Servant" });
  if (state === "damage" && ctx.isNP && master.hasSpells(2))
    out.push({ cmd: "halveNoblePhantasm", cost: 2, note: "Halve the Total Damage" });
  if (state === "defeat" && noOtherRevival(ctx.defender) && master.hasSpells(3))
    out.push({ cmd: "surviveKill", cost: 3, note: "Survive with 5% Health" });
  // …
  return out;
}
```

Offers appear as a slim, dismissible strip on the chat card, never as a blocking modal, so a
player who does not want them can ignore them without adding a click to every exchange.

---

## 17.2 The catalogue

Each Master starts with **3** Command Spells. The rulebook lists sample commands; the list is
explicitly open (*"if you can think of any other use for Command Spells, feel free to mention
it and use it if the GM/majority of players approve"*).

### Cost: 1 Command Spell

| Command | Requirement | Effect |
|---|---|---|
| **Teleport Servant** | Servant **not** already within 2 panels of the Master | Instantly moves the Servant to any panel within 2 panels of the Master. Usable anywhere on the field. If used during Combat, the Combat situation is revised. |
| **Escape** | Servant within 2 panels; pair **not** already in the Home Base | Instantly moves Master **and** Servant to any spot within the Home Base |
| **Half Heal** | Servant in ZON | Restores Health and Agility by 50% of maximum. **Cannot be used during a Damage Step if the damage would defeat the Servant.** |
| **Damage Block** | Servant in ZON | No damage from an enemy Normal Attack; 50% reduction from an Attack Skill / Damage Spell. **Cannot be used against NP.** |
| **Damage Up** | Servant in ZON | +100% Total Damage of the Servant's Normal Attack / Attack Skill / Damage Spell. **Not NP.** |
| **Cure Servant** | Servant in ZON | Cures all debuffs except Unremovable ones |
| **Kill Yourself** (High Rank Master) | Servant in ZON | Forces the Servant to kill itself |
| **Reduce Cooldown** | Servant in ZON | Reduces one Skill's Cooldown by 1◈. **Not NP.** |
| **Kill Humans** | — | A Good-aligned Servant will kill Civilians. **Permanent consequence:** if the Servant ever becomes Unbound it abandons the Master and refuses to re-contract. |

### Cost: 2 Command Spells

| Command | Requirement | Effect |
|---|---|---|
| **Full Heal** | Servant in ZON | Restores Health and Agility to maximum. Same Damage Step restriction as Half Heal. |
| **Halve Noble Phantasm** | Servant in ZON | −50% Total Damage from an enemy NP |
| **Force Noble Phantasm** | Servant in ZON | Forces NP use when it would be unusable (uses exhausted, on cooldown). NP Cooldown is then set to fully un-cooled-down. **Cannot bypass the Round 5/3 gate.** |
| **Noble Phantasm Max** | Servant in ZON | +100% Total Damage of the Servant's NP |
| **Kill Yourself** (Low Rank Master) | Servant in ZON | Forces the Servant to kill itself |
| **Full Cooldown** | Servant in ZON | Fully reduces one Skill's Cooldown |
| **All Cooldown** | Servant in ZON | Reduces all of the Servant's Skill Cooldowns by 1◈ |

### Cost: 3 Command Spells

| Command | Requirement | Effect |
|---|---|---|
| **Survive Kill** | Servant in ZON; **no other method of revival available** | The Servant survives with 5% of its Health |

### Reference-set additions

Three Servants define command-spell interactions of their own:

| Servant | Command | Cost | Effect |
|---|---|---|---|
| Karna | Negate *Fated Rivals of the Mahabharata* | 1 | For 1◈, Karna is not forced to attack Arjuna. Affects Karna only. |
| Penthesilea | Negate *Hatred of Achilles* | 1 | For 1◈, she ignores the forced-attack compulsion. **Does not deactivate Mad Enhancement.** |
| Penthesilea / Heracles | Deactivate Mad Enhancement | 1 | For 1◈; reactivates afterward if the conditions still hold |
| Van Gogh | — | — | *"Gogh cannot be ordered to commit suicide/kill herself, even with a Command Spell."* |

Van Gogh's *Sunflower's Curse* is the only stated **immunity** to a Command Spell, and it must
be checked at offer time so the option never appears.

### Rankless variant

> *"If all Masters are Rankless, the Kill Yourself command only costs one Command Spell."*

A ruleset config value.

---

## 17.3 The command model

```ts
interface CommandSpell {
  id: string;
  name: string;
  cost: number;
  requirements: Requirement[];
  timing: CommandTiming;
  effect: Phase[];                    // reuses the ability phase system
  overridesValidation: string[];      // which targeting/legality failures it can bypass
  permanentConsequence?: Phase[];     // Kill Humans
}

type CommandTiming =
  | { window: "anyTime" }
  | { window: "duringCombat"; states: LadderState[] }
  | { window: "onDefeat" }
  | { window: "beforeDamage" };
```

Commands reuse the ability `Phase` system entirely (Ch. 15 §15.2), so `Half Heal` is:

```yaml
id: cs-half-heal
cost: 1
requirements: [{ kind: servantInZon }]
timing: { window: anyTime }
blockedWhen:
  - { state: damage, condition: damageWouldDefeatServant }
effect:
  - kind: statChange
    target: contractedServant
    changes:
      - { stat: health,  deltaPercentOfMax: 50, clamp: true }
      - { stat: agility, deltaPercentOfMax: 50, clamp: true }
```

No new machinery. That is the point of making phases general.

---

## 17.4 The interrupt protocol

```
                    Resolution in progress
                             │
                             ▼
                    ┌─────────────────┐
                    │  INTERRUPTIBLE  │  engine reaches a suspendable state
                    │     POINT       │
                    └────────┬────────┘
                             │
             compute relevantCommands() for every
             Master with spells and standing to act
                             │
                    ┌────────┴────────┐
             none   │                 │  some
                    ▼                 ▼
             continue          offer to those users
                               (non-blocking, with a timeout)
                                      │
                    ┌─────────────────┼─────────────────┐
             declined/timeout         │            declared
                    │                 │                 │
                    ▼                 │                 ▼
              continue                │       ┌──────────────────┐
                                      │       │ SUSPEND          │
                                      │       │ serialize state  │
                                      │       └────────┬─────────┘
                                      │                ▼
                                      │       ┌──────────────────┐
                                      │       │ validate + pay   │
                                      │       └────────┬─────────┘
                                      │                ▼
                                      │       ┌──────────────────┐
                                      │       │ apply the effect │
                                      │       │ (may mutate the  │
                                      │       │  suspended state)│
                                      │       └────────┬─────────┘
                                      │                ▼
                                      │       ┌──────────────────┐
                                      └──────▶│ RESUME           │
                                              │ possibly at a    │
                                              │ different state  │
                                              └──────────────────┘
```

### The interruptible points

| Point | Commands that apply |
|---|---|
| Before an attack is declared | Damage Up, NP Max, Force NP, Reduce/Full/All Cooldown |
| At `react` (Step 2) | Damage Block, Teleport Servant |
| At `s23_acceptOrEscape` | Escape, Teleport Servant |
| Before the Damage Step | Halve Noble Phantasm |
| During the Damage Step | Half/Full Heal (**unless lethal**) |
| On defeat | Survive Kill |
| Any time during your own turn | Cure Servant, Half/Full Heal, Kill Yourself, cooldown commands |
| At targeting validation failure | Kill Humans |

### Timeout

An offer that blocks resolution indefinitely is unacceptable in a game with seven players.
**DECISION.** Offers carry a configurable timeout (default 45 s), after which resolution
continues as if declined, with a chat note. The GM can extend or resolve manually. A player who
was disconnected sees a "you missed an opportunity to interrupt" entry in their log rather than
silently losing the option.

---

## 17.5 The disruptive commands

Three commands genuinely rewrite the state machine rather than adjusting a number.

### Teleport Servant

> *"If used during Combat, the Combat situation is revised."*
> *"When CS: Teleport Servant is used by a Master when it is Attacked, the AU's target is
> switched to the newly-teleported Servant. The newly-teleported Servant cannot use Evade or
> Block in this Combat Process."*

So the sequence is:

```
Master is the DU, at state `react`
 └─ Master's controller spends Teleport Servant
     ├─ Servant is moved to a panel within 2 of the Master (player chooses)
     ├─ CombatPhase.targets is mutated: Master → Servant
     ├─ The new DU enters at `react` with Evade and Block DISABLED
     └─ Resolution continues
```

This is why `CombatPhase` carries a **mutable target list** (Ch. 12 §12.11). It is the only
mechanism that retargets an attack after declaration.

Edge case: what if the Servant is already within 2 panels? The requirement forbids it
(*"Cannot be used if the Servant is already within a 2 panel area of its Master"*), so the
offer never appears — which also means it cannot be used as a pure "swap the target" trick
when the Servant is already adjacent. That restriction is load-bearing and must not be relaxed.

### Escape

Teleports both Master and Servant into the Home Base. At `s23_acceptOrEscape` this is one of
the two listed outcomes (*"Evade with command seal ('teleport' Or 'escape')"*), producing
`noDamage`.

Its second use is strategic rather than defensive: resetting a losing position. The offer
therefore appears both during combat and freely during the player's own turn.

### Force Noble Phantasm

> *"Forces the Servant to use its Noble Phantasm at a time when it would be unusable (e.g. when
> its usages have all been used up, during Cooldown, etc). After that, NP Cooldown is set to
> fully un-Cooldowned."*
> *"Note: Cannot be used to force NP usage before 5 Rounds (or 3 Rounds for Assassin) have
> passed since the start of the game."*

So it overrides `cooldown` and `usesPerGame` requirements but not the round gate, and not the
ZON requirement or the Master's health cost (which still applies — the Master pays for the NP
*and* the spell).

**DECISION.** `overridesValidation: ["cooldown", "usesExhausted"]` — an explicit whitelist, so
the engine never has to guess which requirements a command can bypass. Every command declares
its whitelist; the empty list is the default.

---

## 17.6 Kill Yourself and the immunity question

The `Kill Yourself` command is the game's answer to a Charmed or otherwise compromised Servant.
It costs 1 spell for a High Rank Master and 2 for a Low Rank Master (or 1 for all, in a
rankless game).

Its interactions:
- Van Gogh is immune (*Sunflower's Curse*) — the only Command Spell immunity in the game.
- **It bypasses revival** (Ch. 41 Q35, answered). Guts, Battle Continuation, God Hand, and
  Holder Mode do not trigger. It is `Death`-semantics, not ordinary defeat — which is what makes
  it a reliable answer to a Charmed or contract-stolen Servant rather than a gamble.
- The resulting death **does** count toward the Grail counter.
- On a Dioscuri twin it therefore kills both, since the ordered twin is truly defeated
  (Ch. 34 §34.4).

---

## 17.7 Kill Humans and permanent consequences

The only command with a lasting cost beyond the spell:

> *"After this Command is used, a Servant with the 'Good' Alignment will kill Civilians. However,
> if said Servant ever becomes an Unbound Servant, the Servant will **abandon the Master and
> become a Free Servant**. In this case, the Servant will refuse to make a new Contract with its
> old Master."*

So the command applies a permanent status to the Servant:

```yaml
id: cs-kill-humans
cost: 1
effect:
  - kind: applyEffect
    target: contractedServant
    effects:
      - id: willKillCivilians
        duration: permanent
        polarity: status
  - kind: applyEffect
    target: contractedServant
    effects:
      - id: resentment
        duration: permanent
        polarity: status
        payload: { resentsMasterId: "@master.id" }
```

The `resentment` status has a rule element listening for `contractStateChanged → unbound`,
which converts the Servant to `free` and adds the old Master to a permanent
`refusesContractFrom` list. A small, self-contained piece of content that needs no engine
support beyond events and a list field.

---

## 17.8 Spell accounting and the audit trail

Command Spells are scarce (3 per Master) and their expenditure decides games. Every spend is
logged with full context:

```
Round 7, Turn 2 (Blue) — Command Spell spent
  Master: Waver Velvet          Spells: 2 → 1  (own pool)
  Command: Damage Block          Target: Iskandar
  Context: Karna's Normal Attack, at Combat Process step `react`
  Result: Total Damage 0 (was 847)
```

The chat card shows the counterfactual (`was 847`) because it is the single most useful piece
of information for judging whether the spend was worth it, and it is free — the pipeline
already computed the number.

The Master sheet shows a spell tracker with the three pips, plus a separate row per borrowed
pool with its Servant name, so the namespacing (Ch. 16 §16.9) is visible rather than implicit.

---

## 17.9 GM commands

The GM has an unrestricted version of every command, plus:

| GM command | Purpose |
|---|---|
| Grant Command Spell | Adjudicated rewards, correcting mistakes |
| Force any command | Applying a homebrew command the rules do not list |
| Revoke a spend | Undo, with the resolution rewound |
| Custom command | Free-text label + a phase list, for the "if you can think of any other use" clause |

The custom command builder is a small form over the `Phase` union — the same editor used for
authoring abilities — so a GM improvising mid-game has real tooling rather than a "just describe
it in chat" fallback.

---

## 17.10 Summary of decisions

| # | Decision |
|---|---|
| D17.1 | Every resolution state is suspendable and resumable; commands are the only interrupt source. |
| D17.2 | Commands are *offered* contextually by relevance, not merely permitted, as a non-blocking strip with a timeout. |
| D17.3 | Commands reuse the ability `Phase` system entirely; no separate effect machinery. |
| D17.4 | Each command declares an explicit `overridesValidation` whitelist; empty by default. |
| D17.5 | `Teleport Servant` mutates the Combat Phase's target list — the only post-declaration retarget. |
| D17.6 | Offers time out (default 45 s) into "declined", logged, with a GM override. |
| D17.7 | `Kill Yourself` **bypasses revival effects** — Guts, Battle Continuation and God Hand do not fire (Ch. 41 Q35, answered in `0.2.0`; §17.6). Superseded the `0.1.0` reading, which had revival apply. |
| D17.8 | `Kill Humans`'s permanent consequence is authored content (two statuses + an event listener), not engine code. |
| D17.9 | Spend logs show the counterfactual damage, because the pipeline already produced it. |

---

**Next:** [18 — Action Economy](18-action-economy.md)
