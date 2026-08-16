# 16 — Relationships

> **Implementation note (Ch. 45).** ZON is derived and both its consumers fire — pipeline stage 9
> and the Noble Phantasm legality gate. The Noble Phantasm **cost** of §16.5 is live too
> (Ch. 45 B4): Master Health by rank column for a contracted Servant, Sustainability for a Free
> one, and double self-Health for a Free Servant with no clock at all.
>
> Still open: Contracting, Overpower/Underpower, the Sustainability **drain**, and the
> multi-Servant tax. The drain is a content gap rather than an engine one — nothing authors an
> `OnEvent` against it.

The Master–Servant bond is the game's central tension: Servants are strong and Masters are
fragile, but a Servant far from its Master is weakened and a Servant without a Master is on a
timer. This chapter specifies contracts, ZON, Sustainability, Cover, Overpower/Underpower, and
contract theft.

---

## 16.1 The contract graph

```
Master ──contracts──▶ Servant        (1 : many)
Servant ──boundTo──▶ Master          (many : 1, exactly one or none)
```

A Master may hold several Servants; a Servant has at most one Master. The graph is
bidirectional and must stay consistent — every write goes through a single `ContractService`
that updates both ends atomically.

```ts
type ContractState = "contracted" | "unbound" | "free";

interface Contract {
  state: ContractState;
  masterId: string | null;
  commandSpells: number;          // spells usable on THIS servant
  bondedOnTurn: number;
}
```

### The three states

| State | Master | Command Spells | Contractible by |
|---|---|---|---|
| `contracted` | alive, has spells | ≥ 1 | nobody |
| `unbound` | alive, out of spells | 0 | **enemy** Masters/Casters only |
| `free` | dead | n/a | **allied and enemy** Masters/Casters |

> *"Unbound Servant: A Servant whose Master has lost/used up his Command Seals. Servant is still
> controlled by the player, but is susceptible to Contracts from other parties."*
> *"Free Servant: A Servant whose Master has been killed. Servant is still controlled by the
> player, but is susceptible to Contracts from other parties."*

Both remain **player-controlled**. Losing a Master does not lose the unit; it makes it
vulnerable to theft and starts the Sustainability clock.

State is derived, not stored:

```ts
function contractState(servant, board): ContractState {
  const m = board.units.get(servant.contract.masterId);
  if (!m || m.health.value <= 0) return "free";
  if (totalCommandSpellsFor(m, servant.id) === 0) return "unbound";
  return "contracted";
}
```

---

## 16.2 Contracting

To form a contract, the Master or Caster must be on a panel **next to** the target Servant
(Chebyshev 1), and must not have an enemy unit within a 2-panel area of itself.

> *"Masters/Casters cannot attempt a Contract Servant roll if there is another enemy Unit within
> a 2 panel area of itself."*

| Target | Contracted by | Roll | Success |
|---|---|---|---|
| Unbound | Allied Master/Caster | — | **Forbidden** |
| Unbound | Enemy Master/Caster | `1d6` | on **6** |
| Free | Allied Master/Caster | — | **Automatic** |
| Free | Enemy Master/Caster | `1d6` | on **5 or 6** |

**Independent Action** multiplies the difficulty:

> *"When an enemy Master or Caster tries to contract this Servant, the 'Contract Servant' roll
> is used X times … The Servant can only be contracted if **all** rolls are successful."*

| Rank | Rolls required |
|---|---|
| EX, A+ | **Cannot be contracted by enemies at all** |
| A | 4 |
| B | 3 |
| C and below | 2 |

Kingprotea (Independent Action B) needs 3 successful rolls; Kiritsugu (A) needs 4. At a 1-in-6
success rate per roll for an Unbound Servant, Kiritsugu is effectively uncontractible
(1/1296 ≈ 0.08%). That is the intent — it is what "Independent Action" means.

### Rewards of a successful contract

> *"If the contracting of an Unbound or a Free Servant is Successful, the Master/Caster gains 3
> Command Spells that can only be used on that Servant."*

Three *new* spells, namespaced to that Servant. This is why `commandSpells` is a per-Servant
map on the Master, not a scalar (Ch. 04 §4.5).

