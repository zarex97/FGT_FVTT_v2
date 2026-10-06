/**
 * @file Ozymandias — the rulings of his audit (#189).
 * @see char_orig_sheets/Copia de Ozymandias.md, docs/46-roster-re-audit.md
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { turnWrite } from "../../module/rules/snapshot.mjs";
import { interiorModifiers } from "../../module/rules/bounded-fields.mjs";

const src = (dir, file) =>
  parse(readFileSync(join(process.cwd(), "packs/_source", dir, file), "utf8"));

describe("Move then Attack, or Attack then Move (#189 reading 15)", () => {
  it("records whether a Move came before the Attack, at the moment of the Attack", () => {
    const moved = turnWrite({ tick: 4, moved: true }, 4, { attacked: true });
    expect(moved).toMatchObject({ attacked: true, movedBeforeAttack: true });
    const stood = turnWrite({ tick: 4 }, 4, { attacked: true });
    expect(stood).toMatchObject({ attacked: true, movedBeforeAttack: false });
    // A Move after the Attack does not rewrite it.
    expect(turnWrite(stood, 4, { moved: true })).toMatchObject({ movedBeforeAttack: false, moved: true });
    // A ride stamps its Move and its Attack together: it moved first.
    expect(turnWrite({ tick: 4 }, 4, { moved: true, attacked: true })).toMatchObject({ movedBeforeAttack: true });
  });
});

describe("his content, as ruled", () => {
  it("has his own Riding: Double Move and Riding Attack, no Passenger Seat (reading 1)", () => {
    const o = src("servants", "ozymandias.yml");
    expect(o.abilities).toContainEqual({ ref: "class-riding-ozymandias", rank: "A+", cooldown: "3◈-⅓◈" });
    const riding = src("class-skills", "riding-ozymandias.yml");
    expect(riding.passiveRules[0].abilities).toEqual(["doubleMove", "ridingAttack"]);
  });

  it("asks his Master to keep some Health after paying (reading 4)", () => {
    const rt = src("abilities", "ozymandias-ramesseum-tentyris.yml");
    expect(rt.targeting.limits.requirements).toContainEqual({ kind: "masterHealthFraction", above: 0.5 });
    for (const f of ["ozymandias-dendera-electric-bulb.yml", "ozymandias-dendera-electric-bulb-area.yml"]) {
      expect(src("abilities", f).requirements).toContainEqual({ kind: "masterHealthAbove", amount: 10 });
    }
  });
});

describe("Divine Protection revives the Sphinxes, not any allied summon (reading 5)", () => {
  const rt = src("abilities", "ozymandias-ramesseum-tentyris.yml");
  const panels = [];
  for (let i = 0; i < 11; i++) for (let j = 0; j < 11; j++) panels.push({ i, j });
  const field = { id: "rt", ownerId: "oz", geometry: { kind: "markDefined" }, panels, interior: rt.field.interior };
  const oz = { id: "oz", kind: "servant", faction: "a", factionId: "a", panel: { i: 5, j: 5 } };
  const board = (u) => ({ units: [oz, u], fields: [field], alliances: { a: ["a"] } });
  const revivals = (u) => interiorModifiers(field, u, board(u)).filter((r) => r.key === "RevivalSource").map((r) => r.id);

  it("gives the Sphinx Queen its 10%", () => {
    const queen = { id: "q", kind: "summon", contentId: "sphinx-queen", faction: "a", factionId: "a", panel: { i: 4, j: 4 } };
    expect(revivals(queen)).toEqual(["divineProtectionSphinx"]);
  });

  it("gives another allied summon nothing", () => {
    const other = { id: "d", kind: "summon", contentId: "dragon-tooth-warrior-blade", faction: "a", factionId: "a", panel: { i: 4, j: 4 } };
    expect(revivals(other)).toEqual([]);
  });
});
