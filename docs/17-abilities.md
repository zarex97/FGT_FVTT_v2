# 17 — Abilities: costs, requirements and timing windows

## What it is

An ability is a Skill, Spell, or Noble Phantasm a Servant can use. Using one follows a gate sequence: can this be done right now, what does it cost, what does the player choose, and what does it produce. The gate checks cost first, not last, so a player sees one clear refusal rather than a wall of text naming four problems (`module/rules/costs.mjs:14`). The timing window vocabulary — "during your Turn", "when Attacked" — is centralized with its own enumeration, because 117 of the 195 abilities in the content author them and every reader needs the same list (`module/rules/windows.mjs:1-29`).

## Where it lives

| File | Role |
|---|---|
| `module/rules/costs.mjs` | Cost kinds, gates (cooldown, expended, round, cost), and the first-refusal rule |
| `module/rules/windows.mjs` | The timing window vocabulary, and which windows have dispatchers |
| `module/rules/ability-use.mjs` | Ability classification (attack/mode/active/passive), targeting specs, and usage specs |
| `module/engine/skill-use.mjs` | The orchestration path for non-attack abilities — phases, effects, placement |
| `module/engine/cooldown.mjs` | Cooldown creation, branched cooldowns, and waiver paths |
| `module/engine/channel.mjs` | Multi-Turn ability charging for the Hanging Gardens only |
| `module/rules/np-gate.mjs` | The Noble Phantasm availability gate and essence shifts |
| `module/rules/np-scale.mjs` | NP scale comparisons for bounded fields and vulnerability tests |
| `module/engine/optional-costs.mjs` | Spending offered at timing windows rather than charged |

## How it works

### Cost kinds

Only Noble Phantasms carry costs today (`module/rules/costs.mjs:41-44`). A cost is a discriminated union naming who pays: the Master (most common), the Servant itself (when Free or Unbound with no sustainability), or the Master's sustainability clock. Free Servants whose Master has just been defeated have nobody to charge, so the cost shifts (`module/rules/costs.mjs:70-82`).

Additional per-use costs are declared on the ability itself (`module/rules/costs.mjs:111-155`). They include *"The Master's Health is reduced by 50% of its maximum value"* — sized at runtime, not on the sheet. An ability may carry multiple costs, and one cost may supersede another rather than add to it: Karna's Noble Phantasm **replaces** his Action cost rather than stacking with it, so the Master pays 50 rather than 70 (`module/rules/costs.mjs:563-604`).

A cost is checked AFTER the ruling validates it can be paid (`module/rules/costs.mjs:424-425`). Health is **strictly** greater: a Master at exactly 50 cannot pay a 50-cost NP (`module/rules/costs.mjs:523-527`).

### Gates and requirements

`canUseAbility` returns the **first** refusal, ordered by what a player can act on (`module/rules/costs.mjs:158-165`). The sequence is: no match (match not started), expended (spent for the game), cooldown, exhausted (max uses), round gate, turn-within-round delay, oncePerTurn, sealed, category limit, forbidden creation, oncePerRound, mutual exclusion (sameTurnExclusive, sameRoundExclusive), presence concealment, ZON, then requirements (`module/rules/costs.mjs:172-428`). Every gate but the first three is a lesser refusal than the ones above it — "on cooldown for 4 Turns" invites a player to wait, when "expended" says it is gone for the life of the match.

Requirements are ability-declared predicates checked at the end of this chain (`module/rules/costs.mjs:414-422`, `module/rules/items.mjs:568`). They are the long tail: stat/effect/weapon/item checks.

### Timing windows

Six timing windows exist, and only one is documentary: `ownTurn` is how the sheet button reads, not an offer (`module/rules/windows.mjs:39-75`). The others dispatch at specific moments:

- `whenAttacked` — as a reaction inside an attacker's Combat Process (`module/rules/windows.mjs:47-50`)
- `whenAllyAttacked` — when an ally nearby is about to be hit (`module/rules/windows.mjs:52-55`)
- `damageStep` — at the start of a Damage Step, on the attacker's own attack (`module/rules/windows.mjs:57-60`)
- `combatPhaseStart` — at the start of a Combat Phase, on the attacker's own attack (`module/rules/windows.mjs:62-65`)
- `whenTargetedByNP` — when a Noble Phantasm is declared (before any Combat Process) (`module/rules/windows.mjs:67-70`)

A window may be a single string or a list (`module/rules/windows.mjs:127-129`). Karna's Uncrowned Arms Mastership names both `ownTurn` and `combatPhaseStart`, so it is available at either moment.