### Contract by conquest

> *"When a Master kills an enemy Master, or a Servant kills an enemy Master while within a 2
> panel area of its own Master, or Caster kills a Master, the Master/Caster **automatically**
> Contracts the dead enemy Master's Servant and gains all of the dead Master's remaining Command
> Spells."*

Three trigger conditions, one outcome. The inherited spells are namespaced to the acquired
Servant.

**Note the middle condition:** a Servant killing an enemy Master only transfers the contract if
that Servant is within 2 panels of *its own* Master. A lone Servant killing a Master creates a
Free Servant that nobody automatically claims.

**RISK.** What happens when a Master ends up with more Servants than it can command? The
multi-Servant tax (§16.6) applies, and nothing prevents accumulation. The rules assume this is
self-limiting via the 25-health-per-turn cost. No cap is implemented.

### Automatic contract on a Servant already contracted

Can a contracted Servant be stolen? No — only Unbound and Free Servants are contractible. But
conquest bypasses this: killing a Master makes its Servants Free *and* immediately contracts
them in one step. So the sequence is: Master dies → Servants become Free → the killer's
automatic contract fires. Ordering matters, and the `ContractService` performs both in one
transaction so no intermediate state is observable.

---

## 16.3 ZON — the Effective Servant Zone

Specified numerically in Ch. 06 §6.9. Here, the *behavioural* consequences.

### Being outside ZON

Two penalties, and only two:

1. **Damage reduction.** *"When a Servant deals damage with an Attack while outside of its
   Master's ZON, damage dealt is reduced by 5d10."* Pipeline stage 9.
2. **NPs are unusable.** *"Noble Phantasms can only be used when the Servant is within its
   Master's ZON."*

Not a penalty: skills, spells, movement, and defence are unaffected.

### Exceptions in the reference set

| Unit | Exception |
|---|---|
| Dioscuri | ZON is satisfied if **either** twin is inside |
| Semiramis aboard HGoB | *"ZON does not apply to her"* |
| Semiramis activating HGoB | *"can perform the activation without being in her Master's ZON"* |
| Free Servants | No Master ⇒ no ZON ⇒ the penalty cannot apply (inferred, Ch. 41) |

### ZON is a *Master* property

The zone is drawn around the Master and its radius depends on the Servant's class. With one
Master and three Servants of different classes, there are three different ZON radii around the
same Master. The UI draws the relevant one when a Servant is selected, and the union with
per-Servant colour coding when the Master is selected.

---

## 16.4 Master protection

Four rules, all keyed on "the Master's Servant is within 2 panels of it".

### 1. Targeting immunity

> *"Masters cannot be targeted for an Attack when their Servant is within 2 panels of their
> Master."*

A selection filter (Ch. 09 §9.5). Bypassed by active Presence Concealment and by Scáthach's
*Gate of Skye*.

### 2. Counter redirect

> *"If a Master performs an Attack on an enemy Unit and the enemy Unit decides to Counter, the
> Counter Attack cannot be used on the Master if its Servant is within a 2 panel area of itself,
> the Counter Attack is redirected to that Master's Servant instead."*

A retarget, not a refusal (Ch. 12 §12.8).

### 3. Zone denial

> *"Units are not allowed to enter a 1 panel area of enemy Masters if that Master's Servant is
> within 2 panels of its Master. However, Masters **can** stop on a panel directly next to an
> enemy Unit (this is because I cannot think of a way to stop this happening in reverse)."*

A movement constraint with an explicit asymmetry the author acknowledges. Implemented as an
`Infinity` movement cost (Ch. 08 §8.3), with the exemption for Master-kind movers.

### 4. Cover

The most involved of the four:

> *"When a Master that has its Servant within a 2 panel Range of itself gets caught in an AoE
> Noble Phantasm and fails to Evade, the Servant performs an Agility Check/Agility Check−. If
> Successful, the Servant shoves (Moves) its Master out of the NP area (the Master is Moved to
> one panel outside of the NP area), and the Combat Process proceeds as normal."*
> *"If Failed, the Master receives no damage and effects, while the Total Damage the Servant
> takes from the AoE NP is increased by 100%; and in this situation, Servants **cannot Evade**
> the enemy Unit's AoE NP if their Master is within a 2 panel range of them."*

