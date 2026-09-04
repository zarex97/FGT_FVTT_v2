/**
 * @file The unit-action registry.
 * @see module/rules/actions.mjs, docs/29-user-interface.md §29.5
 *
 * Three of `budget.mjs`'s eight ActionKinds had no caller anywhere in the
 * repository when this was written: `mark`, `gather` and `ridingAttack`. Each
 * engine was complete. The registry exists so that offering an action is a
 * table entry rather than a hand-written button somebody forgets to add.
 */
import { describe, it, expect } from "vitest";
import { UNIT_ACTIONS, ACTION_EXEMPT_KINDS, availableActions } from "../../module/rules/actions.mjs";
import { ACTION_KINDS } from "../../module/rules/budget.mjs";

const unit = (over = {}) => ({
  id: "u1", kind: "servant", faction: "red",
  grantedAbilities: [], abilities: [], resources: {}, ...over,
});
const board = (units = [], over = {}) => ({ units, fields: [], ...over });
const idsFor = (u, b) => availableActions(u, b).map((a) => a.id);

describe("the always-available actions", () => {
  it("offers attack, move and facing to an ordinary unit", () => {
    expect(idsFor(unit(), board([unit()]))).toEqual(
      expect.arrayContaining(["attack", "move", "facing"]),
    );
  });

  it("withholds attack from a unit that cannot make one", () => {
    // Pale Rider: "cannot perform Normal Attacks." The grant already exists
    // and `engine/attack.mjs` already refuses; the button should not be there
    // to press in the first place.
    const pale = unit({ grantedAbilities: ["noNormalAttack"] });
    expect(idsFor(pale, board([pale]))).not.toContain("attack");
    expect(idsFor(pale, board([pale]))).toContain("move");
  });
});

describe("Mark (Ch. 43 §43.4)", () => {
  const medusa = () => unit({
    abilities: [{
      id: "np1", contentId: "medusa-blood-fort-andromeda", isNP: true,
      fieldGeometryKind: "markDefined",
    }],
  });

  it("is offered to a unit whose NP is built by marking, carrying the ability id", () => {
    const found = availableActions(medusa(), board([medusa()])).find((a) => a.id === "mark");
    expect(found).toBeDefined();
    expect(found.context).toEqual({ abilityId: "np1" });
    expect(found.kind).toBe("mark");
  });

  it("is withheld once the field it builds is already open", () => {
    // "Medusa cannot place new Bloodmarks while Bloodfort Andromeda is Active."
    const b = board([medusa()], { fields: [{ id: "medusa-blood-fort-andromeda" }] });
    expect(idsFor(medusa(), b)).not.toContain("mark");
  });

  it("is withheld from a unit with no such NP", () => {
    expect(idsFor(unit(), board([unit()]))).not.toContain("mark");
  });
});

describe("Gather (Ch. 32)", () => {
  const semiramis = () => unit({ id: "s1", resources: { hgobConstruction: { value: 0, max: null } } });
  const ally = () => unit({ id: "a1", faction: "red" });

  it("is offered to an ALLY because of who else is on the board", () => {
    // "Semiramis or any allied Unit can perform 'Gather'." The predicate is
    // board-dependent, which is why `available` takes the board.
    const found = availableActions(ally(), board([semiramis(), ally()])).find((a) => a.id === "gather");
    expect(found).toBeDefined();
    expect(found.context).toEqual({ ownerId: "s1" });
  });

  it("is offered to Semiramis herself", () => {
    expect(idsFor(semiramis(), board([semiramis()]))).toContain("gather");
  });

  it("is withheld when the only Construction owner is an enemy", () => {
    const enemyOwner = unit({ id: "s1", faction: "blue", resources: { hgobConstruction: { value: 0 } } });
    expect(idsFor(ally(), board([enemyOwner, ally()]))).not.toContain("gather");
  });

  it("is withheld when nobody on the board has Construction", () => {
    expect(idsFor(ally(), board([ally()]))).not.toContain("gather");
  });
});

