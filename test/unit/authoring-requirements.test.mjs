/**
 * @file Every requirement kind, describable — and the two lists kept apart.
 * @see module/rules/authoring/requirements.mjs
 *
 * Both dispatchers refuse an unknown kind, so an undescribed one is not a gate
 * that gets skipped -- it is a gate that always LOSES, and the ability or
 * command can never be used by anybody, silently.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { REQUIREMENT_KINDS as CS_ENGINE_KINDS } from "../../module/rules/command-spells.mjs";
import { casesIn, descriptorProblems } from "../../module/rules/authoring/contract.mjs";
import {
  REQUIREMENT_DESCRIPTORS, REQUIREMENT_IDS,
  CS_REQUIREMENT_DESCRIPTORS, CS_REQUIREMENT_IDS, requirementsFor,
} from "../../module/rules/authoring/requirements.mjs";

const dispatched = () =>
  casesIn(readFileSync("module/rules/items.mjs", "utf8"), "meetsRequirement");

describe("drift: descriptors and meetsRequirement", () => {
  it("describes every kind the engine answers", () => {
    for (const kind of dispatched()) {
      expect(REQUIREMENT_IDS, `meetsRequirement answers "${kind}" and no GM can author it`)
        .toContain(kind);
    }
  });

  it("describes nothing meetsRequirement would refuse", () => {
    const cases = dispatched();
    for (const id of REQUIREMENT_IDS) {
      expect(cases.has(id), `the picker offers "${id}" and meetsRequirement has no case for it`)
        .toBe(true);
    }
  });

  it("covers all 24", () => {
    expect(REQUIREMENT_IDS.length).toBe(dispatched().size);
  });
});

describe("drift: the command spell list", () => {
  it("matches the engine's own exported vocabulary, both ways", () => {
    // `rules/command-spells.mjs#REQUIREMENT_KINDS` is exported precisely so a
    // test can hold the catalogue against it.
    expect([...CS_REQUIREMENT_IDS].sort()).toEqual([...CS_ENGINE_KINDS].sort());
  });

  it("does not read the content validator's allowlist as the vocabulary", () => {
    // `tools/lib/content.mjs#CS_REQUIREMENT_KINDS` covers requirement kinds
    // AND `blockedWhen` conditions in one set. `damageWouldDefeatServant` is
    // in it and is a condition, handled by a different switch -- offering it
    // as a requirement would give a gate `meets` has no case for.
    expect(CS_REQUIREMENT_IDS).not.toContain("damageWouldDefeatServant");
  });
});

describe("the two vocabularies stay apart", () => {
  it("keeps command-spell-only kinds out of the ability list", () => {
    // `servantInZon` asks about somebody else's Servant and `attackIsNotNP`
    // about an attack already being resolved. An ability authoring either
    // would be asking a question with no answer.
    expect(REQUIREMENT_IDS).not.toContain("servantInZon");
    expect(REQUIREMENT_IDS).not.toContain("attackIsNotNP");
  });

  it("offers them to command spells", () => {
    expect(CS_REQUIREMENT_IDS).toContain("servantInZon");
    expect(CS_REQUIREMENT_IDS).toContain("attackIsNotNP");
  });
});

describe("requirementsFor", () => {
  it("gives an ability the ability list", () => {
    expect(requirementsFor("ability").map((r) => r.id)).toEqual([...REQUIREMENT_IDS]);
    expect(requirementsFor("noblePhantasm").map((r) => r.id)).toEqual([...REQUIREMENT_IDS]);
  });

  it("gives a command spell the command spell list", () => {
    expect(requirementsFor("commandSpell").map((r) => r.id)).toEqual([...CS_REQUIREMENT_IDS]);
  });

  it("gives an unknown type the ability list rather than nothing", () => {
    // A picker that empties on an unexpected type is worse than one that
    // offers the common vocabulary.
    expect(requirementsFor("mystery").length).toBeGreaterThan(0);
  });
});

describe("every requirement descriptor is well formed", () => {
  it("has an id, a label, a hint and renderable fields", () => {
    for (const id of REQUIREMENT_IDS) {
      expect(descriptorProblems(REQUIREMENT_DESCRIPTORS[id]), id).toEqual([]);
    }
    for (const id of CS_REQUIREMENT_IDS) {
      expect(descriptorProblems(CS_REQUIREMENT_DESCRIPTORS[id]), id).toEqual([]);
    }
  });

  it("types every field the corpus authors on a requirement", async () => {
    const { readdirSync } = await import("node:fs");
    const { parse } = await import("yaml");
    const missing = [];

    for (const dir of ["abilities", "class-skills", "command-spells", "effects"]) {
      const table = dir === "command-spells" ? CS_REQUIREMENT_DESCRIPTORS : REQUIREMENT_DESCRIPTORS;
      for (const f of readdirSync(`packs/_source/${dir}`).filter((n) => n.endsWith(".yml"))) {
        let doc;
        try {
          doc = parse(readFileSync(`packs/_source/${dir}/${f}`, "utf8"));
        } catch {
          continue;
        }
        for (const r of doc?.requirements ?? []) {
          const d = table[r?.kind];
          if (!d) continue;
          const known = new Set(d.fields.map((x) => x.key));
          for (const key of Object.keys(r).filter((k) => k !== "kind")) {
            if (!known.has(key)) missing.push(`${dir}/${f}: ${r.kind}.${key}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
