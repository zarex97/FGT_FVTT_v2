# 16 — Removal, transfer, visibility and undo

## What it is

Four small rules that share one property: each is about *who may know or change what*, rather than about
a number. **Transfer** moves an effect from one unit to another while preserving its duration.
**Removal** decides whether a dispel actually lands, accounting for resistance and permanent effects.
**Visibility** gates which players see which effects and card details. **Undo eligibility** prevents
takebacks after information has leaked to an opponent (`module/rules/effect-flow.mjs:6-9`).

## Where it lives

| File | Role |
|---|---|
| `module/rules/effect-flow.mjs` | Transfer, visibility, Confuse's selector, and Undo eligibility |
| `module/rules/removal.mjs` | Removal plan logic, resistance calculation, and roll requirements |
| `module/rules/card-visibility.mjs` | Per-viewer chat card redaction by side and controller |

## How it works

### Transfer

A transfer moves an effect instance from one unit to another. The rule states: *"The buff is removed from the DU and applied to the AU instead, **with the duration being maintained**."* Because durations are stored as absolute expiry ticks, transfer is a move rather than a re-application—restarting the clock would break the maintenance promise (`module/rules/effect-flow.mjs:20-22`).

`transferEffect` generates two descriptors: one to remove the instance from its source, and one to apply it to the target. The only adjustment is `pausedTicks`: if either unit has been Stopped (clock offset), the expiry is rebased to land at the correct moment (`module/rules/effect-flow.mjs:34-50`).

Stage travels with the effect. Van Gogh's Shadow of Longing gathers Curse from everyone nearby: *"apply all stages accordingly"* means the stages arrive, not that the effect restarts at stage one (`module/rules/effect-flow.mjs:44-46`).

`transferableFrom` enumerates every instance a transfer would move, filtering by `defId` and `polarity` if requested. **Unremovable effects cannot be transferred**, because a transfer removes before it applies, and Unremovable means it cannot be taken off at all (`module/rules/effect-flow.mjs:62-76`).

### Removal

Removal decides which candidates actually come off a unit. A dispel nominates a set of candidates; removal filters by resistance and `unremovable` status.

**Unremovable effects** are refused before any roll. Appendix A marks a few that no dispel reaches at all, and rolling would imply one sometimes does (`module/rules/removal.mjs:71-73`). The rule is "for the rest of the game"—expressed as a boolean flag, not a duration.

**Buff Removal Resistance** is Kingprotea's Huge Scale: *"If Kingprotea has 1 Proliferation stock, the chance of buffs being removed from herself is reduced by 35%. For every additional stock, the magnitude is increased by 5%."* The resistance value is summed; it gates whether a roll is needed at all (`module/rules/removal.mjs:37-45`).

**Debuffs are never protected**. The bypassing rule is Kingprotea's Infantile Regression: *"ignores effects that prevent buffs from being removed."* She removes her own buffs **through the protection they themselves granted**, and the same buffs resist one remover but not another. Only buffs are protected because every clause of this shape in the corpus says "buffs"—a self-targeted debuff cleanse must not be resisted by a Skill that exists to keep her buffs on (`module/rules/removal.mjs:8-26`).

`removalPlan` takes candidates, a bearer unit, rolls by `defId`, and an `ignoresProtection` flag. For each candidate: if unremovable, it stays. If it is a debuff or resistance is zero or bypassed, it comes off. If it is a buff with active resistance, a roll is required: the candidate stays if the roll exceeds `100 - resist`, and is recorded in the `resisted` list with the roll and chance for logging (`module/rules/removal.mjs:62-89`).

`pendingRemovalRolls` enumerates which candidates need `1d100` before `removalPlan` can decide. The caller rolls and passes the totals in—no roll, no resistance; the contract is symmetric (`module/rules/removal.mjs:104-111`).

### Visibility

**Effect visibility** by default is by polarity. A buff stays with its owner and the GM. A debuff is shown to the inflicter as well, because they applied it and already know what they applied—telling them is not a leak (`module/rules/effect-flow.mjs:82-88`).

`visibilityOf` returns a `{ visibleTo, gm: true }` object. `visibleTo` is a list of viewer IDs that can see it, or `["all"]` for public. Explicit marks—`visibility: "public"`, `"gmOnly"`—override polarity (`module/rules/effect-flow.mjs:94-104`).

