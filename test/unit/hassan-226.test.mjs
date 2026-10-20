/**
 * Hundred-Faced Hassan, audit #226: the 27 readings ruled 2026-10-16, built.
 * Each describe names its reading; Ch. 46 §46.32 holds the record.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { loadSource } from "../../tools/lib/load.mjs";
import {
  annotateLegions, deployable, deployPanels, legionPrice, bodyName,
} from "../../module/rules/linked-group.mjs";
import { meetsRequirement } from "../../module/rules/items.mjs";
import { twinsOf } from "../../module/engine/cooldown.mjs";
import { advanceCooldowns } from "../../module/engine/scheduler.mjs";
import * as process from "../../module/engine/combat-process.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";
import { adjustmentFor } from "../../module/engine/roll-adjust.mjs";
import { DEACTIVATION_REASONS } from "../../module/rules/concealment.mjs";

beforeAll(prepareSubjects, 120_000);

/** Real 16-character actor ids. */
const H1 = "hassanHundred001";
const H2 = "hassanHundred002";
const H3 = "hassanHundred003";
const KEY = H1;

/** The authored group, read from the real YAML. */
let GROUP = null;
async function group() {
  GROUP ??= (await loadSource("packs/_source")).files.find((f) => f.doc?.id === "hassan-hundred-face").doc.linkedGroup;
  return GROUP;
}

/**
 * Bodies of one legion, as a war holds them: the authored group with its
 * members, a key and a number each, and the pool on the board's settings.
 */
async function bodies(specs, pool = { size: 100, remaining: 100, nextNumber: specs.length + 1, label: "Hassan", fieldCap: 10 }) {
  const authored = await group();
  const ids = specs.map((s) => s.id);
  return {
    specs: specs.map((s, n) => ({
      from: "hassan-hundred-face",
      ...s,
      state: {
        factionId: "A",
        legionKey: KEY,
        legionNumber: n + 1,
        linkedGroup: { ...authored, memberIds: ids.filter((id) => id !== s.id) },
        ...(s.state ?? {}),
      },
    })),
    settings: { legions: { [KEY]: pool } },
  };
}

/** One of a Subject's abilities, by content id. */
const abilityOf = (world, actorId, contentId) =>
  world.actor(actorId).items.find((i) => i.system?.contentId === contentId);

/* ========================================================================== */

describe("the sheet, projected (SB, SB.attr; #226 readings 7, 8)", () => {
  it("is one Servant authored as a legion of 100, ten on the field, 0.5 each", async () => {
    await withSubjects([{ from: "hassan-hundred-face", id: H1 }], ({ unit }) => {
      const h = unit(H1);
      expect(h.linkedGroup.legion).toEqual({ size: 100, fieldCap: 10, openingMax: 10, label: "Hassan" });
      expect(h.linkedGroup.unitWeight).toBe(0.5);
      expect(h.linkedGroup.sharedCooldowns).toBe("byName");
      expect(h.linkedGroup.ownCooldowns).toEqual(["presenceConcealment", "battleRetreat"]);
    });
  });

  it("carries both Male and Female, and Base Attack by the tables (100 / 150)", async () => {
    await withSubjects([{ from: "hassan-hundred-face", id: H1 }], ({ unit }) => {
      const h = unit(H1);
      expect(h.attributes).toEqual(expect.arrayContaining(["male", "female", "servant", "man", "humanoid", "antiHero"]));
      expect(h.baseAttack).toEqual(expect.objectContaining({ str: 100, mag: 150 }));
    });
  });

  // His clause 8 is Revised Presence Concealment's (#260 reading 3): both sheets
  // carry the clause, and under the War's *As printed* only his sheet prints it.
  // Every pick is pressed in `revisions-260.test.mjs`.
  it("his Presence Concealment alone prints the Skill Seal end (PC.8.seal, reading 16)", async () => {
    await withSubjects([{ from: "hassan-hundred-face", id: H1 }, { from: "jack-the-ripper", id: "jackTheRipper001" }], ({ world: w }) => {
      expect(abilityOf(w, H1, "class-presence-concealment").system.printedRevision).toBe("revised");
      expect(abilityOf(w, "jackTheRipper001", "class-presence-concealment").system.printedRevision).toBe("classic");
      expect(DEACTIVATION_REASONS.sealed).toBe("sealed");
    });
  });
});

