/**
 * @file The faction roster and the alliance graph.
 * @see module/rules/factions.mjs
 */

import { describe, it, expect } from "vitest";
import {
  normalizeFactions, alliancesOf, factionChoices, createFaction, factionForUser,
  FACTION_COLORS,
} from "../../module/rules/factions.mjs";

describe("normalizeFactions", () => {
  it("returns an empty roster for anything that is not an array", () => {
    for (const bad of [null, undefined, "red", 3, {}]) {
      expect(normalizeFactions(bad)).toEqual([]);
    }
  });

  it("fills the defaults an entry omits", () => {
    const [f] = normalizeFactions([{ id: "red" }]);
    expect(f.name).toBe("red");
    expect(f.color).toBe(FACTION_COLORS[0]);
    expect(f.userId).toBeNull();
    expect(f.allies).toEqual([]);
  });

  it("drops entries with no id — a half-typed row is not a faction", () => {
    expect(normalizeFactions([{ name: "Red" }, { id: "", name: "x" }, { id: "blue" }]))
      .toHaveLength(1);
  });

  it("drops duplicate ids, keeping the first", () => {
    const out = normalizeFactions([{ id: "red", name: "First" }, { id: "red", name: "Second" }]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("First");
  });

  it("never lets a faction ally itself", () => {
    expect(normalizeFactions([{ id: "red", allies: ["red"] }])[0].allies).toEqual([]);
  });

  it("drops allies naming a faction that no longer exists", () => {
    const out = normalizeFactions([{ id: "red", allies: ["green"] }, { id: "blue" }]);
    expect(out[0].allies).toEqual([]);
  });

  // A roster where red allies blue but blue does not ally red is a half-finished
  // edit. The safe reading is the one where nobody is surprised by an ally.
  it("makes the alliance graph symmetric", () => {
    const out = normalizeFactions([{ id: "red", allies: ["blue"] }, { id: "blue" }]);
    expect(out.find((f) => f.id === "blue").allies).toEqual(["red"]);
  });

  it("keeps an already-symmetric graph unchanged", () => {
    const out = normalizeFactions([
      { id: "red", allies: ["blue"] },
      { id: "blue", allies: ["red"] },
    ]);
    expect(out[0].allies).toEqual(["blue"]);
    expect(out[1].allies).toEqual(["red"]);
  });

  it("deduplicates a repeated ally", () => {
    expect(normalizeFactions([{ id: "red", allies: ["blue", "blue"] }, { id: "blue" }])[0].allies)
      .toEqual(["blue"]);
  });

  it("is idempotent", () => {
    const once = normalizeFactions([{ id: "red", allies: ["blue"] }, { id: "blue" }]);
    expect(normalizeFactions(once)).toEqual(once);
  });
});

describe("alliancesOf", () => {
  // Without the self entry a unit is an enemy of its own side, because
  // `relationOf` asks whether the target's faction is in the caster's ally list.
  it("always includes the faction itself", () => {
    expect(alliancesOf(normalizeFactions([{ id: "red" }]))).toEqual({ red: ["red"] });
  });

  it("includes declared allies both ways", () => {
    const map = alliancesOf(normalizeFactions([{ id: "red", allies: ["blue"] }, { id: "blue" }]));
    expect(map.red).toEqual(["red", "blue"]);
    expect(map.blue).toEqual(["blue", "red"]);
  });

  it("leaves unrelated factions as islands", () => {
    const map = alliancesOf(normalizeFactions([{ id: "red" }, { id: "blue" }]));
    expect(map.red).not.toContain("blue");
  });

  it("returns an empty map for an empty roster", () => {
    expect(alliancesOf([])).toEqual({});
  });
});

describe("createFaction", () => {
  it("derives a slug id from the name", () => {
    expect(createFaction("Red Team").id).toBe("red-team");
    expect(createFaction("Red Team").name).toBe("Red Team");
  });

  it("makes the id unique against the existing roster", () => {
    const existing = [createFaction("Red")];
    expect(createFaction("Red", existing).id).toBe("red-2");
  });

  it("keeps counting past the second collision", () => {
    const existing = [createFaction("Red"), { id: "red-2" }];
    expect(createFaction("Red", existing).id).toBe("red-3");
  });

  it("falls back to a usable id for a name with no usable characters", () => {
    expect(createFaction("!!!").id).toBe("faction");
    expect(createFaction("").id).toBe("faction");
  });

  it("cycles the colour palette so two new factions differ", () => {
    const a = createFaction("A");
    const b = createFaction("B", [a]);
    expect(a.color).not.toBe(b.color);
  });
});

describe("factionChoices", () => {
  it("maps id to display name, which is what a select needs", () => {
    const roster = normalizeFactions([{ id: "red", name: "Red Team" }, { id: "blue", name: "Blue" }]);
    expect(factionChoices(roster)).toEqual({ red: "Red Team", blue: "Blue" });
  });
});

describe("factionForUser", () => {
  const roster = normalizeFactions([
    { id: "red", userId: "u1" },
    { id: "blue", userId: "u2" },
    { id: "green" },
  ]);

  it("finds the faction a user was assigned", () => {
    expect(factionForUser(roster, "u2").id).toBe("blue");
  });

  it("returns null for a user with no faction", () => {
    expect(factionForUser(roster, "u9")).toBeNull();
  });
});
