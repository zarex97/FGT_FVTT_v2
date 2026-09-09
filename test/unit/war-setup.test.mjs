/**
 * @file The war's container roster.
 * @see module/rules/war-setup.mjs
 */

import { describe, it, expect } from "vitest";
import {
  CORE_CLASSES, EXTRA, defaultContainers, candidatesFor, drawPlan, validateRoster,
} from "../../module/rules/war-setup.mjs";

const factions = [{ id: "red", name: "Red" }, { id: "blue", name: "Blue" }];

const catalogue = [
  { contentId: "medusa", name: "Medusa", servantClasses: ["rider"], packId: "fgt.servants" },
  { contentId: "medea", name: "Medea", servantClasses: ["caster"], packId: "fgt.servants" },
  { contentId: "semiramis", name: "Semiramis", servantClasses: ["caster", "assassin"], packId: "fgt.servants" },
  { contentId: "kingprotea", name: "Kingprotea", servantClasses: ["alterEgo"], packId: "fgt.servants" },
];

const container = (over = {}) => ({
  id: "c1", factionId: "red", classContainer: "rider", fill: "random",
  contentId: null, servantId: null, masterId: null, npChoice: null, ...over,
});

/** A roster covering both factions, so `emptyFaction` does not fire in unrelated cases. */
const covering = (...rows) => [...rows, container({ id: "b1", factionId: "blue" })];