describe("what \"remaining\" counts (ZA.track; #226 reading 2)", () => {
  it("every living Hassan, on the field and off: the reserve is the count less the field", async () => {
    const { specs, settings } = await bodies([
      { id: H1, panel: { i: 10, j: 2 } }, { id: H2, panel: { i: 10, j: 3 } },
    ], { size: 100, remaining: 57, nextNumber: 3, label: "Hassan", fieldCap: 10 });
    await withSubjects(specs, ({ unit }) => {
      expect(unit(H1).legion).toEqual(expect.objectContaining({
        key: KEY, number: 1, size: 100, remaining: 57, onField: 2, reserve: 55,
      }));
    }, { settings });
  });

  it("a body with no pool reads none remaining", () => {
    const [u] = annotateLegions([{ id: "x", legionKey: "gone", panel: { i: 0, j: 0 } }], {});
    expect(u.legion.remaining).toBe(0);
  });
});

describe("at most ten on the field (ZA.cap)", () => {
  it("deploys only into the room left, and never past the reserve", () => {
    expect(deployable({ remaining: 100, onField: 7, fieldCap: 10 })).toBe(3);
    expect(deployable({ remaining: 9, onField: 7, fieldCap: 10 })).toBe(2);
    expect(deployable({ remaining: 100, onField: 10, fieldCap: 10 })).toBe(0);
  });
});

describe("where a body deploys (ZA.deploy, ZA.deploy.base; #226 readings 4, 23)", () => {
  const base = (faction, rows) => ({
    faction,
    panels: rows.flatMap((i) => Array.from({ length: 13 }, (_, j) => ({ i, j }))),
  });
  const board = (warType, units = []) => ({
    warType,
    bounds: { iMin: 0, jMin: 0, iMax: 12, jMax: 12 },
    zones: { a: base("A", [10, 11, 12]), b: base("B", [0, 1, 2]) },
    units,
  });

  it("a Great Holy Grail War: anywhere on his Master's half, the centre row shared", () => {
    const panels = deployPanels(board("greatHolyGrailWar"), "A");
    expect(Math.min(...panels.map((p) => p.i))).toBe(6);
    expect(Math.max(...panels.map((p) => p.i))).toBe(12);
    expect(panels.length).toBe(7 * 13);
  });

  it("any other war: within 2 panels of his Home Base's border, the base included", () => {
    const panels = deployPanels(board("holyGrailWar"), "A");
    expect(Math.min(...panels.map((p) => p.i))).toBe(8);
    expect(panels.length).toBe(5 * 13);
  });

  it("free panels only", () => {
    const panels = deployPanels(board("holyGrailWar", [{ id: "u", panel: { i: 9, j: 4 } }]), "A");
    expect(panels.some((p) => p.i === 9 && p.j === 4)).toBe(false);
  });
});

describe("numbers (ZA.number; #226 reading 27)", () => {
  it("names a body by its label and number", () => {
    expect(bodyName("Hassan", 47)).toBe("Hassan 47");
  });
});

describe("shared clocks, except PC and Battle Retreat (ZA.cd.shared, ZA.cd.own; #226 reading 9)", () => {
  it("finds the other body's Librarian, Expert and Zabaniya, and not its PC or Battle Retreat", async () => {
    const { specs, settings } = await bodies([
      { id: H1, panel: { i: 10, j: 2 } }, { id: H2, panel: { i: 10, j: 3 } },
    ]);
    await withSubjects(specs, ({ unit, board, world: w }) => {
      const twinOf = (contentId) => twinsOf(unit(H1), abilityOf(w, H1, contentId).id, board);
      for (const shared of ["hassan-librarian-of-stored-knowledge", "hassan-expert-of-many-specializations",
        "hassan-zabaniya-delusional-illusion"]) {
        expect(twinOf(shared), shared).toEqual([{ unitId: H2, abilityId: abilityOf(w, H2, shared).id }]);
      }
      expect(twinOf("class-presence-concealment")).toEqual([]);
      expect(twinOf("hassan-battle-retreat")).toEqual([]);
    }, { settings });
  });
});

