/**
 * @file Raikou's audit, #195: what the live press found.
 */

import { readFileSync } from "node:fs";
import { describe, it, expect, beforeAll } from "vitest";
import { prepareSubjects, subject } from "../helpers/subject.mjs";
import { installClientNamespace } from "../helpers/client-namespace.mjs";
import { fireEvent } from "../../module/engine/scheduler.mjs";

describe("an effect in its last Turn still acts inside that Turn", () => {
  beforeAll(async () => { await prepareSubjects(); installClientNamespace(); }, 60_000);

  // Raikou carrying Crit DmUp (Martial) to tick 4, through the real projection.
  const raikou = () => subject({ from: "raikou", effects: [{ defId: "critDmUpMartial", expiry: 4, uses: 3 }] });

  it("spends Crit DmUp (Martial)'s use on a crit the Turn it expires", async () => {
    const unit = await raikou();
    const out = fireEvent("damageDealt", [unit], { tick: 4, turnsPerRound: 3, options: new Set(["attack:crit", "attack:kind:normal"]) });
    expect(out.some((i) => i.t === "consumeUse")).toBe(true);
  }, 120_000);

  it("still does not act at a boundary it ends on", async () => {
    const unit = await raikou();
    const handlers = (unit.eventHandlers ?? []).map((h) => ({ ...h, event: "turnEnd" }));
    expect(fireEvent("turnEnd", [{ ...unit, eventHandlers: handlers }], { tick: 4, turnsPerRound: 3 }).some((i) => i.t === "consumeUse")).toBe(false);
  }, 120_000);
});

describe("each damage instance resolves under its own block", () => {
  beforeAll(async () => { await prepareSubjects(); installClientNamespace(); }, 60_000);

  it("damageBlockFor takes the instance's block over the ability's", async () => {
    const { damageBlockFor } = await import("../../module/engine/attack.mjs");
    const { expandInstances } = await import("../../module/rules/damage/instances.mjs");
    const damage = {
      instances: [
        { multiplier: 0.5, component: "str", kind: "normal", element: "lightning", elementFraction: 0.5 },
        { multiplier: 3.5, flatBonus: 200, component: "mag", kind: "np", element: "lightning" },
      ],
    };
    const ability = { system: { damage } };
    const [sub, np] = expandInstances(damage);
    expect(damageBlockFor(ability, new Set(), { instanceBlock: sub })).toMatchObject({ multiplier: 0.5, element: "lightning" });
    expect(damageBlockFor(ability, new Set(), { instanceBlock: np })).toMatchObject({ multiplier: 3.5, flatBonus: 200, component: "mag" });
  }, 120_000);
});

describe("one Counter per target after a multi-instance Noble Phantasm (reading 17)", () => {
  it("withholds the Counter from every instance but the last", () => {
    const src = readFileSync(new URL("../../module/engine/attack.mjs", import.meta.url), "utf8");
    const fn = src.slice(src.indexOf("function counterAvailable(state) {"), src.indexOf("function counterAvailable(state) {") + 500);
    expect(fn).toMatch(/instanceIndex \?\? 0\) < state\.attack\.instanceCount - 1\) return false/);
  });
});

describe("Tenmōkaikai makes her element-less attacks Lightning (half)", () => {
  it("an AttackProperty carries a string value through", async () => {
    const { EXECUTORS, empty } = await import("../../module/rules/elements.mjs");
    const out = empty();
    EXECUTORS.AttackProperty({ property: "element", value: "lightning" }, { rank: null, source: "T", out, ctx: {} });
    EXECUTORS.AttackProperty({ property: "elementFraction", value: 0.5 }, { rank: null, source: "T", out, ctx: {} });
    expect(out.attackProperties.map((p) => [p.property, p.value])).toEqual([["element", "lightning"], ["elementFraction", 0.5]]);
  });
});

describe("the granted element reaches the attack's facts (#195)", () => {
  beforeAll(async () => { await prepareSubjects(); installClientNamespace(); }, 60_000);

  const raikou = {
    id: "r", panel: { i: 0, j: 0 },
    attackProperties: [{ property: "element", value: "lightning" }, { property: "elementFraction", value: 0.5 }],
  };
  const foe = { id: "f", panel: { i: 1, j: 0 } };

  it("fills an element-less attack, so `attack:element:lightning` sees it", async () => {
    const { attackFacts } = await import("../../module/engine/attack.mjs");
    const facts = attackFacts(raikou, foe, { attack: { kind: "skill" } }, { units: [] });
    expect(facts).toMatchObject({ element: "lightning", elementFraction: 0.5 });
  }, 120_000);

  it("leaves an attack with its own element alone", async () => {
    const { attackFacts } = await import("../../module/engine/attack.mjs");
    const facts = attackFacts(raikou, foe, { attack: { kind: "skill", element: "fire" } }, { units: [] });
    expect(facts.element).toBe("fire");
    expect(facts.elementFraction).toBeUndefined();
  }, 120_000);
});