describe("defaultContainers", () => {
  it("gives every faction the seven core classes, in rulebook order", () => {
    const out = defaultContainers(factions);
    expect(out).toHaveLength(14);
    expect(out.filter((c) => c.factionId === "red").map((c) => c.classContainer))
      .toEqual([...CORE_CLASSES]);
  });

  it("gives every container a distinct id", () => {
    const ids = defaultContainers(factions).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("honours a smaller per-faction count by taking the first classes", () => {
    const out = defaultContainers([factions[0]], 3);
    expect(out.map((c) => c.classContainer)).toEqual(CORE_CLASSES.slice(0, 3));
  });

  it("makes every container past the seventh an extra", () => {
    const out = defaultContainers([factions[0]], 9);
    expect(out.slice(7).map((c) => c.classContainer)).toEqual([EXTRA, EXTRA]);
  });

  it("returns nothing for no factions", () => {
    expect(defaultContainers([])).toEqual([]);
    expect(defaultContainers(undefined)).toEqual([]);
  });
});

describe("candidatesFor", () => {
  it("matches a core container on class membership", () => {
    expect(candidatesFor(container({ classContainer: "caster" }), catalogue, {}))
      .toEqual(["medea", "semiramis"]);
  });

  it("matches a multi-class Servant into either of its containers", () => {
    expect(candidatesFor(container({ classContainer: "assassin" }), catalogue, {}))
      .toEqual(["semiramis"]);
  });

  it("gives an extra container everything holding no core class", () => {
    expect(candidatesFor(container({ classContainer: EXTRA }), catalogue, {}))
      .toEqual(["kingprotea"]);
  });

  it("returns nothing for a class the catalogue cannot fill", () => {
    expect(candidatesFor(container({ classContainer: "saber" }), catalogue, {})).toEqual([]);
  });

  it("removes taken entries under the unique policy and keeps them otherwise", () => {
    const c = container({ classContainer: "caster" });
    expect(candidatesFor(c, catalogue, { policy: "unique", taken: ["medea"] })).toEqual(["semiramis"]);
    expect(candidatesFor(c, catalogue, { policy: "duplicates", taken: ["medea"] }))
      .toEqual(["medea", "semiramis"]);
  });

  it("treats a Servant with no stated class as an extra candidate", () => {
    const odd = [{ contentId: "nameless", name: "Nameless" }];
    expect(candidatesFor(container({ classContainer: EXTRA }), odd, {})).toEqual(["nameless"]);
    expect(candidatesFor(container({ classContainer: "saber" }), odd, {})).toEqual([]);
  });
});

describe("drawPlan", () => {
  it("returns one line per random container and skips fixed ones", () => {
    const lines = drawPlan(
      [container({ id: "a" }), container({ id: "b", fill: "fixed", contentId: "medusa" })],
      catalogue, { policy: "duplicates" },
    );
    expect(lines.map((l) => l.containerId)).toEqual(["a"]);
    expect(lines[0].candidates).toEqual(["medusa"]);
    expect(lines[0].reason).toBeNull();
  });

  it("names the reason a container cannot be drawn into", () => {
    const [line] = drawPlan([container({ classContainer: "saber" })], catalogue, {});
    expect(line.candidates).toEqual([]);
    expect(line.reason).toBe("noCandidates");
  });

  it("does not offer a taken Servant under the unique policy", () => {
    const lines = drawPlan(
      [container({ id: "a", classContainer: "caster" }),
        container({ id: "b", classContainer: "caster" })],
      catalogue, { policy: "unique", taken: ["medea"] },
    );
    expect(lines[0].candidates).toEqual(["semiramis"]);
    expect(lines[1].candidates).toEqual(["semiramis"]);
  });
});

describe("validateRoster", () => {
  it("passes a roster whose containers are all fillable and owned", () => {
    expect(validateRoster(covering(container({ classContainer: "rider" })), factions, catalogue, {}))
      .toEqual([]);
  });

  it("refuses a container whose class the catalogue cannot fill", () => {
    const out = validateRoster(
      covering(container({ classContainer: "saber" })), factions, catalogue, {},
    );
    expect(out).toContainEqual(expect.objectContaining({ code: "noCandidates", containerId: "c1" }));
  });

  it("refuses a container pointing at a faction that does not exist", () => {
    const out = validateRoster(
      covering(container({ factionId: "green" })), factions, catalogue, {},
    );
    expect(out).toContainEqual(expect.objectContaining({ code: "unknownFaction" }));
  });

  it("refuses a fixed container with nothing chosen", () => {
    const out = validateRoster(
      covering(container({ fill: "fixed", contentId: null })), factions, catalogue, {},
    );
    expect(out).toContainEqual(expect.objectContaining({ code: "noFixedChoice" }));
  });

  it("refuses a duplicate under the unique policy and allows it otherwise", () => {
    const rows = covering(
      container({ id: "a", fill: "fixed", contentId: "medusa" }),
      container({ id: "b", fill: "fixed", contentId: "medusa" }),
    );
    expect(validateRoster(rows, factions, catalogue, { policy: "unique" }))
      .toContainEqual(expect.objectContaining({ code: "duplicateDraw", containerId: "b" }));
    expect(validateRoster(rows, factions, catalogue, { policy: "duplicates" })).toEqual([]);
  });

  it("refuses a faction with no containers at all", () => {
    const out = validateRoster([container({ factionId: "red" })], factions, catalogue, {});
    expect(out).toContainEqual(expect.objectContaining({ code: "emptyFaction" }));
  });

  it("reports every problem at once rather than the first", () => {
    // Three distinct faults: `a` has no Saber to draw, `b` names a faction that
    // does not exist, and `blue` was given no container. `b` is a Rider, which
    // the catalogue can fill, so it draws only the one complaint it earns.
    const out = validateRoster(
      [container({ id: "a", classContainer: "saber" }),
        container({ id: "b", factionId: "green" })],
      factions, catalogue, {},
    );
    expect(out.map((r) => r.code).sort())
      .toEqual(["emptyFaction", "noCandidates", "unknownFaction"]);
  });

  it("gives every refusal a localization key to render", () => {
    const out = validateRoster(
      covering(container({ classContainer: "saber" })), factions, catalogue, {},
    );
    for (const refusal of out) expect(refusal.message).toMatch(/^FGT\.Setup\.Refusal\./);
  });
});
