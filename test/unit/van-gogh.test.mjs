/**
 * @file Van Gogh — the Servant whose own debuff is her fuel.
 * @see char_orig_sheets/Copia de Van Gogh.md
 * @see docs/superpowers/specs/2026-09-14-van-gogh-design.md
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";

const src = (dir, file) =>
  parse(readFileSync(join(process.cwd(), "packs/_source", dir, file), "utf8"));

describe("Van Gogh — the statline", () => {
  const g = src("servants", "van-gogh.yml");

  it("is the sheet's statline exactly", () => {
    expect(g.parameters).toEqual({ str: "E", end: "B", agi: "C", mag: "A", luc: "D" });
    expect(g.baseHealth).toBe(1250);
    expect(g.mov).toBe(5);
    expect(g.range).toEqual({ panels: 3, targets: 1 });
    expect(g.baseAttack).toEqual({ str: 50, mag: 200 });
    expect(g.sustainability).toBe("2◈");
  });

  it("attacks with MAG, which her sheet states in a Note (spec R4)", () => {
    // Unusual enough that the sheet has a Note for it. BA(MAG) 200 against a
    // STR of 50 -- reading the default would quarter her Normal Attack.
    expect(g.normalAttack).toEqual({ mode: "fixed", component: "mag" });
  });

  it("is Chaotic Neutral with the sheet's six attributes", () => {
    expect(g.alignment).toEqual({ order: "chaotic", morality: "neutral" });
    expect(g.attributes).toEqual(
      ["female", "servant", "man", "humanoid", "threatToHumanity", "child"],
    );
  });

  it("takes Base Health and BA(MAG) from the tables", () => {
    expect(g.baseHealth).toBe(lookup("baseHealthByEnd", Rank.parse("B")));
    expect(g.baseAttack.mag).toBe(lookup("baseAttackMagByMag", Rank.parse("A")));
  });
});

describe("Van Gogh — Divinity B+ is a ref and nothing else (spec R5)", () => {
  const g = src("servants", "van-gogh.yml");

  it("carries it at B+", () => {
    expect(g.abilities).toContainEqual({ ref: "divinity", rank: "B+" });
  });

  it("gets the sheet's 45 from the table", () => {
    // "All damage dealt is increased by 45 including NP" -- B is 40, perStep 5.
    expect(lookup("divinity", Rank.parse("B+"))).toBe(45);
  });
});
