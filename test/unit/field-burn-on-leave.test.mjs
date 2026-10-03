/**
 * @file Piedra Del Sol's Burn turns ordinary on leaving, and permanent again on re-entry (#65, ruling 17).
 * @see module/rules/bounded-fields.mjs#revertingActionFor, #leavePatch, #reentryPatch, module/engine/movement-hooks.mjs
 *
 * > *"…this Burn debuff is permanent as long as the Unit is within the area.
 * > Once it leaves the area, the Burn is no longer permanent."*
 *
 * Ruled 2026-10-02: leaving makes it an ordinary Burn -- its own 2◈ from the
 * moment it leaves, and removable -- and walking back in while it runs makes
 * that same Burn permanent again. The engine had deleted it on leaving. The
 * Ramesseum's Curse, *"automatically removed after leaving the Complex"*,
 * still ends.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { fieldsOf, squareAround, prepareFields } from "../helpers/field.mjs";
import { revertingActionFor, leavePatch, reentryPatch } from "../../module/rules/bounded-fields.mjs";
import { EffectRegistry } from "../../module/rules/registry.mjs";

beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);

const stone = { ability: "quetz-piedra-del-sol", owner: "quetzalcoatlAct1", faction: "A", panels: squareAround({ i: 6, j: 6 }, 7) };
const complex = { ability: "ozymandias-ramesseum-tentyris", owner: "ozymandiasAct001", faction: "B", panels: squareAround({ i: 6, j: 14 }, 11) };

/** The projected fields for these casts, read back the way a board reads them. */
const projected = async (casts) => {
  const fields = await fieldsOf(casts);
  return withSubjects([{ from: "quetzalcoatl" }], ({ board }) => board.fields, { settings: { fields } });
};

describe("which tied effects turn ordinary on leaving", () => {
  it("Piedra Del Sol's Burn does", async () => {
    const [field] = await projected([stone]);
    const action = revertingActionFor(field, "burn");
    expect(action).toMatchObject({ key: "ApplyEffect", tiedToField: true, onLeave: "ordinary", unremovable: true });
  });

  it("the Ramesseum's Curse does not: it still ends on leaving", async () => {
    const [field] = await projected([complex]);
    expect(revertingActionFor(field, "curse")).toBeNull();
  });

  it("nothing else on the stone does", async () => {
    const [field] = await projected([stone]);
    expect(revertingActionFor(field, "shock")).toBeNull();
  });
});

describe("what leaving and re-entering change", () => {
  const burn = () => EffectRegistry.get("burn");

  it("leaving: an ordinary Burn, 2◈ from now and removable, remembering its field", async () => {
    await prepareSubjects();
    const patch = leavePatch(
      { defId: "burn", sourceFieldId: "quetz-piedra-del-sol", expiry: null, unremovable: true },
      burn(), { tick: 60, turnsPerRound: 3 },
    );
    expect(patch).toEqual({
      sourceFieldId: null, revertedFromField: "quetz-piedra-del-sol", expiry: 66, unremovable: false,
    });
  });

  it("re-entering: the same Burn permanent and unremovable again, tied to the field", async () => {
    const [field] = await projected([stone]);
    const action = revertingActionFor(field, "burn");
    const patch = reentryPatch({ defId: "burn", revertedFromField: "quetz-piedra-del-sol", expiry: 66 }, action);
    expect(patch).toEqual({
      sourceFieldId: "quetz-piedra-del-sol", revertedFromField: null, expiry: null, unremovable: true,
    });
  });
});

describe("the movement hook reverts rather than deletes, and restores on re-entry", () => {
  const hook = readFileSync("module/engine/movement-hooks.mjs", "utf8").replaceAll("\r\n", "\n");

  it("splits the effects a Unit left into reverting and ending", () => {
    const body = hook.slice(hook.indexOf("async function dropLeftFieldEffects"));
    const fn = body.slice(0, body.indexOf("\n}\n"));
    expect(fn).toMatch(/revertingActionFor\(/);
    expect(fn).toMatch(/leavePatch\(/);
    expect(fn).toMatch(/deleteEmbeddedDocuments\("ActiveEffect", ending/);
  });

  it("restores a reverted effect when its bearer moves back in", () => {
    expect(hook).toMatch(/await restoreReenteredFieldEffects\(document\.actor, document, movement\)/);
    const body = hook.slice(hook.indexOf("async function restoreReenteredFieldEffects"));
    expect(body.slice(0, body.indexOf("\n}\n"))).toMatch(/reentryPatch\(/);
  });
});