describe("NP Regen: only the strongest takes effect (ZA.regen)", () => {
  it("ticks the shared NP clock by the strongest body's Regen, not the sum", async () => {
    const { specs, settings } = await bodies([
      { id: H1, panel: { i: 10, j: 2 }, effects: [{ defId: "npRegen", magnitude: 1 }] },
      { id: H2, panel: { i: 10, j: 3 }, effects: [{ defId: "npRegen", magnitude: 2 }] },
    ]);
    await withSubjects(specs, async ({ world: w }) => {
      for (const id of [H1, H2]) {
        await abilityOf(w, id, "hassan-zabaniya-delusional-illusion").update({ "system.cooldown.remaining": 10 });
      }
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const units = currentBoard({ legions: settings.legions }).units;
      const ticks = advanceCooldowns(units, { tick: 4 }).filter((i) => i.unitId === H1
        && i.abilityId === abilityOf(w, H1, "hassan-zabaniya-delusional-illusion").id);
      // 1 for the Turn and 2 for the strongest Regen: 3, where a sum is 4.
      expect(ticks.map((i) => i.ticks)).toEqual([3]);
    }, { settings, tokens: true });
  });
});

describe("the gate (ZA.gate; #226 readings 2, 20)", () => {
  it("refuses with 10 remaining and allows 11", () => {
    const req = { kind: "legionAbove", count: 10 };
    expect(meetsRequirement(req, { unit: { legion: { remaining: 10 } } })).toBe(false);
    expect(meetsRequirement(req, { unit: { legion: { remaining: 11 } } })).toBe(true);
    expect(meetsRequirement(req, { unit: {} })).toBe(false);
  });
});

describe("paying the 4d6 (ZA.cost; #226 readings 19, 20)", () => {
  it("takes the reserve first, then field bodies", () => {
    expect(legionPrice({ remaining: 50, onField: 5 }, 14)).toEqual({ fromReserve: 14, fromField: 0, remainingAfter: 36 });
    expect(legionPrice({ remaining: 12, onField: 5 }, 10)).toEqual({ fromReserve: 7, fromField: 3, remainingAfter: 2 });
  });

  it("a price past the count ends at 0", () => {
    expect(legionPrice({ remaining: 11, onField: 3 }, 24)).toEqual({ fromReserve: 8, fromField: 3, remainingAfter: 0 });
  });
});

describe("Zabaniya's 3x3 (ZA.area; #226 readings 14, 26)", () => {
  it("is flush against one side, centred on his row, and he is not in it", async () => {
    await withSubjects([{ from: "hassan-hundred-face", id: H1, panel: { i: 6, j: 6 } }], ({ unit, board, world: w }) => {
      const np = abilityOf(w, H1, "hassan-zabaniya-delusional-illusion");
      const out = resolveTargets(np.system.targeting, unit(H1), board, { direction: "e" });
      expect(out.panels.map((p) => `${p.i},${p.j}`).sort())
        .toEqual(["5,7", "5,8", "5,9", "6,7", "6,8", "6,9", "7,7", "7,8", "7,9"].sort());
    });
  });
});

describe("Battle Retreat leaves the Attack (BR.cancel; #226 readings 12, 24)", () => {
  it("is a terminal rung of its own: no damage, no Injury, no facing, no Counter", () => {
    let s = process.begin({ attackerId: "a", defenderId: "h", attack: {} });
    s = process.advance(s, "done");
    s = process.advance(s, "hit");
    expect(s.state).toBe("react");
    s = process.advance(s, "withdraw");
    expect(s.state).toBe("withdrawn");
    s = process.advance(s, "done");
    expect(s.state).toBe("done");
    expect(s.history.map((h) => h.state)).not.toContain("damage");
  });
});

describe("Expert's ±3 (EMS.p1, EMS.p1.not; #226 readings 10, 25)", () => {
  it("is a grant for rolls outside a Combat Process, up to 3", async () => {
    await withSubjects([{ from: "hassan-hundred-face", id: H1 }], ({ unit }) => {
      expect(adjustmentFor(unit(H1), "luck")).toBe(3);
      expect(adjustmentFor(unit(H1), "evade")).toBe(3);
    });
  });

  it("is nobody else's", async () => {
    await withSubjects([{ from: "jack-the-ripper", id: "jackTheRipper001" }], ({ unit }) => {
      expect(adjustmentFor(unit("jackTheRipper001"), "luck")).toBe(0);
    });
  });
});

