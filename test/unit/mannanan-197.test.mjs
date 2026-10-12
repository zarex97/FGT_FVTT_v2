/**
 * @file Mannanán's audit rulings (#197) that changed the engine.
 * @see docs/33-case-mannanan.md
 *
 * - reading 3: Tradition Carrier's +30% lasts *"that Combat Phase"*, so a
 *   duration authored `until <event>` must end on that event. It never did:
 *   the duration parsed, stamped no clock, and nothing removed the instance.
 * - reading 5: the ⅓◈ extension reaches a ◈ length only.
 * - reading 11: one Fragarach Counter per attacker per Combat Phase, after that
 *   attacker's last Process against her.
 * - reading 15: Holder Mode takes her at her defeat without asking.
 * - Q1: a Stun stops the counter it provoked (kept; `flushAutoCounters`).
 * - Q2: c and d come from performing the counter, so a Dodge leaves them.
 * - Q3: every hit of a Riding Attack is at Range 1.
 */

import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { applyEffect } from "../../module/engine/effect-applier.mjs";
import { fireEvent } from "../../module/engine/scheduler.mjs";
import { provoke, takePending, pendingCount } from "../../module/engine/auto-counter.mjs";
import { prepareSubjects } from "../helpers/subject.mjs";
import { installClientNamespace } from "../helpers/client-namespace.mjs";

const buff = { id: "critUp", name: "Crit Up", polarity: "buff", baseChance: 100 };
const bearer = (extra = {}) => ({
  id: "mann", name: "Mannanán", kind: "servant", effects: [], attributes: [], applicationChances: [],
  durationExtensions: [{ amount: "⅓◈", appliesTo: "buffs", direction: "incoming", source: "Tradition Carrier" }],
  ...extra,
});
const apply = (duration, target = bearer()) => applyEffect({
  def: buff, target, duration, magnitude: 30,
  source: { unitId: "mann", abilityId: "tc" },
  ctx: { turnsPerRound: 3, currentTick: 4, roll: 1, options: new Set() },
});
const created = (out) => out.intents.find((i) => i.t === "applyEffect")?.effect;

describe("an `until <event>` duration ends on that event (reading 3)", () => {
  it("is stamped with the event and no clock", () => {
    const effect = created(apply("until combatPhaseEnd"));
    expect(effect.endsOn).toBe("combatPhaseEnd");
    expect(effect.expiry).toBeNull();
  });

  it("is removed when the event fires on its bearer, and only then", () => {
    const unit = { id: "mann", eventHandlers: [], effectInstances: [{ id: "e1", defId: "critUp", endsOn: "combatPhaseEnd" }] };
    const ctx = { tick: 4, turnsPerRound: 3, options: new Set() };
    expect(fireEvent("combatProcessEnd", [unit], ctx).filter((i) => i.t === "removeEffect")).toEqual([]);
    expect(fireEvent("combatPhaseEnd", [unit], ctx).filter((i) => i.t === "removeEffect"))
      .toEqual([expect.objectContaining({ unitId: "mann", effectId: "e1" })]);
  });

  it("Tradition Carrier's spend is authored that way", () => {
    const carrier = parse(readFileSync("packs/_source/abilities/mannanan-tradition-carrier.yml", "utf8"));
    const spend = carrier.passiveRules.find((r) => r.key === "OptionalCost");
    expect(spend.effects[0]).toMatchObject({ id: "critUp", magnitude: 30, duration: "until combatPhaseEnd" });
  });
});

describe("Tradition Carrier P4 extends a ◈ length only (reading 5)", () => {
  it("⅓◈ becomes ⅔◈", () => {
    expect(created(apply("⅓◈")).expiry).toBe(4 + 2);
  });

  it("\"this turn\" stays this Turn", () => {
    expect(created(apply("this turn")).expiry).toBe(4);
  });

  it("an `until` duration is given no clock", () => {
    expect(created(apply("until combatPhaseEnd")).expiry).toBeNull();
  });
});

describe("one Fragarach Counter per attacker per Combat Phase (reading 11)", () => {
  const unit = { id: "mann", autoCounters: [{ on: ["attacked", "debuffed"], ability: "fc", source: "Fragarach" }] };
  beforeEach(() => takePending());

  it("holds a provocation while the attacker still owes a Process against her", () => {
    provoke({ bearer: unit, provokerId: "raikou", cause: "attacked" });
    const open = new Set(["mann:raikou"]);
    expect(takePending((p) => open.has(`${p.bearerId}:${p.provokerId}`))).toEqual([]);
    expect(pendingCount()).toBe(1);
    // A second hit of the same declaration adds nothing.
    provoke({ bearer: unit, provokerId: "raikou", cause: "attacked" });
    expect(pendingCount()).toBe(1);
    // After the last Process, one Counter.
    expect(takePending(() => false)).toHaveLength(1);
  });

  it("releases another attacker's provocation at once", () => {
    provoke({ bearer: unit, provokerId: "raikou", cause: "attacked" });
    provoke({ bearer: unit, provokerId: "medusa", cause: "debuffed" });
    const open = new Set(["mann:raikou"]);
    const out = takePending((p) => open.has(`${p.bearerId}:${p.provokerId}`));
    expect(out.map((p) => p.provokerId)).toEqual(["medusa"]);
  });

  it("the engine holds them by the Phase's open Processes", () => {
    const src = readFileSync("module/engine/attack.mjs", "utf8");
    const body = src.slice(src.indexOf("export async function flushAutoCounters"));
    expect(body.slice(0, 2500)).toMatch(/takePending\(holds\)/);
  });
});