An ability whose only moment is a timing window is not a button on the sheet (`module/rules/ability-use.mjs:291-296`). Asterios's Monstrous Strength has no phases and no targeting declaration, so it is offered only at its window and pressing it does nothing.

### Ability classification

Every ability is one of five kinds (`module/rules/ability-use.mjs:220-305`):

- **attack** — consumes an attack slot, opens targeting, resolves damage. Every Noble Phantasm, every Skill with a damage phase, every Attack Skill except those flagged `countsAsAttack: false`.
- **mode** — toggles on or off, enters cooldown on toggle (if its own phases define one), never consumed. Riding's Active, Mad Enhancement.
- **active** — resolves against its own targeting spec or phases when clicked. A self-buff, a utility Skill.
- **passive** — always on. A class skill with only `passiveRules`, or an Attack Skill marked passive.
- **windowed** — usable only at a timing window, no phases, no targeting. Asterios's Monstrous Strength.

The classification matters because non-attack abilities do not open a targeting session or a Combat Process (`module/engine/skill-use.mjs:7-22`). A Skill's click uses the Unit's **Act**; an Attack's click uses both the Attack and (usually) the Act.

### Cooldowns

A cooldown is stored as remaining Turns, counted down by the scheduler (`module/engine/cooldown.mjs:1-16`). The authored form is a tick expression (`3◈`, `5◈+⅓◈`) or, for one ability, a per-unit rate resolved against the summon count (`module/engine/cooldown.mjs:45-80`).

Cooldowns can branch on predicate: Summoning: Bašmu is `2◈` for its damage branch and `4◈` for its summon branch (`module/engine/cooldown.mjs:81-106`). First match wins, tested against the caster's options.

A cooldown may be **waived**. Scáthach's Primordial Rune Spells skip cooldown if she holds a PRS Token, and the Token is removed automatically — not offered to the player, because the sheet says "if ... while she has", not "she may" (`module/engine/cooldown.mjs:24-72`).

Cooldowns may start later: Presence Concealment's `2◈` begins "AFTER PC is deactivated", not at the use (`module/engine/cooldown.mjs:48-63`). Quetzalcoatl's mount's `7◈` begins on its defeat, not on the summon. Both have been on the schema since authoring and nothing read them until this module (`module/engine/cooldown.mjs:48-63`).

### Channeling

A multi-Turn ability charging is stored on the Unit, not the ability (`module/engine/channel.mjs:38-58`). The Hanging Gardens of Babylon is the only clause using this: Semiramis cannot Act for 3◈ Turns while it charges, and any attack during that window interrupts it and forces a restart. The cost is **deferred** — charged only when the channel completes, not at the start (`module/engine/channel.mjs:1-20`).

A declaration interrupts every channel its targets hold, except the declarer's own (`module/rules/ability-use.mjs:202-204`). Semiramis cannot interrupt her own Hanging Gardens' channel by using it.

### The Noble Phantasm availability gate

A Noble Phantasm is not usable until a Round gate is past. The general gate is Round 6, but Assassin-classed Servants open at Round 4 (`module/rules/np-gate.mjs:31`). A Master's Essence shifts the gate early: Kaleidoscope opens it 4 Rounds earlier, so Assassin reaches Round 2 if it holds one (`module/rules/np-gate.mjs:46-48`).

An ability's gate is `isNP || categorizedAsNP` (`module/rules/np-gate.mjs:54-66`). Every other NP-scoped question uses the same predicate, so the scope is consistent. A Servant carrying two classes takes the earliest gate (`module/rules/np-gate.mjs:74-86`).

An NP Lock that hits before the gate opens does not cause the gate to activate. Instead, the cooldown increase composits additively with the gate delay: if a lock adds 5 Turns before Round 6 opens, the NP becomes usable at Round 6 + 5 Turns extra, not at the max of the two (`module/rules/np-gate.mjs:134-151`). Additive, not `max()`, because the rule's prose and its pseudocode disagree, and the prose prevents the caster wasting a Skill.

### Optional costs

A passive may offer a Unit a choice to spend a resource at a timing window (`module/engine/optional-costs.mjs:1-23`). Mannanán's Fragarach Tokens can be spent for 30% crit chance at the start of a Combat Phase. The spend is offered to both sides (attacker and defender) of the exchange, because she counts when she counters too. Refusing the offer is a real choice because the same tokens are worth something else.

An optional cost's effect goes through immunity, exclusivity, and duration extension exactly as one from a Skill does — all the same rules apply (`module/engine/optional-costs.mjs:177-182`).

## Invariants & edge cases

