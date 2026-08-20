/**
 * @file Contracting a Servant.
 * @see docs/16-relationships.md §16.2
 */

import { describe, it, expect } from "vitest";
import {
  canAttemptContract, contractPlan, rollsRequired, contractOutcome,
  conquestContract, CONTRACT_REFUSALS,
} from "../../module/rules/contract.mjs";

const master = (over = {}) => ({
  id: "kayneth", kind: "master", factionId: "red", panel: { i: 5, j: 5 }, ...over,
});

const servant = (over = {}) => ({
  id: "lancer", kind: "servant", factionId: "blue", contract: "free",
  panel: { i: 5, j: 6 }, abilities: [], ...over,
});

const board = (units) => ({ units });

describe("canAttemptContract", () => {
  const m = master();
  const s = servant();

  it("allows an adjacent Master with no enemy nearby", () => {
    expect(canAttemptContract(m, s, board([m, s]))).toMatchObject({ ok: true });
  });

  it("refuses a Servant that is not directly next to it", () => {
    // "must be on a panel next to the target Servant (Chebyshev 1)".
    expect(canAttemptContract(m, servant({ panel: { i: 5, j: 8 } }), board([m, s])))
      .toMatchObject({ ok: false, reason: "notAdjacent" });
  });

  it("refuses when an enemy stands within 2 panels of the CONTRACTOR", () => {
    // "cannot attempt a Contract Servant roll if there is another enemy Unit
    // within a 2 panel area of ITSELF" -- of the Master, not of the Servant.
    const enemy = { id: "e", kind: "servant", factionId: "green", panel: { i: 6, j: 6 } };

    expect(canAttemptContract(m, s, board([m, s, enemy])))
      .toMatchObject({ ok: false, reason: "enemyNearby" });
  });

  it("does not count the target Servant itself as the blocking enemy", () => {
    // The Servant being contracted is an enemy unit standing adjacent, so a
    // naive check refuses every enemy contract there is.
    expect(canAttemptContract(m, s, board([m, s]))).toMatchObject({ ok: true });
  });

  it("does not count an ALLY standing nearby", () => {
    const ally = { id: "a", kind: "servant", factionId: "red", panel: { i: 6, j: 5 } };

    expect(canAttemptContract(m, s, board([m, s, ally]))).toMatchObject({ ok: true });
  });

  it("refuses an already-contracted Servant", () => {
    // "only Unbound and Free Servants are contractible."
    expect(canAttemptContract(m, servant({ contract: "contracted" }), board([m, s])))
      .toMatchObject({ ok: false, reason: "alreadyContracted" });
  });

  it("refuses a contractor that is neither a Master nor a Caster", () => {
    const saber = { ...master(), kind: "servant", servantClass: "saber" };

    expect(canAttemptContract(saber, s, board([saber, s])))
      .toMatchObject({ ok: false, reason: "notAContractor" });
  });

  it("allows a Caster to contract", () => {
    const caster = { ...master(), kind: "servant", servantClass: "caster" };

    expect(canAttemptContract(caster, s, board([caster, s]))).toMatchObject({ ok: true });
  });

  it("names a refusal from the documented set", () => {
    expect(CONTRACT_REFUSALS).toContain(canAttemptContract(m, servant({ panel: { i: 9, j: 9 } }), board([])).reason);
  });
});

describe("contractPlan", () => {
  const m = master();

  it("forbids an ALLIED Master contracting an Unbound Servant", () => {
    // The one row in §16.2's table that is not a roll but a prohibition.
    const s = servant({ contract: "unbound", factionId: "red" });

    expect(contractPlan(m, s, board([m, s]))).toMatchObject({ ok: false, reason: "forbidden" });
  });

  it("gives an allied Master an AUTOMATIC contract on a Free Servant", () => {
    const s = servant({ contract: "free", factionId: "red" });

    expect(contractPlan(m, s, board([m, s]))).toMatchObject({ ok: true, automatic: true, rolls: 0 });
  });

  it("makes an enemy roll a 6 for an Unbound Servant", () => {
    const s = servant({ contract: "unbound" });

    expect(contractPlan(m, s, board([m, s]))).toMatchObject({
      ok: true, automatic: false, formula: "1d6", succeedsOn: [6], rolls: 1,
    });
  });

  it("makes an enemy roll 5 or 6 for a Free Servant", () => {
    expect(contractPlan(m, servant(), board([m, servant()]))).toMatchObject({
      succeedsOn: [5, 6], rolls: 1,
    });
  });

  it("carries the refusal through when the attempt is illegal at all", () => {
    expect(contractPlan(m, servant({ panel: { i: 9, j: 9 } }), board([m])))
      .toMatchObject({ ok: false, reason: "notAdjacent" });
  });
});

