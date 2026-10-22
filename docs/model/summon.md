---
shape: Summon
parent: Phase
code: module/engine/summon.mjs, module/data/actor/simple.mjs
---
**What it is:** a Unit an Ability puts on the board, with its own statblock, and how it acts and leaves.

**Fields:**
- `countsTowardBudget`, `actsOncePerTurn`, `leavesWithSummoner`: known.
  keys: `actor.countsTowardBudget`, `actor.actsOncePerTurn`, `actor.leavesWithSummoner`, `phase.summon.countsTowardBudget`
- `onDefeat` (**Variant** `split`, Saber 2026-10-21): Gilles (Caster)'s Elder Horror, defeated, rolls a d4 and on a 3
  becomes three Horrors; Prelati's Horror flips a coin and on Heads becomes two. Neither splits when killed by
  Light damage or an Attack that deals extra damage to Dark or Outsider Units. Built in #260 reading 12
  (`engine/summoning.mjs#splitSummon`, the `Split` action with `unlessAttack`); #290 closed as built, 2026-10-22.
  keys: `action.Split`

- `unitWeight` (**Variant**, Caster 2026-10-21): how much of a Unit a summon counts as on the Move and Attack
  budget. Avicebron's Golem counts 0.2, Babbage's Mechanical Golem 0.33, Edison's Mechanized Infantry 0.25,
  Medea Lily's Colchis Bull 0.5. Hundred-Faced Hassan's 0.5 already runs, but `unitWeight` is declared on the
  Servant document only (`module/data/actor/servant.mjs`), so a summon cannot carry it. 9 sheets. Not run, #291.
  keys: `actor.linkedGroup.unitWeight`; on a summon: none (#291)
- `source` (**Variant** `random roster Servant`, Caster 2026-10-21): a summon drawn at random from the roster's
  Servants. Jason summons a random Argo-related Servant. Zhuge Liang, defeated, may be replaced by a Servant rolled
  from a category, such as *"A Servant from the Three Kingdoms period"*. Oda Nobukatsu may summon a random
  Nobunaga, contracted to his Master. Nothing summons a Servant. Not run, #292.
  keys: none (#292)

- `companion` (**Variant**, Rider 2026-10-21): a summon that stays bound to its owner. Mistress C's dogs Spieldorf
  and Reinfeldt *"automatically Move together with her (like Passenger Seat)"*, one can be sent to Guard her Master
  and Called back, and a defeated dog *"will reappear on a panel directly next to Mistress C after 3◈ Turns"*.
  Geronimo's Spirit Coyote moves with him, guards his Master on command, and reappears after 2◈ Turns. Summons
  today leave with their summoner but do not follow, guard or return. Not run, #308.
  keys: none (#308)

**Kin:** Saber: K157, 3 sheets. Rider: Mistress C, 5 Clauses; Caster: Geronimo, 4. Caster: R73, R16, R84, R212, R604, R642; Saber: Jason.