describe("Fragarach's reflect is computed against its user (reading 13)", () => {
  it("swaps the defender for single-target and area Noble Phantasms alike", () => {
    const src = readFileSync("module/engine/attack.mjs", "utf8");
    const body = src.slice(src.indexOf("async function resolveNPCancellation"), src.indexOf("export function counterfactualAttack"));
    expect(body).toMatch(/defenderUnit: attackerUnit,/);
    expect(body).not.toMatch(/defenderUnit: aoe/);
  });
});

describe("the Fragarach Counter is not a button", () => {
  it("is authored at the automatic window, which the bar never offers", async () => {
    const { classifyAbility } = await import("../../module/rules/ability-use.mjs");
    const counter = parse(readFileSync("packs/_source/abilities/mannanan-fragarach-counter.yml", "utf8"));
    expect(counter.timing).toEqual({ window: "automatic" });
    expect(classifyAbility({ type: "ability", system: counter }).clickable).toBe(false);
  });
});

describe("Fragarach's Instakill says what the die did (reading 14)", () => {
  it("words a resisted Instakill as resisted, with the roll", () => {
    const src = readFileSync("module/engine/attack.mjs", "utf8");
    const body = src.slice(src.indexOf("async function resolveNPCancellation"), src.indexOf("export function counterfactualAttack"));
    expect(body).toMatch(/applied\.outcome === "applied"/);
    expect(body).toMatch(/FGT\.CancelNP\.InstakillResisted/);
    const lang = JSON.parse(readFileSync("lang/en.json", "utf8"));
    expect(lang["FGT.CancelNP.InstakillResisted"]).toMatch(/\{detail\}/);
    expect(lang["FGT.CancelNP.Instakill"]).toMatch(/\{detail\}/);
  });
});

describe("an automatic counter and a cancellation are Acts", () => {
  const src = readFileSync("module/engine/attack.mjs", "utf8");
  it("the automatic counter stamps its bearer acted", () => {
    const body = src.slice(src.indexOf("export async function flushAutoCounters"), src.indexOf("export async function flushAutoCounters") + 6000);
    expect(body).toMatch(/I\.markTurn\(bearer\.id, \{ acted: true \}\)/);
  });
  it("Fragarach's cancel stamps its user acted", () => {
    const body = src.slice(src.indexOf("async function resolveNPCancellation"), src.indexOf("export function counterfactualAttack"));
    expect(body).toMatch(/I\.markTurn\(cancellerDoc\.id, \{ acted: true \}\)/);
  });
});

describe("Holder Mode revives her once (reading 15)", () => {
  it("is not available once Holder Mode is on, whatever she holds", async () => {
    const { collectContributions } = await import("../../module/rules/elements.mjs");
    const { availableRevivals } = await import("../../module/rules/revival.mjs");
    const possession = parse(readFileSync("packs/_source/abilities/mannanan-gods-holder-possession.yml", "utf8"));
    const out = collectContributions([{ id: "possession", name: "God's Holder: Possession", passiveRules: possession.passiveRules }]);
    const unit = (active) => ({
      revivals: out.revivals.map((r) => ({ ...r, charges: 1 })),
      resources: { fragarachTokens: { value: 3, max: 7 } },
      abilities: [{ id: "possession", slug: "godsHolderPossession", active }],
    });
    expect(availableRevivals(unit(false))).toHaveLength(1);
    expect(availableRevivals(unit(true))).toEqual([]);
  });
});

describe("the counter's c and d come from performing it (Q2)", () => {
  const counter = parse(readFileSync("packs/_source/abilities/mannanan-fragarach-counter.yml", "utf8"));
  it("c waits for the ladder to close, whatever it decided, not for the hit", () => {
    const c = counter.phases.find((p) => p.kind === "cooldown");
    expect(c.when).toBe("afterProcess");
  });
  it("d is a caster phase, paid at declaration", async () => {
    const { CASTER_PHASES } = await import("../../module/engine/skill-use.mjs");
    expect(counter.phases.find((p) => p.kind === "resource").when).toBeUndefined();
    expect(CASTER_PHASES.has("resource")).toBe(true);
  });
  it("a and b still ride the hit", () => {
    const riders = counter.phases.filter((p) => p.kind === "applyEffects");
    expect(riders).toHaveLength(2);
    expect(riders.every((p) => p.when === undefined)).toBe(true);
  });
});

describe("a Unit struck in passing is at Range 1 (Q3)", () => {
  beforeAll(async () => { await prepareSubjects(); installClientNamespace(); }, 60_000);
  const holder = {
    id: "mann", panel: { i: 0, j: 0 },
    normalAttack: {
      mode: "rangeBanded", component: "str",
      bands: [
        { from: 1, to: 2, component: "str", sources: [{ component: "str", factor: 1 }, { component: "mag", factor: 0.3 }], ignoresMagicResistance: true },
        { from: 3, component: "mag", sources: [{ component: "mag", factor: 1 }] },
      ],
    },
  };
  const medea = { id: "medea", panel: { i: 3, j: 0 } };

  it("a ride's hit takes the Range 1–2 band wherever the ride ended", async () => {
    const { attackFacts } = await import("../../module/engine/attack.mjs");
    const ride = attackFacts(holder, medea, { attack: { kind: "normal", ride: { hitCount: 2 } } }, { units: [] });
    expect(ride.range).toBe(1);
    expect(ride.ignoresMagicResistance).toBe(true);
  });

  it("a plain Normal Attack is still measured", async () => {
    const { attackFacts } = await import("../../module/engine/attack.mjs");
    const shot = attackFacts(holder, medea, { attack: { kind: "normal" } }, { units: [] });
    expect(shot.range).toBe(3);
    expect(shot.ignoresMagicResistance).toBe(false);
  });
});
