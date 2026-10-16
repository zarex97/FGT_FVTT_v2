---
id: 2026-10-15-consumes-use-spends-the-whole-effect
found: test
kind: generic-path-escapes-special-case
status: fixed
reviewed: true
pattern: generic-path-escapes-special-case
---
**Expected:** "the next time he uses an NP that deals damage" is a one-shot clause of a persistent effect: authored
`uses: 1` and `consumesUse` on the clause, AC stays and the clause is spent.

**Actual:** (read, then proved by the arena test once the thrown duration was out of the way) `consumesUse` is
`io.consumeUse`, which deletes the ActiveEffect at its last charge. A one-shot INSIDE a persistent effect is the effect's
whole life: the first damaging NP would have deleted Activated Circuits, `AC.unremovable`, `AC.status` and the first
clause with it.

**Cause:** `module/engine/scheduler.mjs:509 @ 7231295` — `consumesUse` spends the handler's own effect, and
`module/engine/io.mjs:667 @ 7231295` deletes the document at 0. The charge and the lifetime are one thing.

**Fix:** `packs/_source/effects/ac-next-np.yml @ d9a77c1` and `bc-next-np.yml` — the one-shot is a document of its
own, `uses: 1`; the persistent circuit carries no charge. Trace, On puts both on him.
