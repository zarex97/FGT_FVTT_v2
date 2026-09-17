# 23 — Reactions, counters and deadlines

## What it is

Combat is an interactive negotiation, not a roll. An attack triggers a ladder of reactions: the defender chooses how to respond, each choice opens new prompts for the other side, and the exchange continues until both have had their say. The defender may Evade or Block at the first rung, may answer a Luck Check, and may declare a Counter at the end. The attacker may contest every Luck Check the defender calls. Abilities usable "when Attacked" are offered at the same rung as Block and Evade, alongside them. A third party may interpose a protective ability if an ally is about to be hit. Counters may be redirected to a Master's Servant, and the chain may be limited to prevent infinite loops. When nobody answers within a deadline, a safe default is taken.

## Where it lives

| File | Role |
|---|---|
| `module/rules/reactions.mjs` | Filtering abilities usable as reactions, and allies that may protect others |
| `module/rules/counter.mjs` | What answers a Counter and who may Counter a Counter |
| `module/rules/windows.mjs` | The timing window vocabulary and dispatch flags |
| `module/engine/auto-counter.mjs` | Queuing automatic counters and draining the queue |
| `module/engine/await-timeout.mjs` | The clock and the deadline on prompts |
| `module/rules/await-policy.mjs` | Policy table: what happens when the deadline passes |
| `module/rules/cover.mjs` | Servant Cover: taking a Noble Phantasm for the Master |
| `module/engine/combat-process.mjs` | The state machine — states, transitions, and rung table |
| `module/apps/prompt.mjs` | Rendering prompts, dispatching by kind |
| `module/apps/hud/pending-panel.mjs` | The "Pending decisions" panel showing what you are waiting for |

## How it works

### The reaction ladder

The Combat Process is an explicit state machine with 16 states and a transition table (`module/engine/combat-process.mjs:24-110`). The ladder runs symmetric and is two rungs deep on each side: if the defender Evades, the attacker gets two Luck Check rungs to make a lucky hit; if the attacker defends against that, the defender gets two to answer back. The sequence terminates in the "accept or escape" rung (`module/engine/combat-process.mjs:64-65`), and then the Counter rung at the end (`module/engine/combat-process.mjs:120`).

Each prompting state is listed in `PROMPTS` with a side (attacker or defender), a kind, and the options (`module/engine/combat-process.mjs:113-126`). `advance()` is a pure reducer over a `ProcessState` object (`module/engine/combat-process.mjs:129-138`). It takes a state and an event, applies the transition, and returns the new state—never writing and never awaiting, so the state can be stored in a chat message flag and resumed after a disconnect.

### Reactions at the first rung

The first prompt is the "react" rung, and it asks the defender how to meet the attack (`module/engine/combat-process.mjs:114`). The options are "nothing" (take the hit), "block", and "evade". Abilities the defender could use "when Attacked" are appended to this list, prefixed `ability:` so the ladder tells them from the standard three (`module/rules/reactions.mjs:186-188`).

`reactionAbilities` returns every ability whose timing window is `whenAttacked`, that is not on cooldown, has not been used this turn, is not negated, and meets its own requirements that can be answered by the unit alone—no target-dependent gates (`module/rules/reactions.mjs:84-86`, `module/rules/reactions.mjs:133-173`). The critical gate is at line 168: requirements like `stance` are checked before the ability is offered, so a player never sees an option that will be refused when pressed—the principle of Ch. 33, applied to reactions (`module/rules/reactions.mjs:160-169`).

The subject passed to the requirements filter must carry both the snapshot and the items, because the filter reads `system` off the items and `stance` off the snapshot (`module/rules/reactions.mjs:129-131`). The `windowSubject` function assembles this (`module/rules/reactions.mjs:129-131`).

### Ally reactions

EMIYA's Rho Aias is *"used when any allied Unit (including EMIYA) within a 3 panel area of EMIYA is about to be hit by a Noble Phantasm."* The projector is neither attacker nor defender—that breaks the two-sided assumption the ladder usually rests on. `allyReactions` scans all board units, filters by relation to the defender, distance to the defender (or to the attacker, for Kiritsugu's Lethal Gunfire Suppression), and the attack kind and rank (`module/rules/reactions.mjs:238-317`). Each matching ability is returned with its owner, because the ability does not belong to the Unit the Process is protecting. The offer appears appended to the defender's rung but carries the projector's name; it is answered by the GM or the projector's player (`module/rules/reactions.mjs:218-222`).

### Counters and counter-chains

After the attack resolves and damage is dealt, the defender gets the counter rung (`module/engine/combat-process.mjs:120`). They may declare a Counter and choose what attack to answer with (`module/rules/counter.mjs:58-72`). The Normal Attack is always first and always free; everything else is any ability `classifyAbility` calls an Attack—all Noble Phantasms, including non-damaging ones, reused from the attack definition rather than re-derived (`module/rules/counter.mjs:58-72`).

