---
id: 2026-10-19-suite-flaked-under-load
found: tooling
kind: suite-flakes-under-load
status: open
reviewed: true
pattern: suite-flakes-under-load
---
**Expected:** `npm test` green, as at #255's merge (7462 passed).
**Actual:** with Foundry, the debug Chrome's three tabs and a CDP poller running, two full runs failed 24 and 25 tests across `dioscuri-209-arena`, `dioscuri-209-rulings`, `danzo-249-arena`, `hassan-226-arena` and `nursery-247-rulings`: *"Test timed out in 5000ms"*, *"resolveAttack is not a function"*, *"The world saw what Foundry would not have said"*; a third, capped at six workers, failed one in `scathach-204` (*"Cannot read properties of undefined (reading 'on')"* in `FGTSocket.initialize`). Each file passes alone and the five together; `vitest run --maxWorkers=4` passed 7477 of 7477.
**Cause:** not found. Every failure is in the test world's setup or a 5 s timeout, none in a file this branch touched, and none reproduces below six workers; a test world that reads a global another file's world is still tearing down would explain the socket one. Unproven.
**Fix:** open. The gates for #256 were run at four workers; the flake needs its own look.
