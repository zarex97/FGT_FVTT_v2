---
id: 2026-11-12-full-text-leaked-links-and-true-name
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** A learned ability's full text reads as its sheet, with no identity the Faction lacks.
**Actual:** Player1 read raw `@UUID[...]{label}` links and "Cannot be used if Achilles…" for an unknown bearer.
**Cause:** `module/apps/intel-window.mjs:197 @ 9614985` — the window printed the stored description, not an enriched or scrubbed one.
**Fix:** `module/apps/intel-window.mjs:197 @ 9614985` — `#fullText` reads links as labels and scrubs the bearer's names unless the identity is known.