Counter-chains are capped to prevent infinite loops. The setting `fgt.counterChain` is either `"strict"` (default) or `"collateral"`. In strict mode, no Counter begins as the product of a Counter—the ladder always ends with the counter rung. In collateral mode, a bystander caught by an area Counter keeps its own right to counter; its answer targets its own attacker, so the rule closes it one step later (`module/rules/counter.mjs:75-111`). The depth cap is a constant, not a setting (`module/rules/counter.mjs:18-27`).

A Counter aimed at a Master whose Servant is within 2 panels is redirected to that Servant instead, a retarget not a refusal—the Counter happens, against the Servant (`module/rules/counter.mjs:146-159`). The redirect searches for the nearest guard, so a Master flanked by two Servants has one answer rather than whichever the board listed first (`module/rules/counter.mjs:151-157`).

### Automatic counters and the queue

Mannanán's Fragarach counters on two provocations: being Attacked *or* being debuffed. The rule states both fire one counter, so provocations are collected into a set keyed by the pair (`module/engine/auto-counter.mjs:16-21`). Counters are full declarations, and opening one from inside the write path would re-enter the applier, so they are queued (`module/engine/auto-counter.mjs:3-27`). The queue is GM-side, in-memory, and drains at the end of the exchange—a provocation that has not drained by then is a bug; persisting it would turn it into a counter on a later turn (`module/engine/auto-counter.mjs:29-32`).

`provoke` records a provocation if the bearer has an auto-counter rule matching the cause (`module/engine/auto-counter.mjs:84-101`). The `pending` Map is keyed `bearerId:provokerId` so a second provocation between the same two units inside one exchange replaces nothing (`module/engine/auto-counter.mjs:45-52`). While the queue is draining, `isDraining()` returns true; new provocations are refused so a counter's own debuff rider does not provoke a counter from anybody standing in the same shoes (`module/engine/auto-counter.mjs:55-72`).

### Deadlines and timeouts

The timer runs on the GM client only; every client rendering a card would otherwise start its own, and the first to fire would advance the process while others were still counting—a race producing two answers to one prompt (`module/engine/await-timeout.mjs:14-19`). The deadline is stored on the message, not computed per client; two clients that computed it from their own clocks would disagree by the drift between them (`module/engine/await-timeout.mjs:32-34`).

`policyFor` maps a prompt kind to a policy table entry: the default choice, the timeout in milliseconds, what happens on expiry (`default`, `gmDecides`, or `hold`), and whether the choice spends a resource (`module/rules/await-policy.mjs:55-64`). The one property every entry satisfies is **the timeout default is always the option that spends nothing** (`module/rules/await-policy.mjs:11-15`). A player who was disconnected should never come back to find their Luck and Command Spells drained by auto-decisions (`module/engine/await-timeout.mjs:8-13`).

When the deadline passes, `applyExpiry` takes the default choice on behalf of the absent player, logged as a timeout rather than as a decision (`module/engine/await-timeout.mjs:125-145`). The GM can override this by clicking a "Decide for them" button, which is shown from the start rather than after the timeout—a GM who can see the table knows before the clock does that somebody has left (`module/engine/await-timeout.mjs:70-75`).

### Cover

When a Master caught in an AoE Noble Phantasm fails to Evade, its Servants get an Agility Check. If they succeed, they shove the Master out of the area. If they fail, the Master receives no damage or effects, and each Servant takes the blast at ×2 multiplier (or ×1.5 with two Servants, ×1.33 with three, so the **increase** is divided, not the damage) (`module/rules/cover.mjs:1-29`). The covering Servants must be the Master's own guards (`guardsOf`, so Pale Rider's Kagome Spirits stand in for him), within 2 panels, able to act, inside the area, and not defeated (`module/rules/cover.mjs:58-68`). A Servant covering its Master cannot Evade the same Noble Phantasm (`module/rules/cover.mjs:155-157`).

The shove is a Move to the nearest panel outside the area, not anywhere outside—ties broken by board order so two clients agree (`module/rules/cover.mjs:109-136`).

## Invariants & edge cases

1. **A reaction ability must meet all requirements to be offered.** Every requirement answerable from the unit alone is checked before the ability is offered (`module/rules/reactions.mjs:168-169`). Target-dependent gates like `targetHasEffect` cannot be judged and must not refuse—an unsatisfiable gate is not offered, it is silently skipped (`module/rules/reactions.mjs:64-68`).

2. **The reaction options are a single list, not a second set of buttons.** Block, Evade, and reaction abilities are all in `reactionOptions`, so a player sees them in one place (`module/rules/reactions.mjs:186-188`). A second set of buttons would be a second place to keep in step, and the first thing to fall out of step is the reason a button is disabled (`module/apps/hud/pending-panel.mjs:8-10`).

3. **A promoted ability is offered before its cost is known.** When a Counter is declared, the attacker picks the attack to counter with—offered disabled with its reason if they cannot pay for it, so they know the ability exists (`module/rules/counter.mjs:51-53`).

4. **Only self-answers are checked before offer.** Gates that need a target cannot be judged—`targetHasEffect` has no target at a window (`module/rules/reactions.mjs:64-68`). Gates answerable from the unit alone are in `SELF_REQUIREMENTS` (`module/rules/reactions.mjs:72-76`).

