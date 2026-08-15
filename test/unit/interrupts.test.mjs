/**
 * @file Command Spell interrupts — suspending and resuming a Combat Process.
 * @see docs/17-command-spells.md §17.4, docs/27-reaction-protocol.md §27.9
 * @see docs/45-implementation-status.md B1
 *
 * Six of the sixteen commands rewrite a resolution that is already in flight.
 * B1 shipped them logging their own names, because changing an in-flight
 * Process needs the ladder to be interruptible — which is a property of the
 * state machine, not of the command.
 *
 * The interrupt is a **GM-side mutation**: it changes a Process another client
 * is participating in, which is why the GM arbitrates the ladder even though
 * individual rungs are answered by their owners (§27.9).
 */

import { describe, it, expect } from "vitest";
import {
  begin, advance, applyInterrupt, windowFor, interruptible, damageFactorOf,
} from "../../module/engine/combat-process.mjs";

const attack = { abilityId: "np", kind: "np" };
const at = (state) => ({ ...begin({ attackerId: "atk", defenderId: "def", attack }), state });

/* ========================================================================== */
/*  Where a command may be offered                                            */
/* ========================================================================== */

describe("windowFor", () => {
  it("maps the reaction rung to its own window", () => {
    // §17.4: Damage Block and Teleport Servant are offered at `react`.
    expect(windowFor(at("react"))).toBe("react");
  });

  it("maps the accept-or-escape rung to its own window", () => {
    expect(windowFor(at("s23_acceptOrEscape"))).toBe("s23_acceptOrEscape");
  });

  it("maps the damage step, where Half and Full Heal are offered", () => {
    expect(windowFor(at("damage"))).toBe("damage");
  });

  it("has no window for a finished Process", () => {
    expect(windowFor(at("done"))).toBeNull();
  });

  it("refuses to interrupt a finished Process", () => {
    expect(interruptible(at("done"))).toBe(false);
    expect(interruptible(at("react"))).toBe(true);
  });
});

/* ========================================================================== */
/*  The disruptive effects                                                    */
/* ========================================================================== */

describe("applyInterrupt", () => {
  it("sends the Process to noDamage when the defender Escapes", () => {
    // CS: Escape moves the pair home, so the attack resolves against nobody.
    expect(applyInterrupt(at("s23_acceptOrEscape"), { kind: "escape" }).state).toBe("noDamage");
  });

  it("records who interrupted and with what, for the audit trail", () => {
    const out = applyInterrupt(at("react"), { kind: "escape", command: "cs-escape", masterId: "m" });

    expect(out.interrupts).toEqual([
      expect.objectContaining({ kind: "escape", command: "cs-escape", masterId: "m", atState: "react" }),
    ]);
  });

  it("carries a damage factor without moving the Process", () => {
    // Damage Block does not avoid the attack; it changes the number.
    const out = applyInterrupt(at("react"), { kind: "modifyDamage", factor: 0 });

    expect(out.state).toBe("react");
    expect(damageFactorOf(out)).toBe(0);
  });

  it("composes two damage factors multiplicatively", () => {
    // Halve NP then NP Max is x0.5 then x2 — order-independent, and a sum
    // would give the wrong answer in both orders.
    let s = applyInterrupt(at("react"), { kind: "modifyDamage", factor: 0.5 });
    s = applyInterrupt(s, { kind: "modifyDamage", factor: 2 });

    expect(damageFactorOf(s)).toBe(1);
  });

  it("defaults to no change when nothing has interrupted", () => {
    expect(damageFactorOf(at("damage"))).toBe(1);
  });

  it("replaces the defender and restarts the ladder on a retarget", () => {
    // Teleport Servant moves the DU out; the Process gets a new defender who
    // has not yet reacted (§27.9).
    const out = applyInterrupt(at("s23_acceptOrEscape"), { kind: "retarget", newTargetId: "other" });

    expect(out.defenderId).toBe("other");
    expect(out.state).toBe("react");
    expect(out.reaction).toBeNull();
  });

  it("forbids the reactions a retargeted defender never had a chance to declare", () => {
    const out = applyInterrupt(at("s23_acceptOrEscape"), { kind: "retarget", newTargetId: "other" });

    expect(out.forbiddenReactions).toEqual(["evade", "block"]);
  });

  it("records a survival threshold rather than applying it here", () => {
    // Survive Kill is decided at defeat, not at the moment it is declared.
    expect(applyInterrupt(at("damage"), { kind: "survive", fractionOfMax: 0.05 }).survive)
      .toBe(0.05);
  });

  it("records a validation override so the attack flow can honour it", () => {
    const out = applyInterrupt(at("declare"), { kind: "overrideValidation", reason: "cooldown" });

    expect(out.overrides).toEqual(["cooldown"]);
  });

  it("leaves the Process alone and says so for an effect it cannot apply", () => {
    // Never silent: an unapplied interrupt on the most expensive resource in
    // the game must be visible in the state it failed to change.
    const out = applyInterrupt(at("react"), { kind: "somethingNew" });

    expect(out.state).toBe("react");
    // One interrupt, one entry — an optimistic record plus a failure record
    // would double-count in the audit trail.
    expect(out.interrupts).toEqual([expect.objectContaining({ kind: "somethingNew", applied: false })]);
  });

  it("refuses to interrupt a Process that has finished", () => {
    const done = at("done");
    expect(applyInterrupt(done, { kind: "escape" })).toBe(done);
  });
});

/* ========================================================================== */
/*  Resumption                                                                */
/* ========================================================================== */

describe("resuming after an interrupt", () => {
  it("keeps driving from wherever the interrupt left it", () => {
    // "RESUME, possibly at a different state" — the ladder continues from the
    // mutated state rather than from where it was suspended.
    const escaped = applyInterrupt(at("s23_acceptOrEscape"), { kind: "escape" });

    expect(advance(escaped, "done").state).toBe("facing");
  });

  it("survives serialization, because the ladder spans clients", () => {
    const s = applyInterrupt(at("react"), { kind: "modifyDamage", factor: 0.5 });
    const round = JSON.parse(JSON.stringify(s));

    expect(damageFactorOf(round)).toBe(0.5);
    expect(round.interrupts).toHaveLength(1);
  });
});
