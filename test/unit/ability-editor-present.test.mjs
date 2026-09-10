/**
 * @file The ability editor's view-model, tested without a world.
 * @see module/apps/ability-editor/present.mjs, D29.12
 */

import { describe, it, expect } from "vitest";
import {
  formRows, sectionState, railRows, elementRows,
  requirementRows, timingRow, selectionRow, phaseRows,
} from "../../module/apps/ability-editor/present.mjs";

const descriptor = {
  id: "Knockback",
  label: "FGT.Authoring.Element.Knockback",
  hint: "FGT.Authoring.Element.KnockbackHint",
  fields: [
    { key: "direction", type: "select", choices: ["travel", "outward"] },
    { key: "predicate", type: "predicateList" },
  ],
};

describe("formRows", () => {
  it("makes one row per descriptor field, carrying the current value", () => {
    const rows = formRows(descriptor, { direction: "travel" });
    expect(rows.map((r) => r.key)).toEqual(["direction", "predicate"]);
    expect(rows[0].value).toBe("travel");
    // An OBJECT, not the descriptor's array: Foundry's `selectOptions` treats
    // an array as index-keyed and emits value="0"/value="1", so a control set
    // to "travel" silently keeps "". Found live, on Achilles's Knockback.
    expect(rows[0].choices).toEqual({ travel: "travel", outward: "outward" });
  });

  it("carries an empty value rather than dropping the row", () => {
    // A field with no value is the field a GM still has to fill. Dropping it
    // hides the thing they came to do.
    const rows = formRows(descriptor, {});
    expect(rows).toHaveLength(2);
    expect(rows[1].value).toBe(undefined);
  });

  it("prefixes the form name so the editor can route input", () => {
    expect(formRows(descriptor, {}, "passiveRules.0")[0].name).toBe("passiveRules.0.direction");
  });

  it("reports a field whose value its type cannot parse", () => {
    const tick = { id: "x", label: "l", hint: "h", fields: [{ key: "d", type: "tickExpr" }] };
    expect(formRows(tick, { d: "five rounds" })[0].problem.length).toBeGreaterThan(0);
  });

  it("reports no problem for a value its type accepts", () => {
    const tick = { id: "x", label: "l", hint: "h", fields: [{ key: "d", type: "tickExpr" }] };
    expect(formRows(tick, { d: "3◈" })[0].problem).toBe(null);
  });

  it("survives a descriptor with no fields", () => {
    expect(formRows({ id: "x", label: "l", hint: "h" }, {})).toEqual([]);
  });
});

describe("sectionState", () => {
  const section = {
    id: "whatItIs",
    fields: [{ key: "name", type: "text" }, { key: "kind", type: "select", choices: ["skill"] }],
  };

  it("is empty when nothing is filled", () => {
    expect(sectionState(section, {})).toBe("empty");
  });

  it("is partial when some are", () => {
    expect(sectionState(section, { name: "Argos" })).toBe("partial");
  });

  it("is done when all are", () => {
    expect(sectionState(section, { name: "Argos", kind: "skill" })).toBe("done");
  });

  it("reads a dotted key", () => {
    const dotted = { id: "limits", fields: [{ key: "cooldown.max", type: "tickExpr" }] };
    expect(sectionState(dotted, { cooldown: { max: "3◈" } })).toBe("done");
    expect(sectionState(dotted, { cooldown: {} })).toBe("empty");
  });

  it("treats an unticked checkbox as unfilled, not as filled-with-false", () => {
    const flags = { id: "npScoping", fields: [{ key: "isNP", type: "checkbox" }] };
    expect(sectionState(flags, { isNP: false })).toBe("empty");
    expect(sectionState(flags, { isNP: true })).toBe("done");
  });
});

describe("railRows", () => {
  it("gives one row per section for the item type", () => {
    const ids = railRows({}, "ability").map((r) => r.id);
    expect(ids).toContain("ruleElements");
    expect(ids).toContain("whenItFires");
  });

  it("drops NP scoping for a class skill", () => {
    expect(railRows({}, "classSkill").map((r) => r.id)).not.toContain("npScoping");
  });

  it("counts what a list section holds, across all three buckets", () => {
    // The rail says "Rule elements 3" so a GM can see there is something in a
    // section without opening it.
    const draft = { passiveRules: [{ key: "Aura" }, { key: "OnEvent" }], rules: [{ key: "Ward" }] };
    expect(railRows(draft, "ability").find((r) => r.id === "ruleElements").count).toBe(3);
  });

  it("marks exactly one row current", () => {
    const rows = railRows({}, "ability", { current: "ruleElements" });
    expect(rows.filter((r) => r.current)).toHaveLength(1);
    expect(rows.find((r) => r.current).id).toBe("ruleElements");
  });

  it("marks none when no section is named", () => {
    expect(railRows({}, "ability").filter((r) => r.current)).toHaveLength(0);
  });
});

