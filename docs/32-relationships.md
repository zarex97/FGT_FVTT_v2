# 32 — Relationships, Overpower and the multi-Servant tax

## What it is

The Master–Servant relationship is the binding between a Master and one or more of its Servants. It costs the Master Health in two ways: when multiple Servants act in the same Turn (the multi-Servant tax), and when they fail to stay within the Master's Effective Servant Zone (ZON). In return, the Servant gains access to Command Spells and a shared pool of Health when contracting to an ally.

The **Overpower** mechanic governs when a Servant attacking a Master can instantly defeat it — a 50% coin flip that is reduced by the Master's defensive effects. **Underpower** applies the opposite penalty: a Master attacking a Servant risks having its damage halved on a 50% flip, reduced by the Master's offensive effects. Both are directional — neither applies when both combatants are Servants or both are Masters.

**Sustainability** is a Servant's internal clock that ticks down when it spends itself on a Noble Phantasm outside a contract. Contracted Servants draw this cost from their Master's Health instead. When a Master is defeated, its Servants become Free and begin counting down; a Servant with zero Sustainability disappears immediately, but one with `null` (no clock) persists indefinitely.

**Linked groups** are two tokens that count as one Servant for the purpose of counting Units — each member has a `unitWeight` of 0.5, so the Dioscuri acting together do not trigger the multi-Servant tax. They share a leash distance and are subject to a `linkedDeath` rule. This is a general mechanism, not a Dioscuri special case.

## Where it lives

| File | Role |
|---|---|
| `module/rules/relationships.mjs` | Overpower, Underpower, Sustainability, and the multi-Servant tax |
| `module/rules/master-rank.mjs` | Tiers (High, Low, Rankless), parameter grants, and the cheaper NP cost column |
| `module/rules/linked-group.mjs` | Group membership, partners, leash, `unitWeight`, and board annotation |
| `module/rules/zon.mjs` | ZON radius calculation, Master lookup, and outside-zone status |
| `module/rules/contract.mjs` | Contracting rules, roll requirements by Independence Action rank, conquest on kill |
| `module/engine/contract.mjs` | Contract execution — rolling, applying, and the conquest flow |
| `module/engine/io.mjs` | Writing contract state and Sustainability changes; calling `onMasterDefeated` when a Master falls |
| `module/data/actor/_shared.mjs` | `sustainability` field as a `TickField` and `sustainabilityRemaining` tracking |
| `module/settings.mjs` | `grandOrder` — a Grand Order war disables the multi-Servant tax |

## How it works

### Contracting and conquest

A Master or Caster may attempt to contract a Servant by moving adjacent and rolling against it. An ally Servant contracts automatically; an enemy Servant requires 1d6 rolls at difficulty 5+, increased to 4 rolls for Independence Action A, 3 for B, and immune (Infinity) for A+ or EX (`module/rules/contract.mjs:93-138`). A successful contract grants three Command Spells scoped to that Servant and freeing the previous Master's contract chain (`module/rules/contract.mjs:227-235`).

When a Master is killed, its Servants become Free **and** any Servant of the killer within 2 panels of its own Master immediately contracts to the killer in a **single transaction** — ensuring no Free state is observed (`module/rules/contract.mjs`).

Conquest is decided by the defeat write path **before** anything is freed, and the ordering is correctness rather than preference: the selector claims Servants by `masterId === deadMaster.id`, and the freeing pass nulls that field as it goes, so a conquest resolved afterwards would find nobody. The killer travels on the defeat intent itself (ADR 0002); `null` means nothing killed it — a bounded field, the Nameless Forest's death roll, Sustainability running out, a linked partner's death — and those free as before, because Conquest needs a claimant and a Master who starved was killed by nobody. Only **Servants** are conquered: a Summon belongs to the Servant that summoned it and follows its summoner.

A conquered Servant never becomes Free, so none of the consequences of being Free apply to it — no mode lock, no Mad Enhancement Sustainability charge, and no instant defeat at zero Sustainability. **Conquest therefore saves a Servant that would otherwise vanish with its Master.** The world setting `conquestSparesServants` (default on) carries this; switched off, a conquered Servant pays those costs anyway, and is still never Free.

### Overpower and Underpower

