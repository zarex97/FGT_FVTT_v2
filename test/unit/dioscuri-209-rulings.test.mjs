/**
 * The Dioscuri audit, #209: the readings ruled on 2026-10-14 that differ from
 * what was built (#218 to #223). Each describe names its reading; Ch. 46 §46.31
 * holds the record. The Combat Process halves are in `dioscuri-209-arena.test.mjs`.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { twinSpecs, CASTOR, POLLUX } from "../helpers/dioscuri.mjs";
import { loadSource } from "../../tools/lib/load.mjs";
import { loadAssets } from "../../tools/lib/load.mjs";
import { unitImages } from "../../tools/lib/content.mjs";
import { publicNameOf } from "../../module/rules/identity.mjs";
import {
  CORE_CLASSES, EXTRA, candidatesFor, catalogueEntryOf,
} from "../../module/rules/war-setup.mjs";

beforeAll(prepareSubjects, 120_000);

/** The real twins, projected the way a live board projects them. */
const twins = (fn, specs = [{ from: "castor" }, { from: "pollux" }], opts = {}) =>
  withSubjects(specs, fn, opts);

/* ========================================================================== */
/*  Readings 1, 8, 9 -- Pollux is a Saber, and the pair takes a Saber slot     */
/* ========================================================================== */

describe("Pollux is a Saber and Castor stays an Avenger (#209 reading 1, ruled 2026-10-14)", () => {
  it("projects Pollux's class as Saber and Castor's as Avenger", async () => {
    await twins(({ unit }) => {
      // RED before #218: Pollux read ["avenger"] (Appendix D marked it INFERRED).
      expect([...unit("pollux").servantClasses]).toEqual(["saber"]);
      expect([...unit("castor").servantClasses]).toEqual(["avenger"]);
    });
  });
});

describe("the pair fits a Saber slot only (#209 reading 8, ruled 2026-10-14)", () => {
  /**
   * The catalogue as the picker builds it: one compendium index entry per
   * Servant, carrying only the fields `servantCatalogue` asked the index for.
   * The twins' entries are cut from the real projected documents.
   */
  const fakePack = (world, ids) => ({
    collection: "fgt.servants",
    metadata: { type: "Actor", label: "Servants", collection: "fgt.servants" },
    getIndex: async ({ fields }) => ids.map((id) => {
      const source = world.actor(id)._source;
      const entry = { _id: id, name: source.name, img: source.img, type: source.type };
      for (const path of fields) {
        const value = foundry.utils.getProperty(source, path);
        if (value !== undefined) foundry.utils.setProperty(entry, path, value);
      }
      return entry;
    }),
  });

  /** The catalogue the setup wizard offers, through the real `servantCatalogue`. */
  const catalogueOf = async (world, ids) => {
    const { servantCatalogue } = await import("../../module/engine/summon.mjs");
    game.packs = [fakePack(world, ids)];
    return servantCatalogue();
  };

  const roster = (catalogue, classContainer) =>
    candidatesFor({ classContainer }, catalogue, {});

  it("lists Pollux in the Saber container and nobody else's container", async () => {
    await twins(async ({ world }) => {
      const catalogue = await catalogueOf(world, ["castor", "pollux"]);
      expect(roster(catalogue, "saber")).toEqual(["pollux"]);
      // RED before #218: Extra listed both (an Avenger holds no core class).
      expect(roster(catalogue, EXTRA)).toEqual([]);
      // Castor holds the Avenger class and is still never drawn alone.
      expect(roster(catalogue, "avenger")).toEqual([]);
      for (const container of CORE_CLASSES.filter((c) => c !== "saber")) {
        expect(roster(catalogue, container), container).toEqual([]);
      }
    });
  });

  it("marks only Castor as the companion: the one who sits in his partner's slot", async () => {
    await twins(async ({ world }) => {
      const catalogue = await catalogueOf(world, ["castor", "pollux"]);
      const byId = Object.fromEntries(catalogue.map((e) => [e.contentId, e]));
      expect(byId.castor).toMatchObject({ summonTogether: true, companion: true, classContainer: "saber" });
      expect(byId.pollux).toMatchObject({ summonTogether: true, companion: false, classContainer: "saber" });
    });
  });

  it("keeps every other Servant as it was: a lone Avenger is still an Extra candidate", () => {
    // The companion is a role of the relationship (summoned together, seated in
    // the partner's slot), not of the class: nothing else changes slot.
    const lone = catalogueEntryOf({
      name: "Lone", system: { contentId: "lone", servantClasses: ["avenger"], classContainer: "avenger" },
    });
    expect(lone.companion).toBe(false);
    expect(candidatesFor({ classContainer: EXTRA }, [lone], {})).toEqual(["lone"]);
    expect(candidatesFor({ classContainer: "avenger" }, [lone], {})).toEqual(["lone"]);
  });

  it("asks the index for the fields the companion rule reads", async () => {
    await twins(async ({ world }) => {
      const asked = [];
      game.packs = [{
        ...fakePack(world, ["castor"]),
        getIndex: async ({ fields }) => { asked.push(...fields); return []; },
      }];
      const { servantCatalogue } = await import("../../module/engine/summon.mjs");
      await servantCatalogue();
      expect(asked).toEqual(expect.arrayContaining([
        "system.servantClasses", "system.classContainer", "system.linkedGroup.summonTogether",
      ]));
    });
  });
});

