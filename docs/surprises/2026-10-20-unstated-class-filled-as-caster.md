---
id: 2026-10-20-unstated-class-filled-as-caster
found: user
kind: unstated-value-guessed
status: open
reviewed: true
pattern: rule-word-read-one-way
---
**Expected:** Anastasia & Viy's sheet names no class, and Appendix D prints a dash, so the build's `servantClasses: [caster]` was only a label: its comment calls it *"what her opponents would call her"*. Reading 1 of #258 offered full Caster, the Caster slot with no class rules, or another class, and recommended the slot.
**Actual:** the user ruled her an **Archer**: *"The caster in the one whose sheet says only Anastasia. 'Anastasia and Viy' Is basically her summer version."* Four readers had taken the label as the Caster class in full: she could contract enemy Servants and inherit a Contract by killing a Master, she was `Magus`, and her Master's ZON started from the Caster base.
**Cause:** `packs/_source/servants/anastasia.yml:12 @ 50eae993` — the build filled a value the sheet does not state with a guess and never asked. `rules/contract.mjs:278`, `domain/attributes.mjs:68` and `rules/zon.mjs:72 @ 50eae993` read `servantClasses` as rules, so the guess became her powers. The sheet's other form, *Copia de Anastasia.md*, is the Caster.
**Fix:** open. She becomes an Archer under a new name during this audit (#258 readings 1 and 9).