`overpowerCheck` determines whether a Servant's attack on a Master can instant-defeat it: a 50% coin flip reduced by 10 for Def Up or Dmg Cut, blocked entirely by Invuln or Shield (`module/rules/relationships.mjs:43-58`). `resolveOverpower` folds in a Luck Check that covers both the flip and the lethal damage that follows, making it disproportionately valuable (`module/rules/relationships.mjs:76-82`).

Underpower applies when a Master attacks a Servant: 50% chance its Total Damage is halved (×0.5), reduced by 10 for Atk Up or NP Dmg Up. A Master with a suppression scoped to `underpower` cannot be underpowered at all (`module/rules/relationships.mjs:96-139`).

### Sustainability

A Free Servant spends Sustainability to use a Noble Phantasm, charged by the NP's rank: E=1, D=2, C=3, B=4, A=5 (`module/domain/tables.mjs`). Contracted Servants draw this cost from their Master's Health instead; the Master does not have a Sustainability clock.

When a Master is defeated, `onMasterDefeated` frees every contracted Servant and resolves its clock. A Servant with `sustainability: null` (authored as no clock) stays indefinitely; one with `0` disappears immediately; one with a number counts down and disappears at zero (`module/rules/relationships.mjs:161-201`). If Mad Enhancement is active, the clock costs an additional 2 turns (`module/rules/relationships.mjs:194-199`). The Sustainability field is a `TickField`, stored as an expression like `"2◈"` and resolved to turns at snapshot time (`module/data/actor/_shared.mjs:290`).

### The multi-Servant tax

At the end of a Turn, if more than one Servant has Acted, the Master loses 25 Health as a loss (not damage), bypassing all reduction effects (`module/rules/relationships.mjs:236-253`). The tax is **flat**, not per-Servant — acting with five Servants costs the same 25 as acting with two. Units are counted by `unitWeight`: a Dioscuri member is 0.5, so the pair acting together does not trigger it.

A Master with 25 Health or less cannot order a second Servant to Act if one has already (`module/rules/relationships.mjs:267-279`). This prohibition is the flip side of the tax: it prevents a Master from spending to zero in the same Turn.

The `grandOrder` setting disables both the tax and the prohibition, and also disables Hatred of Achilles against allies (`module/settings.mjs:64-67`).

### Linked groups

Two Servants in a `linkedGroup` are one unit for counting purposes. Each carries `linkedGroup.memberIds`, `leash`, `linkedDeath`, `sharedCooldowns`, and `unitWeight`. `partnersOf` returns other members on the board; `partnerDistance` gives Chebyshev distance to the nearest partner, or `null` if none are present (`module/rules/linked-group.mjs:31-56`).

`leashBroken` returns true when a partner is further than the leash allows — a state that only occurs after forced displacement, since voluntary movement refuses such a panel (`module/rules/linked-group.mjs:59-76`). `annotateLinkedGroups` runs in the board snapshot pass and populates `partnerIds`, `partnerDistance`, and `leashBroken` for every unit (`module/rules/linked-group.mjs:106-125`).

When `zonSatisfaction` is `"any"`, one partner satisfying ZON satisfies both — unioned into `zonPartnerIds` so `zonStatus` can read it without change (`module/rules/linked-group.mjs:115-122`, `module/rules/zon.mjs:146-156`).

## Traps and anti-patterns

