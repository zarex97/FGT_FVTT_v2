/**
 * @file Scáthach's audit rulings (#204) that changed the engine.
 * @see docs/46-roster-re-audit.md, char_orig_sheets/Copia de Scáthach.md
 *
 * - reading 5: an effect whose sheet states no NP figure applies its full value
 *   against a Noble Phantasm. The instance's missing `npMagnitude` resolved to
 *   0, so Def Dwn 25% added nothing to an NP on eight Servants. Crit buffs keep
 *   #131: no stated figure, no effect on an NP.
 * - reading 2: she may target herself with Ár and the Rune's ally table. The
 *   picker offered only an explicit `includeSelf`; the resolver allowed it.
 * - reading 8: the pick falls due when the war is built (or the copier's token
 *   enters a war under way), from the Servants on the field then, and no Turn
 *   ends until it is made. It was a sheet button, any time.
 * - reading 9: she copies only other Servants' Skills. Every other Unit on
 *   the board was offered, Masters included.
 * - reading 11: the content flags the families her sheet names: every Mana
 *   Burst, and the Mystic Eyes. None carried the flag.
 * - reading 19: any of the three Wisdom slots cooling blocks Gate of Skye. The
 *   requirement named the grant, the setup button, which never cools.
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { critChance } from "../../module/rules/checks.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { meetsRequirements } from "../../module/rules/items.mjs";
import { canCopy, copyCandidates } from "../../module/rules/copy.mjs";
import { markCopyPicksDue, offerCopies, grantCopies } from "../../module/engine/copy.mjs";
import { endTurnVerdict } from "../../module/engine/budget.mjs";
import { classifyAbility } from "../../module/rules/ability-use.mjs";
import { legalPlacements } from "../../module/rules/targeting/resolve.mjs";
import { reactionAbilities, windowSubject } from "../../module/rules/reactions.mjs";
import { currentBoard } from "../../module/engine/board.mjs";

beforeAll(prepareSubjects, 120_000);

/**
 * Drake holding `effects`, and what `fn` makes of her. Drake, because she
 * cuts no damage of her own: Karna's Kavacha would hide the multiplier.
 */
const drake = (effects, fn) => withSubjects(
  [{ from: "drake", id: "drake", effects }],
  ({ unit }) => fn(unit("drake")),
);

/** The damage a 1000 BA(STR) hit of `kind` does to `defender`, no crit. */
const dealt = (defender, kind) => {
  const attacker = { id: "a", modifiers: [], effects: [], attributes: [], baseAttack: { str: 1000 } };
  const attack = { kind, component: "str" };
  return computeDamage({
    attacker, defender, attack,
    base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    rolls: { attackPlus: 0 },
    crit: { isCrit: false, chanceUsed: 0 },
    options: rollOptionsFor({ attacker, defender, attack }),
  }).total;
};

describe("an unstated NP figure is the full figure (reading 5)", () => {
  it("Def Dwn 25% with no NP figure raises an NP's damage by 25%, as a Normal Attack's", async () => {
    const [bare, debuffed] = await Promise.all([
      drake([], (u) => [dealt(u, "np"), dealt(u, "normal")]),
      drake([{ defId: "defDwn", magnitude: 25 }], (u) => [dealt(u, "np"), dealt(u, "normal")]),
    ]);
    expect(bare).toEqual([1000, 1000]);
    expect(debuffed).toEqual([1250, 1250]);
  });

  it("a stated NP figure still wins: Def Dwn 25%, 15% against an NP", async () => {
    const [bare, debuffed] = await Promise.all([
      drake([], (u) => dealt(u, "np")),
      drake([{ defId: "defDwn", magnitude: 25, npMagnitude: 15 }], (u) => dealt(u, "np")),
    ]);
    expect([bare, debuffed]).toEqual([1000, 1150]);
  });

  it("a crit buff with no NP figure still does nothing to an NP (#131)", async () => {
    const percent = (kind) => drake([{ defId: "critUpViy", magnitude: 50 }], (u) => critChance(u, null, {
      options: rollOptionsFor({ attacker: u, defender: null, attack: { kind, component: "mag" } }),
      isNP: kind === "np",
    }).percent);
    const base = (kind) => drake([], (u) => critChance(u, null, {
      options: rollOptionsFor({ attacker: u, defender: null, attack: { kind, component: "mag" } }),
      isNP: kind === "np",
    }).percent);
    expect(await percent("np")).toBe(await base("np"));
    expect(await percent("normal")).toBe(await base("normal") + 50);
  });
});

