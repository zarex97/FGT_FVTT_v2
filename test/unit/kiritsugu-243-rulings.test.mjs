/**
 * @file Kiritsugu's audit (#243): the readings the grill ruled against the build.
 * @see docs/superpowers/specs/2026-10-17-kiritsugu-clauses.md, docs/46-roster-re-audit.md §46.38
 *
 * Each Process below runs through the real attack flow on subjects built from
 * the authored Servants: Medea is the ally a Unit attacks, Kiritsugu answers
 * for her from beside her, and his player is Player1.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { canUseAbility } from "../../module/rules/costs.mjs";
import { deserialize } from "../../module/engine/combat-process.mjs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 120_000);

const ATTACKER = "drakeAttacker243";
const MEDEA = "medeaInPeril0243";
const KIRITSUGU = "kiritsuguAnswers";

/** Drake swings at Medea; Kiritsugu stands beside her, both on the other side. */
const board = (medeaEffects = []) => [
  { from: "drake", id: ATTACKER, state: { factionId: "B" }, panel: { i: 5, j: 4 } },
  { from: "medea", id: MEDEA, state: { factionId: "A" }, panel: { i: 5, j: 5 }, effects: medeaEffects },
  { from: "kiritsugu", id: KIRITSUGU, owner: "p1", state: { factionId: "A" }, panel: { i: 5, j: 6 } },
];
const ENEMY_TURN = { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "B" } };

const slugOf = (w, s) => [...w.actor(KIRITSUGU).items].find((i) => i.system.slug === s);
const processOf = (w, id) => deserialize(w.messages.get(id).getFlag("fgt", "process"));
const held = (w, id) => [...w.actor(id).effects].map((e) => e.system.defId);

/** Drake declares on Medea; returns the Process's message id. */
async function declare() {
  const { resolveAttack } = await import("../../module/engine/attack.mjs");
  const declared = await resolveAttack({ attackerId: ATTACKER, abilityId: null, placement: { unitId: MEDEA, chosenIds: [MEDEA] } });
  return declared.messageId;
}

describe("Scapegoat at the rung (#243 readings 4, 5, 6, 19)", () => {
  it("lands on the ally its player picks, himself included, and leaves the ally's reaction open", async () => {
    await withSubjects(board(), async ({ world: w }) => {
      const scapegoat = slugOf(w, "scapegoat");
      // Reading 5: any ally within 2, the Unit in peril first; reading 4: himself.
      w.answer({ title: scapegoat.name, by: "p1", pick: [KIRITSUGU] });
      const id = await declare();
      expect(processOf(w, id).reactionAbilities[MEDEA].map((a) => a.id)).toContain(scapegoat.id);

      const { advanceAttack } = await import("../../module/engine/attack.mjs");
      await advanceAttack({ messageId: id, event: `ability:${scapegoat.id}` });

      const asked = w.asked.find((q) => q.title === scapegoat.name);
      expect(asked.options[0]).toBe(MEDEA);
      expect(asked.options).toContain(KIRITSUGU);
      expect(held(w, KIRITSUGU)).toContain("decoyScapegoat");
      expect(held(w, MEDEA)).not.toContain("decoyScapegoat");
      // Reading 19: free, as Argos is. Medea still chooses Block, Evade or nothing.
      expect(processOf(w, id).state).toBe("react");
    }, ENEMY_TURN);
  }, 60_000);

  it("offers the shot on the same Attack once the Unit in peril holds the Decoy (reading 6)", async () => {
    await withSubjects(board(), async ({ world: w }) => {
      const scapegoat = slugOf(w, "scapegoat");
      const shot = slugOf(w, "suppressionShot");
      w.answer({ title: scapegoat.name, by: "p1", pick: [MEDEA] });
      const id = await declare();
      // At the declaration Medea holds no Decoy: no shot.
      expect(processOf(w, id).reactionAbilities[MEDEA].map((a) => a.id)).not.toContain(shot.id);

      const { advanceAttack } = await import("../../module/engine/attack.mjs");
      await advanceAttack({ messageId: id, event: `ability:${scapegoat.id}` });

      expect(held(w, MEDEA)).toContain("decoyScapegoat");
      const offers = processOf(w, id).reactionAbilities[MEDEA].map((a) => a.id);
      expect(offers).toContain(shot.id);
      // What was offered before stays withdrawn: Scapegoat cannot be pressed twice.
      expect(offers).not.toContain(scapegoat.id);
    }, ENEMY_TURN);
  }, 60_000);
});

