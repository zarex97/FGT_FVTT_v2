---
id: 2026-10-15-np-slot-lit-after-attack
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** after EMIYA's Normal Attack, Unlimited Blade Works' slot says why it is closed, as Overedge's and Caladbolg's did.
**Actual:** the slot showed no reason; the press toasted "Unlimited Blade Works: Infinite Creation of Swords cannot be used: this unit has already attacked this turn."
**Cause:** `module/apps/hud/action-bar.mjs:282 @ 960496f` — the bar asked the budget only for abilities that open an Attack; `skill-use.mjs` bills a non-damaging NP as `np`.
**Fix:** `module/rules/ability-use.mjs#useBudgetKind @ uncommitted` — one kind read by the bar and the use path; the slot reads "— this unit has already attacked this turn".
