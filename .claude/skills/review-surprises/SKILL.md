---
name: review-surprises
description: Fuse the unreviewed Surprises into patterns, then grill the user on the lessons for CLAUDE.md and memory.
disable-model-invocation: true
---

# Review the Surprises

Turns the raw records `record-surprise` writes into lessons that change how the next session works.
The format of a Surprise is in `.claude/skills/record-surprise/SKILL.md`.

## Steps

1. **Gather.** Every file in `docs/surprises/` with `reviewed: false`, plus every file in
   `docs/surprises/patterns/`. Done when each unreviewed Surprise is read in full and each pattern's
   member list is known.
2. **Fuse.** Group the unreviewed Surprises by mechanism: the same mistake twice is one pattern, even
   under two different `kind`s, and a Surprise that matches an existing pattern joins it. Split a
   `kind` that turns out to hold two mechanisms. Done when every unreviewed Surprise sits in exactly
   one group, new or existing.
3. **Grill.** Load the `grilling` skill and run it with the user over the groups. For each group the
   frontier asks:
   - Is this one mechanism, and is the pattern's name the right word for it?
   - What is the lesson — the habit or check that would have caught it before the board did?
   - Does it earn a line in `CLAUDE.md`, or only in memory, or neither (a one-off)?
   - Does a `CLAUDE.md` lesson line now overlap another, and should the two merge or one retire?

   Recommend an answer for each. Done when the user has confirmed every group.
4. **Write the patterns.** One file per pattern in `docs/surprises/patterns/<kind>.md`:

   ```markdown
   ---
   kind: <kind>
   lesson: <one line>
   landed: CLAUDE.md#Lessons | memory:<file> | none
   ---
   **Mechanism:** what goes wrong, in two or three sentences.
   **Lesson:** the habit or check, stated positively.
   **Surprises:** [<id>](../<id>.md) · [<id>](../<id>.md)
   ```

   Done when every confirmed group has its file and every member is linked.
5. **Land the lessons.** `CLAUDE.md`'s `### Lessons` section holds one line per pattern that earned it,
   linking the pattern file — it travels to both workplaces by git and is the source of truth. Memory
   gets a `feedback` memory with the longer **Why:** and **How to apply:** on this machine only.
   Merge or retire the lines step 3 said to. Done when every pattern's `landed` matches where it is.
6. **Mark them.** Set `reviewed: true` on each Surprise and add `pattern: <kind>` beneath it. Done when
   no Surprise the grill covered still reads `reviewed: false`.
