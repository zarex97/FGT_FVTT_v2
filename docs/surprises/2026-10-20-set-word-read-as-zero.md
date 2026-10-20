---
id: 2026-10-20-set-word-read-as-zero
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** His sheet's derivation list says why his Alignment reads Neutral Evil while Mad Enhancement is Active (reading 4).
**Actual:** Player1's sheet: "alignment.order 0 — Gilles de Rais (Saber)" and "alignment.morality 0", under a header reading "NEUTRAL EVIL".
**Cause:** `module/apps/actor-sheet/context.mjs:931 @ 48916996` — `AlignmentOverride` writes a delta with `set` and no `value`. `rules/derived.mjs:148` learned `set` for #260; the sheet's `rankAmount`, the other reader of the same deltas, did not, and printed `signed(undefined)`.
**Fix:** `module/apps/actor-sheet/context.mjs:934 @ uncommitted` — a `set` delta passes the zero filter and reads "→ neutral".