describe("elementRows", () => {
  it("renders each authored element with its descriptor's fields", () => {
    const rows = elementRows({ passiveRules: [{ key: "Knockback", direction: "travel" }] }, "passiveRules");
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("Knockback");
    expect(rows[0].fields.map((f) => f.key)).toEqual(["direction", "sidestep", "predicate", "defer"]);
    expect(rows[0].fields[0].value).toBe("travel");
  });

  it("offers only the keys that bucket accepts", () => {
    for (const choice of elementRows({}, "passiveRules").choices) {
      expect(choice.buckets).toContain("passiveRules");
    }
  });

  it("keeps an unknown key rather than dropping it", () => {
    // §21.4: a module may add a rule element. Losing it on the next save would
    // be the editor silently deleting somebody else's content.
    const rows = elementRows({ rules: [{ key: "SomeModuleElement", x: 1 }] }, "rules");
    expect(rows).toHaveLength(1);
    expect(rows[0].unknown).toBe(true);
    expect(rows[0].raw).toContain("SomeModuleElement");
  });

  it("returns nothing for an empty bucket", () => {
    expect([...elementRows({}, "activeRules")]).toEqual([]);
  });
});

describe("requirementRows", () => {
  it("renders a stance requirement with its descriptor's choices", () => {
    const rows = requirementRows({ requirements: [{ kind: "stance", stance: "dismounted" }] }, "ability");
    expect(rows[0].fields[0].choices).toEqual({ mounted: "mounted", dismounted: "dismounted" });
    expect(rows[0].fields[0].value).toBe("dismounted");
  });

  it("offers the command spell vocabulary to a command spell", () => {
    expect(requirementRows({}, "commandSpell").choices.map((c) => c.id)).toContain("servantInZon");
  });

  it("keeps the ability vocabulary out of a command spell's list", () => {
    expect(requirementRows({}, "commandSpell").choices.map((c) => c.id)).not.toContain("stance");
  });
});

describe("timingRow", () => {
  it("carries the window and the four against-modifiers", () => {
    const row = timingRow({ timing: {
      window: "whenAllyAttacked", againstKind: "np", againstRank: "A",
      requiresAoE: true, radius: 2,
    } });
    expect(row.windows).toContain("whenAllyAttacked");
    expect(row.fields.find((f) => f.key === "againstRank").value).toBe("A");
    expect(row.fields.find((f) => f.key === "radius").value).toBe(2);
  });

  it("reads a list of windows, because an ability may name two", () => {
    expect(timingRow({ timing: { window: ["ownTurn", "combatPhaseStart"] } }).windows)
      .toEqual(["ownTurn", "combatPhaseStart"]);
  });

  it("is empty rather than absent when there is no timing", () => {
    expect(timingRow({}).windows).toEqual([]);
    expect(timingRow({}).choices.length).toBeGreaterThan(0);
  });
});

describe("selectionRow", () => {
  it("carries relations, includeSelf and chooser", () => {
    const row = selectionRow({ targeting: { selection: {
      relations: ["ally", "self"], includeSelf: true, chooser: "all",
    } } });
    // A list shows as text and saves as an array -- `displayFieldValue` and
    // `coerceFieldValue` are inverses, so it round-trips without gaining
    // brackets or quotes.
    expect(row.fields.find((f) => f.key === "relations").value).toBe("ally, self");
    expect(row.fields.find((f) => f.key === "chooser").value).toBe("all");
  });

  it("renders its rows even with no targeting at all", () => {
    expect(selectionRow({}).fields).toHaveLength(3);
  });
});

describe("phaseRows", () => {
  it("renders createField with typed fields instead of raw JSON", () => {
    // 8 authored abilities use it and the old PHASE_FIELDS left every one to
    // a JSON textarea.
    const rows = phaseRows({ phases: [{ kind: "createField", target: "self" }] });
    expect(rows[0].fields.map((f) => f.key)).toContain("target");
    expect(rows[0].unknown).toBe(false);
  });

  it("offers the kinds content reaches for first", () => {
    expect(phaseRows({}).choices[0].id).toBe("applyEffects");
  });

  it("keeps an unknown kind in a raw pane rather than dropping it", () => {
    const rows = phaseRows({ phases: [{ kind: "moduleKind", x: 1 }] });
    expect(rows[0].unknown).toBe(true);
    expect(rows[0].raw).toContain("moduleKind");
  });
});

describe("list fields round-trip", () => {
  it("shows an authored array as text and takes text back as an array", async () => {
    const { coerceFieldValue, displayFieldValue } =
      await import("../../module/rules/authoring/fields.mjs");

    // `abilities: [ignoresOccupancy]` and `predicate: ["self:stance:dismounted"]`
    // are arrays in every authored document. Saving the raw string authors an
    // element that reads a character at a time -- it validates and does nothing.
    expect(displayFieldValue("tokenList", ["a", "b"])).toBe("a, b");
    expect(coerceFieldValue("tokenList", "a, b")).toEqual(["a", "b"]);
    expect(coerceFieldValue("predicateList", "self:stance:dismounted"))
      .toEqual(["self:stance:dismounted"]);
  });

  it("reads an empty list as empty rather than as one blank entry", () => {
    return import("../../module/rules/authoring/fields.mjs").then(({ coerceFieldValue }) => {
      expect(coerceFieldValue("tokenList", "")).toEqual([]);
      expect(coerceFieldValue("tokenList", "  ,  ")).toEqual([]);
    });
  });

  it("leaves every other type alone", () => {
    return import("../../module/rules/authoring/fields.mjs").then(({ coerceFieldValue }) => {
      expect(coerceFieldValue("text", "a, b")).toBe("a, b");
      expect(coerceFieldValue("number", "3")).toBe("3");
    });
  });
});
