/**
 * @file A Bašmu cannot leave the Hanging Gardens (#68).
 * @see module/rules/platforms.mjs#canUnboard, module/rules/snapshot.mjs
 *
 * > *"Bašmu cannot leave the HGoB."* — char_orig_sheets/Copia de Semiramis.md, line 104
 *
 * Found on the Semiramis audit: Bašmu's bar offered Jump Off. `summoning.mjs`
 * stamps `boundToPlatformId` so the garden's teardown can dismiss it, but the
 * snapshot never projected the field, so nothing in `rules/` could see the bond
 * and the Jump treated Bašmu as any other summon.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { jumpVerdict, canUnboard } from "../../module/rules/platforms.mjs";

beforeAll(prepareSubjects, 60_000);

const GARDEN = "hgobGardenActor1";
const garden = { id: GARDEN, kind: "platform", level: 20, panel: { i: 0, j: 0 }, footprint: { w: 9, h: 9 } };

describe("a Bašmu bound to the garden", () => {
  it("projects the bond onto its snapshot", async () => {
    const bound = await withSubjects(
      [{ from: "basmu", id: "basmuSummon0001", state: { boundToPlatformId: GARDEN } }],
      ({ unit }) => unit("basmuSummon0001").boundToPlatformId,
    );
    expect(bound).toBe(GARDEN);
  });

  it("is refused the Jump off it", () => {
    const basmu = { id: "b", kind: "summon", level: 20, panel: { i: 8, j: 4 }, boundToPlatformId: GARDEN };
    expect(canUnboard(basmu, garden)).toEqual({ ok: false, reason: "boundToPlatform" });
    expect(jumpVerdict(basmu, garden, 3)).toEqual({ ok: false, reason: "boundToPlatform" });
  });

  it("is refused outright, not told to step to the edge first", () => {
    // The bar withholds the slot for every reason but `notOnEdge` and
    // `noMovement`, which a player can act on. A bound Bašmu in the garden's
    // interior was shown Jump Off, blocked only for standing in the middle.
    const inner = { id: "b", kind: "summon", level: 20, panel: { i: 4, j: 4 }, boundToPlatformId: GARDEN };
    expect(jumpVerdict(inner, garden, 3)).toEqual({ ok: false, reason: "boundToPlatform" });
  });

  it("leaves an unbound summon free to Jump", () => {
    const other = { id: "w", kind: "summon", level: 20, panel: { i: 8, j: 4 } };
    expect(jumpVerdict(other, garden, 3)).toEqual({ ok: true });
  });
});