describe("rollsRequired — Independent Action", () => {
  const withIA = (rank) => servant({ abilities: [{ slug: "independentAction", rank }] });

  it("multiplies an enemy attempt by the rank", () => {
    // "the Contract Servant roll is used X times ... only if ALL are successful."
    expect(rollsRequired(withIA("A"), true)).toBe(4);
    expect(rollsRequired(withIA("B"), true)).toBe(3);
    expect(rollsRequired(withIA("C"), true)).toBe(2);
    expect(rollsRequired(withIA("D"), true)).toBe(2);
  });

  it("makes EX and A+ uncontractible by enemies entirely", () => {
    // Not "very hard" — impossible. A number here would be a rule that can be
    // beaten by enough attempts, and the text says it cannot.
    expect(rollsRequired(withIA("EX"), true)).toBe(Infinity);
    expect(rollsRequired(withIA("A+"), true)).toBe(Infinity);
  });

  it("does not apply to an ALLIED contractor", () => {
    // Independent Action resists being contracted BY ENEMIES; an ally offering
    // a contract to a Free Servant is not something it defends against.
    expect(rollsRequired(withIA("A"), false)).toBe(1);
  });

  it("is one roll for a Servant without the skill", () => {
    expect(rollsRequired(servant(), true)).toBe(1);
  });
});

describe("contractOutcome", () => {
  const plan = { ok: true, automatic: false, succeedsOn: [5, 6], rolls: 3, servantId: "lancer", contractorId: "kayneth" };

  it("succeeds only when EVERY roll succeeds", () => {
    expect(contractOutcome(plan, [6, 5, 6])).toMatchObject({ success: true });
    expect(contractOutcome(plan, [6, 4, 6])).toMatchObject({ success: false });
  });

  it("fails when fewer rolls were made than required", () => {
    // Not "succeed with what we have": a caller that under-rolls is a bug, and
    // succeeding would hand out a contract that was never earned.
    expect(contractOutcome(plan, [6, 6])).toMatchObject({ success: false, reason: "tooFewRolls" });
  });

  it("succeeds without rolls when the plan is automatic", () => {
    expect(contractOutcome({ ...plan, automatic: true, rolls: 0 }, [])).toMatchObject({ success: true });
  });

  it("grants THREE Command Spells namespaced to that Servant", () => {
    // "gains 3 Command Spells that can only be used on that Servant."
    const out = contractOutcome(plan, [6, 6, 6]);

    expect(out.descriptors).toContainEqual(expect.objectContaining({
      kind: "grantCommandSpells", masterId: "kayneth", servantId: "lancer", count: 3,
    }));
  });

  it("sets the contract itself", () => {
    expect(contractOutcome(plan, [6, 6, 6]).descriptors).toContainEqual(
      expect.objectContaining({ kind: "setContract", unitId: "lancer", contract: "contracted", masterId: "kayneth" }),
    );
  });

  it("produces nothing on a failure", () => {
    expect(contractOutcome(plan, [1, 1, 1]).descriptors).toEqual([]);
  });
});

describe("conquestContract", () => {
  const killer = master({ id: "kiritsugu", factionId: "red" });
  const dead = master({ id: "kayneth", factionId: "blue" });
  const theirs = servant({ id: "lancer", contract: "contracted", masterId: "kayneth" });

  it("contracts the dead Master's Servants to the killing Master", () => {
    const out = conquestContract({ killer, deadMaster: dead, board: board([killer, dead, theirs]) });

    expect(out.descriptors).toContainEqual(expect.objectContaining({
      kind: "setContract", unitId: "lancer", contract: "contracted", masterId: "kiritsugu",
    }));
  });

  it("inherits ALL the dead Master's remaining Command Spells", () => {
    const out = conquestContract({
      killer, deadMaster: { ...dead, commandSpells: 2 }, board: board([killer, dead, theirs]),
    });

    expect(out.descriptors).toContainEqual(expect.objectContaining({
      kind: "grantCommandSpells", masterId: "kiritsugu", servantId: "lancer", count: 2,
    }));
  });

  it("fires for a Servant killer only if it is within 2 panels of ITS OWN Master", () => {
    // §16.2 calls this out: "a lone Servant killing a Master creates a Free
    // Servant that nobody automatically claims."
    const ownMaster = master({ id: "kiritsugu", factionId: "red", panel: { i: 0, j: 0 } });
    const killingServant = servant({ id: "saber", factionId: "red", masterId: "kiritsugu", panel: { i: 9, j: 9 } });

    expect(conquestContract({
      killer: killingServant, deadMaster: dead, board: board([ownMaster, killingServant, dead, theirs]),
    })).toMatchObject({ ok: false, reason: "servantTooFarFromMaster" });
  });

  it("fires when the killing Servant IS within 2 of its Master", () => {
    const ownMaster = master({ id: "kiritsugu", factionId: "red", panel: { i: 0, j: 0 } });
    const killingServant = servant({ id: "saber", factionId: "red", masterId: "kiritsugu", panel: { i: 1, j: 1 } });

    expect(conquestContract({
      killer: killingServant, deadMaster: dead, board: board([ownMaster, killingServant, dead, theirs]),
    })).toMatchObject({ ok: true });
  });

  it("frees and contracts in ONE step, so no intermediate state is observable", () => {
    // §16.2: killing a Master makes its Servants Free *and* immediately
    // contracts them. A descriptor list that set "free" first would let a
    // watcher see a Free Servant that was never Free.
    const out = conquestContract({ killer, deadMaster: dead, board: board([killer, dead, theirs]) });

    expect(out.descriptors.filter((d) => d.contract === "free")).toEqual([]);
  });
});
