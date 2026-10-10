---
name: record-surprise
description: Record a Surprise — the design, a test or my own claim said one thing and the board, a test or the user showed another. Use the moment one happens; a live press that disagrees with the design, a test failing for a reason I did not expect, a claim I take back, a correction from the user.
---

# Record a Surprise

A **Surprise** (`CONTEXT.md`) is an expectation that reality contradicted. Each one becomes one file in
`docs/surprises/`, written while the evidence is in front of me. `review-surprises` later fuses them
into patterns and lessons; a Surprise nobody wrote down teaches nothing.

## What counts

Always record:

1. A live press that disagrees with the design.
2. A test that fails for a reason I did not expect.
3. A claim I made and then took back.
4. Something the user corrected me on.

Record tool or setup trouble (a timeout, a locked file, a dead port) only when it cost real time.
A test failing exactly where I expected it to, on the way to green, is the plan working.

## Steps

1. **Name it.** `docs/surprises/<YYYY-MM-DD>-<slug>.md`, the slug naming what went wrong in three to
   six words. Done when no file of that name exists.
2. **Pick its kind.** Read `docs/surprises/patterns/` and reuse a pattern's `kind` when this Surprise
   is the same mistake. Otherwise coin a short kebab-case kind naming the mechanism, not the symptom
   (`event-with-no-listener`, not `resurface-broken`).
3. **Write it** in this shape:

   ```markdown
   ---
   id: <file name without .md>
   found: live press | test | user | retraction | tooling
   kind: <kind>
   status: open | fixed | wontfix
   reviewed: false
   ---
   **Expected:** what the design, the test or I said would happen.
   **Actual:** what happened instead, quoted where there is text to quote.
   **Cause:** `path/to/file.mjs:LINE @ <short sha>` — why, in one or two sentences.
   **Fix:** `path/to/file.mjs:LINE @ <short sha>` — what changed. Or why it stays open.
   ```

   Every **Cause** and **Fix** carries `path:line @ sha`; line numbers drift, the sha pins them. For a
   fix not yet committed write `@ uncommitted` and replace it with the sha in the commit that lands
   it. Done when all four fields are filled, or **Fix** says why it is still open.
4. **Count.** Files in `docs/surprises/` with `reviewed: false`: at 5 or more, tell the user that
   `/review-surprises` is due, with the number.

`reviewed` belongs to `review-surprises`; write it `false` and leave it.