describe("Riding Attack", () => {
  it("is offered only to a unit holding the grant", () => {
    const rider = unit({ grantedAbilities: ["ridingAttack"] });
    expect(idsFor(rider, board([rider]))).toContain("ridingAttack");
    expect(idsFor(unit(), board([unit()]))).not.toContain("ridingAttack");
  });

  it("is targeted, because it needs a destination", () => {
    const rider = unit({ grantedAbilities: ["ridingAttack"] });
    const found = availableActions(rider, board([rider])).find((a) => a.id === "ridingAttack");
    expect(found.mode).toBe("targeted");
  });
});

describe("the registry's shape", () => {
  it("gives every entry an id, kind, icon, label and mode", () => {
    for (const a of UNIT_ACTIONS) {
      expect(typeof a.id).toBe("string");
      expect(typeof a.icon).toBe("string");
      expect(a.label.startsWith("FGT.")).toBe(true);
      expect(["immediate", "targeted", "dial"]).toContain(a.mode);
      expect(typeof a.available).toBe("function");
    }
  });

  it("names the kinds that are billed by ability buttons instead", () => {
    expect([...ACTION_EXEMPT_KINDS].sort()).toEqual(["np", "skill", "spell"]);
  });

  it("survives a null unit rather than throwing", () => {
    expect(availableActions(null, board())).toEqual([]);
  });
});

describe("no ActionKind may go unreachable (§29.5 DA.3)", () => {
  it("gives every ActionKind either a registry entry or an explicit exemption", () => {
    // The guard that would have caught `mark`, `gather` and `ridingAttack`,
    // all three of which shipped with a complete engine and no caller. A new
    // action kind now fails the build until somebody decides how it is offered.
    const offered = new Set(UNIT_ACTIONS.map((a) => a.kind).filter(Boolean));
    const exempt = new Set(ACTION_EXEMPT_KINDS);
    const orphans = ACTION_KINDS.filter((k) => !offered.has(k) && !exempt.has(k));
    expect(orphans).toEqual([]);
  });

  it("lets no registry entry name a kind the budget does not bill", () => {
    const known = new Set(ACTION_KINDS);
    const unknown = UNIT_ACTIONS.map((a) => a.kind).filter((k) => k && !known.has(k));
    expect(unknown).toEqual([]);
  });

  it("keeps the exemptions honest", () => {
    const known = new Set(ACTION_KINDS);
    expect(ACTION_EXEMPT_KINDS.filter((k) => !known.has(k))).toEqual([]);
  });
});

describe("every offered action has a handler", () => {
  it("maps each registry id to exactly one dispatcher entry", async () => {
    // The other half of the drift guard: a registry entry with no handler is a
    // button that throws, and a handler with no entry is dead code.
    const { ACTION_HANDLERS } = await import("../../module/engine/actions.mjs");
    const registry = UNIT_ACTIONS.map((a) => a.id).sort();
    expect(Object.keys(ACTION_HANDLERS).sort()).toEqual(registry);
  });
});

describe("a Structure is not a unit that acts", () => {
  // Reported from play: selecting one of Medusa's Bloodmarks offered Move,
  // Attack, Gather and a facing dial. Every predicate asked what a unit HAS
  // and none asked what it IS.
  const bloodmark = () => unit({ id: "bm1", kind: "structure", faction: "red" });
  const semiramis = () => unit({ id: "s1", resources: { hgobConstruction: { value: 0 } } });

  it("offers a Bloodmark nothing at all", () => {
    expect(availableActions(bloodmark(), board([bloodmark(), semiramis()]))).toEqual([]);
  });

  it("withholds even the facing dial, which a Structure does not have", () => {
    expect(idsFor(bloodmark(), board([bloodmark()]))).not.toContain("facing");
  });

  it("still offers everything to the kinds that do act", () => {
    for (const kind of ["servant", "master", "civilian", "summon", "platform"]) {
      const u = unit({ kind });
      expect(idsFor(u, board([u]))).toEqual(expect.arrayContaining(["attack", "move", "facing"]));
    }
  });

  it("does not let a Structure be offered Gather by standing near Semiramis", () => {
    expect(idsFor(bloodmark(), board([bloodmark(), semiramis()]))).not.toContain("gather");
  });
});