describe("Librarian's Passive 2 reaches other bodies only (LSK.p2; #226 reading 13)", () => {
  it("offers the bodies within 2, not an ally beside him, for the player to pick up to two", async () => {
    const { specs, settings } = await bodies([
      { id: H1, panel: { i: 10, j: 2 } }, { id: H2, panel: { i: 10, j: 4 } }, { id: H3, panel: { i: 10, j: 7 } },
    ]);
    const ally = { from: "jack-the-ripper", id: "jackTheRipper001", panel: { i: 11, j: 2 }, state: { factionId: "A" } };
    await withSubjects([...specs, ally], ({ unit, board, world: w }) => {
      const phase = abilityOf(w, H1, "hassan-librarian-of-stored-knowledge").system.phases.at(-1);
      const out = resolveTargets(phase.targeting, unit(H1), board, { reach: "effect" });
      expect(out.needsChoice).toBe(true);
      expect(out.candidates.map((t) => t.unitId)).toEqual([H2]);
    }, { settings });
  });
});

describe("Conquest claims the hundred as one Servant (#226 reading 17, live)", () => {
  it("contracts every body and grants the Command Spells once, to the legion", async () => {
    const { conquestContract } = await import("../../module/rules/contract.mjs");
    const master = { id: "deadMaster000001", kind: "master", commandSpells: 3 };
    const caster = { id: "medeaCaster00001", kind: "servant", servantClasses: ["caster"], masterId: null };
    const body = (id) => ({ id, kind: "servant", masterId: master.id, legionKey: H1 });
    const out = conquestContract({ killer: caster, deadMaster: master, board: { units: [master, caster, body(H1), body(H2), body(H3)] } });
    expect(out.ok).toBe(true);
    expect(out.descriptors.filter((d) => d.kind === "setContract").map((d) => d.unitId)).toEqual([H1, H2, H3]);
    // RED before the fix: three grants of 3, nine Command Spells for one Servant.
    expect(out.descriptors.filter((d) => d.kind === "grantCommandSpells")).toEqual([
      { kind: "grantCommandSpells", masterId: caster.id, servantId: H1, count: 3 },
    ]);
  });

  it("any body spends the hundred's pool", async () => {
    const { canSpend } = await import("../../module/rules/command-spells.mjs");
    const master = { id: "m", commandSpells: 0, commandSpellsPerServant: { [H1]: 3 } };
    const verdict = canSpend({ id: "x", cost: 1, requirements: [] }, { master, servant: { id: H2, legionKey: H1 }, settings: {} });
    expect(verdict.reason).not.toBe("cost");
  });
});

describe("the half on a scene wider than the war (#226 reading 4, live)", () => {
  it("is cut between the two Home Bases, not at the scene's centre", () => {
    const base = (faction, rows) => ({ faction, panels: rows.flatMap((i) => Array.from({ length: 13 }, (_, j) => ({ i, j }))) });
    const board = {
      warType: "greatHolyGrailWar",
      bounds: { iMin: 0, jMin: 0, iMax: 20, jMax: 20 },
      zones: { a: base("A", [0, 1, 2]), b: base("B", [10, 11, 12]) },
      units: [],
    };
    const rows = [...new Set(deployPanels(board, "A").map((p) => p.i))].sort((x, y) => x - y);
    // RED before the fix: rows 0 to 14, cut on the 21x21 scene's diagonal.
    expect(rows).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("a body's public name carries its number (#226, live)", () => {
  it("reads 'Assassin 3' to the table and 'Hassan 3' to its owner", async () => {
    const { publicNameOf } = await import("../../module/rules/identity.mjs");
    const unit = { kind: "servant", name: "Hassan 3", trueName: "Hassan-i-Sabbah", classContainer: "assassin", legionNumber: 3, identityRevealed: false };
    expect(publicNameOf(unit, {}, {})).toBe("Assassin 3");
    expect(publicNameOf(unit, {}, { isOwner: true })).toBe("Hassan 3");
  });
});
