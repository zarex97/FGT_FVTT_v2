/**
 * @file The build refuses an Effect Entry key `entryOf` drops (#342).
 * @see tools/lib/content.mjs#entryKeysAreKnown, module/rules/effect-flow.mjs#ENTRY_KEYS
 */

import { describe, it, expect } from "vitest";
import { validateAll } from "../../tools/lib/content.mjs";
import { ENTRY_KEYS, entryOf } from "../../module/rules/effect-flow.mjs";

const ok = (over = {}) => ({ schema: 1, id: "thing", name: "Thing", ...over });
const problems = (doc, dir = "abilities") => validateAll([{ path: "x.yml", dir, doc }]).problems;

/** What one entry adds to a document's problems: the same document with a clean entry is the baseline. */
function added(build, bad, dir) {
  const base = problems(build({ id: "slow", duration: "1◈" }), dir);
  return problems(build(bad), dir).filter((p) => !base.includes(p));
}

const phase = (entry) => ok({ kind: "skill", phases: [{ kind: "applyEffects", effects: [entry] }] });

describe("the build refuses an Effect Entry key entryOf drops", () => {
  it("is the key entryOf drops, so the refusal is not over a key it keeps", () => {
    expect(ENTRY_KEYS.bogusKey).toBeUndefined();
    expect(entryOf({ id: "slow", bogusKey: true })).not.toHaveProperty("bogusKey");
  });

  it("on a phase's entry, naming the file, the path and the key", () => {
    const out = added(phase, { id: "slow", duration: "1◈", bogusKey: true });
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("x.yml: phases[0].effects[0] states \"bogusKey\", which is no Effect Entry key");
  });

  it("on a wrapped entry's effect, and on what the wrapper writes beside it", () => {
    const inner = added(phase, { key: "OnEvent", event: "abilityUsed", effect: { id: "slow", bogusKey: 1 } });
    expect(inner).toEqual([expect.stringContaining("phases[0].effects[0].effect states \"bogusKey\"")]);
    const beside = added(phase, { key: "OnEvent", event: "abilityUsed", effect: { id: "slow" }, bogusKey: 1 });
    expect(beside).toEqual([expect.stringContaining("phases[0].effects[0] states \"bogusKey\"")]);
  });

  it("on an entry's otherwise, which keeps a DU's stats", () => {
    const out = added(phase, { id: "slow", chance: 50, otherwise: { id: "slow", bogusKey: 1 } });
    expect(out).toEqual([expect.stringContaining("phases[0].effects[0].otherwise states \"bogusKey\"")]);
    expect(added(phase, { id: "slow", otherwiseOn: "failed", otherwise: { stats: [{ stat: "luck", delta: -2 }] } })).toEqual([]);
  });

  it("on a check's outcome and an aftermath", () => {
    const check = added((e) => ok({ kind: "skill", phases: [{ kind: "check", onFail: { effects: [e] } }] }), { id: "slow", bogusKey: 1 });
    expect(check).toEqual([expect.stringContaining("phases[0].onFail.effects[0] states \"bogusKey\"")]);
    const after = added((e) => ok({ kind: "noblePhantasm", aftermath: { effects: [e] } }), { id: "slow", bogusKey: 1 });
    expect(after).toEqual([expect.stringContaining("aftermath.effects[0] states \"bogusKey\"")]);
  });

  it("on a handler's ApplyEffect effect, which also spells defId and stage", () => {
    const handler = (effect) => ok({ rules: [{ key: "OnEvent", event: "turnStart", actions: [{ key: "ApplyEffect", effect }] }] });
    const out = added(handler, { id: "slow", bogusKey: 1 }, "effects");
    expect(out).toEqual([expect.stringContaining("rules[0].actions[0].effect states \"bogusKey\"")]);
    expect(added(handler, { defId: "curse", stage: 1 }, "effects")).toEqual([]);
  });

  it("in a Servant's embedded ability", () => {
    const servant = (e) => ({ ...ok({ type: "servant" }), abilities: [{ id: "own", name: "Own", phases: [{ kind: "applyEffects", effects: [e] }] }] });
    const out = added(servant, { id: "slow", bogusKey: 1 }, "servants");
    expect(out).toEqual([expect.stringContaining("abilities[0].phases[0].effects[0] states \"bogusKey\"")]);
  });

  it("passes Balmung's countedOnly, which the list now holds", () => {
    expect(ENTRY_KEYS.countedOnly).toBeDefined();
    expect(added(phase, { id: "slow", count: { of: "stacks", effect: "curse" }, countedOnly: true })).toEqual([]);
  });
});