describe("any cooling Wisdom slot blocks Gate of Skye (reading 19)", () => {
  /** Whether her Gate passes its requirements with `cooling` on cooldown. */
  const gateOpen = (cooling) => withSubjects([{ from: "scathach", id: "scathach" }], ({ unit }) => {
    const projected = unit("scathach");
    // Runtime state, not projection: a cooldown the board would carry.
    const abilities = projected.abilities.map((a) => (cooling.includes(a.contentId) ? { ...a, cooldownRemaining: 3 } : a));
    const scathach = { ...projected, abilities };
    // The requirements as the compile wrote them onto her Item: the snapshot
    // does not carry them, and `rules/costs.mjs` reads the Item's.
    const item = game.actors.get("scathach").items.find((i) => i.system.contentId === "scathach-gate-of-skye");
    const gate = { ...abilities.find((a) => a.contentId === "scathach-gate-of-skye"), requirements: item.system.requirements };
    return meetsRequirements(gate.requirements, { unit: scathach, ability: gate }).ok;
  });

  it("is open with nothing cooling", async () => {
    expect(await gateOpen([])).toBe(true);
  });

  it("is blocked while Clairvoyance cools", async () => {
    expect(await gateOpen(["scathach-wisdom-clairvoyance"])).toBe(false);
  });

  it("is blocked while Primordial Rune or Gáe Bolg cools", async () => {
    expect(await gateOpen(["scathach-primordial-rune"])).toBe(false);
    expect(await gateOpen(["scathach-gae-bolg-alternative"])).toBe(false);
  });
});

describe("she copies only from other Servants (reading 9)", () => {
  it("offers Drake's Skills and nothing of a Summon's", async () => {
    const offered = await withSubjects([
      { from: "scathach", id: "scathach" },
      { from: "drake", id: "drake" },
      { from: "jabberwock", id: "jabberwock" },
    ], ({ board, unit }) => {
      // The Jabberwock really holds a Skill the grant could otherwise take,
      // Alice Eater, so the refusal is the kind's, not an empty list's.
      expect(unit("jabberwock").abilities.some((a) => canCopy(a).ok)).toBe(true);
      return copyCandidates(board, unit("scathach"));
    });
    expect(new Set(offered.map((c) => c.unitId))).toEqual(new Set(["drake"]));
  });
});

describe("a Class Skill cannot be copied (WD.class)", () => {
  it("refuses every Riding: Medusa's was offered on the live board", async () => {
    const reasons = await withSubjects([{ from: "medusa", id: "medusa" }, { from: "drake", id: "drake" }, { from: "karna", id: "karna" }],
      ({ units }) => units.flatMap((u) => u.abilities).filter((a) => a.name === "Riding").map((a) => canCopy(a).reason));
    expect(reasons).toHaveLength(3);
    expect(reasons.every((r) => r === "classSkill" || r === "notActive")).toBe(true);
    expect(reasons).toContain("classSkill");
  });
});

