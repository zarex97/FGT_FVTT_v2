---
kind: passes-for-the-wrong-reason
lesson: A check asserts the reason it fails, not only that it failed; and a harness change that replaces a test's premise makes that test fail out loud.
landed: CLAUDE.md#Lessons
---
**Mechanism:** A test or probe stays green after the thing it guards stopped being true. Five files stubbed `Roll` for "every chance lands on 1", the test world began rolling Foundry's real dice over their stub, and they passed on the seed's luck. Three `check:world` probes expected "the model throws", and went on passing when the model threw for an unrelated reason (it could not load at all).
**Lesson:** Assert the reason a guard fails (the message, the refused path), never only that something threw. When the test world takes over something a test used to stub, detect the stub and fail naming the new way (`w.dice`), rather than silently replacing it.
**Surprises:** [2026-10-14-roll-stubs-outlived-by-world-dice](../2026-10-14-roll-stubs-outlived-by-world-dice.md) · [2026-10-14-check-world-accepted-any-throw](../2026-10-14-check-world-accepted-any-throw.md)