describe("a rider the target resisted says so on the card (#195)", () => {
  it("names the effect each chance roll gates", async () => {
    const { pendingRolls } = await import("../../module/engine/scheduler.mjs");
    const usui = { id: "u", eventHandlers: [{ event: "damageDealt", actions: [{ kind: "ApplyEffect", effect: { id: "disable" }, chance: 50 }] }] };
    expect(pendingRolls(usui, "damageDealt")[0]).toMatchObject({ chance: 50, effectId: "disable" });
  });

  it("files the verdict after the effect resolved, with the resisted chance", () => {
    const src = readFileSync(new URL("../../module/engine/attack.mjs", import.meta.url), "utf8");
    const fn = src.slice(src.indexOf("async function fireDamageDealt("), src.indexOf("async function fireDamageTaken("));
    expect(fn.indexOf("await applyBatch(intents")).toBeLessThan(fn.indexOf("rollLog.record("));
    expect(fn).toMatch(/resisted \(\$\{lost\.chance\}\)/);
    const applier = readFileSync(new URL("../../module/engine/applier.mjs", import.meta.url), "utf8");
    expect(applier).toMatch(/landEntry\(/);
    const landing = readFileSync(new URL("../../module/engine/landing.mjs", import.meta.url), "utf8");
    expect(landing).toMatch(/if \(outcome === "resisted"\) \{[\s\S]{0,400}kind: "effectResisted"/);
  });
});

describe("Tenmōkaikai's limit is a moment, not a state (#195)", () => {
  const board = (h) => ({ units: [{ id: "r", kind: "servant", masterId: "m" }, { id: "m", kind: "master", health: h }] });
  const raikou = { id: "r", kind: "servant", masterId: "m" };

  it("is not forced off between upkeeps, whatever her Master's Health", async () => {
    const { forcedOffNow } = await import("../../module/rules/modes.mjs");
    const { readFileSync: read } = await import("node:fs");
    const { parse } = await import("yaml");
    const tk = parse(read(new URL("../../packs/_source/abilities/raikou-tenmokaikai.yml", import.meta.url), "utf8"));
    const item = { system: { ...tk, isMode: true, active: true } };
    expect(forcedOffNow(item, raikou, board(1))).toBe(false);
  });

  it("while Mad Enhancement's states its limit at any moment", () => {
    // LF whatever the checkout: Git on Windows writes CRLF, and `\n` then
    // matched nothing.
    const src = readFileSync(new URL("../../packs/_source/class-skills/mad-enhancement.yml", import.meta.url), "utf8")
      .replace(/\r\n/g, "\n");
    expect(src).toMatch(/lteTable: madEnhancementDrain \}\n(\s+#.*\n)*\s+atAnyMoment: true/);
  });
});

// A mode's end starting its countFrom-deactivation cooldown is played, not
// read: `tenmokaikai-cooldown.test.mjs` switches the mode off in the test world,
// whose hooks now fire, and watches the cooldown land.

describe("Tenmōkaikai's upkeep: her own Turn, and any Turn she or a copy Acts (#195)", () => {
  const handler = {
    event: "anyTurnEnd", source: "Goō Shōrai・Tenmōkaikai", abilityId: "tk",
    targetPredicate: [{ or: ["self:ownTurn", "self:selfOrSummonsActed"] }],
    actions: [{ kind: "Message", text: "upkeep" }],
  };
  const raikou = (extra) => ({ id: "r", kind: "servant", factionId: "faction-1", eventHandlers: [handler], ...extra });
  const fire = (unit, activeFactionId) =>
    fireEvent("anyTurnEnd", [unit], { tick: 22, turnsPerRound: 3, activeFactionId, board: { units: [unit] } })
      .filter((i) => i.entry?.text === "upkeep");

  it("charges at the end of her own Turn though she only switched it on", () => {
    expect(fire(raikou({ acted: false, selfOrSummonsActed: false }), "faction-1")).toHaveLength(1);
  });

  it("charges at an enemy Turn's end when a copy Acted", () => {
    expect(fire(raikou({ acted: false, selfOrSummonsActed: true }), "faction-2")).toHaveLength(1);
  });

  it("does not charge an enemy Turn nobody of hers Acted in", () => {
    expect(fire(raikou({ acted: false, selfOrSummonsActed: false }), "faction-2")).toHaveLength(0);
  });
});

describe("an Evade or a Block is an Act (#195 reading 12)", () => {
  it("marks the defender acted once the rung is taken", () => {
    const src = readFileSync(new URL("../../module/engine/attack.mjs", import.meta.url), "utf8");
    const fn = src.slice(src.indexOf("export async function advanceAttack("), src.indexOf("// Drive through every state that needs no human input"));
    expect(fn).toMatch(/state\.state === "react" && \(event === "evade" \|\| event === "block"\)/);
    expect(fn).toMatch(/if \(reacting && state\.state !== "react"\) \{\s*await applyBatch\(\[I\.markTurn\(reacting, \{ acted: true \}\)\]/);
  });
});

describe("the Turn end says which mode it ended (#195)", () => {
  it("names the mode, its bearer and the handler", async () => {
    const { turnEndCard } = await import("../../module/engine/turn-report.mjs");
    const t = (key, d) => `${key}|${d?.ability}|${d?.who}|${d?.source}`;
    const card = turnEndCard(
      [{ t: "setMode", unitId: "r", abilityId: "tenmokaikai", active: false, source: "Goō Shōrai・Tenmōkaikai" }],
      (id) => (id === "r" ? "Raikou" : id), t, (_u, a) => (a === "tenmokaikai" ? "Tenmōkaikai" : a),
    );
    expect(card).toContain("FGT.TurnReport.ModeEnded|Tenmōkaikai|Raikou|Goō Shōrai・Tenmōkaikai");
  });
});

describe("a queued Mode End can be taken back (#195 reading 14)", () => {
  const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

  it("the sheet's second press asks the GM to cancel it", () => {
    const src = read("module/apps/actor-sheet/sheet.mjs");
    expect(src).toMatch(/if \(isQueued\(item\.id\)\) \{\s*const out = await FGTSocket\.request\("cancelModeEnd"/);
    expect(src.indexOf('request("cancelModeEnd"')).toBeLessThan(src.indexOf('request("queueModeEnd"'));
  });

  it("the GM removes only that entry from the queue", () => {
    const src = read("module/engine/queued-ends.mjs");
    expect(src).toMatch(/queuedEnds\(combat\)\.filter\(\(e\) => e\.id !== id\)/);
    expect(read("module/net/operations.mjs")).toMatch(/cancelModeEnd: \{[\s\S]*cancelEnd\(item\.id\)/);
  });

  it("the bar says the End waits and a press cancels it", () => {
    expect(read("module/apps/hud/action-bar.mjs")).toMatch(/if \(ending && isQueued\(item\.id\)\)[\s\S]{0,120}FGT\.HUD\.EndQueuedCancel/);
    expect(JSON.parse(read("lang/en.json"))["FGT.HUD.EndQueuedCancel"]).toMatch(/Press to cancel/);
  });
});

describe("a mode's refusal reads as a sentence on the bar (#195)", () => {
  it("every reason canToggleMode gives has its FGT.Mode text", () => {
    const src = readFileSync(new URL("../../module/rules/modes.mjs", import.meta.url), "utf8");
    const fn = src.slice(src.indexOf("export function canToggleMode("), src.indexOf("\n}\n", src.indexOf("export function canToggleMode(")));
    const reasons = [...new Set([...fn.matchAll(/reason: "(\w+)"/g)].map((m) => m[1]))];
    const lang = JSON.parse(readFileSync(new URL("../../lang/en.json", import.meta.url), "utf8"));
    expect(reasons.length).toBeGreaterThan(4);
    expect(reasons.filter((r) => !lang[`FGT.Mode.${r}`])).toEqual([]);
  });

  it("the bar shows that text for a mode it cannot end", () => {
    const src = readFileSync(new URL("../../module/apps/hud/action-bar.mjs", import.meta.url), "utf8");
    expect(src).toMatch(/if \(ending && !verdict\.ok\) return \{ \.\.\.slot, group: "mode", tooltip: verdict\.text \};/);
  });
});

describe("the last copy standing is the last, bodies notwithstanding (#195)", () => {
  it("does not count a defeated copy still on the board", async () => {
    const { annotateLastOfSummonGroup } = await import("../../module/rules/snapshot.mjs");
    const units = [
      { id: "r", kind: "servant" },
      { id: "w", kind: "summon", summonerId: "r", defeated: true },
      { id: "s", kind: "summon", summonerId: "r", defeated: true },
      { id: "u", kind: "summon", summonerId: "r", defeated: true },
      { id: "y", kind: "summon", summonerId: "r" },
    ];
    annotateLastOfSummonGroup(units);
    expect(units.find((u) => u.id === "y").lastOfSummonGroup).toBe(true);
  });
});

describe("a Counter is its own fan-out, not its parent's (#195)", () => {
  it("counts siblings by group AND attacker", () => {
    const src = readFileSync(new URL("../../module/engine/attack.mjs", import.meta.url), "utf8");
    const fn = src.slice(src.indexOf("function siblingMessages(state) {"), src.indexOf("function siblingMessages(state) {") + 900);
    expect(fn).toMatch(/sibling\.groupId === state\.groupId && sibling\.attackerId === state\.attackerId/);
  });
});

describe("what a deferred handler did at the Turn's end is said too (#195)", () => {
  it("posts the Turn-end card for the deferred intents", () => {
    const src = readFileSync(new URL("../../module/engine/scheduler-hooks.mjs", import.meta.url), "utf8");
    // The clocks are read before the run since #209's review, so the card says what a cut took.
    expect(src).toMatch(/const owed = scheduler\.runDeferred\(due, board, ctx\);\s*const owedClocks = clocksBefore\(owed, remainingOnActor\);\s*await run\(owed, "scheduler:deferred", ended\);[\s\S]{0,200}await postTurnEndReport\(owed, owedClocks\);/);
  });
});