describe("the shot (#243 readings 7, 8, 9)", () => {
  it("defeats the attacker before its Attack lands, and that Attack is lost (reading 7)", async () => {
    await withSubjects(board([{ defId: "decoyScapegoat" }]), async ({ world: w }) => {
      const shot = slugOf(w, "suppressionShot");
      w.answer({ title: "FGT.Kiritsugu.PreShotSpell", by: "p1", decline: true });
      // The shot opens its own Combat Phase, where Reinforcement is offered (reading 1).
      w.answer({ title: "FGT.Window.combatPhaseStart", by: "p1", decline: true });
      await w.actor(ATTACKER).update({ "system.health.value": 1 });
      const before = w.actor(MEDEA).system.health.value;
      const id = await declare();

      const { advanceAttack } = await import("../../module/engine/attack.mjs");
      await advanceAttack({ messageId: id, event: `ability:${shot.id}` });

      expect(w.actor(ATTACKER).system.health.value).toBe(0);
      expect(["withdrawn", "done"]).toContain(processOf(w, id).state);
      expect(w.actor(MEDEA).system.health.value).toBe(before);
      expect([...w.messages.values()].some((m) => String(m.content).includes("FGT.Attack.AttackerFell"))).toBe(true);
    }, ENEMY_TURN);
  }, 60_000);

  it("is offered once per Attack, and a survivor's Attack goes on (reading 8)", async () => {
    await withSubjects(board([{ defId: "decoyScapegoat" }]), async ({ world: w }) => {
      const shot = slugOf(w, "suppressionShot");
      w.answer({ title: "FGT.Kiritsugu.PreShotSpell", by: "p1", decline: true });
      // The shot opens its own Combat Phase, where Reinforcement is offered (reading 1).
      w.answer({ title: "FGT.Window.combatPhaseStart", by: "p1", decline: true });
      const id = await declare();

      const { advanceAttack } = await import("../../module/engine/attack.mjs");
      await advanceAttack({ messageId: id, event: `ability:${shot.id}` });

      const after = processOf(w, id);
      expect(after.state).toBe("react");
      expect(after.reactionAbilities[MEDEA].map((a) => a.id)).not.toContain(shot.id);
    }, ENEMY_TURN);
  }, 60_000);

  it("casts a 'Used during your Turn' Spell on the enemy's Turn, inside the trigger (reading 9)", async () => {
    await withSubjects(board([{ defId: "decoyScapegoat" }]), async ({ world: w }) => {
      const shot = slugOf(w, "suppressionShot");
      const penetration = slugOf(w, "penetration");
      w.answer({ title: "FGT.Kiritsugu.PreShotSpell", by: "p1", pick: [penetration.id] });
      w.answer({ title: "FGT.Window.combatPhaseStart", by: "p1", decline: true });
      const id = await declare();

      const { advanceAttack } = await import("../../module/engine/attack.mjs");
      await advanceAttack({ messageId: id, event: `ability:${shot.id}` });

      expect(w.actor(KIRITSUGU).items.get(penetration.id).system.cooldown.remaining).toBeGreaterThan(0);
      expect(held(w, KIRITSUGU)).toContain("penetration");
    }, ENEMY_TURN);
  }, 60_000);

  it("refuses the same Spell outside the trigger on the enemy's Turn, as the sheet's moment says", () => {
    // `anyMoment` is the trigger's, and only the engine sets it.
    const spec = { id: "p", contentId: "p", timing: { window: "ownTurn" }, cooldown: { remaining: 0, gatedDelay: 0 } };
    const unit = { id: "k", factionId: "A", effects: [], turnState: {}, abilities: [] };
    expect(canUseAbility({ ability: spec, unit, round: 3, turn: 7, actingFactionId: "B" }).reason).toBe("notOwnTurn");
    expect(canUseAbility({ ability: spec, unit, round: 3, turn: 7, actingFactionId: "B", anyMoment: true }).ok).toBe(true);
  });
});

