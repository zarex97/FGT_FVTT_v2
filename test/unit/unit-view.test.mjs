/**
 * @file One way to look at a Unit: as the board sees it.
 * @see module/engine/board.mjs#unitOf, docs/09-projection.md
 *
 * A bare projection (`unitSnapshot`, or `snapshotUnit` straight from
 * `rules/snapshot.mjs`) carries no auras, terrain, ZON or suppressions: every one
 * of them is a property of who stands where, which only the board knows. A
 * reader handed one answers silently wrong — Item Construction never reached
 * Medea's own Spells, an entry gate lost its position, a Master's ZON read a
 * Servant's own. Engine and interface code asks `unitOf(actor, board)`.
 *
 * The few reads left are listed here with their reason, and the list only
 * shrinks.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { installClientNamespace } from "../helpers/client-namespace.mjs";

/** Every bare projection still allowed outside `engine/board.mjs`, and why. */
const ALLOWED = {
  "module/apps/actor-sheet/context.mjs": "the actor sheet renders its own document; a board per render costs ~75 ms",
  "module/engine/movement-hooks.mjs": "mid-move: the token document passed in holds the new position the board does not have yet",
  "module/engine/io.mjs": "the writer reads its own document's turn record and Sustainability, no position-derived facts",
  "module/engine/public-identity.mjs": "the board's row first; pure fallback for callers with no board and no Foundry globals (tests, chat render)",
  "module/engine/token-vision.mjs": "detection range only, from the Unit's own sheet; called where no board or globals exist",
};

const sources = (dir) => readdirSync(dir).flatMap((f) => {
  const path = join(dir, f);
  if (statSync(path).isDirectory()) return sources(path);
  return path.endsWith(".mjs") ? [path] : [];
});

/** The code of a line, with its comment removed. */
const code = (line) => line.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");

describe("engine and interface code reads a Unit through the board", () => {
  it("leaves bare projections only where the list says why", () => {
    const found = new Set();
    for (const file of [...sources("module/engine"), ...sources("module/apps")]) {
      if (file.endsWith("engine/board.mjs")) continue;
      const src = readFileSync(file, "utf8");
      const rawSnapshot = /import\s*\{[^}]*\bsnapshotUnit\b[^}]*\}\s*from\s*"[./]*rules\/snapshot\.mjs"/.test(src);
      const bare = src.split("\n").map(code).some((l) => /\bunitSnapshot\(/.test(l) || (rawSnapshot && /\bsnapshotUnit\(/.test(l)));
      if (bare) found.add(file.replace(/\\/g, "/"));
    }
    expect([...found].sort()).toEqual(Object.keys(ALLOWED).sort());
  });
});

describe("unitOf", () => {
  beforeAll(async () => { await prepareSubjects(); installClientNamespace(); }, 60_000);

  it("refuses a missing board, so a forgotten argument cannot fall back silently", async () => {
    const { unitOf } = await import("../../module/engine/board.mjs");
    expect(() => unitOf({ id: "x" }, undefined)).toThrow(/needs a board/);
  });

  it("returns the board's own unit, auras and all", () => withSubjects(
    [{ from: "medea", id: "medea", panel: { i: 5, j: 5 } }],
    async ({ board, world }) => {
      const { unitOf } = await import("../../module/engine/board.mjs");
      const unit = unitOf(world.actor("medea"), board);
      expect(unit).toBe(board.units.find((u) => u.id === "medea"));
      expect(unit.projectedAlone).toBeUndefined();
      expect(unitOf("medea", board)).toBe(unit);
    },
  ), 120_000);

  it("marks a lone projection as one", () => withSubjects(
    [{ from: "medea", id: "medea", panel: { i: 5, j: 5 } }],
    async ({ world }) => {
      const { unitOf } = await import("../../module/engine/board.mjs");
      expect(unitOf(world.actor("medea"), null).projectedAlone).toBe(true);
    },
  ), 120_000);
});