So:

```
Master caught in AoE NP, Servant within 2 panels, Master fails Evade
 │
 ├─ Servant rolls Agility Check
 │
 ├─ SUCCESS → Master is moved 1 panel outside the NP area
 │            Combat proceeds normally for everyone else
 │            Servant takes normal NP damage (if it is also in the area)
 │
 └─ FAILURE → Master takes NOTHING
              Servant's Total Damage from this NP is +100%  (stage 15)
              Servant CANNOT Evade this NP
```

**Multi-Servant division:**

> *"If a Master in this situation has more than one Servant … the increase in Total Damage taken
> by the Servants are divided by the number of Servants Covering."*

Two covering Servants ⇒ +50% each. Three ⇒ +33% each.

**The exclusion:**

> *"If a Servant fails to Shove their Master out of an AoE NP, but that Servant is **not within
> the NP area**, that Servant cannot Cover for their Master."*

So a Servant outside the blast cannot absorb it. If *all* covering Servants are outside the
area and all fail, the Master takes the hit normally.

**Optional for non-NP AoE:**

> *"When a Master in the same conditions gets caught in a non-NP AoE Attack, the above process
> can be performed, but it is **optional**."*

So the Servant's controller is prompted; for NPs it is mandatory.

**Negation:**

> *"While a Servant is affected by Charm, Confuse, Berserk, Stun, Stop, Petrify, Freeze, Sleep,
> or any other effect that prevents a Servant from Acting, the effects in the above three
> paragraphs are negated."*

So all four protection rules — targeting immunity, counter redirect, zone denial, and Cover —
are disabled when the Servant cannot Act. An incapacitated Servant protects nothing.

This is a significant tactical lever: `Stun` on a bodyguard Servant opens its Master to direct
attack. The engine must therefore recompute Master protection whenever a Servant's
action-denial state changes, not just on movement.

**Presence Concealment exception:**

> *"An exception to the above three paragraphs is the 'Presence Concealment' Skill."*

A concealed Servant may attack Masters and move anywhere regardless of Master–Servant
positions. So protection is evaluated against the *attacker's* concealment state as well.

### Implementation

```ts
function masterIsProtected(master, attacker, board): boolean {
  if (attacker.flags.presenceConcealed) return false;
  if (attacker.ability?.ignoresMasterProtection) return false;   // Gate of Skye
  return master.contract.servantIds.some(sid => {
    const s = board.units.get(sid);
    return s
      && s.health.value > 0
      && minPanelDistance(s, master) <= 2
      && canAct(s);                                              // the negation clause
  });
}
```

`canAct(s)` is the shared predicate used by Cover, zone denial, and the counter redirect. One
function, four call sites.

---

## 16.5 Overpower and Underpower

### Overpower — Servant attacks Master

> *"When A Servant successfully Attacks Master, the player controlling the Servant Flips a Coin.
> If Heads, the Master is instantly defeated. If Tails, proceed to Step 3 of Combat."*

Base 50%. Modifiers:

| Condition | Effect |
|---|---|
| Master has `Invuln` | **Cannot be Overpowered** |
| Master has `Shield` | **Cannot be Overpowered** |
| Master has `Def Up` or `Dmg Cut` | Chance **−10%** |
| `Luck Check: Master's Luck` succeeds | Not instantly defeated; takes normal damage; survives at 1 Health if that damage would kill |

The Luck Check covers *both* the Overpower flip and the subsequent lethal-damage case in one
success, which makes it disproportionately valuable and worth surfacing clearly in the UI.

### Underpower — Master attacks Servant

> *"When a Master successfully Attacks a Servant, the player controlling the Master Flips a Coin.
> If Heads, damage is calculated normally. If Tails, the Total Damage dealt to the Servant is
> reduced by 50% including NP."*

Base 50% chance of the penalty. Modifier: the Master having `Atk Up` or `NP DmUp` reduces the
penalty chance by 10%.

Note the asymmetry in phrasing: for Overpower, "chance of being Overpowered is reduced by 10%"
(good for the Master); for Underpower, "chance of being Underpowered is reduced by 10%" (also
good for the Master). Both modifiers favour the Master. Consistent.

