/**
 * @file An offer passes the gate its press runs (#244).
 * @see module/engine/press-gate.mjs, module/rules/costs.mjs, module/engine/combat-process.mjs#rungOptions,
 *   docs/23-reactions.md, docs/34-action-bar.md, docs/surprises/patterns/two-readers-one-rule.md
 *
 * An offer is a reader of the use gate: a window, a reaction rung, a prompt or
 * the action bar offers only what its press would let through. They disagreed
 * at least eight times, four of them in Kiritsugu's audit alone (#243): the
 * Combat Phase window offered a Spell the category cap refused, the Counter
 * rung offered a Counter the shot forbade, the unanswerable-rung guard counted
 * buttons the card had filtered out, and the free-Spell prompt listed Spells
 * the use gate refused off-Turn. Each was fixed where the audit looked. This
 * file is the guard the *Two readers* lesson asks for once a rule has slipped
 * three times.
 *
 * Built through `test/helpers/subject.mjs`: what is refused is authored content
 * reaching the gate through the real compile and projection.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { canUseAbility } from "../../module/rules/costs.mjs";
import { usageSpecFor } from "../../module/rules/ability-use.mjs";
import { abilityState } from "../../module/apps/actor-sheet/present.mjs";
import { deserialize, begin, advance, pendingPrompt, rungOptions } from "../../module/engine/combat-process.mjs";
import { pressGate } from "../../module/engine/press-gate.mjs";

beforeAll(prepareSubjects, 120_000);

/* ========================================================================== */
/*  Seam C: the use gate refuses a negated ability                            */
/* ========================================================================== */

describe("the use gate and an ability negated by an effect", () => {
  // `negatedBy` was asked by `useSkill` alone (`rules/ability-use.mjs#isNegated`),
  // so the bar and every offer, which ask `canUseAbility`, lit an ability its
  // press refused with "negated". Every negated Active in the corpus also carries
  // a `notHasEffect` requirement or is a Seal's, so the probe is authored: an
  // ability negated by Poison, which no Seal and no requirement covers.
  const probe = {
    type: "servant", id: "probeNegated", name: "Probe Negated", servantClasses: ["saber"],
    parameters: { str: "C", end: "C", agi: "C", mag: "C", luc: "C" },
    abilities: [{ id: "probe-veiled", name: "Probe Veiled", kind: "skill", slug: "probeVeiled", negatedBy: ["poison"] }],
  };
  const gate = (effects) => withSubjects(
    [{ from: probe, id: "probeNegated", effects }],
    ({ world, unit }) => {
      const item = world.actor("probeNegated").items.find((i) => i.system.slug === "probeVeiled");
      return canUseAbility({ ability: usageSpecFor(item), unit: unit("probeNegated"), round: 5 });
    },
  );

  it("refuses it while its owner carries the effect, naming the effect", async () => {
    expect(await gate([{ defId: "poison" }]))
      .toMatchObject({ ok: false, reason: "negated", detail: { by: "poison" } });
  });

  it("allows it without the effect", async () => {
    expect((await gate([])).ok).toBe(true);
  });

  it("is said on the slot by the effect's name", async () => {
    const verdict = await gate([{ defId: "poison" }]);
    expect(abilityState(verdict)).toMatchObject({ ok: false, label: "FGT.Ability.NegatedBy", detail: { by: "Poison" } });
  });
});

describe("a use whose target is not known yet", () => {
  // A billed window use (Monstrous Strength) is offered before anyone is aimed
  // at. `pressGate` read `target: undefined` as that mode, and its own
  // destructuring default turned the `undefined` into `null`: the mode never
  // switched on, and a target requirement refused for want of a target (#244 review).
  const probe = {
    type: "servant", id: "probeAimless", name: "Probe Aimless", servantClasses: ["saber"],
    parameters: { str: "C", end: "C", agi: "C", mag: "C", luc: "C" },
    abilities: [{
      id: "probe-aimed", name: "Probe Aimed", kind: "skill", slug: "probeAimed",
      requirements: [{ kind: "targetHasEffect", effectId: "poison" }],
    }],
  };
  const ask = (ctx) => withSubjects([{ from: probe, id: "probeAimless" }], ({ world }) => {
    const actor = world.actor("probeAimless");
    return pressGate(actor, actor.items.find((i) => i.system.slug === "probeAimed"), { billsBudget: false, ...ctx });
  });

  it("judges only what the Unit can answer alone, when asked `selfOnly`", async () => {
    expect((await ask({ selfOnly: true })).ok).toBe(true);
  });

  it("judges the target requirement, and refuses it, when there is no target", async () => {
    expect(await ask({ target: null })).toMatchObject({ ok: false, reason: "targetHasEffect" });
  });
});

