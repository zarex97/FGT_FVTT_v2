/**
 * @file Overpower, Underpower, Sustainability and the multi-Servant tax.
 * @see docs/16-relationships.md §16.5, §16.6, §16.7
 */

import { describe, it, expect } from "vitest";
import {
  overpowerCheck, resolveOverpower, underpowerCheck, resolveUnderpower,
  onMasterDefeated, sustainabilityCostOf, multiServantTax, mayOrderAnotherServant,
} from "../../module/rules/relationships.mjs";

const servant = (over = {}) => ({ id: "s", kind: "servant", effects: [], contract: "contracted", ...over });
const master = (over = {}) => ({ id: "m", kind: "master", effects: [], health: { value: 500 }, ...over });

/* ── §16.5 Overpower ──────────────────────────────────────────────────────── */

describe("overpowerCheck", () => {
  it("is a coin flip by default", () => {
    expect(overpowerCheck(servant(), master())).toMatchObject({ applies: true, chance: 50 });
  });

  it("does not apply Servant to Servant", () => {
    // Zero chance and "the rule does not apply" are different facts.
    expect(overpowerCheck(servant(), servant({ id: "s2" })))
      .toMatchObject({ applies: false, reason: "wrongDirection" });
  });

  it("does not apply Master to Master", () => {
    expect(overpowerCheck(master(), master({ id: "m2" }))).toMatchObject({ applies: false });
  });

  it("cannot happen to a Master with Invuln", () => {
    expect(overpowerCheck(servant(), master({ effects: ["invuln"] })))
      .toMatchObject({ applies: false, reason: "invuln" });
  });

  it("cannot happen to a Master with Shield", () => {
    expect(overpowerCheck(servant(), master({ effects: ["shield"] })))
      .toMatchObject({ applies: false, reason: "shield" });
  });

  it("is ten points less likely against Def Up", () => {
    expect(overpowerCheck(servant(), master({ effects: ["defUp"] }))).toMatchObject({ chance: 40 });
  });

  it("is ten points less likely against Dmg Cut", () => {
    expect(overpowerCheck(servant(), master({ effects: ["dmgCut"] }))).toMatchObject({ chance: 40 });
  });
});

describe("resolveOverpower", () => {
  const args = (over = {}) => ({ attacker: servant(), defender: master(), roll: 1, ...over });

  it("defeats the Master on a roll inside the chance", () => {
    expect(resolveOverpower(args({ roll: 50 }))).toMatchObject({ defeated: true });
  });

  it("spares it on a roll outside", () => {
    expect(resolveOverpower(args({ roll: 51 }))).toMatchObject({ defeated: false });
  });

  it("is prevented entirely by a successful Luck Check", () => {
    expect(resolveOverpower(args({ roll: 1, luckCheckPassed: true }))).toMatchObject({ defeated: false });
  });

  it("makes that Luck Check cover the lethal damage too", () => {
    // "Not instantly defeated; takes normal damage; SURVIVES AT 1 HEALTH if
    // that damage would kill." One success buys both, which is what makes the
    // check disproportionately valuable.
    expect(resolveOverpower(args({ luckCheckPassed: true }))).toMatchObject({ survivesLethal: true });
  });

  it("does not claim survival when the flip simply missed", () => {
    expect(resolveOverpower(args({ roll: 99 }))).toMatchObject({ defeated: false, survivesLethal: false });
  });
});

/* ── §16.5 Underpower ─────────────────────────────────────────────────────── */

describe("underpower", () => {
  it("halves a Master's damage on a failed flip", () => {
    expect(resolveUnderpower({ attacker: master(), defender: servant(), roll: 1 }))
      .toMatchObject({ underpowered: true, factor: 0.5 });
  });

  it("leaves it alone on a successful one", () => {
    expect(resolveUnderpower({ attacker: master(), defender: servant(), roll: 99 }))
      .toMatchObject({ underpowered: false, factor: 1 });
  });

  it("is ten points less likely when the Master has Atk Up", () => {
    // Both this modifier and Overpower's favour the MASTER. Consistent, and
    // worth pinning because the phrasing in the source reads as if they oppose.
    expect(underpowerCheck(master({ effects: ["atkUp"] }), servant())).toMatchObject({ chance: 40 });
  });

  it("does not apply Servant to Servant", () => {
    expect(underpowerCheck(servant(), servant({ id: "s2" }))).toMatchObject({ applies: false });
  });

  it("never applies a factor when the rule does not apply", () => {
    expect(resolveUnderpower({ attacker: servant(), defender: servant({ id: "x" }), roll: 1 }))
      .toMatchObject({ factor: 1 });
  });
});