describe("an enemy sees Saber on both twins before the True Names are revealed (#209 reading 9, ruled 2026-10-14)", () => {
  it("names both Saber while unrevealed, and by their names once revealed", async () => {
    await twins(({ unit, board }) => {
      // RED before #218: "Avenger" on both.
      expect(publicNameOf(unit("castor"), board)).toBe("Saber");
      expect(publicNameOf(unit("pollux"), board)).toBe("Saber");
    }, [{ from: "castor", state: { factionId: "A" } }, { from: "pollux", state: { factionId: "A" } }]);

    await twins(({ unit, board }) => {
      expect(publicNameOf(unit("castor"), board)).toBe("Castor");
      expect(publicNameOf(unit("pollux"), board)).toBe("Pollux");
    }, [{ from: "castor", state: { identityRevealed: true } }, { from: "pollux", state: { identityRevealed: true } }]);
  });

  it("gives both the Saber class image as their token until revealed", async () => {
    const { files } = await loadSource("packs/_source");
    const { assets } = await loadAssets("assets");
    for (const id of ["castor", "pollux"]) {
      const doc = files.find((f) => f.doc?.id === id).doc;
      // RED before #218: classes/avenger.webp.
      expect(unitImages(doc, "servants", "servant", assets).defaultImage, id).toMatch(/classes\/saber\.webp$/);
    }
  });
});

/* ========================================================================== */
/*  Finding §46.4-D3 -- the second twin of a war-setup slot is a full member    */
/* ========================================================================== */

describe("a war built by the wizard seats both twins (#218, finding §46.4-D3)", () => {
  // `commitWar` filled a slot with `commitSummon`, which summons the partner
  // with no Master and no faction, then wrote the faction, the Contract and the
  // token of the PRIMARY alone: the second twin of every war-setup pair stood
  // on no side, under no Master, off the board. Only the Dioscuri summon
  // together, so nothing else showed it.
  const MASTER = "masterOfTwins000";
  const container = { id: "A-saber-0", factionId: "A", classContainer: "saber" };

  /** Two summoned twins as `commitSummon` leaves them: cross-linked, no Master, no faction. */
  const summoned = async () => [
    ...(await twinSpecs({ faction: null, castor: { state: { contract: "free" } }, pollux: { state: { contract: "free" } } })),
    { from: "master-advanced", id: MASTER, state: { factionId: "A" } },
  ];

  it("gives the partner the primary's faction, slot and Master", async () => {
    await withSubjects(await summoned(), async ({ world }) => {
      const { seatPartners } = await import("../../module/engine/war-setup.mjs");
      // The primary is drawn into the container, as `commitWar` does.
      const seated = await seatPartners(world.actor(POLLUX), container, world.actor(MASTER));
      expect(seated.map((a) => a.id)).toEqual([CASTOR]);

      const castor = world.actor(CASTOR);
      expect(castor.system.factionId).toBe("A");
      expect(castor.system.classContainer).toBe("saber");
      expect(castor.system.contract).toBe("contracted");
      expect(castor.system.masterId).toBe(MASTER);
      // The Master's roster is the other half of the Contract (`setContract`).
      expect([...world.actor(MASTER).system.servantIds]).toContain(CASTOR);
    });
  });

  it("seats nobody for a Servant summoned alone", async () => {
    await withSubjects([
      { from: "karna", id: "karnaAlone000000", state: { factionId: "A" } },
      { from: "master-advanced", id: MASTER, state: { factionId: "A" } },
    ], async ({ world }) => {
      const { seatPartners } = await import("../../module/engine/war-setup.mjs");
      expect(await seatPartners(world.actor("karnaAlone000000"), container, world.actor(MASTER))).toEqual([]);
    });
  });
});

describe("a war built by the wizard puts both twins on the board (#218, finding §46.4-D3)", () => {
  const draft = { warType: "holyGrailWar", boardSize: 13, homeBaseDepth: 2 };
  const roster = [{ id: "A", name: "Red" }, { id: "B", name: "Blue" }];
  const stand = (id, factionId) => ({
    id, system: { factionId },
    getTokenDocument: async ({ x, y }) => ({ toObject: () => ({ actorId: id, x, y }) }),
  });

  it("deploys the partner beside the primary, inside the leash of 2", async () => {
    const { deployTokens } = await import("../../module/engine/war-setup.mjs");
    const made = [];
    const scene = { grid: { size: 100 }, createEmbeddedDocuments: async (_, data) => { made.push(...data); } };
    await deployTokens(
      scene, draft, roster,
      [stand("masterA", "A")], [stand("pollux", "A")], [[stand("castor", "A")]],
    );
    const at = (id) => {
      const t = made.find((m) => m.actorId === id);
      return t ? { i: t.y / 100, j: t.x / 100 } : null;
    };
    expect(made.map((m) => m.actorId).sort()).toEqual(["castor", "masterA", "pollux"]);
    const cheb = (a, b) => Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j));
    // RED before the fix: no token at all for the partner.
    expect(cheb(at("castor"), at("pollux"))).toBeLessThanOrEqual(2);
    // Directly next to each other: the joint NP's condition.
    expect(cheb(at("castor"), at("pollux"))).toBe(1);
    const panels = made.map((m) => `${m.x},${m.y}`);
    expect(new Set(panels).size, "no two tokens on one panel").toBe(3);
  });
});
