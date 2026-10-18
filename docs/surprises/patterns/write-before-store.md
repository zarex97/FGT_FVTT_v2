---
kind: write-before-store
lesson: A run that writes before it stores its progress replays its writes when lost; store progress at each irreversible write.
landed: none
---
**Mechanism:** A Combat Process stores its state only when its run ends, and the damage is written mid-run. Reloading the GM's client while the run waited on its windows lost the run and left the card at `react`; the next answer dealt the damage again (#249, live). An engine flaw, not a habit: tracked as #250.
**Lesson:** Where a run writes and then waits, store how far it got right after the write, or stamp the write so a replay skips it.
**Surprises:** [2026-10-18-reanswered-rung-dealt-damage-twice](../2026-10-18-reanswered-rung-dealt-damage-twice.md)
