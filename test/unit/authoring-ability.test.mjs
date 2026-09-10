/**
 * @file The ability's own fields, the rail order, and what a GM may not type.
 * @see module/rules/authoring/ability.mjs
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { descriptorProblems } from "../../module/rules/authoring/contract.mjs";
import {
  SECTIONS, fieldGroupsFor, EDITABLE_FIELDS, RUNTIME_FIELDS, FIELD_DESCRIPTORS,
} from "../../module/rules/authoring/ability.mjs";
import { describe as describeOne, FAMILY_NAMES } from "../../module/rules/authoring/index.mjs";

const lang = JSON.parse(readFileSync("lang/en.json", "utf8"));

describe("SECTIONS", () => {
  it("is the rail order, first-author first", () => {
    expect(SECTIONS.map((s) => s.id)).toEqual([
      "whatItIs", "limits", "npScoping", "whenItFires",
      "requirements", "ruleElements", "whereItLands", "whatItDoes",
    ]);
  });

  it("gives every section a label and a hint that resolve", () => {
    for (const s of SECTIONS) {
      expect(lang[s.label], `${s.label} missing`).toBeTruthy();
      expect(lang[s.hint], `${s.hint} missing`).toBe(s.english);
    }
  });

  it("describes every field it renders", () => {
    for (const id of Object.keys(FIELD_DESCRIPTORS)) {
      expect(descriptorProblems(FIELD_DESCRIPTORS[id]), id).toEqual([]);
    }
  });

  it("gives every field a label and a hint that resolve", () => {
    for (const s of SECTIONS) {
      for (const x of s.fields ?? []) {
        expect(lang[x.label], `${x.label} missing`).toBeTruthy();
        expect(lang[x.hint], `${x.hint} missing`).toBe(x.english);
      }
    }
  });

  it("names no field twice across the whole form", () => {
    const keys = SECTIONS.flatMap((s) => (s.fields ?? []).map((x) => x.key));
    expect(new Set(keys).size, "a field appears in two sections").toBe(keys.length);
  });
});

describe("runtime state is never editable", () => {
  it("keeps engine-written fields out of every group", () => {
    // A GM typing `timesUsed` is a GM corrupting the match record.
    for (const runtime of RUNTIME_FIELDS) {
      expect(EDITABLE_FIELDS, runtime).not.toContain(runtime);
    }
  });

  it("names the ones the engine writes", () => {
    expect([...RUNTIME_FIELDS]).toEqual(expect.arrayContaining(
      ["timesUsed", "toggledAt", "lastUsedTick", "expended", "active"],
    ));
  });
});

describe("fieldGroupsFor", () => {
  it("gives an ability every section", () => {
    expect(fieldGroupsFor("ability").map((s) => s.id)).toEqual(SECTIONS.map((s) => s.id));
  });

  it("drops NP scoping from a class skill", () => {
    // A Class Skill is never a Noble Phantasm; offering the scoping questions
    // is offering three checkboxes that mean nothing.
    expect(fieldGroupsFor("classSkill").map((s) => s.id)).not.toContain("npScoping");
  });

  it("keeps every section a command spell needs", () => {
    const ids = fieldGroupsFor("commandSpell").map((s) => s.id);
    expect(ids).toContain("whenItFires");
    expect(ids).toContain("requirements");
  });
});

describe("the fields Akhilleus Kosmos needs are all editable", () => {
  it("covers the ones that had no control at all", () => {
    for (const field of ["slug", "npTags", "expendsPermanently", "rank", "isNP"]) {
      expect(EDITABLE_FIELDS, field).toContain(field);
    }
  });
});

describe("describe()", () => {
  it("finds a descriptor in every family", () => {
    expect(describeOne("element", "Knockback").id).toBe("Knockback");
    expect(describeOne("phase", "applyEffects").id).toBe("applyEffects");
    expect(describeOne("requirement", "stance").id).toBe("stance");
    expect(describeOne("csRequirement", "servantInZon").id).toBe("servantInZon");
    expect(describeOne("timing", "whenAllyAttacked").id).toBe("whenAllyAttacked");
  });

  it("returns null for an unknown id rather than throwing", () => {
    // §21.4: a module may add a rule element. An ability carrying one must
    // still OPEN in the editor -- it goes to the raw pane rather than taking
    // the window down.
    expect(describeOne("element", "SomeModuleElement")).toBe(null);
    expect(describeOne("nonsense", "Knockback")).toBe(null);
  });

  it("names its families", () => {
    expect([...FAMILY_NAMES].sort()).toEqual(
      ["csRequirement", "element", "field", "phase", "requirement", "timing"],
    );
  });
});