5. **A Master's Servant within 2 panels absorbs a Counter aimed at the Master.** The rule says within 2 panels; the redirect is the nearest one, so a Master flanked by two Servants has one answer rather than an arbitrary one (`module/rules/counter.mjs:151-157`).

6. **Every Luck Check rung carries a declined edge.** Luck is a finite resource spent whether or not the check succeeds; a player may rationally refuse (`module/engine/combat-process.mjs:35-38`).

7. **The counter rung has exactly two edges—counter or declined; no other outcome.** Both finish the process; Counters cannot be Countered again, so there is nothing after this rung either way (`module/engine/combat-process.mjs:86-90`).

8. **Auto-counters are queued, never resolved inside a write.** A Counter is a full declaration, and opening one from inside the write path re-enters the applier (`module/engine/applier.mjs:103-104`). The queue drains when the Process finishes, guarded by `isDraining()` so a counter's own debuff does not provoke another (`module/engine/auto-counter.mjs:55-72`).

## Traps and anti-patterns

**Not offering reaction abilities whose requirements cannot be judged.** `abilitiesAtWindow` filters on requirements answerable from the unit alone, because a gate needing a target (or an attack) has neither at a window and must not refuse for lack. Offered without this gate, a player would see an option that vanishes when pressed. `SELF_REQUIREMENTS` lists every gate that can be answered (`module/rules/reactions.mjs:72-76`). The gate is checked before the offer and a player never sees an unsatisfiable option (`module/rules/reactions.mjs:160-169`). **Only check gates answerable from the unit alone; skip the rest**.

**Building the reaction subject from loose fields instead of a snapshot.** `abilitiesAtWindow` reads `stance` off the subject, and `rules/stance.mjs#stanceOf` returns **null** without `stanceSpec`. A subject assembled as `{items, effects, turnState, roundState}` would answer `null === "dismounted"` and refuse every stance-gated ability before it could be offered—Achilles's Runner Comet at the only window his sheet gives it. The snapshot carries every field the filter needs (`module/rules/reactions.mjs:107-124`). **Use `windowSubject(snapshot, items)` to assemble the subject** (`module/engine/attack.mjs:5399`).

**Offering attacker-side windows when there is no dispatcher.** Asterios's Monstrous Strength and Karna's Uncrowned Arms Mastership lived in the data, shipped as inert — authored, compiled, loaded, and unreachable. They had no implementation at all because every window in `reactions.mjs` describes a moment inside somebody else's Combat Process (`module/rules/reactions.mjs:35-48`). An ability whose text places it inside the attacker's own had nowhere to go. Both are now offered at `damageStep` and `combatPhaseStart` (`module/rules/windows.mjs:103-106`). **Offer attacker windows at their explicit rungs** (`module/engine/attack.mjs:5393-5401`).

**Queuing automatic counters from inside the write path.** A Counter is a full declaration and opening one from inside the write path re-enters the applier, breaking the single-write-choke-point rule. Mannanán's Fragarach counters on two provocations (attacked or debuffed), and both need to produce one counter when they fire inside one exchange. A queue collects provocations, guarded by `isDraining()` so the counter's own debuff rider does not queue another (`module/engine/auto-counter.mjs:3-27`). **Queue provocations, not resolved counters; drain at the end of the exchange**.

## Open questions

- **How are two clients guaranteed to agree on the shove destination?** `shoveDestination` finds the nearest panel outside the area via Chebyshev distance and breaks ties by board order (`module/rules/cover.mjs:109-136`), but the board order on two clients may differ if tokens were added/removed since the last sync. Worth an ADR or a test against a live game.

- **Resolved, and the two halves are in different places.** The offer is **computed** on the GM
  client -- the attack flow runs there (`resolveAttack`, Model B) and builds it from a fresh
  `boardSnapshot()` (`module/engine/attack.mjs:5644-5646`) -- but it is **presented at the defender's
  rung**, and the code says why: *"Offered at the defender's rung because the ladder prompts one side
  per rung; the option is labelled with the projector's name so whoever answers knows whose Health it
  is about to cost."* So the protector is not asked; the defender is asked whether to spend the
  protector's Health, with the protector named on the button.

- **Confirmed by construction.** The offer is built once, from one `boardSnapshot()` taken at the
  react rung (`module/engine/attack.mjs:5644`). Nothing re-reads the board between rungs, so a
  Familiar that widens a protector's reach *after* the offer was assembled cannot widen the offer, and
  one that leaves scope cannot withdraw it. That is a consequence of snapshotting rather than a
  defect -- the ladder is a negotiation over a fixed situation -- but it means a range that changes
  mid-exchange is not seen.

- **Confirmed live, and the scope is narrower than it sounds.** Six await situations exist, and
  **five of them decide on expiry**: `reaction` resolves to `none`; `luckCheck`, `commandSpell` and
  `counter` to `declined`; `facing` to `attacker`. Only `gmRuling` carries
  `onExpiry: "gmDecides"`, and it alone returns `{decided: false, escalate: true}`. So an unanswered
  prompt never hangs the ladder in ordinary play -- the one situation that stays open is the one
  whose entire purpose is to require a human.
