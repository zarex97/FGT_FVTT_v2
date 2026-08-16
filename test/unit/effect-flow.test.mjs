/**
 * @file Transfer, effect visibility, Confuse's selector, and Undo.
 * @see docs/11-effect-engine.md §11.8, §11.10, docs/18-action-economy.md §18.5, §18.7
 */

import { describe, it, expect } from "vitest";
import {
  transferEffect, transferableFrom, visibilityOf, canSeeEffect,
  confusedAction, canUndo, CONFUSE_ACTIONS,
} from "../../module/rules/effect-flow.mjs";

const unit = (over = {}) => ({ id: "u", pausedTicks: 0, effectInstances: [], ...over });
const curse = (over = {}) => ({ id: "e1", defId: "curse", polarity: "debuff", stage: 3, expiry: 12, ...over });

/* ── §11.8 Transfer ───────────────────────────────────────────────────────── */

describe("transferEffect", () => {
  it("removes it from the source and applies it to the target", () => {
    const out = transferEffect(curse(), unit({ id: "a" }), unit({ id: "b" }));

    expect(out.map((d) => d.kind)).toEqual(["removeEffect", "applyEffect"]);
    expect(out[0].unitId).toBe("a");
    expect(out[1].unitId).toBe("b");
  });

  it("keeps the absolute expiry rather than restarting the clock", () => {
    // "With the duration being maintained." Because durations are absolute
    // ticks, a transfer is a move -- re-application would reset it.
    expect(transferEffect(curse(), unit({ id: "a" }), unit({ id: "b" }))[1].effect.expiry).toBe(12);
  });

  it("rebases the expiry when one side has been Stopped", () => {
    // Their clocks are offset, so an expiry carried across unchanged would
    // land at the wrong moment.
    const out = transferEffect(curse(), unit({ id: "a", pausedTicks: 0 }), unit({ id: "b", pausedTicks: 3 }));

    expect(out[1].effect.expiry).toBe(15);
  });

  it("carries the stage with it", () => {
    // Van Gogh gathers Curse from everyone nearby: "apply all stages
    // accordingly" means the stages arrive, not that it restarts at one.
    expect(transferEffect(curse({ stage: 4 }), unit({ id: "a" }), unit({ id: "b" }))[1].effect.stage).toBe(4);
  });

  it("leaves a permanent effect permanent", () => {
    expect(transferEffect(curse({ expiry: null }), unit({ id: "a" }), unit({ id: "b" }))[1].effect.expiry).toBeNull();
  });
});

describe("transferableFrom", () => {
  const bearer = (id, instances) => unit({ id, effectInstances: instances });

  it("gathers a named effect from everyone", () => {
    const out = transferableFrom([bearer("a", [curse()]), bearer("b", [curse({ id: "e2" })])], { defId: "curse" });

    expect(out).toHaveLength(2);
  });

  it("ignores an effect of a different id", () => {
    expect(transferableFrom([bearer("a", [curse({ defId: "burn" })])], { defId: "curse" })).toEqual([]);
  });

  it("can select by polarity instead", () => {
    const mixed = bearer("a", [curse(), { id: "e2", defId: "atkUp", polarity: "buff" }]);

    expect(transferableFrom([mixed], { polarity: "buff" })).toHaveLength(1);
  });

  it("never moves an Unremovable effect", () => {
    // A transfer removes before it applies, and Unremovable means it cannot be
    // taken off its bearer at all.
    expect(transferableFrom([bearer("a", [curse({ unremovable: true })])], { defId: "curse" })).toEqual([]);
  });
});

/* ── §11.10 Visibility ────────────────────────────────────────────────────── */

describe("visibilityOf", () => {
  const bearer = unit({ id: "b", ownerId: "playerB" });

  it("shows a buff to its bearer's owner and the GM", () => {
    const out = visibilityOf({ polarity: "buff" }, bearer);

    expect(out.visibleTo).toEqual(["playerB"]);
    expect(out.gm).toBe(true);
  });

  it("also shows a debuff to whoever inflicted it", () => {
    // Not a leak: they applied it and already know what they applied.
    expect(visibilityOf({ polarity: "debuff", sourceUnitId: "attacker" }, bearer).visibleTo)
      .toEqual(["playerB", "attacker"]);
  });

  it("honours an explicit public marking", () => {
    expect(visibilityOf({ polarity: "buff", visibility: "public" }, bearer).visibleTo).toEqual(["all"]);
  });

  it("honours an explicit GM-only marking", () => {
    expect(visibilityOf({ polarity: "debuff", visibility: "gmOnly", sourceUnitId: "x" }, bearer).visibleTo)
      .toEqual([]);
  });
});

