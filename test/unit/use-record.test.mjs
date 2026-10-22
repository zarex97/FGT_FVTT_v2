/**
 * @file The Use record: what one use of an ability did (#320, #285).
 * @see module/rules/use-record.mjs, docs/superpowers/plans/2026-10-22-count-and-use-record.md (Task 10)
 */

import { describe, it, expect } from "vitest";
import {
  USE_FACTS, emptyUseRecord, noteLanding, noteFact, mergeRecords, useFacts, useOptions,
} from "../../module/rules/use-record.mjs";
import { parseOption } from "../../module/rules/facets.mjs";

const landing = (defId, polarity, outcome, targetId = "du") => ({ defId, polarity, outcome, targetId });

describe("the facts a Use record holds", () => {
  it("are the ones the grill settled (Q7), frozen", () => {
    expect(USE_FACTS).toEqual([
      "failed", "missed", "evaded", "unitsHit", "effectsApplied", "debuffsInflicted",
      "summoned", "criteriaMet", "die", "overCooldown", "channelStarted", "concealmentBroken",
    ]);
    expect(Object.isFrozen(USE_FACTS)).toBe(true);
  });

  it("starts with every fact empty", () => {
    const facts = useFacts(emptyUseRecord({ abilityId: "a", unitId: "u" }));
    expect(facts).toMatchObject({
      failed: false, missed: false, evaded: false, unitsHit: 0, effectsApplied: 0, debuffsInflicted: 0,
      summoned: 0, criteriaMet: 0, die: null, overCooldown: false, channelStarted: false, concealmentBroken: false,
    });
    expect([...facts.applied]).toEqual([]);
  });
});

describe("what it applied and inflicted", () => {
  it("counts the landings that applied, and of them the debuffs, by their landed polarity", () => {
    const r = emptyUseRecord({ abilityId: "a", unitId: "u" });
    noteLanding(r, landing("bleed", "debuff", "applied"));
    noteLanding(r, landing("poison", "debuff", "applied", "du2"));
    noteLanding(r, landing("atkUp", "buff", "resisted"));
    noteLanding(r, landing("atkUp", "buff", "applied", "u"));
    const facts = useFacts(r);
    // The resisted one is not "applied".
    expect(facts.effectsApplied).toBe(3);
    expect(facts.debuffsInflicted).toBe(2);
    expect([...facts.applied].sort()).toEqual(["atkUp", "bleed", "poison"]);
  });
});

describe("a fact the record does not hold", () => {
  it("is refused by name", () => {
    expect(() => noteFact(emptyUseRecord({}), "bogus", true)).toThrow(/bogus/);
  });
});

describe("one declaration's Processes", () => {
  it("merge into one record: landings together, a flag true if any Process raised it", () => {
    const a = emptyUseRecord({ abilityId: "np", unitId: "u" });
    const b = emptyUseRecord({ abilityId: "np", unitId: "u" });
    noteFact(a, "criteriaMet", 3);
    noteFact(b, "criteriaMet", 3);
    noteLanding(a, landing("defDwn", "debuff", "applied", "d1"));
    noteLanding(b, landing("defDwn", "debuff", "applied", "d2"));
    noteFact(b, "evaded", true);
    const facts = useFacts(mergeRecords([a, b]));
    expect(facts.debuffsInflicted).toBe(2);
    expect(facts.evaded).toBe(true);
    // A commit fact is the declaration's, taken once.
    expect(facts.criteriaMet).toBe(3);
  });

  it("survives the Process state's JSON round trip unchanged", () => {
    const r = emptyUseRecord({ abilityId: "np", unitId: "u" });
    noteLanding(r, landing("defDwn", "debuff", "applied"));
    noteFact(r, "overCooldown", true);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
    expect(useFacts(JSON.parse(JSON.stringify(r)))).toMatchObject({ debuffsInflicted: 1, overCooldown: true });
  });
});

describe("the use: options a settled cooldown's predicate reads (Q9)", () => {
  it("are the flags that hold, the effects applied, and the die", () => {
    const r = emptyUseRecord({});
    noteFact(r, "missed", true);
    noteFact(r, "die", 4);
    noteLanding(r, landing("burn", "debuff", "applied"));
    expect([...useOptions(useFacts(r))].sort()).toEqual(["use:applied:burn", "use:die:4", "use:missed"]);
  });

  it("are options the predicate grammar admits", () => {
    for (const o of ["use:failed", "use:missed", "use:evaded", "use:overCooldown", "use:channelStarted",
      "use:concealmentBroken", "use:applied:burn", "use:die:4"]) {
      expect(parseOption(o), o).not.toBeNull();
    }
    expect(parseOption("use:bogus")).toBeNull();
  });
});
