/**
 * @file Every phase kind `runPhases` dispatches, describable by a GM.
 * @see module/rules/authoring/phases.mjs
 *
 * The old PHASE_FIELDS typed four kinds no authored ability uses and left nine
 * that it does to a raw JSON textarea. The typed list was aimed at the wrong
 * targets, and nothing held it against the dispatcher.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { casesIn, descriptorProblems } from "../../module/rules/authoring/contract.mjs";
import { PHASE_DESCRIPTORS, PHASE_IDS, phasesByUsage } from "../../module/rules/authoring/phases.mjs";

/** `applyEffect` is an alias `runPhases` falls through on; it is not a kind. */
const ALIASES = new Set(["applyEffect"]);

/**
 * Every phase kind the engine dispatches, from BOTH runners.
 *
 * There are two. `runPhases` in `engine/skill-use.mjs` switches on `phase.kind`
 * for a Skill; the attack pipeline in `engine/attack.mjs` handles three kinds
 * of its own with `if (phase.kind === …)`, because they happen relative to the
 * damage rather than instead of it — and `cutContract` (Medea's Rule Breaker)
 * exists **only** there.
 *
 * Reading one runner and calling it the authority is how a picker ends up
 * missing a kind that works, which is the mistake this function was written
 * after making.
 */
const dispatched = () => {
  const skill = casesIn(readFileSync("module/engine/skill-use.mjs", "utf8"), "runPhases");
  const attack = (readFileSync("module/engine/attack.mjs", "utf8")
    .match(/phase\.kind === "(\w+)"/g) ?? [])
    .map((m) => m.match(/"(\w+)"/)[1]);
  return new Set([...skill, ...attack].filter((k) => !ALIASES.has(k)));
};

describe("drift: descriptors and runPhases", () => {
  it("describes every kind the engine dispatches", () => {
    for (const kind of dispatched()) {
      expect(PHASE_IDS, `runPhases dispatches "${kind}" and no GM can author it`).toContain(kind);
    }
  });

  it("describes nothing the engine does not dispatch", () => {
    // The four the old PHASE_FIELDS typed and content never used are exactly
    // what this catches: cooldownDelta, modifyDamage, overrideValidation and
    // teleport are not runPhases cases at all.
    const cases = dispatched();
    for (const id of PHASE_IDS) {
      expect(cases.has(id), `the picker offers phase "${id}" and runPhases has no case for it`)
        .toBe(true);
    }
  });

  it("has dropped the four kinds no ability ever used", () => {
    for (const gone of ["cooldownDelta", "modifyDamage", "overrideValidation", "teleport"]) {
      expect(PHASE_IDS, `${gone} is back, and it is not a runPhases case`).not.toContain(gone);
    }
  });
});

describe("every phase descriptor is well formed", () => {
  it("has an id, a label, a hint and renderable fields", () => {
    for (const id of PHASE_IDS) {
      expect(descriptorProblems(PHASE_DESCRIPTORS[id]), id).toEqual([]);
    }
  });

  it("gives no descriptor two fields with the same key", () => {
    for (const id of PHASE_IDS) {
      const keys = PHASE_DESCRIPTORS[id].fields.map((f) => f.key);
      expect(new Set(keys).size, `${id} repeats a field key`).toBe(keys.length);
    }
  });

  it("offers a target on every phase, because every authored phase has one", () => {
    for (const id of PHASE_IDS) {
      expect(PHASE_DESCRIPTORS[id].fields.map((f) => f.key), id).toContain("target");
    }
  });
});

describe("the descriptors cover what the corpus authors", () => {
  it("types every field the shipped abilities actually write", async () => {
    // The real test of a field list: 195 authored files. A key content writes
    // that no descriptor names is a field the editor would silently drop into
    // the raw pane -- which is exactly the state this table replaces.
    const { readdirSync } = await import("node:fs");
    const { parse } = await import("yaml");
    const missing = [];

    for (const dir of ["abilities", "class-skills", "command-spells", "effects"]) {
      for (const f of readdirSync(`packs/_source/${dir}`).filter((n) => n.endsWith(".yml"))) {
        let doc;
        try {
          doc = parse(readFileSync(`packs/_source/${dir}/${f}`, "utf8"));
        } catch {
          continue;
        }
        for (const phase of doc?.phases ?? []) {
          const d = PHASE_DESCRIPTORS[phase?.kind];
          if (!d) continue;
          const known = new Set(d.fields.map((x) => x.key));
          for (const key of Object.keys(phase).filter((k) => k !== "kind")) {
            if (!known.has(key)) missing.push(`${dir}/${f}: ${phase.kind}.${key}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("phasesByUsage", () => {
  it("puts the kinds content actually reaches for first", () => {
    // applyEffects is 95 of the phases in the corpus; a picker that buries it
    // under `channel` is a picker that makes the common case slowest.
    const order = phasesByUsage().map((p) => p.id);
    expect(order[0]).toBe("applyEffects");
    expect(order.indexOf("damage")).toBeLessThan(order.indexOf("channel"));
  });

  it("returns every kind, not just the used ones", () => {
    expect(phasesByUsage()).toHaveLength(PHASE_IDS.length);
  });
});