/* ========================================================================== */
/*  Seam A: every offer site, through the refusals its press meets            */
/* ========================================================================== */

const ATTACKER = "drakeAttacker244";
const MEDEA = "medeaInPeril0244";
const KIRITSUGU = "kiritsuguGate244";

/** Drake swings at Medea; Kiritsugu stands beside her, both on the other side. */
const board = ({ medea = [], kiritsugu = [] } = {}) => [
  { from: "drake", id: ATTACKER, state: { factionId: "B" }, panel: { i: 5, j: 4 } },
  // Carrying his Decoy, so his shot answers the attack on her.
  { from: "medea", id: MEDEA, state: { factionId: "A" }, panel: { i: 5, j: 5 }, effects: [{ defId: "decoyScapegoat" }, ...medea] },
  { from: "kiritsugu", id: KIRITSUGU, owner: "p1", state: { factionId: "A" }, panel: { i: 5, j: 6 }, effects: kiritsugu },
];
const turnOf = (faction, round = 3) => ({
  tokens: true, combat: { round, started: true, system: { globalTurn: 3 * round - 2 }, actingFactionId: faction },
});
const ENEMY_TURN = turnOf("B");
const OWN_TURN = turnOf("A");

/** An ability by slug, or by content id where the sheet gives it none (Medea's Spells). */
const itemOf = (w, actorId, key) => [...w.actor(actorId).items]
  .find((i) => i.system.slug === key || i.system.contentId === key);
const processOf = (w, id) => deserialize(w.messages.get(id).getFlag("fgt", "process"));
const offeredOn = (w, id) => (processOf(w, id).reactionAbilities?.[MEDEA] ?? []).map((a) => a.id);
const asked = (w, title) => w.asked.filter((q) => q.title === title);

/** One Unit declares an attack; returns the Process's message id. */
async function declare(attackerId, targetId, abilityId = null) {
  const { resolveAttack } = await import("../../module/engine/attack.mjs");
  const declared = await resolveAttack({ attackerId, abilityId, placement: { unitId: targetId, chosenIds: [targetId] } });
  return declared.messageId;
}

describe("the reaction rung offers what its press would let through", () => {
  it("offers Medea's Spells and Kiritsugu's shot when nothing refuses them", async () => {
    await withSubjects(board(), async ({ world: w }) => {
      const id = await declare(ATTACKER, MEDEA);
      expect(offeredOn(w, id)).toEqual(expect.arrayContaining([
        itemOf(w, MEDEA, "medea-trofa").id, itemOf(w, MEDEA, "medea-argos").id, itemOf(w, KIRITSUGU, "suppressionShot").id,
      ]));
    }, ENEMY_TURN);
  }, 60_000);

  it("withholds a Silenced Medea's Spells, which her press refuses as prevented", async () => {
    await withSubjects(board({ medea: [{ defId: "silence" }] }), async ({ world: w }) => {
      const id = await declare(ATTACKER, MEDEA);
      const trofa = itemOf(w, MEDEA, "medea-trofa");
      expect(offeredOn(w, id)).not.toContain(trofa.id);
      expect(offeredOn(w, id)).not.toContain(itemOf(w, MEDEA, "medea-argos").id);
      expect(pressGate(w.actor(MEDEA), trofa, { atWindow: true, target: null }))
        .toMatchObject({ ok: false, reason: "prevented" });
    }, ENEMY_TURN);
  }, 60_000);

  it("withholds a Skill-Sealed Kiritsugu's shot, which its press refuses as prevented", async () => {
    await withSubjects(board({ kiritsugu: [{ defId: "skillSeal" }] }), async ({ world: w, unit }) => {
      const id = await declare(ATTACKER, MEDEA);
      const shot = itemOf(w, KIRITSUGU, "suppressionShot");
      expect(offeredOn(w, id)).not.toContain(shot.id);
      expect(pressGate(w.actor(KIRITSUGU), shot, { atWindow: true, target: unit(ATTACKER) }))
        .toMatchObject({ ok: false, reason: "prevented" });
    }, ENEMY_TURN);
  }, 60_000);
});