Applied at pipeline stage 15 as a `×0.5` on Total Damage.

### Neither applies between same-kind units

Explicitly: *"Master cannot be Overpowered by Servants"* is the phrasing used when an effect
grants immunity, and *"Master cannot be Underpowered by Servants"* clarifies the direction. A
Servant attacking a Servant runs neither; a Master attacking a Master runs neither.

Civilians: a Servant attacking a Civilian kills it outright, which is its own rule, not
Overpower.

---

## 16.6 Sustainability

The Free Servant timer. Numeric model in Ch. 06 §6.8; here, the behaviour.

```
Master dies
 └─▶ Servant becomes FREE
      └─▶ sustainabilityRemaining = effectiveSustainability
           └─▶ decrement at each turn end
                └─▶ reaching 0 ⇒ the Servant DISAPPEARS
```

**Disappearance counts toward the Grail counter:**

> *"A disappeared Servant counts towards the number of Servants needed for the Grail to
> materialize (but not if inflicted with Erase)."*

### Modifiers

| Source | Delta |
|---|---|
| Independent Action | grants a "high" value, stated per-Servant |
| High Rank Master (alive) | +1◈ |
| Mad Enhancement active when the Master dies | −2◈ |
| Semiramis aboard HGoB | +2◈ |
| Semiramis with `Double Summon: Caster` | 4◈ instead of 2◈ |
| Using an NP while Free | −1◈ to −6◈ by NP rank |

### `N/A` Sustainability

> *"If a Servant's Sustainability is N/A, it means that Sustainability does not apply if it loses
> its Master, it remains indefinitely in the game (unless it disappears from using its NP)."*
> *"If a Free Servant with Sustainability: N/A would use its Noble Phantasm, its Health is
> reduced as if its Master's Health would be reduced. Use the value of the left side, but
> doubled. If using the NP would reduce its Health to 0, it disappears at the end of the Combat
> Process."*

So `N/A` trades a timer for a per-NP health cost of `2 × highRankMasterCost`. A Rank A NP costs
100 self-health.

And the contrast with zero:

> *"To differentiate from a Servant with zero Sustainability, a Servant with zero Sustainability
> disappears immediately if it loses its Master."*

`null` ≠ `0`. Ch. 06 §6.8.

### Mad Enhancement's state preservation

> *"When this Servant's Master is killed, it remains in whatever state it was in before its
> Master died until the Servant is contracted to another Master/Caster."*

So a Berserker with Mad Enhancement active when its Master dies stays in that state — it cannot
be deactivated while Free, and reactivating a contract restores normal control. A small rule
with a real consequence: it locks in the −2◈ Sustainability penalty.

---

## 16.7 The multi-Servant tax

> *"If a Master has more than one Servant Contracted to it, at the end of its Turn, if more than
> one of its Servants Acted during that Turn, that Master loses 25 Health. If a Master has 25
> Health or less, it cannot order more than one of its Servants to Act during its Turn."*
> *"Note: Does not apply in the Grand Order Holy Grail War."*

Two clauses:
1. A **cost**: 25 health at turn end if ≥2 of its Servants Acted.
2. A **prohibition**: at ≤25 health, the Master cannot let more than one act.

The prohibition is a turn-budget constraint enforced at action declaration, and it composes
with the global budget (Ch. 18). The cost is a `loss`, not damage (Ch. 06 §6.2), so it bypasses
all reduction effects.

Note it is per-*Turn* and checks "more than one Acted" — so acting with two Servants costs 25
and acting with five also costs 25. Flat, not per-Servant.

---

## 16.8 The Dioscuri — a joint unit

Castor and Pollux are a special case worth its own treatment because they break several
assumptions:

> *"Castor and Pollux are summoned as two separate Servants as one. Castor and Pollux have their
> individual stats; however, the maximum distance between the two is 2 panels. If either one is
> defeated, the other one is also defeated as well regardless of remaining Health. Both are
> respectively allowed to Move and Attack once during their Turn; **each one counts as 0.5
> Units**."*

Consequences:

