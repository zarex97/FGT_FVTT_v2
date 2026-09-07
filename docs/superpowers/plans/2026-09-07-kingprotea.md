# Kingprotea — Implementation Plan

**Goal:** Build Kingprotea from `char_orig_sheets/Copia de Kingprotea.md` completely — every
clause of all twelve abilities working, with the engine features they need built rather than
deferred.

**Spec:** [`docs/superpowers/specs/2026-09-07-kingprotea-design.md`](../specs/2026-09-07-kingprotea-design.md)

## Global Constraints

- Layer discipline (`tools/check-layers.mjs`): `domain/` → `rules/` → `engine/` → `apps/`.
- Shut the world down before `npm run build:packs` (`node tools/fgt-rebuild.mjs fgt2026`).
- Checks before the commit: `npm run lint`, `npx vitest run`, `npm run validate:content`,
  `npm run check:templates`, `npm run check:manifest`.
- Docs are part of the commit: the affected chapter in `00`–`44` **and** Ch. 45.
- Live-test in `fgt2026` as the GM. Report measurements, not assertions.
- A new rule-element key goes in **both** `EXECUTORS` and `RULE_ELEMENT_KEYS`.
- Read the **projection**, never the document, for anything a rule element can move.

## Tasks

- [ ] **1 — `perStack`.** `resolveValue` gains `perStack: {effect, each, base}` + `max`;
      `stacksOf` counts instances or uses. `contributionsOf` supplies the counts.
- [ ] **2 — Statline + the shared Alter Ego.** `class-skills/alter-ego.yml`, Mannanán switched
      to the ref, `packs/_source/servants/kingprotea.yml`.
- [ ] **3 — Mad Enhancement A+.** `scaled` tables gain `overrides`; `DamageModifier` gains
      `magnitudeRoundTo`.
- [ ] **4 — The easy skills.** Territory Creation EX, Independent Action B, Goddess's Divine
      Core A, Monstrous Strength EX, Earth Mother's Wail.
- [ ] **5 — Self-Suggestion.** `nvDebuffResUp` effect; the Active's debuff sweep.
- [ ] **6 — Size.** `SizeStep` writes `footprint`; `ServantData` gains `footprint`;
      `token-footprint.mjs` re-syncs from the derived value; `GRANTS.ignoresOccupancy`;
      `knockBackOccupants` walks the whole footprint.
- [ ] **7 — Huge Scale.** `Endless Proliferation`, `proliferationStock`, the six `perStack`
      clauses, the stock-gain handler.
- [ ] **8 — Buff removal.** `rules/removal.mjs`, `BuffRemovalResist`,
      `ignoresRemovalProtection`; Infantile Regression.
- [ ] **9 — Giant Monster of the Great River.** `times:` on an effect spec; `NP DmUp (GAO)`.
- [ ] **10 — Airavata King Size.** The 3×3 edge-adjacent NP, size-scaled NP DmUp, Atk Up rider.
- [ ] **11 — Docs, live test, commit.**