describe("Invuln against a Noble Phantasm (Appendix A; #243 reading 11)", () => {
  const unit = (o = {}) => ({
    baseAttack: { str: 0, mag: 0 }, parameters: {}, effects: [], modifiers: [], health: 1000,
    shield: 0, magicResistance: null, outsideZon: false, ...o,
  });
  const ctx = (kind, invulnFactor) => ({
    attacker: unit({ baseAttack: { str: 300, mag: 0 } }), defender: unit({ effects: ["invuln"] }), board: {},
    attack: { kind, rank: null, categorizedAsNP: false, element: null, ...(invulnFactor ? { invulnFactor } : {}) },
    base: { sources: [{ unit: "self", component: "str", factor: 1 }] }, multiplier: 1, flatBonus: 0,
    crit: { isCrit: false, chanceUsed: 0 }, reaction: { kind: "none" }, luckChecks: {}, rolls: {}, options: new Set(),
  });

  it("cuts an NP by 50%: it cut nothing", () => {
    expect(computeDamage(ctx("np")).total).toBe(150);
  });

  it("cuts it by 25% under Penetration, which halves the effect of Invuln", () => {
    const r = computeDamage(ctx("np", 0.5));
    expect(r.total).toBe(225);
    expect(r.flags.negatedBy).not.toBe("Invuln");
  });

  it("still negates a Normal Attack, and Penetration still halves that", () => {
    expect(computeDamage(ctx("normal")).total).toBe(0);
    expect(computeDamage(ctx("normal", 0.5)).total).toBe(150);
  });
});

describe("a clamped restore names a value, not a pool (#243, live)", () => {
  it("resolves every authored clamped change to a `.value` path", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const yaml = (await import("js-yaml")).default;
    const { resourcePathFor } = await import("../../module/domain/resources.mjs");
    const dir = new URL("../../packs/_source/abilities/", import.meta.url);
    const changes = readdirSync(dir).flatMap((f) => (yaml.load(readFileSync(new URL(f, dir), "utf8"))?.phases ?? [])
      .filter((p) => p.kind === "resource").flatMap((p) => p.changes ?? []).filter((c) => c.clampToMax)
      .map((c) => [f, c.key]));
    expect(changes.length).toBeGreaterThan(5);
    for (const [f, key] of changes) expect(resourcePathFor(key), f).toMatch(/\.value$/);
  });
});

describe("a handler's `then:` names an action the scheduler runs (#243, live)", () => {
  it("walks every OnEvent in the content", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const yaml = (await import("js-yaml")).default;
    const { ACTION_KINDS } = await import("../../module/engine/scheduler.mjs");
    const root = new URL("../../packs/_source/", import.meta.url);
    const found = [];
    const walk = (node, file) => {
      if (Array.isArray(node)) return node.forEach((n) => walk(n, file));
      if (!node || typeof node !== "object") return;
      if (node.key === "OnEvent") for (const a of node.then ?? []) found.push([file, a.key ?? a.kind]);
      Object.values(node).forEach((v) => walk(v, file));
    };
    const files = (dir) => readdirSync(dir).flatMap((f) => {
      const u = new URL(f, dir);
      return statSync(u).isDirectory() ? files(new URL(`${f}/`, dir)) : (f.endsWith(".yml") ? [u] : []);
    });
    for (const u of files(root)) walk(yaml.load(readFileSync(u, "utf8")), u.pathname.split("/_source/")[1]);
    expect(found.length).toBeGreaterThan(20);
    // Magecraft named `DurationExtension`, an element: "unhandledAction", nothing extended.
    for (const [file, kind] of found) expect(ACTION_KINDS, `${file}: ${kind}`).toContain(kind);
  });
});