describe("the families her sheet names cannot be copied (reading 11)", () => {
  it("refuses every Mana Burst and the Mystic Eyes, by their content flag", async () => {
    const reasons = await withSubjects([
      { from: "karna", id: "karna" }, { from: "raikou", id: "raikou" },
      { from: "medusa", id: "medusa" }, { from: "castor", id: "castor" }, { from: "pollux", id: "pollux" },
    ], ({ units }) => units.flatMap((u) => u.abilities)
      .filter((a) => /Mana Burst|Mystic Eyes/.test(a.name))
      .map((a) => [a.name, canCopy(a).reason]));
    expect(reasons).toEqual(expect.arrayContaining([
      ["Mana Burst (Flames)", "named"],
      ["Mana Burst (Lightning)", "named"],
      ["Mana Burst (Light/Ancient)", "named"],
      ["Mystic Eyes of Petrification: Cybele", "physical"],
    ]));
    expect(reasons.filter(([, r]) => r !== "named" && r !== "physical")).toEqual([]);
  });
});

describe("her copies fall due at the war's start (reading 8)", () => {
  const field = [
    { from: "scathach", id: "scathach", state: { factionId: "A" }, panel: { i: 2, j: 2 } },
    { from: "drake", id: "drake", state: { factionId: "B" }, panel: { i: 6, j: 6 } },
    { from: "jabberwock", id: "jabberwock", state: { factionId: "B" }, panel: { i: 8, j: 8 } },
  ];
  const opts = { tokens: true, combat: { round: 1, started: true, system: { globalTurn: 1 }, actingFactionId: "B" } };

  it("owes the pick, from the Servants on the field then, and holds every side's Turn", async () => {
    await withSubjects(field, async ({ world: w }) => {
      const due = await markCopyPicksDue({ open: false });
      expect(due.map((d) => d.copierId)).toEqual(["scathach"]);
      expect(w.actor("scathach").system.copyPick).toEqual({ due: true, poolIds: ["drake"] });
      // Drake's side is acting, and still cannot end its Turn.
      const verdict = endTurnVerdict(game.combats.active, "B", currentBoard().units);
      expect(verdict.ok).toBe(false);
      expect(verdict.unmet.map((u) => u.unitId)).toContain("scathach");
      // Only Drake's Skills are offered, never the Jabberwock's.
      expect(new Set(offerCopies({ copierId: "scathach" }).map((c) => c.unitId))).toEqual(new Set(["drake"]));
    }, opts);
  });

  it("is paid by the pick: the Turn may end, and it is not owed again", async () => {
    await withSubjects(field, async ({ world: w }) => {
      await markCopyPicksDue({ open: false });
      const two = offerCopies({ copierId: "scathach" }).slice(0, 2).map((c) => ({ unitId: c.unitId, abilityId: c.ability.id }));
      expect(two).toHaveLength(2);
      expect(await grantCopies({ copierId: "scathach", picks: two, grantedBy: "scathach-wisdom-of-dun-scaith" })).toMatchObject({ ok: true });
      expect(w.actor("scathach").system.copyPick.due).toBe(false);
      // Each copy is usable as its source is: its window and targeting came
      // with it, and its passive rules did not (W1.effect, reading 10). A copy
      // with phases resolved only by reference classified as passive.
      for (const copy of [...w.actor("scathach").items].filter((i) => i.system.copiedFrom)) {
        const source = [...w.actor(two.find((t) => w.actor(t.unitId).items.get(t.abilityId)?.system.contentId === copy.system.copiedFrom).unitId).items]
          .find((i) => i.system.contentId === copy.system.copiedFrom);
        expect(classifyAbility(copy).kind).toBe(classifyAbility(source).kind);
        expect(copy.system.timing).toEqual(source.system.timing);
        expect(copy.system.targeting).toEqual(source.system.targeting);
        expect(copy.system.rules ?? []).toEqual([]);
        expect(copy.system.rank).toBe("A+");
      }
      expect(endTurnVerdict(game.combats.active, "B", currentBoard().units).ok).toBe(true);
      expect(await markCopyPicksDue({ open: false })).toEqual([]);
    }, opts);
  });

  it("carries a Skill's Active part and leaves its Passive behind (reading 10)", async () => {
    await withSubjects([...field, { from: "heracles", id: "heracles", state: { factionId: "B" }, panel: { i: 6, j: 8 } }], async ({ world: w }) => {
      const eye = [...w.actor("heracles").items].find((i) => i.system.contentId === "heracles-eye-of-the-mind-false");
      expect(eye.system.passiveRules.length).toBeGreaterThan(0);
      await grantCopies({ copierId: "scathach", picks: [{ unitId: "heracles", abilityId: eye.id }], grantedBy: "scathach-wisdom-of-dun-scaith" });
      const copy = [...w.actor("scathach").items].find((i) => i.system.copiedFrom === "heracles-eye-of-the-mind-false");
      expect(copy.system.passiveRules ?? []).toEqual([]);
      expect(copy.system.timing).toEqual(eye.system.timing);
    }, opts);
  });

  it("does not offer a copy as a reaction while another slot cools (W1.lock)", async () => {
    await withSubjects([...field, { from: "heracles", id: "heracles", state: { factionId: "B" }, panel: { i: 6, j: 8 } }], async ({ world: w }) => {
      const heracles = [...w.actor("heracles").items];
      const eye = heracles.find((i) => i.system.contentId === "heracles-eye-of-the-mind-false");
      const other = heracles.find((i) => i.system.contentId === "heracles-bravery");
      await grantCopies({ copierId: "scathach", picks: [{ unitId: "heracles", abilityId: eye.id }, { unitId: "heracles", abilityId: other.id }], grantedBy: "scathach-wisdom-of-dun-scaith" });
      const offered = () => reactionAbilities(windowSubject(currentBoard().units.find((u) => u.id === "scathach"), w.actor("scathach").items)).map((a) => a.system.copiedFrom);
      expect(offered()).toContain("heracles-eye-of-the-mind-false");
      const bravery = [...w.actor("scathach").items].find((i) => i.system.copiedFrom === "heracles-bravery");
      await bravery.update({ "system.cooldown.remaining": 5 });
      expect(offered()).not.toContain("heracles-eye-of-the-mind-false");
    }, opts);
  });

  it("falls due when her token enters a war under way, through the engine's own listener", async () => {
    await withSubjects(field, async ({ world: w }) => {
      expect(w.actor("scathach").system.copyPick.due).toBe(false);
      Hooks.callAll("createToken", { actorId: "scathach" });
      await vi.waitFor(() => expect(w.actor("scathach").system.copyPick.due).toBe(true));
    }, opts);
  });

  it("never offers a Servant that came after the pick fell due", async () => {
    await withSubjects([...field, { from: "heracles", id: "heracles", state: { factionId: "B" }, panel: { i: 6, j: 8 } }], async ({ world: w }) => {
      // Heracles arrived after: the pool is the field the pick fell due on.
      await w.actor("scathach").update({ "system.copyPick": { due: true, poolIds: ["drake"] } });
      expect(new Set(offerCopies({ copierId: "scathach" }).map((c) => c.unitId))).toEqual(new Set(["drake"]));
    }, opts);
  });
});

describe("she may target herself with Ár and the Rune's ally table (reading 2)", () => {
  it("offers her own panel as a legal pick, beside an ally's", async () => {
    const legal = await withSubjects([
      { from: "scathach", id: "scathach", state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "drake", id: "drake", state: { factionId: "A" }, panel: { i: 5, j: 7 } },
    ], ({ unit, board, world: w }) => Object.fromEntries(["scathach-ar", "scathach-primordial-rune"].map((cid) => {
      const item = [...w.actor("scathach").items].find((i) => i.system.contentId === cid);
      return [cid, legalPlacements(item.system.targeting, unit("scathach"), board)
        .filter((o) => o.legal).map((o) => o.placement.unitId).sort()];
    })));
    expect(legal["scathach-ar"]).toEqual(["drake", "scathach"]);
    expect(legal["scathach-primordial-rune"]).toEqual(["drake", "scathach"]);
  });
});