| Assumption broken | Handling |
|---|---|
| One Servant = one token | Two tokens, one logical Servant |
| Units count as 1 toward the budget | Each counts as **0.5** |
| Units move freely | Hard 2-panel leash |
| Death is per-unit | Linked death, ignoring the survivor's health |
| Cooldowns are per-unit | *"When either Castor or Pollux uses a Skill, the Skill enters Cooldown for both"* |
| ZON is per-unit | Satisfied if **either** is in range |
| NP base attack is one unit's | Half of each twin's BA(STR), combined |
| NP modifiers are one unit's | *"The effects of all Skills, buffs and debuffs on **both** are combined when calculating damage for this NP"* |

**DECISION.** Model as a `LinkedUnitGroup`:

```ts
interface LinkedUnitGroup {
  id: string;
  memberIds: string[];
  leash: number | null;              // 2 for Dioscuri
  linkedDeath: boolean;
  sharedCooldowns: boolean;
  budgetWeight: number;              // 0.5 per member
  zonSatisfaction: "any" | "all";
  modifierCombination: "union" | "separate";
}
```

A general mechanism rather than a Dioscuri special case, because the shape recurs (a Servant
with a permanent summon, a Master-Servant pair moving as one under Passenger Seat). Chapter 34
walks through the Dioscuri in full.

---

## 16.9 Command Spell namespacing

Because contracts move, Command Spells must be tracked per-relationship, not per-Master:

```ts
interface MasterCommandSpells {
  own: number;                              // the Master's original 3
  perServant: Map<string, number>;          // servantId → borrowed/granted spells
}

function availableFor(master, servantId): number {
  return master.commandSpells.own + (master.commandSpells.perServant.get(servantId) ?? 0);
}
```

`own` spells work on any contracted Servant; `perServant` spells only on the named one. When
spending, the engine consumes `perServant` first (they are more restricted, so spending them
first is strictly better for the player) and reports which pool was used.

The Unbound state is derived from `availableFor(master, servantId) === 0`, so a Master with
zero own spells but three borrowed spells for Servant B has Servant A Unbound and Servant B
contracted. That is the correct reading and it produces a genuinely interesting state.

---

## 16.10 Events

The relationship layer emits (Appendix E):

| Event | Payload |
|---|---|
| `contractFormed` | `{masterId, servantId, method: "roll"|"automatic"|"conquest", spellsGranted}` |
| `contractBroken` | `{masterId, servantId, reason: "masterDeath"|"stolen"|"abandoned"}` |
| `contractStateChanged` | `{servantId, from, to}` |
| `zonEntered` / `zonExited` | `{servantId, masterId}` |
| `masterProtectionChanged` | `{masterId, protected: boolean, reason}` |
| `coverAttempted` | `{masterId, servantId, success, damageIncrease}` |
| `overpowerRolled` | `{servantId, masterId, result, luckCheckUsed}` |
| `underpowerRolled` | `{masterId, servantId, result}` |
| `sustainabilityTicked` | `{servantId, remaining}` |
| `servantDisappeared` | `{servantId, cause: "sustainability"|"npCost"}` |

`zonEntered`/`zonExited` fire on movement of either party and are what drive the "your Servant
is out of ZON" warning badge on the token — a small UI affordance that prevents a large class
of player mistakes.

---

## 16.11 Summary of decisions

| # | Decision |
|---|---|
| D16.1 | Contract state is derived from Master liveness and spell count, never stored. |
| D16.2 | Command Spells are namespaced per-Servant; `own` spells are universal, borrowed ones are not. |
| D16.3 | Conquest contracts run death → Free → contract in one transaction with no observable intermediate state. |
| D16.4 | `canAct()` is one shared predicate gating all four Master-protection rules. |
| D16.5 | Master protection is recomputed on action-denial changes, not only on movement. |
| D16.6 | Cover is mandatory for AoE NPs and optional for non-NP AoE; the damage increase divides among covering Servants. |
| D16.7 | `LinkedUnitGroup` is a general mechanism, not a Dioscuri special case. |
| D16.8 | The multi-Servant tax is a flat 25 health loss per turn, not per extra Servant. |

---

**Next:** [17 — Command Spells](17-command-spells.md)
