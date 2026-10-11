/**
 * @file Medea's audit, #193: what the live press found.
 * @see docs/46-roster-re-audit.md §46.11, char_orig_sheets/Copia de Medea.md
 *
 * Built through `test/helpers/subject.mjs`, so every ability here is the
 * authored content after the compile, the DataModel and `usageSpecFor`.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { canUseAbility } from "../../module/rules/costs.mjs";
import { usageSpecFor } from "../../module/rules/ability-use.mjs";

beforeAll(prepareSubjects, 60_000);

const abilityOf = (world, key) =>
  world.actor("medea").items.find((i) => i.system?.contentId === key);

const gate = (item, unit) => canUseAbility({
  ability: usageSpecFor(item), unit, round: 5, turnsPerRound: 3, actingFactionId: "red",
});

describe("Silence stops every one of her Spells", () => {
  const SPELLS = ["medea-aero", "medea-argos", "medea-keraino", "medea-atlas",
    "medea-dragon-tooth-warriors", "medea-rain-of-light"];

  it("refuses all six her own Turn offers while she is Silenced", async () => {
    await withSubjects(
      [{ from: "medea", state: { factionId: "red" }, effects: [{ defId: "silence" }] }],
      ({ world, unit }) => {
        for (const id of SPELLS) {
          expect(gate(abilityOf(world, id), unit("medea")), id).toMatchObject({ ok: false });
        }
      },
    );
  });

  it("allows them without Silence, and leaves her non-Spells alone under it", async () => {
    await withSubjects(
      [{ from: "medea", state: { factionId: "red" } }],
      ({ world, unit }) => {
        for (const id of SPELLS) expect(gate(abilityOf(world, id), unit("medea")).ok, id).toBe(true);
      },
    );
    await withSubjects(
      [{ from: "medea", state: { factionId: "red" }, effects: [{ defId: "silence" }] }],
      ({ world, unit }) => {
        expect(gate(abilityOf(world, "medea-golden-fleece"), unit("medea")).ok).toBe(true);
      },
    );
  });
});

describe("Item Construction's +50 reaches her Spells' debuffs", () => {
  // Atlas on Medusa rolled against 30% live: 100, −25, −25, −20 for Magic
  // Resistance, and no +50. Both live callers handed `inflictBonusOf` a bare
  // `unitSnapshot`, which carries no auras; the Skill-path test above built its
  // caster from the board and so agreed with the code, not with the board.

  const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

  it("the Skill path asks with the board's caster", () => {
    const src = read("module/engine/skill-use.mjs");
    const call = src.slice(src.indexOf("ctx: skillEffectContext({"), src.indexOf("ctx: skillEffectContext({") + 600);
    expect(call).toMatch(/attacker: phaseCtx\.self \?\? unitFrom\(currentBoard\(\), actor\)/);
  });

  it("the event path asks with the board's inflicter", () => {
    const src = read("module/engine/applier.mjs");
    expect(src).not.toMatch(/inflictBonusOf\(unitSnapshot\(/);
    expect(src).toMatch(/inflictBonusOf\(unitFrom\(board, inflicterDoc\)/);
  });
});

describe("Atlas's \"Rank of B or higher\" is met by B− (reading 11)", () => {
  it("a MAG B− target clears B, and a MAG C+ target does not", async () => {
    const { rollOptionsFor } = await import("../../module/rules/options.mjs");
    const opts = (mag) => rollOptionsFor({ attacker: { id: "a" }, defender: { id: "d", parameters: { mag } } });
    expect(opts("B-").has("target:rank:mag:gte:B")).toBe(true);
    expect(opts("B+").has("target:rank:mag:gte:B")).toBe(true);
    expect(opts("C+").has("target:rank:mag:gte:B")).toBe(false);
  });
});

describe("Trofa failed against a Noble Phantasm: she may still Block (reading 9)", () => {
  it("the escape rung takes a Block, which reaches the damage step as her reaction", async () => {
    const process = await import("../../module/engine/combat-process.mjs");
    let s = { ...process.begin({ attackerId: "a", defenderId: "medea", attack: {} }), state: "s23_acceptOrEscape" };
    s = process.advance(s, "block");
    expect(s.state).toBe("damage");
    expect(s.reaction).toBe("block");
  });
});

describe("Argos is not her reaction (reading 8)", () => {
  it("is authored free, and Trofa is not", async () => {
    await withSubjects([{ from: "medea", state: { factionId: "red" } }], ({ world }) => {
      expect(abilityOf(world, "medea-argos").system.reactionFree).toBe(true);
      expect(abilityOf(world, "medea-trofa").system.reactionFree).toBe(false);
    });
  });
});

describe("NP Regen for 1◈ takes 1◈ off (reading 7)", () => {
  it("ticks while it lasts, and not at the Turn End it expires on", async () => {
    const { cooldownRate } = await import("../../module/engine/scheduler.mjs");
    const unit = (expiry) => ({ effects: ["npCooldownRegen"], effectInstances: [{ defId: "npCooldownRegen", expiry }] });
    const np = { isNP: true };
    // Applied on tick 2, expiry 5: Turn Ends 2, 3 and 4 tick; 5 does not.
    for (const tick of [2, 3, 4]) expect(cooldownRate(unit(5), np, { tick })).toBe(2);
    expect(cooldownRate(unit(5), np, { tick: 5 })).toBe(1);
  });
});

describe("Rule Breaker gives the Contract to Medea (reading 18)", () => {
  it("names the caster as the new Master, and a Servant can hold the spells", () => {
    const attack = readFileSync(new URL("../../module/engine/attack.mjs", import.meta.url), "utf8");
    const fn = attack.slice(attack.indexOf("async function cutContract("), attack.indexOf("async function cutContract(") + 2500);
    expect(fn).toMatch(/const newMaster = caster \?\? null;/);
    const servant = readFileSync(new URL("../../module/data/actor/servant.mjs", import.meta.url), "utf8");
    expect(servant).toMatch(/commandSpellsPerServant: new fields\.ObjectField/);
  });
});

describe("A Servant stolen by Rule Breaker has its class ZON around Medea (reading 19)", () => {
  it("ignores the Master-Servant's own zone and rank", async () => {
    const { zonRadius, annotateZon } = await import("../../module/rules/zon.mjs");
    const medea = { id: "medea", kind: "servant", servantClasses: ["caster"], zon: 5, rank: "A" };
    const medusa = { id: "medusa", kind: "servant", servantClasses: ["rider"] };
    expect(zonRadius(medusa, medea)).toBe(2);
    // A Master's stated ZON survives the annotation pass, whatever the order.
    const master = { id: "m", kind: "master", zon: 4, panel: { i: 0, j: 0 } };
    const saber = { id: "s", kind: "servant", servantClasses: ["saber"], masterId: "m", panel: { i: 0, j: 3 } };
    annotateZon([master, saber], { units: [master, saber] });
    expect(master.zon).toBe(4);
    expect(saber.zon).toBe(4);
  });
});

describe("Medea pays the multi-Servant tax (reading 21)", () => {
  it("is billed as any Master is, holding two Servants", () => {
    const src = readFileSync(new URL("../../module/engine/scheduler.mjs", import.meta.url), "utf8");
    const fn = src.slice(src.indexOf("function multiServantIntents("), src.indexOf("function multiServantIntents(") + 1600);
    expect(fn).toMatch(/units\.some\(\(s\) => s\.masterId === u\.id\)/);
  });
});
