/**
 * @file Building a predicate from dropdowns instead of typing it.
 * @see module/apps/ability-editor/predicate-builder.mjs
 *
 * `builderRows` and `toPredicate` are INVERSES, and the round-trip test is the
 * one that matters: anything the builder renders it must give back unchanged,
 * or opening an ability and saving it would quietly rewrite its rules.
 */

import { describe, it, expect } from "vitest";
import {
  builderRows, toPredicate, refChoicesFor, patchRows,
} from "../../module/apps/ability-editor/predicate-builder.mjs";

describe("builderRows", () => {
  it("turns an option into subject, facet and value", () => {
    const [row] = builderRows(["self:stance:dismounted"], "ownerOnly");
    expect(row).toMatchObject({ kind: "term", subject: "self", facet: "stance", negated: false });
    expect(row.segments[0].value).toBe("dismounted");
  });

  it("marks a negated term without losing the option", () => {
    const [row] = builderRows(["not:self:free"], "ownerOnly");
    expect(row.negated).toBe(true);
    expect(row.facet).toBe("free");
  });

  it("offers the closed values a segment admits, as an OBJECT", () => {
    // An array is treated as index-keyed by Foundry's `selectOptions` and
    // emits value="0"/value="1" -- the subject picker offered `0` and `1`
    // instead of `self` and `target`. Found live, twice, because no unit test
    // renders a Handlebars helper.
    const [row] = builderRows(["self:phase:day"], "ownerOnly");
    expect(row.segments[0].choices).toEqual({ day: "day", night: "night", none: "none" });
  });

  it("offers subjects and facets as objects too", () => {
    const [row] = builderRows(["self:phase:day"], "ownerOnly");
    expect(row.subjectChoices).toEqual({ self: "self", target: "target" });
    expect(row.facetChoices.stance).toBe("stance");
  });

  it("says when a segment is unchecked, rather than pretending", () => {
    // 21 of 37 facets end in a free identifier. Making that visible is the
    // point -- an author should know the editor cannot help here.
    const [row] = builderRows(["self:attribute:large"], "ownerOnly");
    expect(row.segments[0].choices).toBe(null);
    expect(row.segments[0].unchecked).toBe(true);
  });

  it("renders a group for or and anyOf", () => {
    const [row] = builderRows([{ or: ["self:free", "target:free"] }], "exchange");
    expect(row.kind).toBe("group");
    expect(row.op).toBe("or");
    expect(row.rows).toHaveLength(2);
  });

  it("renders a comparison as a two-ref row", () => {
    const [row] = builderRows([{ gte: ["@self.health.value", 100] }], "ownerOnly");
    expect(row.kind).toBe("comparison");
    expect(row.op).toBe("gte");
    expect(row.left).toBe("@self.health.value");
    expect(row.right).toBe(100);
  });

  it("renders a rank comparison, which content has not used yet", () => {
    // Zero uses in 336 files -- and the corpus is 29 Servants short, which is
    // why this is built rather than deferred.
    const [row] = builderRows([{ rankGte: ["@self.parameters.str", "B"] }], "exchange");
    expect(row.kind).toBe("comparison");
    expect(row.op).toBe("rankGte");
  });

  it("keeps anything it cannot model as a raw row", () => {
    const [row] = builderRows([{ someModuleOp: ["x"] }], "ownerOnly");
    expect(row.kind).toBe("raw");
    expect(row.raw).toContain("someModuleOp");
  });

  it("keeps an option no facet admits as a raw row rather than dropping it", () => {
    const [row] = builderRows(["mod:something:odd"], "ownerOnly");
    expect(row.kind).toBe("raw");
  });

  it("renders an empty predicate as no rows", () => {
    expect(builderRows([], "ownerOnly")).toEqual([]);
    expect(builderRows(null, "ownerOnly")).toEqual([]);
  });
});

describe("refChoicesFor", () => {
  it("offers only the roots its scope can resolve", () => {
    // `expressionRefs` supplies NO target, so offering `@target.…` there would
    // emit a path that cannot resolve -- and `num()` throws on that.
    expect(refChoicesFor("ownerOnly").every((r) => r.path.startsWith("@self"))).toBe(true);
    expect(refChoicesFor("exchange").some((r) => r.path.startsWith("@target"))).toBe(true);
  });

  it("types each path, so a rank comparison is not offered a health pool", () => {
    const ranks = refChoicesFor("exchange").filter((r) => r.type === "rank");
    expect(ranks.length).toBeGreaterThan(0);
    // Parameters and the Unit's own rank. Never a pool.
    for (const r of ranks) expect(r.path).toMatch(/parameters|\.rank$/);
    expect(ranks.map((r) => r.path)).not.toContain("@self.health");
  });

  it("uses the shape its scope actually has", () => {
    // `@self.health` is {value,max} under expressionRefs and a NUMBER under a
    // unit snapshot. The two scopes must not offer the same path.
    const owner = refChoicesFor("ownerOnly").map((r) => r.path);
    const exchange = refChoicesFor("exchange").map((r) => r.path);
    expect(owner).toContain("@self.health.value");
    expect(exchange).toContain("@self.health");
    expect(exchange).not.toContain("@self.health.value");
  });
});

