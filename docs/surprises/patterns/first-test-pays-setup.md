---
kind: first-test-pays-setup
lesson: A test file loads what it needs in beforeAll; it never relies on an earlier file having paid for it.
landed: none
---
**Mechanism:** A file's first test paid Foundry's load and timed out, and passed only when an earlier file in the same worker had loaded Foundry first.
**Lesson:** Load Foundry and the engine in `beforeAll` (`prepareWorld`, `prepareSubjects`) with room in its timeout. Run a new world test alone once before trusting it.
**Surprises:** [2026-10-11-first-world-test-pays-the-load](../2026-10-11-first-world-test-pays-the-load.md)