/* ── §16.6 Sustainability ─────────────────────────────────────────────────── */

describe("onMasterDefeated", () => {
  it("frees the Servant", () => {
    expect(onMasterDefeated(servant({ sustainability: 4 })))
      .toContainEqual(expect.objectContaining({ kind: "setContract", contract: "free" }));
  });

  it("keeps a Servant with no clock indefinitely", () => {
    // `null` is NOT zero: no Sustainability means no timer at all.
    const out = onMasterDefeated(servant({ sustainability: null }));

    expect(out.some((d) => d.kind === "defeat")).toBe(false);
  });

  it("removes one with zero Sustainability immediately", () => {
    // "A Servant with ZERO Sustainability disappears immediately if it loses
    // its Master." The distinction from null is the whole rule.
    expect(onMasterDefeated(servant({ sustainability: 0 })))
      .toContainEqual(expect.objectContaining({ kind: "defeat", cause: "sustainabilityExhausted" }));
  });

  it("locks the Servant's modes in whatever state they were", () => {
    // "It remains in whatever state it was in before its Master died."
    expect(onMasterDefeated(servant({ sustainability: 4 })))
      .toContainEqual(expect.objectContaining({ kind: "lockModes" }));
  });

  it("costs two more Sustainability if Mad Enhancement was active", () => {
    expect(onMasterDefeated(servant({ sustainability: 4, modes: ["madEnhancement"] })))
      .toContainEqual(expect.objectContaining({ key: "sustainability", delta: -2 }));
  });

  it("does nothing to a Master", () => {
    expect(onMasterDefeated(master())).toEqual([]);
  });
});

describe("sustainabilityCostOf", () => {
  it("charges a Free Servant by its Noble Phantasm's rank", () => {
    expect(sustainabilityCostOf(servant({ contract: "free" }), "A")).toBe(5);
    expect(sustainabilityCostOf(servant({ contract: "free" }), "E")).toBe(1);
  });

  it("charges a contracted Servant nothing", () => {
    // It pays its Master's Health instead (Ch. 15 §15.4).
    expect(sustainabilityCostOf(servant(), "A")).toBe(0);
  });
});

/* ── §16.7 The multi-Servant tax ──────────────────────────────────────────── */

describe("multiServantTax", () => {
  const acted = (id) => servant({ id, turnState: { acted: true } });
  const idle = (id) => servant({ id, turnState: { acted: false } });

  it("costs 25 Health when two Servants acted", () => {
    expect(multiServantTax(master(), [acted("a"), acted("b")]))
      .toEqual([expect.objectContaining({ delta: -25 })]);
  });

  it("is flat, not per-Servant", () => {
    // "Acting with two costs 25 and acting with five also costs 25."
    const five = ["a", "b", "c", "d", "e"].map(acted);

    expect(multiServantTax(master(), five)).toHaveLength(1);
    expect(multiServantTax(master(), five)[0].delta).toBe(-25);
  });

  it("costs nothing when only one acted", () => {
    expect(multiServantTax(master(), [acted("a"), idle("b")])).toEqual([]);
  });

  it("is a loss, not damage, so nothing reduces it", () => {
    expect(multiServantTax(master(), [acted("a"), acted("b")])[0]).toMatchObject({ isLoss: true });
  });

  it("does not apply in a Grand Order war", () => {
    expect(multiServantTax(master(), [acted("a"), acted("b")], { grandOrder: true })).toEqual([]);
  });
});

describe("mayOrderAnotherServant", () => {
  const acted = servant({ id: "a", turnState: { acted: true } });

  it("allows a healthy Master to order a second Servant", () => {
    expect(mayOrderAnotherServant(master(), [acted])).toMatchObject({ ok: true });
  });

  it("refuses at 25 Health or less once one has acted", () => {
    expect(mayOrderAnotherServant(master({ health: { value: 25 } }), [acted]))
      .toMatchObject({ ok: false, reason: "multiServantTaxUnaffordable" });
  });

  it("still allows the first Servant at low Health", () => {
    // The prohibition is on ordering MORE THAN ONE, not on acting at all.
    expect(mayOrderAnotherServant(master({ health: { value: 25 } }), [])).toMatchObject({ ok: true });
  });

  it("does not apply in a Grand Order war", () => {
    expect(mayOrderAnotherServant(master({ health: { value: 5 } }), [acted], { grandOrder: true }))
      .toMatchObject({ ok: true });
  });
});
