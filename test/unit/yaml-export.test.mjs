/**
 * @file Writing a document back to its pack source.
 * @see module/apps/yaml-export.mjs, docs/29-user-interface.md §29.6
 *
 * The compendium is the whole source of truth (spec R1), which is only safe
 * because authoring has somewhere to go. Without this the ability editor's
 * output is overwritten on the next load and SC-6 -- "a GM authors a
 * Karna-complexity Servant in under an hour" -- means nothing.
 */

import { describe, it, expect } from "vitest";
import { parse } from "yaml";
import { readFileSync } from "node:fs";
// The browser half is dependency-free and only produces the authored SHAPE.
import { toAuthoredSource } from "../../module/apps/yaml-export.mjs";
// The Node half turns that shape into YAML, where `yaml` is available.
import { shapeToYaml, destinationFor } from "../../tools/stage-to-yaml.mjs";

const itemLike = (system) => ({ name: "Test", system });

describe("toAuthoredSource", () => {
  it("keeps the authored fields", () => {
    const out = toAuthoredSource(itemLike({ contentId: "x", rank: "A", npGateRound: 3 }));
    expect(out).toMatchObject({ id: "x", rank: "A", npGateRound: 3 });
  });

  it("drops runtime state", () => {
    // A cooldown mid-tick is not content. Exporting it would author a Servant
    // that starts the game four Turns into its own clock.
    const out = toAuthoredSource(itemLike({
      contentId: "x", cooldown: { max: "3◈", remaining: 4, gatedDelay: 2 },
      timesUsed: 7, expended: true,
    }));
    expect(out.cooldown).toEqual({ max: "3◈" });
    expect(out.timesUsed).toBeUndefined();
    expect(out.expended).toBeUndefined();
  });

  it("drops provenance, which is the world's and never content", () => {
    // An ability copied by Wisdom of Dún Scáith records where it came from.
    // Authoring that would ship a template claiming to be somebody's copy.
    const out = toAuthoredSource(itemLike({
      contentId: "x", copiedFrom: "emiya", grantedBy: "wisdomOfDunScaith",
    }));
    expect(out.copiedFrom).toBeUndefined();
    expect(out.grantedBy).toBeUndefined();
  });

  it("drops empty and null fields rather than writing noise", () => {
    const out = toAuthoredSource(itemLike({ contentId: "x", npTags: [], category: null }));
    expect(out.npTags).toBeUndefined();
    expect(out.category).toBeUndefined();
  });

  it("writes the schema line the loader requires", () => {
    expect(toAuthoredSource(itemLike({ contentId: "x" })).schema).toBe(1);
  });
});

describe("shapeToYaml", () => {
  it("produces something the YAML parser reads back", () => {
    const yaml = shapeToYaml(toAuthoredSource(itemLike({ contentId: "x", rank: "A", npTags: ["antiUnit"] })));
    expect(parse(yaml)).toMatchObject({ schema: 1, id: "x", rank: "A", npTags: ["antiUnit"] });
  });

  it("survives the ◈ operator and other non-ASCII the sheets are full of", () => {
    const yaml = shapeToYaml(toAuthoredSource(itemLike({ contentId: "x", cooldown: { max: "3◈" } })));
    expect(parse(yaml).cooldown.max).toBe("3◈");
  });
});

describe("destinationFor", () => {
  it("sends a Servant to servants/ and an ability to abilities/", () => {
    // Read off the shape, not guessed from the id: an ability and a Noble
    // Phantasm both live in `abilities/`, and a Servant does not.
    expect(destinationFor({ id: "karna", servantClasses: ["lancer"] })).toBe("servants");
    expect(destinationFor({ id: "karna-brahmastra", kind: "np" })).toBe("abilities");
    expect(destinationFor({ id: "sphinx", kind: "summon" })).toBe("summons");
  });
});

describe("round trip", () => {
  it("an authored file survives load -> export -> load", () => {
    // The exporter is the inverse of the loader, and this is what that means.
    const source = parse(readFileSync("packs/_source/abilities/ozymandias-imperial-privilege.yml", "utf8"));
    const asItem = itemLike({
      contentId: source.id, rank: source.rank, kind: source.kind, slug: source.slug,
      cooldown: source.cooldown, description: source.description, phases: source.phases,
      timing: source.timing,
    });
    const round = parse(shapeToYaml(toAuthoredSource(asItem)));
    expect(round.id).toBe(source.id);
    expect(round.phases).toEqual(source.phases);
    expect(round.cooldown).toEqual(source.cooldown);
  });
});
