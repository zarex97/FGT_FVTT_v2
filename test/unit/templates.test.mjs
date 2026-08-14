/**
 * @file Static template checks.
 * @see tools/lib/templates.mjs
 *
 * Template defects are invisible to ESLint and to every other test, and surface
 * as a stack trace inside Foundry at render time. Two have already shipped, so
 * both classes are pinned here — including a pass over the real templates, so a
 * new one cannot be added with either defect.
 */

import { describe, it, expect } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { checkTemplate, FOUNDRY_HELPERS } from "../../tools/lib/templates.mjs";

/** @param {string} dir */
async function allTemplates(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await allTemplates(path)));
    else if (entry.name.endsWith(".hbs")) out.push(path);
  }
  return out;
}

describe("unknown helpers", () => {
  it("catches a helper Foundry does not register", () => {
    // The real one: `array` and `upper` do not exist in v14.
    expect(checkTemplate("t.hbs", `{{array a b}}`)[0]).toMatch(/unknown helper "array"/);
    expect(checkTemplate("t.hbs", `{{upper name}}`)[0]).toMatch(/unknown helper "upper"/);
  });

  it("accepts every helper Foundry does register", () => {
    for (const helper of FOUNDRY_HELPERS) {
      expect(checkTemplate("t.hbs", `{{${helper} x}}`)).toEqual([]);
    }
  });

  it("accepts the Handlebars built-ins", () => {
    expect(checkTemplate("t.hbs", "{{#if x}}a{{/if}}{{#each y}}b{{/each}}")).toEqual([]);
    expect(checkTemplate("t.hbs", "{{lookup a b}}")).toEqual([]);
  });

  it("does not mistake a dotted path for a helper call", () => {
    expect(checkTemplate("t.hbs", "{{system.health.value}}")).toEqual([]);
  });

  it("ignores helpers named inside comments", () => {
    expect(checkTemplate("t.hbs", "{{!-- {{array a}} is not real --}}")).toEqual([]);
  });
});

describe("scope inside {{#each}}", () => {
  // The real one: `players` resolved against the faction, not the context, so
  // selectOptions received undefined and threw.
  it("catches a bare context name passed to a strict helper", () => {
    const source = `{{#each factions as |faction|}}{{selectOptions players selected=faction.userId}}{{/each}}`;
    expect(checkTemplate("t.hbs", source)[0]).toMatch(/resolves against the item/);
  });

  it("names the fix", () => {
    const source = `{{#each rows as |row|}}{{selectOptions players}}{{/each}}`;
    expect(checkTemplate("t.hbs", source)[0]).toMatch(/@root\.players.*\.\.\/players/);
  });

  it("accepts @root", () => {
    const source = `{{#each factions as |faction|}}{{selectOptions @root.players selected=faction.userId}}{{/each}}`;
    expect(checkTemplate("t.hbs", source)).toEqual([]);
  });

  it("accepts ../", () => {
    expect(checkTemplate("t.hbs", `{{#each rows}}{{selectOptions ../players}}{{/each}}`)).toEqual([]);
  });

  it("accepts a block param, which stays in scope", () => {
    const source = `{{#each factions as |faction|}}{{selectOptions faction.choices}}{{/each}}`;
    expect(checkTemplate("t.hbs", source)).toEqual([]);
  });

  it("keeps a block param in scope inside a NESTED each", () => {
    const source = `{{#each a as |x|}}{{#each x.b as |y|}}{{selectOptions x.choices}}{{/each}}{{/each}}`;
    expect(checkTemplate("t.hbs", source)).toEqual([]);
  });

  it("drops a block param again once its block closes", () => {
    const source = `{{#each a as |x|}}{{/each}}{{#each b as |y|}}{{selectOptions x}}{{/each}}`;
    expect(checkTemplate("t.hbs", source)[0]).toMatch(/resolves against the item/);
  });

  it("says nothing outside an each, where a bare name is correct", () => {
    expect(checkTemplate("t.hbs", `{{selectOptions players}}`)).toEqual([]);
  });

  it("ignores hash options and string literals", () => {
    const source = `{{#each a as |x|}}{{selectOptions x.c selected=x.v valueAttr="id"}}{{/each}}`;
    expect(checkTemplate("t.hbs", source)).toEqual([]);
  });

  it("does not flag a lenient helper, which renders nothing rather than throwing", () => {
    expect(checkTemplate("t.hbs", `{{#each a as |x|}}{{localize label}}{{/each}}`)).toEqual([]);
  });
});

describe("every shipped template", () => {
  it("passes both checks", async () => {
    const files = await allTemplates("templates");
    expect(files.length).toBeGreaterThan(0);

    const problems = [];
    for (const file of files) problems.push(...checkTemplate(file, await readFile(file, "utf8")));
    expect(problems).toEqual([]);
  });
});
