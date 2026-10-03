/**
 * @file An area cast with a structure on the caster's panel goes where the structure goes (#170).
 * @see module/rules/bounded-fields.mjs#castLevel, module/engine/fields.mjs, module/engine/skill-use.mjs#zonePaintArgs
 *
 * Piedra Del Sol cast from the Quetzalcoatlus's deck put the stone on the
 * ground and its 7x7 field and Burning label on the deck, so a ground enemy
 * beside the stone was never burned. Ruled 2026-10-02 (#65, ruling 20): the
 * stone, its field and its label all go on the ground, under her.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { prepareSubjects } from "../helpers/subject.mjs";
import { compiled, prepareFields } from "../helpers/field.mjs";
import { castLevel } from "../../module/rules/bounded-fields.mjs";
import { zonePaintArgs } from "../../module/engine/skill-use.mjs";
import { squareBounds } from "../../module/domain/geometry.mjs";

beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);

const DECK = 20;

describe("castLevel", () => {
  it("puts Piedra Del Sol's area on the ground when she casts it from the deck", async () => {
    const stone = await compiled("quetz-piedra-del-sol");
    expect(stone.system.phases.some((p) => p.kind === "createStructure")).toBe(true);
    expect(castLevel(stone, DECK)).toBe(0);
  });

  it("keeps an ability with no structure on her own Level", async () => {
    const sun = await compiled("quetz-charisma-of-the-sun");
    expect(castLevel(sun, DECK)).toBe(DECK);
  });

  it("keeps her Level for a structure placed on a random panel, which is not under her", () => {
    const ability = { system: { phases: [{ kind: "createStructure", at: "randomPanel" }] } };
    expect(castLevel(ability, DECK)).toBe(DECK);
  });
});

describe("the stone's Burning label is painted on the ground", () => {
  it("zonePaintArgs stamps Level 0 for Piedra Del Sol cast from the deck", async () => {
    const stone = await compiled("quetz-piedra-del-sol");
    const spec = stone.system.phases.find((p) => p.kind === "zone").spec;
    const paint = zonePaintArgs(spec, stone, { id: "q" }, { panel: { i: 6, j: 6, k: DECK } }, { bounds: squareBounds(13) });
    expect(paint.level).toBe(0);
  });
});

describe("the field is anchored on the cast Level", () => {
  it("createField stamps castLevel on the anchor", () => {
    const fields = readFileSync("module/engine/fields.mjs", "utf8").replaceAll("\r\n", "\n");
    expect(fields).toMatch(/anchor: \{ \.\.\.anchor, k: castLevel\(ability, self\.panel\.k\) \?\? 0 \}/);
  });
});
