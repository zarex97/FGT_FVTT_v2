/**
 * @file The closed set of input kinds a descriptor may ask for.
 * @see module/rules/authoring/fields.mjs, docs/29-user-interface.md §29.6
 *
 * Closed on purpose: the editor has one renderer per type, so a descriptor
 * asking for a type that does not exist would render nothing and lose the
 * field silently. The drift test in `authoring-contract.test.mjs` holds every
 * descriptor's field types against this list.
 */

import { describe, it, expect } from "vitest";
import { FIELD_TYPES, isFieldType, validateFieldValue } from "../../module/rules/authoring/fields.mjs";

describe("FIELD_TYPES", () => {
  it("is the closed set the editor has renderers for", () => {
    expect([...FIELD_TYPES].sort()).toEqual([
      "checkbox", "effectId", "number", "objectList", "predicateList",
      "range", "rank", "raw", "select", "text", "tickExpr", "tokenList",
    ]);
  });

  it("refuses a type it has no renderer for", () => {
    expect(isFieldType("text")).toBe(true);
    expect(isFieldType("colourWheel")).toBe(false);
    expect(isFieldType(null)).toBe(false);
  });
});

describe("validateFieldValue", () => {
  it("accepts a tick expression the engine can parse", () => {
    // Every duration and cooldown in the game is one of these, and a typo is
    // the difference between "5◈+⅓◈" and an ability reusable immediately.
    expect(validateFieldValue("tickExpr", "5◈+⅓◈")).toMatchObject({ ok: true });
    expect(validateFieldValue("tickExpr", "this turn")).toMatchObject({ ok: true });
  });

  it("refuses a tick expression it cannot parse, and says so", () => {
    const verdict = validateFieldValue("tickExpr", "five rounds");
    expect(verdict.ok).toBe(false);
    expect(verdict.reason.length).toBeGreaterThan(0);
  });

  it("accepts an empty value for every type, because required-ness is the descriptor's job", () => {
    // A half-filled form is the normal state of an editor. Emptiness is
    // reported by the checklist, not by the field validator.
    for (const type of FIELD_TYPES) {
      expect(validateFieldValue(type, ""), type).toMatchObject({ ok: true });
      expect(validateFieldValue(type, null), type).toMatchObject({ ok: true });
    }
  });

  it("refuses a number that is not one", () => {
    expect(validateFieldValue("number", "abc")).toMatchObject({ ok: false });
    expect(validateFieldValue("number", "12")).toMatchObject({ ok: true });
    expect(validateFieldValue("number", -3)).toMatchObject({ ok: true });
  });

  it("refuses raw JSON that does not parse", () => {
    expect(validateFieldValue("raw", "{not json}")).toMatchObject({ ok: false });
    expect(validateFieldValue("raw", '{"a":1}')).toMatchObject({ ok: true });
  });

  it("passes anything through for a type with no syntax of its own", () => {
    expect(validateFieldValue("text", "whatever")).toMatchObject({ ok: true });
    expect(validateFieldValue("tokenList", ["a", "b"])).toMatchObject({ ok: true });
  });
});
