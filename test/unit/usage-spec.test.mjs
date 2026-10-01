/**
 * @file The ability the use gate sees is the ability the action bar sees.
 * @see module/rules/ability-use.mjs#usageSpecFor, module/rules/costs.mjs, docs/17-abilities.md, #155
 *
 * `canUseAbility` reads `isSpell`, `categorizedAs` and `creates` off the
 * ability, and `usageSpecFor` -- what BOTH use paths and the actor-sheet card
 * hand it -- carried none of them. Only the action bar passed the raw
 * `item.system`, which has all three, so the bar refused what the declaration
 * then accepted, and the declaration refused what it should not:
 *
 * - `Seal` spares Spells, `Silence` and `Skill Seal` refuse them: all sixteen
 *   Spells read the opposite at the gate;
 * - Blind clause 3, *"'Mystic Eye' Skills cannot be used"*, never reached
 *   Medusa's Mystic Eyes;
 * - Nemo's Storm Border refuses what creates a Large or Giant Unit, and the
 *   declaration accepted all five abilities that do.
 *
 * Built with `test/helpers/subject.mjs`: the real items of the real Servants,
 * through the real projection. Three earlier tests hand-built the spec in the
 * shape the reader wanted and so confirmed the reader, which is why none of
 * them could see the spec was missing the keys.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { usageSpecFor } from "../../module/rules/ability-use.mjs";
import { canUseAbility } from "../../module/rules/costs.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { test as testPredicate } from "../../module/rules/predicate.mjs";

beforeAll(prepareSubjects, 60_000);

/** The six Servants that hold the sixteen Spells. */
const CASTERS = ["emiya", "kiritsugu", "medea", "nursery-rhyme", "scathach", "semiramis"];

/** What the gate says, as the surfaces ask it. */
const verdictOf = (ability, unit) => canUseAbility({
  ability, unit, round: 6, turn: 18,
  testPredicate: (p) => testPredicate(p, { options: rollOptionsFor({ attacker: unit }) }),
});
const brief = (v) => `${v.ok ? "ok" : v.reason}${v.detail?.by ? `:${v.detail.by}` : ""}`;

/**
 * Every Spell of the six, under one effect, answered by the gate and by the bar.
 * @param {string|null} defId
 */
const spellsUnder = (defId) => withSubjects(
  CASTERS.map((from) => ({ from, effects: defId ? [{ defId }] : [] })),
  ({ units, world }) => units.flatMap((unit) => [...world.actor(unit.id).items]
    .filter((item) => item.system.isSpell)
    .map((item) => ({
      id: item.system.contentId,
      gate: brief(verdictOf(usageSpecFor(item), unit)),
      bar: brief(verdictOf(item.system, unit)),
    }))),
);

describe("the sixteen Spells meet the prevention table at the gate (#155)", () => {
  it("are all sixteen, with the Quetzalcoatlus Spells to join them", async () => {
    const all = await spellsUnder(null);
    expect(all.length).toBe(16);
  });

  it("are spared by Seal -- not prevented, whatever else a Spell's own requirements say", async () => {
    // Summoning: Bašmu answers `predicate` under every effect, because it needs
    // her Home Base; that is its requirement and not Seal's say.
    for (const row of await spellsUnder("seal")) expect(row.gate, row.id).not.toMatch(/^prevented/);
  });

  it("are refused by Silence, the non-attacking ones included", async () => {
    for (const row of await spellsUnder("silence")) expect(row.gate, row.id).toBe("prevented:silence");
  });

  it("are refused by Skill Seal", async () => {
    for (const row of await spellsUnder("skillSeal")) expect(row.gate, row.id).toBe("prevented:skillSeal");
  });

  it("read the same on the bar, which passes the raw `item.system`", async () => {
    for (const defId of ["seal", "silence", "skillSeal"]) {
      for (const row of await spellsUnder(defId)) expect(row.gate, `${row.id} under ${defId}`).toBe(row.bar);
    }
  });
});

