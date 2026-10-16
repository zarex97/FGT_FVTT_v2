---
id: 2026-10-16-placed-item-frozen-by-sync
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** after the packs gained Avalon's `eventFilter` and the world reloaded, the [Avalon] inside Arturia's Master carries it, as every other world copy of pack content does (Ch. 41, "the compendium is the whole source of truth").
**Actual:** the pack document held `{amount: "positive"}` on all three heals; the Master's item held `null`, through two rebuilds.
**Cause:** `module/migration/content-sync.mjs:160 @ b4464ed` — an item on an actor that is real content but not on the actor's template is "kept" so play's items are not deleted, and kept meant never compared again. Avalon, moved onto the Master by its rite, sat there frozen; so would a crafted Poison or any transferred Item.
**Fix:** `module/migration/content-sync.mjs#reconcileItems @ 9d0ab57` — such an item is refreshed from its OWN pack document (`runner.mjs#loadItemSources`), keeping what play wrote (`quantity`, the bond); an item with provenance is still only kept. Unit test in `content-sync.test.mjs`; live check after reload.
