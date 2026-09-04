/**
 * @file What the pending-decisions window lists.
 * @see module/apps/hud/pending-present.mjs, docs/27-reaction-protocol.md §27.5
 *
 * An AoE attack already fans out to one ladder PER DEFENDER. Own four units,
 * have a Noble Phantasm catch three, and there are three prompts in a scrolling
 * log — each with a clock, and §27.5's default on expiry is the option that
 * spends nothing. Nothing in the system answered "what is waiting for me?"
 */
import { describe, it, expect } from "vitest";
import { pendingRowsFor } from "../../module/apps/hud/pending-present.mjs";

const entry = (over = {}) => ({
  messageId: "m1", unitId: "u1", unitName: "Rider", unitImg: "rider.webp",
  kind: "reaction", owned: true, countdown: null, commandSpells: 0, ...over,
});
const viewer = { id: "p1", isGM: false };

describe("pendingRowsFor", () => {
  it("lists a prompt for a unit this viewer owns", () => {
    expect(pendingRowsFor([entry()], viewer)).toHaveLength(1);
  });

  it("omits a prompt for a unit this viewer does not own", () => {
    // The window is YOUR list. Somebody else's decision is not yours to see.
    expect(pendingRowsFor([entry({ owned: false })], viewer)).toEqual([]);
  });

  it("keeps a Command Spell offer even when the rung is not the viewer's", () => {
    // §17.4's interrupt: a Master may spend into somebody else's exchange, so
    // the offer is the viewer's business even though the rung is not.
    const rows = pendingRowsFor([entry({ owned: false, commandSpells: 2 })], viewer);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("commandSpell");
  });

  it("sorts the soonest clock first", () => {
    // A player with three prompts and one about to expire should not have to
    // find it.
    const rows = pendingRowsFor([
      entry({ messageId: "slow", countdown: { ms: 40000, label: "0:40" } }),
      entry({ messageId: "urgent", countdown: { ms: 4000, label: "0:04" } }),
      entry({ messageId: "mid", countdown: { ms: 20000, label: "0:20" } }),
    ], viewer);
    expect(rows.map((r) => r.messageId)).toEqual(["urgent", "mid", "slow"]);
  });

  it("puts rows with no clock after every row that has one", () => {
    const rows = pendingRowsFor([
      entry({ messageId: "none" }),
      entry({ messageId: "timed", countdown: { ms: 30000, label: "0:30" } }),
    ], viewer);
    expect(rows.map((r) => r.messageId)).toEqual(["timed", "none"]);
  });

  it("marks an expired row so the UI can shout about it", () => {
    expect(pendingRowsFor([entry({ countdown: { ms: 0, label: "0:00" } })], viewer)[0].expired).toBe(true);
  });

  it("marks a Counter rung, which is the one that arms the bar", () => {
    expect(pendingRowsFor([entry({ kind: "counter" })], viewer)[0].isCounter).toBe(true);
    expect(pendingRowsFor([entry({ kind: "reaction" })], viewer)[0].isCounter).toBe(false);
  });

  it("gives each kind a localisable label key the cards already use", () => {
    expect(pendingRowsFor([entry({ kind: "reaction" })], viewer)[0].label).toBe("FGT.Prompt.reaction");
    expect(pendingRowsFor([entry({ kind: "counter" })], viewer)[0].label).toBe("FGT.Prompt.counter");
  });

  it("returns nothing for an empty board, rather than throwing", () => {
    expect(pendingRowsFor([], viewer)).toEqual([]);
    expect(pendingRowsFor(undefined, viewer)).toEqual([]);
  });

  it("shows a GM every prompt, because the GM answers for absent players", () => {
    // §27.5's "decide for them" lives on the card; the GM needs to find it.
    expect(pendingRowsFor([entry({ owned: false })], { id: "gm", isGM: true })).toHaveLength(1);
  });
});