describe("Blind clause 3 reaches Medusa's Mystic Eyes at the gate (#155)", () => {
  it("refuses the Skill categorized as a Mystic Eye, and the bar agrees", async () => {
    const [gate, bar] = await withSubjects(
      [{ from: "medusa", effects: [{ defId: "blind" }] }],
      ({ units, world }) => {
        const item = [...world.actor(units[0].id).items].find((i) => [...(i.system.categorizedAs ?? [])].includes("mysticEye"));
        return [brief(verdictOf(usageSpecFor(item), units[0])), brief(verdictOf(item.system, units[0]))];
      },
    );
    expect(gate).toBe("suppressedCategory");
    expect(bar).toBe("suppressedCategory");
  });

  it("leaves it alone when nothing is suppressed", async () => {
    const gate = await withSubjects([{ from: "medusa" }], ({ units, world }) => {
      const item = [...world.actor(units[0].id).items].find((i) => [...(i.system.categorizedAs ?? [])].includes("mysticEye"));
      return brief(verdictOf(usageSpecFor(item), units[0]));
    });
    expect(gate).not.toBe("suppressedCategory");
  });
});

describe("a Storm Border's ban on creating Large Units reaches the gate (#155)", () => {
  // The suppression is what a Storm Border puts on whoever stands inside it
  // (`ForbidCreating`, `rules/elements.mjs`); it is added here because the
  // thing under test is the SPEC the gate is handed, not where the Border
  // writes it.
  const border = { scope: "creating", attributes: ["large"], source: "Storm Border" };
  const refused = (from, contentId) => withSubjects([{ from }], ({ units, world }) => {
    const item = [...world.actor(units[0].id).items].find((i) => i.system.contentId === contentId);
    const unit = { ...units[0], suppressions: [...(units[0].suppressions ?? []), border] };
    return [brief(verdictOf(usageSpecFor(item), unit)), brief(verdictOf(item.system, unit))];
  });

  it("refuses Semiramis's Summoning: Basmu, which creates a Large Unit", async () => {
    const [gate, bar] = await refused("semiramis", "semiramis-summoning-basmu");
    expect(gate).toBe("forbidCreating");
    expect(bar).toBe("forbidCreating");
  });

  it("refuses Winged Serpent, which creates a Giant one", async () => {
    const [gate] = await withSubjects([{ from: "quetzalcoatl" }], ({ units, world }) => {
      const item = [...world.actor(units[0].id).items].find((i) => i.system.contentId === "quetz-winged-serpent");
      const unit = { ...units[0], suppressions: [{ ...border, attributes: ["giant"] }] };
      return [brief(verdictOf(usageSpecFor(item), unit))];
    });
    expect(gate).toBe("forbidCreating");
  });
});

describe("usageSpecFor carries every key the gate reads", () => {
  const read = (path, pattern) => {
    const text = readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    return [...text.matchAll(pattern)].map((m) => m[1]);
  };

  /** Every key `canUseAbility` and the helpers it hands the ability to read. */
  const keysRead = () => new Set([
    ...read("module/rules/costs.mjs", /\bability\??\.([A-Za-z]+)/g),
    ...read("module/rules/items.mjs", /\bctx\.ability\??\.([A-Za-z]+)/g),
    ...read("module/rules/np-gate.mjs", /\bability\??\.([A-Za-z]+)/g),
    // `canUseWhileConcealed` takes the spec or the item's `system`.
    ...read("module/rules/concealment.mjs", /\bsys\.([A-Za-z]+)/g),
  ].filter((key) => key !== "system"));

  const written = () => Object.keys(usageSpecFor({ id: "x", system: {} }));
  const missing = (keys, have) => [...keys].filter((key) => !have.includes(key)).sort();

  it("so a fourth key cannot go the way of `isSpell`, `categorizedAs` and `creates`", () => {
    expect(missing(keysRead(), written())).toEqual([]);
  });

  it("and the guard bites when a key is taken out", () => {
    expect(missing(keysRead(), written().filter((key) => key !== "isSpell"))).toContain("isSpell");
    expect(missing(keysRead(), written().filter((key) => key !== "creates"))).toContain("creates");
  });

  it("finds the keys it is meant to guard", () => {
    const keys = keysRead();
    for (const key of ["isSpell", "categorizedAs", "creates", "cooldown", "requirements"]) {
      expect(keys.has(key), key).toBe(true);
    }
  });

  it("is the spec the action bar hands the gate, as the other two paths do", () => {
    const bar = readFileSync("module/apps/hud/action-bar.mjs", "utf8");
    expect(bar).toMatch(/canUseAbility\(\{\s*ability: usageSpecFor\(item\)/);
    expect(bar).not.toMatch(/ability: item\.system,\s*unit, master, board, \.\.\.gateContext\(\)/);
  });
});
