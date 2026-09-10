/**
 * @file The acceptance criterion: Akhilleus Kosmos, from descriptors.
 * @see docs/superpowers/specs/2026-09-10-ability-editor-design.md §8
 *
 * Two clauses that have almost nothing to do with each other — a passive that
 * decides how Achilles walks through people, and a barrier he raises exactly
 * once in the whole game. Before this work **neither half was authorable**:
 * `passiveRules` had no UI at all, and `timing` — the field 117 of 195
 * abilities carry — had no control.
 *
 * This test asserts the vocabulary can express the shipped YAML. It is the
 * half a machine can check; the other half is authoring it by hand in a live
 * world and looking at the result, which was done and is recorded in Ch. 45.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { ELEMENT_DESCRIPTORS } from "../../module/rules/authoring/elements.mjs";
import { REQUIREMENT_DESCRIPTORS } from "../../module/rules/authoring/requirements.mjs";
import { TIMING_DESCRIPTORS, AGAINST_FIELDS } from "../../module/rules/authoring/timing.mjs";
import { PHASE_DESCRIPTORS } from "../../module/rules/authoring/phases.mjs";
import { EDITABLE_FIELDS } from "../../module/rules/authoring/ability.mjs";
import { TARGET_ANCHORS, TARGET_SHAPES } from "../../module/rules/targeting/vocabulary.mjs";

const shipped = parse(
  readFileSync("packs/_source/abilities/achilles-akhilleus-kosmos.yml", "utf8"),
);

describe("every clause of Akhilleus Kosmos is reachable", () => {
  it("describes both passive rule elements", () => {
    // GrantedAbility and Knockback. The editor VALIDATED these and offered no
    // control that could add one.
    for (const el of shipped.passiveRules) {
      expect(ELEMENT_DESCRIPTORS[el.key], `no descriptor for ${el.key}`).toBeDefined();
    }
  });

  it("describes every field those elements use", () => {
    for (const el of shipped.passiveRules) {
      const known = new Set(ELEMENT_DESCRIPTORS[el.key].fields.map((f) => f.key));
      for (const key of Object.keys(el).filter((k) => k !== "key")) {
        expect(known, `${el.key}.${key} is authored and has no descriptor field`).toContain(key);
      }
    }
  });

  it("describes its timing window and every against-modifier", () => {
    expect(TIMING_DESCRIPTORS[shipped.timing.window], shipped.timing.window).toBeDefined();
    const modifiers = new Set(AGAINST_FIELDS.map((f) => f.key));
    for (const key of Object.keys(shipped.timing).filter((k) => k !== "window")) {
      expect(modifiers, `timing.${key} is authored and has no control`).toContain(key);
    }
  });

  it("describes its requirement and the field it carries", () => {
    for (const req of shipped.requirements) {
      const descriptor = REQUIREMENT_DESCRIPTORS[req.kind];
      expect(descriptor, `no descriptor for requirement ${req.kind}`).toBeDefined();
      const known = new Set(descriptor.fields.map((f) => f.key));
      for (const key of Object.keys(req).filter((k) => k !== "kind")) {
        expect(known, `${req.kind}.${key} has no descriptor field`).toContain(key);
      }
    }
  });

  it("offers its anchor and its shape in the picker", () => {
    expect(TARGET_ANCHORS.map((a) => a.id)).toContain(shipped.targeting.anchor.kind);
    expect(TARGET_SHAPES.map((s) => s.id)).toContain(shipped.targeting.shape.kind);
  });

  it("describes its phase and the effect it applies", () => {
    for (const phase of shipped.phases) {
      const descriptor = PHASE_DESCRIPTORS[phase.kind];
      expect(descriptor, `no descriptor for phase ${phase.kind}`).toBeDefined();
      const known = new Set(descriptor.fields.map((f) => f.key));
      for (const key of Object.keys(phase).filter((k) => k !== "kind")) {
        expect(known, `${phase.kind}.${key} has no descriptor field`).toContain(key);
      }
    }
  });

  it("makes every top-level field editable", () => {
    // `schema` and `id` are pipeline bookkeeping; the rest are sections of
    // their own, checked above.
    const elsewhere = new Set([
      "schema", "id", "phases", "passiveRules", "targeting", "requirements", "timing",
    ]);
    for (const key of Object.keys(shipped).filter((k) => !elsewhere.has(k))) {
      expect(EDITABLE_FIELDS, `${key} is authored in the shipped YAML and has no control`)
        .toContain(key);
    }
  });
});

describe("the two halves that were impossible", () => {
  it("can say that Achilles walks through people only while dismounted", () => {
    const granted = shipped.passiveRules.find((r) => r.key === "GrantedAbility");
    const descriptor = ELEMENT_DESCRIPTORS.GrantedAbility;
    expect(descriptor.fields.map((f) => f.key)).toContain("abilities");
    // Every element carries the gate, because `collectContributions` tests it
    // before any executor runs.
    expect(descriptor.fields.map((f) => f.key)).toContain("predicate");
    expect(granted.predicate).toBeDefined();
  });

  it("can say the barrier answers an AoE Noble Phantasm of Rank A within 2 panels", () => {
    // `timing: { window: whenAllyAttacked, againstKind: np, againstRank: A,
    //            requiresAoE: true, radius: 2 }` -- one window plus all four
    // modifiers, and EMIYA's Rho Aias opens in the same window with only one
    // of them. The difference between the two sheets is entirely in fields
    // that had no control at all.
    expect(shipped.timing.window).toBe("whenAllyAttacked");
    const rank = AGAINST_FIELDS.find((f) => f.key === "againstRank");
    expect(rank.type, "a rank comparison in free text silently never matches").toBe("rank");
  });
});