describe("canSeeEffect", () => {
  const bearer = unit({ id: "b", ownerId: "playerB" });

  it("lets the GM see everything", () => {
    expect(canSeeEffect({ polarity: "buff" }, bearer, { isGM: true })).toBe(true);
  });

  it("hides another player's buff", () => {
    expect(canSeeEffect({ polarity: "buff" }, bearer, { id: "playerC" })).toBe(false);
  });

  it("shows the bearer's own", () => {
    expect(canSeeEffect({ polarity: "buff" }, bearer, { id: "playerB" })).toBe(true);
  });
});

/* ── §18.5 Confuse ────────────────────────────────────────────────────────── */

describe("confusedAction", () => {
  const targets = [{ id: "t1" }, { id: "t2" }, { id: "t3" }];

  it("maps the 1d4 onto the four action classes", () => {
    expect(CONFUSE_ACTIONS).toHaveLength(4);
    expect(confusedAction(unit(), targets, { action: 4 }).action).toBe("nothing");
  });

  it("rolls a cardinal direction when moving", () => {
    expect(confusedAction(unit(), targets, { action: 1, direction: 2 })).toMatchObject({ direction: "e" });
  });

  it("picks a target uniformly when attacking", () => {
    expect(confusedAction(unit(), targets, { action: 2, target: 3 })).toMatchObject({ targetId: "t3" });
  });

  it("may pick an ally, which is the point of the debuff", () => {
    // Enumeration is `relations: [any]`; the selector does not filter.
    const allies = [{ id: "friend", faction: "same" }];
    expect(confusedAction(unit(), allies, { action: 2, target: 1 })).toMatchObject({ targetId: "friend" });
  });

  it("attacks nobody when nothing is in reach", () => {
    expect(confusedAction(unit(), [], { action: 2, target: 1 })).toMatchObject({ targetId: null });
  });

  it("does both when the roll says so", () => {
    const out = confusedAction(unit(), targets, { action: 3, direction: 1, target: 1 });

    expect(out).toMatchObject({ action: "moveAndAttack", direction: "n", targetId: "t1" });
  });

  it("logs every roll it made", () => {
    // The one place the system decides for a player. An unexplained decision is
    // indistinguishable from a bug.
    const out = confusedAction(unit(), targets, { action: 3, direction: 1, target: 2 });

    expect(out.trace.map((t) => t.step)).toEqual(["action", "direction", "target"]);
  });
});

/* ── §18.7 Undo ───────────────────────────────────────────────────────────── */

describe("canUndo", () => {
  const ctx = { turnEnded: false, actingFactionId: "a" };

  it("allows a movement to be taken back", () => {
    expect(canUndo({ kind: "move", factionId: "a" }, ctx)).toMatchObject({ ok: true });
  });

  it("allows a facing choice", () => {
    expect(canUndo({ kind: "facing", factionId: "a" }, ctx)).toMatchObject({ ok: true });
  });

  it("refuses once the turn has ended", () => {
    expect(canUndo({ kind: "move", factionId: "a" }, { ...ctx, turnEnded: true })).toMatchObject({ ok: false });
  });

  it("refuses a resolved attack", () => {
    // The defender reacted, so undoing would extract their reaction for free.
    expect(canUndo({ kind: "attack", resolved: true, factionId: "a" }, ctx)).toMatchObject({ ok: false });
  });

  it("allows an attack that has not resolved yet", () => {
    expect(canUndo({ kind: "attack", resolved: false, factionId: "a" }, ctx)).toMatchObject({ ok: true });
  });

  it("never allows a Command Spell to be taken back", () => {
    expect(canUndo({ kind: "commandSpell", factionId: "a" }, ctx)).toMatchObject({ ok: false });
  });

  it("refuses anything that revealed information", () => {
    // The whole boundary: once an opponent learned something, undoing is a
    // free information extraction.
    expect(canUndo({ kind: "move", revealedToOpponent: true, factionId: "a" }, ctx)).toMatchObject({ ok: false });
  });

  it("allows a skill nobody could see", () => {
    expect(canUndo({ kind: "abilityUsed", opponentVisible: false, factionId: "a" }, ctx)).toMatchObject({ ok: true });
  });

  it("refuses a skill the opponent saw", () => {
    expect(canUndo({ kind: "abilityUsed", opponentVisible: true, factionId: "a" }, ctx)).toMatchObject({ ok: false });
  });

  it("refuses to rewind somebody else's turn", () => {
    expect(canUndo({ kind: "move", factionId: "b" }, ctx)).toMatchObject({ ok: false });
  });

  it("refuses an action kind it does not recognise", () => {
    // The safe direction: never rewind something whose consequences this
    // function does not understand.
    expect(canUndo({ kind: "somethingNew", factionId: "a" }, ctx)).toMatchObject({ ok: false });
  });
});
