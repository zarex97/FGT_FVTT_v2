---
id: 2026-10-15-handler-extend-restamped
found: test
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Magecraft's Range Up (Hawkeye) is `noneExtend`: a second Spell while it is held adds its span to the clock
(a rider held to 9 and reapplied for 1◈ is 12). Atk Up (Trace) already does that.

**Actual:** the unit test I wrote for the ruling read 10, one tick past where it was (9 + 1). A second cast in the same
Turn left the expiry exactly where the first had put it. docs/14's open question ("authoring `noneExtend` gets you
`noneRefresh`", #23) had been half fixed and the other half was still open.

**Cause:** `module/engine/effect-applier.mjs:64 @ 7231295` — the flow extends correctly (`priorExpiry + ticks`), then
`mergeEmitted` lays the emitter's absolute `now + duration` over it. A phase's `applyEffects` has no emitted expiry, so it
extended; a handler's `ApplyEffect` always has one, so it restamped. Two readers of "extended if reapplied".

**Fix:** `module/engine/effect-applier.mjs:57 @ ae1dc44` — the flow tags its extension (`extendsFrom`) and
`mergeEmitted` adds the emitter's span to that. Magecraft's is the only handler-applied `noneExtend` in the corpus.