describe("toPredicate is the inverse of builderRows", () => {
  const CASES = [
    ["a bare term", ["self:stance:dismounted"]],
    ["a negated term", ["not:self:free"]],
    ["two terms", ["self:free", "target:attribute:large"]],
    ["an or group", [{ or: ["self:free", "target:free"] }]],
    ["an anyOf group", [{ anyOf: ["target:attribute:large", "target:attribute:divine"] }]],
    ["a nor group", [{ nor: ["target:attribute:undead"] }]],
    ["a numeric comparison", [{ gte: ["@self.health.value", 100] }]],
    ["a rank comparison", [{ rankGte: ["@self.parameters.str", "B"] }]],
    ["something it cannot model", [{ someModuleOp: ["x"] }]],
    ["a mixture", ["self:free", { or: ["target:free"] }, { gte: ["@self.health.value", 1] }]],
  ];

  for (const [name, predicate] of CASES) {
    it(`round-trips ${name}`, () => {
      expect(toPredicate(builderRows(predicate, "exchange"))).toEqual(predicate);
    });
  }

  it("round-trips every predicate the shipped corpus authors", async () => {
    // The real test. If this fails, opening an ability in the editor and
    // pressing Save would rewrite content that was correct.
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { parse } = await import("yaml");
    const { predicateSitesIn } = await import("../../module/rules/authoring/predicates.mjs");

    const seen = [];
    const walk = (node) => {
      if (Array.isArray(node)) return void node.forEach(walk);
      if (!node || typeof node !== "object") return;
      for (const [k, v] of Object.entries(node)) {
        if (k === "predicate" && Array.isArray(v)) seen.push(v);
        walk(v);
      }
    };
    for (const dir of readdirSync("packs/_source")) {
      const p = join("packs/_source", dir);
      if (!statSync(p).isDirectory()) continue;
      for (const f of readdirSync(p).filter((n) => n.endsWith(".yml"))) {
        try {
          const doc = parse(readFileSync(join(p, f), "utf8"));
          if (predicateSitesIn(doc).length > 0) walk(doc);
        } catch { /* the content validator's business */ }
      }
    }

    expect(seen.length, "no predicates found; this test proves nothing").toBeGreaterThan(20);
    for (const p of seen) {
      expect(toPredicate(builderRows(p, "exchange")), JSON.stringify(p)).toEqual(p);
    }
  });
});

describe("patchRows", () => {
  it("changes a value and gives back a predicate", () => {
    const rows = builderRows(["self:stance:dismounted"], "ownerOnly");
    expect(patchRows(rows, { "0.seg0": "mounted" })).toEqual(["self:stance:mounted"]);
  });

  it("changes the subject", () => {
    const rows = builderRows(["self:free"], "exchange");
    expect(patchRows(rows, { "0.subject": "target" })).toEqual(["target:free"]);
  });

  it("toggles negation", () => {
    const rows = builderRows(["self:free"], "ownerOnly");
    expect(patchRows(rows, { "0.negated": "on" })).toEqual(["not:self:free"]);
  });

  it("reaches into a nested group", () => {
    const rows = builderRows([{ or: ["self:free", "target:free"] }], "exchange");
    expect(patchRows(rows, { "0.rows.1.subject": "self" }))
      .toEqual([{ or: ["self:free", "self:free"] }]);
  });

  it("keeps a number a number", () => {
    // `{gte: ["@x", "100"]}` and `{gte: ["@x", 100]}` are not the same
    // document, and a form gives back strings.
    const rows = builderRows([{ gte: ["@self.health.value", 100] }], "ownerOnly");
    expect(patchRows(rows, { "0.right": "250" })).toEqual([{ gte: ["@self.health.value", 250] }]);
  });

  it("leaves an @path alone rather than coercing it", () => {
    const rows = builderRows([{ gte: ["@self.health.value", 1] }], "ownerOnly");
    expect(patchRows(rows, { "0.left": "@self.baseHealth" }))
      .toEqual([{ gte: ["@self.baseHealth", 1] }]);
  });

  it("carries a raw row through untouched when nothing patches it", () => {
    const rows = builderRows([{ someModuleOp: ["x"] }, "self:free"], "ownerOnly");
    expect(patchRows(rows, { "1.subject": "self" }))
      .toEqual([{ someModuleOp: ["x"] }, "self:free"]);
  });

  it("ignores a path that names no row", () => {
    const rows = builderRows(["self:free"], "ownerOnly");
    expect(patchRows(rows, { "7.subject": "target" })).toEqual(["self:free"]);
  });
});
