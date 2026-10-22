---
name: survey-class
description: Survey one Class's Character Sheets against the Character model, giving each Kin group of Clauses a verdict, and land the result in docs/model.
disable-model-invocation: true
---

# Survey a Class

Grows the Character model (`docs/model/README.md`) by reading one Class's sheets the cheap way: one Clause per
Kin group, plus the Clauses no other sheet shares. The argument is the Class, as its folder under
`char_orig_sheets/by-class/` names it.

## Steps

1. **Gather.** Run `node tools/sheet-kin.mjs survey <Class> --out <scratchpad>/survey-<Class>.md`. Read
   `docs/model/README.md` and every Shape file beside it. Done when the survey file is written and the
   Shapes are known. Groups the ledger already holds are counted, not listed: do not re-read them.
2. **Classify.** Give each open group and each residue Clause one verdict: **Member** `<Shape>`,
   **Variant** `<Shape>.<field> = <value>`, **Attribute** `<Shape>.<field>`, **Shape** `<Name>`, or **Own**.
   Read every group in full, its head and its other phrasings, Members included: a verdict comes from a
   reading, never from a keyword match or a pre-sort (the user, 2026-10-21). Open the full sheet only when a
   Clause cannot be judged out of its Ability. Done when every group and residue Clause has a verdict.
3. **Grill yourself.** Load the `grilling` skill, but answer each question yourself and record the answer:
   the user asked to be told the answers, not asked. For each Variant, Attribute and Shape:
   - Is it new, or a known value under another name? Grep the code's vocabulary before calling it new.
   - Does it fold into a known Shape as a value or a field, rather than stand as its own Shape?
   - How many sheets carry it? Give the Kin count.
   - Does the engine run it today? Ask `node tools/capability.mjs <term>` first, and name the authored key
     that runs it, or say none. A grep for one word is not the answer: #284, #287 and #290 were built.
   - Is one sheet's phrase being read as everyone's? (*A sheet binds only its owner.*)
   Done when every question has an answer and a reason.
4. **Write.** Land each verdict in `docs/model/`: a new row or field in the Shape's file, or a new Shape
   file, ending in a `keys:` line (`docs/model/README.md`). Write every decided group's normalized head into `docs/model/ledger.json` as
   `{ "verdict", "shape", "note" }`. Tick the Class in the README's Progress table. Done when the next
   survey of this Class lists no open group.
5. **Report.** Tell the user each Variant, Attribute and Shape with its answers from step 3, then the
   Member and Own counts. Each gap the engine cannot run becomes an issue. Record a Surprise when the
   sheets contradict the model. Done when the user has the report.

## Shape file

```markdown
---
shape: <Name>
parent: <Shape it belongs to, or none>
code: <files that run it>
---
**What it is:** one or two sentences.
**Fields:** one line each: `name`: values, with the sheets that showed each new one.
**Kin:** the groups it absorbed, by head Clause and sheet count.
```