describe("the free Spell before the shot offers what its cast would let through", () => {
  /** Kiritsugu takes the shot at Drake; the free Spell is asked first. */
  async function shoot(w) {
    const { advanceAttack } = await import("../../module/engine/attack.mjs");
    const id = await declare(ATTACKER, MEDEA);
    await advanceAttack({ messageId: id, event: `ability:${itemOf(w, KIRITSUGU, "suppressionShot").id}` });
  }

  it("offers each Spell the cast allows on the enemy's Turn, and not one on Cooldown", async () => {
    await withSubjects(board(), async ({ world: w }) => {
      const [penetration, familiars, reinforcement] = ["penetration", "familiars", "reinforcement"].map((s) => itemOf(w, KIRITSUGU, s));
      await penetration.update({ "system.cooldown.remaining": 3 });
      w.answer({ title: "FGT.Kiritsugu.PreShotSpell", by: "p1", decline: true });
      w.answer({ title: "FGT.Window.combatPhaseStart", by: "p1", decline: true });
      await shoot(w);
      const [spell] = asked(w, "FGT.Kiritsugu.PreShotSpell");
      // "Used during your Turn" (Familiars) and a Combat Phase window
      // (Reinforcement) answer to the shot's moment instead (#243 reading 9).
      expect(spell.options).toEqual(expect.arrayContaining([familiars.id, reinforcement.id]));
      expect(spell.options).not.toContain(penetration.id);
      expect(pressGate(w.actor(KIRITSUGU), penetration, { anyMoment: true, bypassesCategoryLimit: true, target: null }))
        .toMatchObject({ ok: false, reason: "cooldown" });
    }, ENEMY_TURN);
  }, 60_000);

  it("asks nothing of a Silenced Kiritsugu, whose every Spell the cast refuses", async () => {
    await withSubjects(board({ kiritsugu: [{ defId: "silence" }] }), async ({ world: w }) => {
      await shoot(w);
      expect(asked(w, "FGT.Kiritsugu.PreShotSpell")).toEqual([]);
      expect(pressGate(w.actor(KIRITSUGU), itemOf(w, KIRITSUGU, "familiars"), { anyMoment: true, bypassesCategoryLimit: true, target: null }))
        .toMatchObject({ ok: false, reason: "prevented" });
    }, ENEMY_TURN);
  }, 60_000);
});

describe("an attacker's window offers what its use would let through", () => {
  it("offers Reinforcement at the start of his own Combat Phase", async () => {
    await withSubjects(board(), async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", by: "p1", decline: true });
      await declare(KIRITSUGU, ATTACKER);
      const [window] = asked(w, "FGT.Window.combatPhaseStart");
      expect(window.options).toContain(itemOf(w, KIRITSUGU, "reinforcement").id);
    }, OWN_TURN);
  }, 60_000);

  // Silence, not Skill Seal: his Normal Attack is a Skill (Lethal Gunfire
  // Suppression's gun), and a Seal refuses the attack before any window opens.
  it("asks nothing of a Silenced Kiritsugu, whose Reinforcement the cast refuses", async () => {
    await withSubjects(board({ kiritsugu: [{ defId: "silence" }] }), async ({ world: w }) => {
      await declare(KIRITSUGU, ATTACKER);
      expect(asked(w, "FGT.Window.combatPhaseStart")).toEqual([]);
      expect(pressGate(w.actor(KIRITSUGU), itemOf(w, KIRITSUGU, "reinforcement"), { atWindow: true, target: null }))
        .toMatchObject({ ok: false, reason: "prevented" });
    }, OWN_TURN);
  }, 60_000);
});

