/**
 * @file Abilities usable "when Attacked".
 * @see docs/17-abilities.md, docs/23-reactions.md
 *
 * Medea has two, and they are the reason this exists: *Argos* is "used during
 * your Turn **or when Attacked**", and *Trofa* is "used **when Attacked**" and
 * automatically Evades. Neither can be offered by a Skill button on the sheet,
 * because the moment they matter the defender is inside someone else's Combat
 * Process.
 */

import { describe, it, expect } from "vitest";
import { reactionAbilities, reactionOptions } from "../../module/rules/reactions.mjs";
import { canUseAbility } from "../../module/rules/costs.mjs";
import { usageSpecFor } from "../../module/rules/ability-use.mjs";

const ability = (over = {}) => ({
  id: "a", name: "Ability", system: { cooldown: { remaining: 0 }, ...over },
});

const spell = (id, window, over = {}) => ability({
  contentId: id, category: "spell", timing: { window }, ...over,
});

describe("reactionAbilities", () => {
  const argos = { ...spell("medea-argos", ["ownTurn", "whenAttacked"]), id: "argos", name: "Argos" };
  const trofa = { ...spell("medea-trofa", "whenAttacked"), id: "trofa", name: "Trofa" };
  const keraino = { ...spell("medea-keraino", "ownTurn"), id: "keraino", name: "Keraino" };

  const unit = (items, over = {}) => ({ id: "medea", items, effects: [], turnState: {}, ...over });

  it("offers an ability whose window includes whenAttacked", () => {
    expect(reactionAbilities(unit([argos, trofa, keraino])).map((a) => a.id))
      .toEqual(["argos", "trofa"]);
  });

  it("accepts a single window as a string, not only a list", () => {
    expect(reactionAbilities(unit([trofa])).map((a) => a.id)).toEqual(["trofa"]);
  });

  it("does not offer an own-turn-only ability", () => {
    expect(reactionAbilities(unit([keraino]))).toEqual([]);
  });

  it("does not offer one on cooldown", () => {
    // An option that refuses when pressed teaches nothing a missing option
    // does not teach faster (Ch. 33's argument, applied to reactions).
    const cooling = { ...trofa, system: { ...trofa.system, cooldown: { remaining: 4 } } };

    expect(reactionAbilities(unit([cooling]))).toEqual([]);
  });

  // The two below are the use gate's since #244, which every offer of this list
  // asks (`engine/press-gate.mjs#offerable`): asked here too, the window list was
  // a second reader of each, and the offers that skipped it lit what the press refused.
  const gate = (item, u) => canUseAbility({ ability: usageSpecFor(item), unit: u, round: 5, atWindow: true });

  it("leaves one its same-turn partner has already used to the use gate, which refuses it", () => {
    // Medea: Trofa "cannot be used on the same Turn as Κεραινο".
    const trofaX = { ...trofa, system: { ...trofa.system, sameTurnExclusive: ["medea-keraino"] } };
    const spent = unit([trofaX], { turnState: { abilitiesUsed: ["medea-keraino"] } });

    expect(gate(trofaX, spent)).toMatchObject({ ok: false, reason: "sameTurnExclusive" });
  });

  it("leaves one negated by an effect the Unit carries to the use gate, which refuses it", () => {
    const silenced = { ...trofa, system: { ...trofa.system, negatedBy: ["burn"] } };

    expect(gate(silenced, unit([silenced], { effects: ["burn"] }))).toMatchObject({ ok: false, reason: "negated" });
  });
});

describe("reactionOptions", () => {
  const trofa = { id: "trofa", name: "Trofa", system: { contentId: "medea-trofa", timing: { window: "whenAttacked" }, cooldown: { remaining: 0 } } };

  it("appends the ability options to the standard reaction list", () => {
    // The three the ladder already offers, plus one per usable reaction
    // ability -- the defender chooses between them in one prompt.
    const out = reactionOptions(["nothing", "block", "evade"], { id: "m", items: [trofa], effects: [], turnState: {} });

    expect(out).toEqual(["nothing", "block", "evade", "ability:trofa"]);
  });

  it("leaves the list alone when nothing is usable", () => {
    expect(reactionOptions(["nothing", "block", "evade"], { id: "m", items: [], effects: [], turnState: {} }))
      .toEqual(["nothing", "block", "evade"]);
  });
});
