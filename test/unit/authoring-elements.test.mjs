/**
 * @file Every rule element the engine executes, describable by a GM.
 * @see module/rules/authoring/elements.mjs
 *
 * Both directions, for the reason test/unit/targeting.test.mjs gives: an
 * element offered that nothing executes authors cleanly and does nothing, and
 * an element executed that nobody can author is a feature with no door.
 */

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { handledKeys, EXECUTORS } from "../../module/rules/elements.mjs";
import { descriptorProblems } from "../../module/rules/authoring/contract.mjs";
import {
  ELEMENT_DESCRIPTORS, ELEMENT_IDS, elementsForBucket,
} from "../../module/rules/authoring/elements.mjs";

describe("drift: descriptors and EXECUTORS", () => {
  it("describes every key the engine executes", () => {
    for (const key of handledKeys()) {
      expect(ELEMENT_IDS, `the engine executes "${key}" and no GM can author it`).toContain(key);
    }
  });

  it("describes nothing the engine cannot execute", () => {
    for (const id of ELEMENT_IDS) {
      expect(typeof EXECUTORS[id], `the picker offers "${id}" and nothing executes it`)
        .toBe("function");
    }
  });

  it("covers all 54", () => {
    expect(ELEMENT_IDS.length).toBe(handledKeys().length);
  });
});

describe("every descriptor is well formed", () => {
  it("has an id, a label, a hint and renderable fields", () => {
    for (const id of ELEMENT_IDS) {
      expect(descriptorProblems(ELEMENT_DESCRIPTORS[id]), id).toEqual([]);
    }
  });

  it("names at least one bucket it may be authored into", () => {
    for (const id of ELEMENT_IDS) {
      expect(ELEMENT_DESCRIPTORS[id].buckets.length, id).toBeGreaterThan(0);
      for (const b of ELEMENT_DESCRIPTORS[id].buckets) {
        expect(["rules", "passiveRules", "activeRules"], `${id}: ${b}`).toContain(b);
      }
    }
  });

  it("gives every descriptor a doc anchor that exists", () => {
    for (const id of ELEMENT_IDS) {
      const file = ELEMENT_DESCRIPTORS[id].doc.split("#")[0];
      expect(existsSync(`docs/${file}`), `${id} → docs/${file}`).toBe(true);
    }
  });

  it("offers the gate on every element, because the engine tests it on every element", () => {
    // `collectContributions` checks `el.predicate` before any executor runs.
    // An element whose descriptor omitted it would be one a GM could not gate.
    for (const id of ELEMENT_IDS) {
      const keys = ELEMENT_DESCRIPTORS[id].fields.map((f) => f.key);
      expect(keys, `${id} has no predicate field`).toContain("predicate");
    }
  });

  it("gives no descriptor two fields with the same key", () => {
    for (const id of ELEMENT_IDS) {
      const keys = ELEMENT_DESCRIPTORS[id].fields.map((f) => f.key);
      expect(new Set(keys).size, `${id} repeats a field key`).toBe(keys.length);
    }
  });
});

describe("elementsForBucket", () => {
  it("returns only elements that bucket accepts", () => {
    for (const entry of elementsForBucket("passiveRules")) {
      expect(entry.buckets, entry.id).toContain("passiveRules");
    }
  });

  it("finds the two Akhilleus Kosmos needs in passiveRules", () => {
    const ids = elementsForBucket("passiveRules").map((e) => e.id);
    expect(ids).toContain("GrantedAbility");
    expect(ids).toContain("Knockback");
  });

  it("returns nothing for a bucket that does not exist", () => {
    expect(elementsForBucket("nonsense")).toEqual([]);
  });
});