1. **One refusal answers the question.** `canUseAbility` returns the first refusal in order, never all of them (`module/rules/costs.mjs:162-165`). A player pressing an ability sees one clear reason why not, not a list.

2. **Attacked by a declaration, not necessarily hit.** A Noble Phantasm that interrupts a channel fires on declaration, before any Combat Process exists (`module/engine/channel.mjs:1-20`, `module/rules/ability-use.mjs:183-196`). Semiramis interrupted mid-charge counts as Attacked.

3. **A cost may supersede rather than stack.** Mutual-exclusion costs are one-pass, not transitive: a cycle of supersession collapses to one survivor rather than none (`module/rules/costs.mjs:582-604`).

4. **Cooldowns ignore unstarted matches.** An ability used before Combat starts writes a cooldown that nothing can count down; the Servant is gone for the life of the world. Checked FIRST, above expended, because "on cooldown for 22 Turns" invites waiting for a Turn that is never coming (`module/rules/costs.mjs:177-215`). Defaulted to `true`; seven call sites all pass the real value from `gateContext`.

5. **An attack always picks a target, even a self-targeting one.** It opens a Combat Process against a defender. A self-buff's targeting session is offered only when the ability says the player chooses (`module/rules/ability-use.mjs:389-421`).

6. **Expended is above cooldown.** An ability broken for the rest of the match (Akhilleus Kosmos when shattered) is refused before cooldown is checked, because a cooldown on a broken ability is a wrong refusal — the player would wait for something that is never coming back (`module/rules/costs.mjs:234-247`).

7. **Presence Concealment refuses by category, not by list.** *"Active Skills targeting/affecting an enemy Unit(s) cannot be used"*, not a set of names. A new Skill in that category is covered without touching the code (`module/rules/costs.mjs:392-403`).

8. **Timing windows and phases are declared on the same ability.** An ability may be usable at a window AND during the owner's Turn — Medea's Argos, *"used during your Turn or when Attacked"* — and has phases (`module/rules/ability-use.mjs:293`). The two moments both happen; the phases run both times.

## Traps and anti-patterns

**Checking truthiness of an empty array in a branching condition.** A plain tick cooldown is compiled to `{max: "3◈"}` with no `branches` field. The schema's `ArrayField` turns `null` into `[]` automatically, so a truthiness check passes (`[]` is truthy) and the condition enters the branch loop, matches nothing, and returns no clock. Every cooldown in the game entered this trap: measured live at 49 of 49 abilities across six authored Servants, every one infinitely reusable. The defect arrived with branched cooldowns themselves (Summoning: Bašmu is the only ability to have any), so Servants verified before the feature shipped were verified correctly and broken as soon as it landed (`module/engine/cooldown.mjs:88-98`). **Check `.length`, not truthiness, when a field can be an empty array** (`module/engine/cooldown.mjs:99`).

## Open questions

- **Resolved: additive, deliberately, and fully wired.** The code states the reasoning in situ —
  the rulebook's prose and its pseudocode disagree, the prose wins, and under `max()` an NP Lock
  spent while the target was gated anyway *"costs the caster a Skill and buys nothing, which is
  precisely the outcome this clause exists to prevent"* (`module/rules/np-gate.mjs:134-151`). The
  input is real rather than notional: `gatedDelay` is declared on the schema
  (`module/data/item/ability.mjs:97`), accumulated by the cooldown writer as
  `(existing ?? 0) + ticks` (`module/engine/io.mjs:601`), read back at
  `module/rules/costs.mjs:293`, and correctly classed as world state rather than pack state
  (`module/content/authored-fields.mjs:123`). It is zero in every world until something raises a
  cooldown early, which is why no live board shows it yet.

- **Confirmed live.** The waiver fires, pays, and falls back. `cooldownFor` was run against an
  ability declaring `cooldownWaiver: {resource: "prs", amount: 1}`: holding **2** tokens waived the
  clock and emitted `resources.prs.value: -1`; holding the **last** token did the same; holding
  **none** produced the full `12` ticks (4◈ at three turns per Round) and no spend; and omitting the
  unit snapshot entirely also produced the full clock rather than throwing. The skip and the spend
  are emitted together, which is the property that matters — *"emitting the skipped clock without the
  token spent would make Scáthach's Rune Spells free for ever"*
  (`module/engine/skill-use.mjs:1258-1260`).

- **Who chooses when an optional cost is offered?** The Unit's owner answers; the GM is the fallback. The reference set has only one Unit with an optional cost (Mannanán), tested only by its author. `FGTSocket.ask` is a socket prompt, so the latency and answer path are system-level.
