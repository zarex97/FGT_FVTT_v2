/**
 * @file The action bar's view-model.
 * @see module/apps/hud/present.mjs, docs/29-user-interface.md §29.5
 *
 * Pure, so every slot state the design names is testable without Foundry —
 * the same split `apps/actor-sheet/present.mjs` already uses.
 */
import { describe, it, expect } from "vitest";
import { portraitBlock, slotFor, rowsFor } from "../../module/apps/hud/present.mjs";

const ability = (over = {}) => ({
  id: "a1", name: "Mystic Eyes", img: "art.webp", isNP: false,
  cooldownRemaining: 0, active: false, ...over,
});

describe("portraitBlock", () => {
  const medusa = { kind: "servant", identityRevealed: false };

  it("shows the class image and the public name while concealed", () => {
    // The bar must not leak a true name to a player who selected an opponent.
    const out = portraitBlock(medusa, {
      img: "true.webp", defaultImage: "rider.webp",
      publicName: "Rider", trueName: "Medusa", isOwner: false,
    });
    expect(out).toMatchObject({ img: "rider.webp", name: "Rider" });
  });

  it("shows the true portrait to the unit's own owner", () => {
    const out = portraitBlock(medusa, {
      img: "true.webp", defaultImage: "rider.webp",
      publicName: "Rider", trueName: "Medusa", isOwner: true,
    });
    expect(out).toMatchObject({ img: "true.webp", name: "Medusa" });
  });

  it("shows the true portrait once the identity is revealed", () => {
    const out = portraitBlock({ kind: "servant", identityRevealed: true }, {
      img: "true.webp", defaultImage: "rider.webp",
      publicName: "Rider", trueName: "Medusa", isOwner: false,
    });
    expect(out.img).toBe("true.webp");
  });

  it("never conceals a non-Servant", () => {
    const out = portraitBlock({ kind: "master", identityRevealed: false }, {
      img: "k.webp", defaultImage: "mask.webp",
      publicName: "Master", trueName: "Kiritsugu", isOwner: false,
    });
    expect(out.img).toBe("k.webp");
  });
});

describe("slotFor", () => {
  it("is ready with its cost when nothing refuses it", () => {
    const s = slotFor(ability(), { verdict: { ok: true }, cost: { kind: "sustainability", amount: 1 } });
    expect(s).toMatchObject({ disabled: false, ring: null, cooldown: null });
    expect(s.cost).toEqual({ kind: "sustainability", amount: 1 });
  });

  it("shows the remaining ticks while cooling", () => {
    const s = slotFor(ability({ cooldownRemaining: 3 }), { verdict: { ok: true }, turnsPerRound: 3 });
    expect(s.cooldown).toEqual({ remaining: 3, label: "1◈" });
    expect(s.disabled).toBe(true);
  });

  it("rings a mode that is switched on", () => {
    const s = slotFor(ability({ active: true }), { verdict: { ok: true } });
    expect(s.ring).toBe("on");
  });

  it("rings a Noble Phantasm whose field is built", () => {
    const s = slotFor(ability({ isNP: true, fieldOpen: true }), { verdict: { ok: true } });
    expect(s.ring).toBe("built");
  });

  it("carries the refusal reason rather than hiding the slot", () => {
    // A dead control is how a player concludes the system is broken.
    const s = slotFor(ability(), { verdict: { ok: false, reason: "exhausted" } });
    expect(s).toMatchObject({ disabled: true, reason: "exhausted" });
  });
});

describe("rowsFor", () => {
  const base = {
    unit: { id: "u1", kind: "servant" },
    board: { units: [], fields: [] },
    actions: [{ id: "attack", icon: "i", label: "FGT.Action.Attack", mode: "targeted", context: {} }],
    abilities: [], fields: [], effects: [],
  };

  it("omits a row the unit has nothing for", () => {
    const ids = rowsFor(base).map((r) => r.id);
    expect(ids).toContain("actions");
    expect(ids).not.toContain("modes");
    expect(ids).not.toContain("np");
  });

  it("splits abilities into skills, noble phantasms and modes", () => {
    const rows = rowsFor({
      ...base,
      abilities: [
        { ...ability({ id: "s1" }), group: "skill" },
        { ...ability({ id: "n1", isNP: true }), group: "np" },
        { ...ability({ id: "m1", active: true }), group: "mode" },
      ],
    });
    const by = Object.fromEntries(rows.map((r) => [r.id, r.slots.map((s) => s.id)]));
    expect(by.skills).toEqual(["s1"]);
    expect(by.np).toEqual(["n1"]);
    expect(by.modes).toEqual(["m1"]);
  });

  it("puts the pinned row first when there are pins", () => {
    const rows = rowsFor({
      ...base,
      abilities: [{ ...ability({ id: "s1" }), group: "skill" }],
      pins: ["s1"],
    });
    expect(rows[0].id).toBe("pinned");
    expect(rows[0].slots.map((s) => s.id)).toEqual(["s1"]);
    // A pin is a shortcut, never a replacement: the ability is still in its row.
    expect(rows.find((r) => r.id === "skills").slots.map((s) => s.id)).toEqual(["s1"]);
  });

  it("ignores a pin naming an ability the unit no longer has", () => {
    const rows = rowsFor({ ...base, pins: ["gone"] });
    expect(rows.some((r) => r.id === "pinned")).toBe(false);
  });
});

describe("slotFor in counter mode", () => {
  // §12.8's rung is the one moment a unit may attack outside its own turn, so
  // the bar is armed FOR the player rather than waiting to be found.
  const np = { id: "np1", name: "Nine Lives", img: "np.webp", isNP: true };
  const ok = { ok: true };

  it("marks an Attack as available to Counter with", () => {
    const slot = slotFor(np, { verdict: ok, counter: { isAttack: true } });
    expect(slot.counter).toBe(true);
    expect(slot.disabled).toBe(false);
  });

  it("disables anything that is not an Attack, and says why", () => {
    // Dimmed with a reason, never hidden. A dead control with no explanation is
    // how a player concludes the system is broken.
    const slot = slotFor({ id: "s1", name: "Argos" }, { verdict: ok, counter: { isAttack: false } });
    expect(slot.disabled).toBe(true);
    expect(slot.reason).toBe("notAnAttack");
    expect(slot.counter).toBe(false);
  });

  it("keeps an unaffordable Attack visible, disabled, with its own reason", () => {
    // The counterer needs to know the Noble Phantasm exists and why it cannot
    // be used, which is a different fact from "this is not an Attack".
    const slot = slotFor(np, {
      verdict: { ok: false, reason: "sustainability" }, counter: { isAttack: true },
    });
    expect(slot.disabled).toBe(true);
    expect(slot.reason).toBe("sustainability");
    expect(slot.counter).toBe(true);
  });

  it("behaves exactly as before when not countering", () => {
    const slot = slotFor(np, { verdict: ok });
    expect(slot.counter).toBe(false);
    expect(slot.disabled).toBe(false);
  });
});