describe("the free Spell does not count towards the Turn's one (#243 reading 9, live)", () => {
  const unit = (turnState) => ({
    categoryUseLimits: [{ category: "thaumaturgy", perTurn: 1 }],
    abilities: [
      { id: "p", contentId: "kiritsugu-penetration", category: "thaumaturgy" },
      { id: "r", contentId: "kiritsugu-reinforcement", category: "thaumaturgy" },
    ],
    turnState,
  });
  const reinforcement = { id: "r", contentId: "kiritsugu-reinforcement", category: "thaumaturgy" };

  it("leaves the cap open after a free use, and closes it after an ordinary one", async () => {
    const { categoryLimitFor } = await import("../../module/rules/costs.mjs");
    expect(categoryLimitFor(reinforcement, unit({ abilitiesUsed: ["kiritsugu-penetration"], categoryExempt: ["kiritsugu-penetration"] }))).toBeNull();
    expect(categoryLimitFor(reinforcement, unit({ abilitiesUsed: ["kiritsugu-penetration"], categoryExempt: [] }))).toMatchObject({ category: "thaumaturgy" });
  });

  it("offers nothing at a window the cap would refuse", async () => {
    const { abilitiesAtWindow } = await import("../../module/rules/reactions.mjs");
    const item = { id: "r", system: { contentId: "kiritsugu-reinforcement", category: "thaumaturgy", timing: { window: ["combatPhaseStart"] }, cooldown: { remaining: 0 } } };
    const capped = { ...unit({ abilitiesUsed: ["kiritsugu-penetration"], categoryExempt: [] }), items: [item], effects: [] };
    const free = { ...unit({ abilitiesUsed: ["kiritsugu-penetration"], categoryExempt: ["kiritsugu-penetration"] }), items: [item], effects: [] };
    expect(abilitiesAtWindow(capped, "combatPhaseStart")).toEqual([]);
    expect(abilitiesAtWindow(free, "combatPhaseStart").map((i) => i.id)).toEqual(["r"]);
  });
});

describe("Presence Concealment clause 7 reads a phase's own reach (#243, live)", () => {
  it("refuses Affection of the Holy Grail's Active while concealed, and not Scapegoat or an NP", async () => {
    const { readFileSync } = await import("node:fs");
    const yaml = (await import("js-yaml")).default;
    const { canUseWhileConcealed } = await import("../../module/rules/concealment.mjs");
    const { usageSpecFor } = await import("../../module/rules/ability-use.mjs");
    const doc = (f) => usageSpecFor({ id: f, type: "skill", system: yaml.load(readFileSync(new URL(`../../packs/_source/abilities/${f}.yml`, import.meta.url), "utf8")) });
    expect(canUseWhileConcealed(doc("kiritsugu-affection-of-the-holy-grail"))).toEqual({ ok: false, reason: "presenceConcealment" });
    expect(canUseWhileConcealed(doc("kiritsugu-scapegoat")).ok).toBe(true);
    expect(canUseWhileConcealed(doc("kiritsugu-chronos-rose")).ok).toBe(true);
  });
});

describe("the use gate sees clause 7's phase reach through the usage spec (#243, live)", () => {
  it("carries every phase's targeting, so a concealed Affection is refused where it is pressed", async () => {
    const { readFileSync } = await import("node:fs");
    const yaml = (await import("js-yaml")).default;
    const { usageSpecFor } = await import("../../module/rules/ability-use.mjs");
    const { canUseWhileConcealed } = await import("../../module/rules/concealment.mjs");
    const sys = yaml.load(readFileSync(new URL("../../packs/_source/abilities/kiritsugu-affection-of-the-holy-grail.yml", import.meta.url), "utf8"));
    const spec = usageSpecFor({ id: "a", type: "skill", system: sys });
    expect(spec.phaseTargeting.length).toBe(1);
    expect(canUseWhileConcealed(spec)).toEqual({ ok: false, reason: "presenceConcealment" });
  });
});