describe("the NP cancellation offers what its use would let through", () => {
  const ARTURIA = "arturiaDeclarer4";
  const MANNANAN = "mannananCancels4";
  const FRAGARACH = "Fragarach: Gouging Sword of the War God";
  const cancelBoard = (effects = []) => [
    { from: "arturia", id: ARTURIA, state: { factionId: "B" }, panel: { i: 5, j: 4 } },
    { from: "mannanan", id: MANNANAN, owner: "p1", state: { factionId: "A" }, panel: { i: 5, j: 5 }, effects },
  ];
  const ROUND_FIVE = turnOf("B", 5);

  async function strikeAir(w) {
    await w.actor(MANNANAN).update({ "system.resources.fragarachTokens.value": 5 });
    // Her Holder mode asks its setup when she is attacked; not this test's question.
    w.answer({ title: "God's Holder: Tradition Carrier", by: "p1", decline: true });
    // Strike Air: a single-target Noble Phantasm with no gate of its own.
    return declare(ARTURIA, MANNANAN, itemOf(w, ARTURIA, "strikeAir").id);
  }

  it("offers Fragarach against a Noble Phantasm", async () => {
    await withSubjects(cancelBoard(), async ({ world: w }) => {
      w.answer({ title: FRAGARACH, by: "p1", decline: true });
      await strikeAir(w);
      expect(asked(w, FRAGARACH)).toHaveLength(1);
    }, ROUND_FIVE);
  }, 60_000);

  it("asks nothing of an NP-Sealed Mannanán, whose Fragarach its use refuses", async () => {
    await withSubjects(cancelBoard([{ defId: "npSeal" }]), async ({ world: w, unit }) => {
      await strikeAir(w);
      expect(asked(w, FRAGARACH)).toEqual([]);
      expect(pressGate(w.actor(MANNANAN), itemOf(w, MANNANAN, "fragarach"), { atWindow: true, target: unit(ARTURIA), billsBudget: false }))
        .toMatchObject({ ok: false, reason: "prevented" });
    }, ROUND_FIVE);
  }, 60_000);
});

/* ========================================================================== */
/*  Seam B: one reader of what is left on the react rung                      */
/* ========================================================================== */

describe("what is left on the react rung has one reader", () => {
  // Four places answered it: `pendingPrompt` (the unanswerable-rung guard), the
  // card (`promptOptions`), the timeout (`await-timeout.mjs`) and the transition
  // guard. The guard counted the list the card had already filtered, and was
  // dead (#243). A rung the attack forbids is planted, and each must drop it.
  const planted = (forbiddenReactions, abilities = []) => ({
    ...begin({ attackerId: "a", defenderId: "d", attack: { kind: "normal" } }),
    state: "react", forbiddenReactions, reactionAbilities: { d: abilities },
  });

  it("drops a forbidden rung, and keeps the abilities beside the rest", () => {
    expect(rungOptions(planted(["evade"], [{ id: "trofa" }]))).toEqual(["nothing", "block", "ability:trofa"]);
  });

  it("is what the prompt carries and the card draws", async () => {
    const s = planted(["evade"]);
    const prompt = pendingPrompt(s);
    expect(prompt.options).toEqual(["nothing", "block"]);
    // The card's module needs a running Foundry.
    await withSubjects([], async () => {
      const { promptOptions } = await import("../../module/apps/chat/cards.mjs");
      expect(promptOptions(prompt, s).map((o) => o.event)).toEqual(["nothing", "block"]);
    });
  });

  it("is no question at all when only Do nothing is left", () => {
    expect(pendingPrompt(planted(["block", "evade"]))).toBeNull();
    expect(pendingPrompt(planted(["block", "evade"], [{ id: "trofa" }]))).not.toBeNull();
  });

  it("is what the timeout falls back to, never a forbidden rung", async () => {
    await withSubjects([], async () => {
      const { timeoutReaction } = await import("../../module/engine/await-timeout.mjs");
      expect(timeoutReaction(planted(["block"]), "block")).toBe("nothing");
      expect(timeoutReaction(planted(["nothing"]), "nothing")).toBe("block");
      expect(timeoutReaction(planted([]), "evade")).toBe("evade");
      // Every standing rung refused and an ability left: the ability is the one
      // move the transition takes. The policy's "nothing" threw (#244 review).
      const cornered = planted(["nothing", "block", "evade"], [{ id: "trofa" }]);
      expect(timeoutReaction(cornered, "nothing")).toBe("ability:trofa");
      expect(() => advance(cornered, timeoutReaction(cornered, "nothing"))).not.toThrow();
    });
  });

  it("is what the transition refuses, by name", () => {
    expect(() => advance(planted(["evade"]), "evade")).toThrow(/"evade" is not available against this attack/);
  });
});

