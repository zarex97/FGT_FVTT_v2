---
kind: producer-without-consumer
lesson: "Built" means everything a feature emits has a consumer; grep for the reader before calling it done.
landed: CLAUDE.md#Lessons
---
**Mechanism:** Something is produced and nothing takes it: a hook nobody hears, an authored key nobody reads, a roll option nobody emits, a record nobody renders. The tests assert the YAML or the pure half, so they pass while the chain ends in mid-air.
**Lesson:** For each thing a feature emits, find its consumer by grep before calling it built: `Hooks.on` for a hook, a reader for an authored key, the emitter for a predicate option, the renderer for a record. Then press the far end live.
**Surprises:** [2026-10-10-dimension-exit-offer-unheard](../2026-10-10-dimension-exit-offer-unheard.md) · [2026-10-10-zero-sail-never-switched-off](../2026-10-10-zero-sail-never-switched-off.md) · [2026-10-10-imaginary-numbers-terrain-unread](../2026-10-10-imaginary-numbers-terrain-unread.md) · [2026-10-10-storm-border-restrictions-unread](../2026-10-10-storm-border-restrictions-unread.md) · [2026-10-10-counter-is-not-a-reaction](../2026-10-10-counter-is-not-a-reaction.md) · [2026-10-10-quickfire-dice-off-the-card](../2026-10-10-quickfire-dice-off-the-card.md)
