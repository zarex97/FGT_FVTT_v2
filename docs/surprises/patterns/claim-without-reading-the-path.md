---
kind: claim-without-reading-the-path
lesson: A doc line, a glossary entry or a name is not evidence; read the code, or probe it, before telling the user what it does or proposing to change it.
landed: CLAUDE.md#Lessons
---
**Mechanism:** A claim about the code is made from something written about it -- a name (`CASTER_PHASES`), an ADR line ("the client layer does not import in Node"), a glossary entry ("Tick (◈)"), the shape of a call site (a live board at a boundary) -- and built on: a proposal, a plan, a list of bugs. The code said otherwise, and so did a rationale already recorded beside it (`test/helpers/world.mjs`'s header had rejected the very seam proposed).
**Lesson:** Before stating what code does, or proposing a change to it, open the code that does it, or run a probe, and quote it. Read the rationale recorded in the file being changed before proposing to restructure it. A claimed bug names the line that reads the wrong thing, not the shape it was found in.
**Surprises:** [2026-10-12-counter-cooldown-said-at-declaration](../2026-10-12-counter-cooldown-said-at-declaration.md) · [2026-10-12-seam-proposed-against-recorded-rejection](../2026-10-12-seam-proposed-against-recorded-rejection.md) · [2026-10-12-foundry-dice-import-in-node](../2026-10-12-foundry-dice-import-in-node.md) · [2026-10-13-glossary-merged-tick-and-diamond](../2026-10-13-glossary-merged-tick-and-diamond.md) · [2026-10-14-boundary-twins-mostly-false-alarms](../2026-10-14-boundary-twins-mostly-false-alarms.md)
