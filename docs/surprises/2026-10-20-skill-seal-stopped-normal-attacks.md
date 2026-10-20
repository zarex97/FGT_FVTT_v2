---
id: 2026-10-20-skill-seal-stopped-normal-attacks
found: live press
kind: unknown-value-falls-to-default
status: fixed
reviewed: true
pattern: unknown-value-falls-to-default
---
**Expected:** Skill Seal, *"Cannot use Skills or Spells"* (Appendix A §A.10), leaves a Normal Attack alone: Karna, sealed by Anastasia's Snegleta, swings at her on Blue's Turn.
**Actual:** Player2 confirmed Karna's Normal Attack and got *"Cannot use this ability: Prevented"*; `pressGate(Karna, null)` answered `{ reason: "prevented", detail: { by: "skillSeal" } }`.
**Cause:** `module/rules/costs.mjs:676 @ 50eae993` — `preventionActionsFor(null)` fell through to its default, `["skill"]`. A Normal Attack is the one press with no Item, and the use gate asked about it since the press gate became the one gate (#244), so every Skill-Sealed Unit lost its Normal Attack.
**Fix:** `module/rules/costs.mjs#preventionActionsFor @ 0552085c` — no ability is an `attack`: Seal and Disable stop it, Skill Seal does not. `anastasia-258-rulings.test.mjs`, red before.
