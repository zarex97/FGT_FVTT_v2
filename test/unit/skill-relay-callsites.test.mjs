/**
 * @file A Skill runs on the GM, and a player's client only asks (#130, #144).
 * @see module/net/operations.mjs, module/apps/actor-sheet/sheet.mjs, docs/38-authority.md, docs/44-testing.md
 *
 * A non-attack ability used to run on the client that pressed it. A player's
 * client cannot create a Region with a Behaviour, an Actor, a Token or a Level
 * (Foundry's own permission table), and it is refused a buff on another
 * player's Unit (`authorizeIntents`). So a player's Charisma of the Sun applied
 * the buffs on Units that player owned, threw, painted no Day and set no
 * cooldown, and a player's Winged Serpent failed at the Level after the Actor
 * and the Token may already have been created.
 *
 * The defect lives in what a caller did -- imported the engine and ran it
 * locally -- not in what any function computed, and none of it can run in Node
 * (it needs a second client), so the guards read the source, which is where a
 * call that stayed local is visible. The authorizers are behavioural, in
 * `authorize.test.mjs`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/** A source file with CRLF folded, so a slice by `\n` means the same on every checkout. */
const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const between = (text, from, to) => text.slice(text.indexOf(from), text.indexOf(to, text.indexOf(from)));

describe("the sheet asks the GM to use a Skill", () => {
  const sheet = read("module/apps/actor-sheet/sheet.mjs");
  const relay = between(sheet, "static async #relaySkill(", "static async useSkill(actor, ability)");

  it("has ONE place that requests the operation, and it sends the placement", () => {
    expect(relay).toContain('FGTSocket.request("useSkill"');
    expect(relay).toContain("placement");
  });

  it("FGTActorSheet.useSkill goes through it and does not run the engine itself", () => {
    const body = between(sheet, "static async useSkill(actor, ability)", "static async #declare");
    expect(body).toContain("#relaySkill(actor, ability, placement)");
    expect(body).not.toContain("skill-use.mjs");
  });

  it("so does a mode whose switch-on is a use", () => {
    const body = between(sheet, "if (active && pricedOnEntry(item)) {", "// Stamped on BOTH directions");
    expect(body).toContain("#relaySkill(actor, item)");
    expect(body).not.toContain("skill-use.mjs");
  });

  it("imports the engine's useSkill nowhere in the sheet", () => {
    expect(sheet).not.toContain("skill-use.mjs");
  });
});

describe("the End control asks the GM to end a field", () => {
  const bar = read("module/apps/hud/action-bar.mjs");

  it("requests deactivateField and does not run the engine itself", () => {
    const body = between(bar, 'if (row === "fields") {', "const item = actor.items.get(id);");
    expect(body).toMatch(/FGTSocket\.request\("deactivateField"/);
    expect(body).not.toMatch(/import\("\.\.\/\.\.\/engine\/fields\.mjs"\)/);
  });
});

describe("the operations the GM runs", () => {
  const ops = read("module/net/operations.mjs");

  it("useSkill runs the engine's useSkill on the GM", () => {
    const body = between(ops, "useSkill: {", "deactivateField: {");
    expect(body).toMatch(/import\("\.\.\/engine\/skill-use\.mjs"\)/);
  });

  it("deactivateField re-checks on the GM that the actor owns the field and may end it now", () => {
    const body = between(ops, "deactivateField: {", "advanceProcess: {");
    // The verdict with its reason kept, so a queued End can be told apart (#65, ruling 19).
    expect(body).toMatch(/deactivationReason\(/);
    expect(body).toMatch(/ownerId/);
  });
});

describe("a following area is repainted by one client", () => {
  // `moveToken` fires on EVERY connected client. `repaintFollowing` deletes and
  // re-creates a Region, which a non-GM client is refused and two GM-role
  // clients race. `Terrain.attach` gates its own delete hook the same way.
  const hooks = read("module/engine/movement-hooks.mjs");
  const onMove = hooks.slice(hooks.indexOf("async function onMove"));

  it("gates every repaint on the active GM", () => {
    const calls = [...onMove.matchAll(/await repaintFollowing\(/g)].map((m) => m.index);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const at of calls) {
      expect(onMove.slice(Math.max(0, at - 700), at), `a repaintFollowing at ${at}`).toMatch(/activeGM\?\.isSelf/);
    }
  });

  it("gates the terrain-tied effect sweep the same way: it deletes documents too", () => {
    const calls = [...onMove.matchAll(/await dropLeftTerrainEffects\(/g)].map((m) => m.index);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const at of calls) {
      expect(onMove.slice(Math.max(0, at - 700), at), `a dropLeftTerrainEffects at ${at}`).toMatch(/activeGM\?\.isSelf/);
    }
  });
});

describe("a Skill's own dialogs ask the player whose Unit it is", () => {
  // Run on the GM, `ChoiceDialog.pick` would open on the GM's screen for a
  // decision that is a player's: the roll-table wildcard, a `choose` phase, the
  // cooldown shape and targets, the summon type, and a duel's consent.
  it("skill-use.mjs opens no ChoiceDialog of its own", () => {
    expect(read("module/engine/skill-use.mjs")).not.toMatch(/ChoiceDialog/);
  });

  it("a duel's consent is asked of the CHALLENGED Unit's owner", () => {
    const fields = read("module/engine/fields.mjs");
    const body = between(fields, "async function agreesToField", "/**\n * What a field's");
    expect(body).not.toMatch(/ChoiceDialog/);
    expect(body).toMatch(/chooseFor\(target,/);
  });

  it("chooseFor is the owner-routed `choose` prompt", () => {
    const ask = read("module/engine/ask.mjs");
    expect(ask).toMatch(/export async function chooseFor\(/);
    expect(ask).toMatch(/kind: "choose"/);
  });
});