`canSeeEffect` gates a viewer against an effect: the GM sees everything, viewers in the `visibleTo` list see it, and `"all"` means everyone (`module/rules/effect-flow.mjs:114-119`).

**Card visibility** is per-viewer redaction by **side**, not by name. A fact without a side (facing, terrain) stays for all viewers; a row marked `side: "defender"` is redacted from the attacker, and vice versa. The defender learns **what was applied to them**, by name; everyone else learns only **how many**—enough to see something happened, not enough to plan around it (`module/rules/card-visibility.mjs:44-75`).

`cardFor` returns the card one viewer should see. Involvement (attacker, defender, or GM) gates access to damage, breakdown, and effect names. Roles that are both attacker and defender (AoE catching the caster, or a charmed Servant) are treated as both—no redaction applies (`module/rules/card-visibility.mjs:44-75`).

### Undo eligibility

**The boundary is information disclosure.** Once an opponent has learned something from your action, undoing it would let you extract information for free. That is the classic take-back exploit, and it is the only line that matters (`module/rules/effect-flow.mjs:182-185`).

`canUndo` gates an action against `ctx`: `{ turnEnded, actingFactionId }`. A movement, facing, or unresolved targeting is undoable. A resolved attack is not—the defender has already reacted (`module/rules/effect-flow.mjs:203-234`).

Only your own turn: undoing during somebody else's would rewrite a board they are currently reasoning about (`module/rules/effect-flow.mjs:205-209`).

A Command Spell is never undoable; your opponent saw you spend it (`module/rules/effect-flow.mjs:227-228`). A Skill is undoable only if nobody could see it; if the opponent saw it happen, the takeback is refused (`module/rules/effect-flow.mjs:218-222`).

Unknown action kinds are NOT undoable. The safe direction is refusing to rewind something whose consequences this function does not understand (`module/rules/effect-flow.mjs:230-232`).

## Invariants & edge cases

1. **A transfer carries stage, duration, and source.** Everything an instance carries moves except the holder. Stage 7 Curse stays Stage 7; absolute expiry is rebased for clock offset (`module/rules/effect-flow.mjs:34-50`).

2. **Unremovable effects do not transfer and do not come off.** A flag rather than a duration, expressing "for the rest of the game" (`module/rules/removal.mjs:71-89`).

3. **Buff Removal Resistance is rolled once per buff definition, not per instance.** Two stacks of one effect roll once; their outcome is shared (`module/rules/removal.mjs:48-53`).

4. **Effect visibility is a default, not a fact.** `visibility: "public"`, `"gmOnly"` (and aliases `"all"`) override polarity, so an effect can be marked to break the normal rules (`module/rules/effect-flow.mjs:95-97`).

5. **Card redaction is by side, not by who owns it.** A fact belonging to no side is kept for all; a row marked `side: "attacker"` is shown to attackers, the GM, and viewers with `openTable`, never to the defender (`module/rules/card-visibility.mjs:139-190`).

6. **Undo eligibility is checked per action, not per phase.** An action can be undone even if the phase it belonged to cannot (`module/rules/effect-flow.mjs:203-234`).

7. **Visibility modes affect chat cards, not effect instances.** `cardFor` and `skillEffectsFor` filter what the client renders; `canSeeEffect` answers whether a unit's passive reveals an effect to an observer. Two different shapes (`module/rules/card-visibility.mjs:22-31`).

## Open questions

- **Checked live: the override path is real but unexercised.** Every effect instance in the
  `fgt2026` world carries `visibility: "public"` — zero instances bear an override, so the field is
  handled by the code and never yet exercised by content. Nothing is broken; there is simply no live
  evidence either way, and the catalogue still does not surface the field to an author.

- **Confirmed registered and readable.** `closedInfo` resolves live (currently `true`), so the
  setting exists and is consulted rather than declared and ignored — which is the failure mode its
  own Traps entry records. What is still unverified is the *rendering*: that a viewer holding it sees
  the full breakdown on a card is not confirmed against a second connected client.

- **Why is stage applied before expiry rebasing?** Transfer applies stage to the new instance, then expiry is rebased. If the target is Stopped and expiry drops into the past, does the instance apply and then immediately expire? The code sequence is correct (tests pass), but the reasoning is opaque (`module/rules/effect-flow.mjs:39-50`).
