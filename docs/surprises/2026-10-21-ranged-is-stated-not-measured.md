---
id: 2026-10-21-ranged-is-stated-not-measured
found: user
kind: rule-word-read-one-way
status: open
reviewed: true
pattern: rule-word-read-one-way
---
**Expected:** Surveying the Saber sheets, I read `{R}`, `{M}` and `{S}` at the head of an attack as markers with no
rule behind them. The engine has no Melee or Ranged on an attack. Where a rule asks for a *"ranged Attack"*, as
the Hanging Gardens, the Golden Hind and the Queen Anne's Revenge do, it measures distance instead: the War Rule
`rangedMinimumRange` (default 2) calls any Attack from that far away ranged (`module/domain/war-rules.mjs:160`).

**Actual:** The user, 2026-10-21: *"The {R}, {M}, and {S} are meant to represent if an attack is "Ranged", "Melee" or
"Special"."* The Drive sheets tag 65 attacks `{R}`, 69 `{M}` and 13 `{S}`, and 89 sheets print an `N.Atk Type` line
such as *"STR, Melee (1pan); MAG, Ranged (2+pan)"*. A tagged attack can disagree with the distance reading:
Moralltach is `{M}` at *"Range=3"*, so the War Rule would call it ranged.

**Cause:** `char_orig_sheets/by-class/Saber/Diarmuid (Saber).md`, against `module/domain/war-rules.mjs:160 @ 3530fb5b`.
The 48 older repo sheets carry no tags, so the engine had to infer what the sheet now states. *Special* is not
defined on any sheet read so far.

**Fix:** open in the engine (#281). The user ruled on 2026-10-21: *"Special means special, neither melee nor
ranged."* A rule that asks for a ranged Attack refuses a Special one, and so does a rule that asks for melee. An
attack's delivery is an Attribute in `docs/model/ability.md`.