**A complete, tested rule that no engine path reached.** `conquestContract` was written, documented
and unit-tested, its engine wrapper existed, and **nothing had ever called either** — so every killed
Master's Servants were simply freed, which is the *opposite* of what Ch. 32 says. The wrapper's own
docstring named the call site it was waiting for. Fixed in
[#27](https://github.com/zarex97/FGT_FVTT_v2/issues/27); same shape as #19, #24 and #28.

**Filtering on a field the step before you just rewrote.** The freeing pass selects the dead Master's
Servants with `masterId === deadMaster.id`. Conquest must run first — and conquest *writes*
`masterId` on everyone it claims, so collecting that list after it silently drops exactly the
Servants whose remaining consequences still had to be decided. Invisible while the default spares
them (they are owed nothing) and a silent skip the moment a table switches `conquestSparesServants`
off. Measured live, in the one configuration that shows it. **Collect the set you are iterating
before any step that mutates what it selects on.**

## Invariants & edge cases

1. **Overpower and Underpower are directional.** Neither applies when both units are Servants or both are Masters. Zero chance and "does not apply" are different facts (`module/rules/relationships.mjs:43-46`, `module/rules/relationships.mjs:96-99`).

2. **`null` Sustainability is not zero.** A Servant with `null` has no clock and stays indefinitely; one with `0` disappears immediately (`module/rules/relationships.mjs:171-183`).

3. **The multi-Servant tax is a loss, not damage.** It bypasses every reduction effect and is tracked by `isLoss: true` in the intent (`module/rules/relationships.mjs:250-251`).

4. **Linked groups count Units, not Servants.** Two 0.5-Unit Dioscuri acting together make 1.0 Unit total, which does not exceed the "more than one" threshold (`module/rules/relationships.mjs:244-246`, `module/test/unit/relationships.test.mjs:237-240`).

5. **Conquest happens in one transaction.** A free Servant and a new contract must be written together; no intermediate Free state is observable (`module/engine/contract.mjs:79-82`).

6. **Partner satisfaction is unioned, not intersected.** When `zonSatisfaction: "any"`, all members benefit if any partner is within ZON (`module/rules/linked-group.mjs:115-122`).

## Traps and anti-patterns

**Reading the wrong shape for Mad Enhancement's active state.** `onMasterDefeated` charged -2◈ when a field `modes: ["madEnhancement"]` was present, but no snapshot, applier or schema ever produced that shape. The snapshot projects `abilities`, each with `slug` and `active`, which is what the Servant document actually carries. **Use the shape the snapshot produces, not a hypothetical one** — a test that passes against a wrong fixture is a false green (`module/rules/relationships.mjs:194-195`, `module/test/unit/relationships.test.mjs:135-147`).

**...and then fix the caller too.** The entry above was recorded as fixed when only the *rule* had moved to `abilities`: `engine/io.mjs`, its one caller, went on building `modes` and never started building `abilities`, so the clause stayed permanently false by a second route and this chapter said otherwise. Measured live on the same Servant side by side — called the way io calls it, the function returned `setContract` and `lockModes` and nothing else; called with `abilities`, it returned those and the Sustainability charge (Ch. 46 §46.4-AS). **When a rule changes the field it reads, the sites that build that field are part of the change**, and a rule whose fixture is now right is still unreachable if its caller feeds it the old shape.

**Charging a ◈ amount against a clock measured in Turns.** The same clause carried a bare `delta: -2` against `servant.sustainability`, which the function's own guards insist is the RESOLVED clock — 6 Turns for a 2◈ Servant at three Turns to the Round. The sheet says *"reduced by 2◈ Turns"*, so the charge was a third of what it should be and a Servant survived a Master's death it should not have. **One denomination for the whole descriptor stream**: `onMasterDefeated` takes `turnsPerRound` and emits Turns, and the caller adds no arithmetic of its own — which is how the two came apart in the first place.

**Passing Sustainability as a string to `onMasterDefeated`.** The authored field is "2◈"; when passed unresolved, arithmetic like `Math.max(0, "2◈" + -2)` produces NaN, silently defeating a Free Servant with time left. **Resolve the Sustainability field through `snapshotUnit` before calling this rule** (`module/engine/io.mjs:1227`). *Fixed: io.mjs now resolves the field before passing it.*

## Open questions

- **Confirmed by the return shape.** `resolveOverpower` answers both questions in one object: a
  passed check returns `{defeated: false, survivesLethal: true}`, while a failed or absent one returns
  `{defeated: roll <= chance, survivesLethal: false}` (`module/rules/relationships.mjs:76-82`). So a
  single Luck Check both prevents the instant defeat **and** carries the unit through the lethal
  damage that would otherwise follow -- there is no second roll, and no path where one half applies
  without the other.

- **Still open, and it needs a forced displacement to settle.** The state is entered on forced
  displacement; what is untested is the return path -- whether a knockback that pushes a member back
  *inside* the leash reads as healed or stays broken. Settling it means applying a real knockback to a
  linked member in both directions, which needs a board carrying a linked pair. No such pair is on the
  live scene.

- **Why the `grandOrder` setting?** A Grand Order is a multi-Master collaboration against a single threat, where the multi-Servant tax and intra-alliance Hatred would make cooperation expensive. The setting is checked in every place these rules fire, but no narrative document exists for when and why a GM should use it.