/* ========================================================================== */
/*  The scan: a new ability prompt asks `offerable`, or says why not          */
/* ========================================================================== */

describe("tools/check-offers.mjs", () => {
  // The matrix above holds the offer sites known today. Kiritsugu's free-Spell
  // prompt was a NEW site, and no matrix written before it would have held it.
  // The scan holds the next one: a prompt listing a Unit's ability Items asks
  // `offerable` for the list, or carries a marker with its reason.
  const prompt = (decl, marker = "") => [
    "async function offerSpell(owner) {",
    `  const candidates = ${decl};`,
    `  const [chosen] = await chooseFor(owner, {${marker}`,
    "    title: \"x\",",
    "    options: candidates.map((i) => ({ id: i.id, name: i.name })),",
    "  });",
    "}",
  ].join("\n");

  it("refuses a prompt listing ability Items no gate was asked about, naming the line and the list", async () => {
    const { abilityOffers } = await import("../../tools/check-offers.mjs");
    const found = abilityOffers(prompt("[...(owner.items ?? [])].filter((i) => i.system?.category === \"x\")"));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ line: 3, list: "candidates" });
    expect(found[0].problem).toMatch(/ask `offerable`/);
  });

  it("passes the list when it came from `offerable`", async () => {
    const { abilityOffers } = await import("../../tools/check-offers.mjs");
    expect(abilityOffers(prompt("offerable(owner, owner.items, { atWindow: true })"))).toEqual([]);
  });

  it("passes a prompt marked with its reason, and refuses a bare marker", async () => {
    const { abilityOffers } = await import("../../tools/check-offers.mjs");
    const decl = "owner.items.filter((i) => (i.system?.cooldown?.remaining ?? 0) > 0)";
    expect(abilityOffers(prompt(decl, " // fgt-offer-ok: picks whose Cooldown to cut, not a use"))).toEqual([]);
    const bare = abilityOffers(prompt(decl, " // fgt-offer-ok:"));
    expect(bare).toHaveLength(1);
    expect(bare[0].problem).toMatch(/marker without a reason/);
  });

  it("follows the list back through the lists it is built from", async () => {
    const { abilityOffers } = await import("../../tools/check-offers.mjs");
    const text = [
      "async function offerSpell(owner) {",
      "  const ofCategory = [...owner.items].filter((i) => i.system?.category === \"x\");",
      "  const candidates = ofCategory.filter((i) => (i.system?.cooldown?.remaining ?? 0) === 0);",
      "  await chooseFor(owner, { options: candidates.map((i) => ({ id: i.id, name: i.name })) });",
      "}",
    ].join("\n");
    expect(abilityOffers(text)).toMatchObject([{ line: 4, list: "candidates" }]);
    expect(abilityOffers(text.replace("ofCategory.filter((i) => (i.system?.cooldown?.remaining ?? 0) === 0)", "offerable(owner, ofCategory, {})"))).toEqual([]);
  });

  it("reads the list however the prompt maps it: inline, chained or spread", async () => {
    const { abilityOffers } = await import("../../tools/check-offers.mjs");
    const ask = (options, decl = "") => abilityOffers([
      "async function offerSpell(owner) {",
      `  ${decl}`,
      `  await chooseFor(owner, { options: ${options}.map((i) => ({ id: i.id, name: i.name })) });`,
      "}",
    ].join("\n"));
    expect(ask("owner.items.filter((i) => i.system.isSpell)")).toHaveLength(1);
    expect(ask("[...spells]", "const spells = owner.items.filter((i) => i.system.isSpell);")).toMatchObject([{ list: "spells" }]);
    expect(ask("spells.filter((i) => i.system.cooldown.remaining === 0)", "const spells = owner.items.contents;")).toMatchObject([{ list: "spells" }]);
    expect(ask("offerable(owner, owner.items, {})")).toEqual([]);
  });

  it("leaves a prompt about Units, not abilities, alone", async () => {
    const { abilityOffers } = await import("../../tools/check-offers.mjs");
    expect(abilityOffers(prompt("board.units.filter((u) => u.factionId === owner.factionId)"))).toEqual([]);
  });
});
