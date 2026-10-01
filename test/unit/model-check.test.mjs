/**
 * @file The build holds every compiled document to the real DataModel.
 * @see tools/lib/model-check.mjs, docs/40-content-pipeline.md, docs/adr/0006-tests-and-build-run-real-foundry.md
 *
 * `compilePack` writes whatever JSON it is given, and the DataModel prunes an
 * undeclared key only later, when the document loads in a world — which is how
 * `field` on a Skill, `inherit` on a Platform and `timing.window` were lost with
 * nothing anywhere failing. The model check constructs each compiled document
 * through Foundry's own classes at build time and reports any Authored Key that
 * did not survive, naming the file and the dotted path.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { compileDocument } from "../../tools/lib/content.mjs";
import { checkCompiled } from "../../tools/lib/model-check.mjs";

const servant = (over = {}) => ({
  schema: 1,
  id: "probe-servant",
  name: "Probe",
  servantClasses: ["saber"],
  parameters: { str: "B", end: "B", agi: "B", mag: "B", luc: "B" },
  mov: 5,
  abilities: [],
  ...over,
});

const ability = (over = {}) => ({ schema: 1, id: "probe-skill", name: "Probe Skill", rank: "B", ...over });

const check = async (doc, dir, library = new Map()) =>
  checkCompiled([{ path: `packs/_source/${dir}/${doc.id}.yml`, doc: compileDocument(doc, dir, library) }]);

describe("the model check", () => {
  let clean;
  beforeAll(async () => { clean = await check(servant(), "servants"); });

  it("passes a Unit whose every Authored Key is declared", () => {
    expect(clean).toEqual([]);
  });

  it("fails a Unit carrying an Authored Key no schema declares, naming it", async () => {
    const problems = await check(servant({ notARealKey: 1 }), "servants");
    expect(problems.map((p) => p.message).join("\n")).toMatch(/probe-servant.*system\.notARealKey/);
  });

  it("fails an Ability carrying an Authored Key no schema declares", async () => {
    const problems = await check(ability({ notARealKey: true }), "abilities");
    expect(problems.map((p) => p.message).join("\n")).toMatch(/system\.notARealKey/);
  });

  it("fails an embedded Ability the same way, naming the Unit and the item", async () => {
    const skill = ability({ notARealKey: true });
    const library = new Map([[skill.id, skill]]);
    const problems = await check(servant({ abilities: [{ ref: skill.id }] }), "servants", library);
    expect(problems.map((p) => p.message).join("\n")).toMatch(/probe-servant.*items.*Probe Skill.*system\.notARealKey/);
  });

  describe("a template slot nobody filled (#120)", () => {
    // Drake's Riding carried `cooldown: "@cooldown"` because her sheet passed no
    // `cooldown` beside the ref. `withoutTemplateSlots` stripped every whole-string
    // `@name` from every document before constructing it, the Items embedded in an
    // Actor included, so the slot that should have been filled never reached
    // Foundry's own refusal (`is not a valid duration`) and `validate:content`
    // printed "0 Silent Drop(s)". In a world her Riding had no cooldown.
    const template = ability({ id: "class-slotted", parameterized: ["rank"], rank: "@rank", cooldown: "@cooldown" });
    const library = new Map([[template.id, template]]);

    it("fails an embedded Ability whose slot the bearer left empty", async () => {
      const problems = await check(servant({ abilities: [{ ref: template.id, rank: "B" }] }), "servants", library);
      // Foundry's own words, which run over several lines, naming the field.
      expect(problems.map((p) => p.message).join("\n"))
        .toMatch(/probe-servant[\s\S]*Foundry would not construct this Item[\s\S]*is not a valid duration[\s\S]*@cooldown/);
    });

    it("passes once the bearer fills it", async () => {
      const filled = servant({ abilities: [{ ref: template.id, rank: "B", cooldown: "2◈" }] });
      expect(await check(filled, "servants", library)).toEqual([]);
    });

    it("still passes the template on its own, whose slots are not yet anyone's", async () => {
      expect(await check(template, "abilities")).toEqual([]);
    });
  });

  it("fails a value the model would change rather than keep", async () => {
    const problems = await check(servant({ mov: -3 }), "servants");
    expect(problems.map((p) => p.message).join("\n")).toMatch(/system\.mov/);
  });

  it("keeps an authored null exactly as authored (46a26a8)", async () => {
    const out = compileDocument(servant({ type: "platform", id: "probe-platform", footprint: null }), "platforms", new Map());
    expect(out.system.footprint).toBeNull();
  });
});
