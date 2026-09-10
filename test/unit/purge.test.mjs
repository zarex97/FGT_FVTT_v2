/**
 * @file Selecting actors and their tokens for deletion.
 * @see module/rules/purge.mjs, docs/29-user-interface.md §29.13
 *
 * Foundry does not clean up after a deleted Actor. `Actor._onDelete`
 * (`client/documents/actor.mjs`) removes its ActiveEffects and nothing else,
 * so every token of that actor stays in its scene pointing at an id that no
 * longer resolves. Every rule about *what goes with what* therefore has to
 * live somewhere, and it is here rather than in the dialog.
 */

import { describe, it, expect } from "vitest";
import { filterCandidates, purgePlan, danglingReferences } from "../../module/rules/purge.mjs";

const at = (sceneId, sceneName, ...tokenIds) => ({ sceneId, sceneName, tokenIds });

const candidates = [
  {
    id: "heracles", name: "Heracles", type: "servant", factionId: "red",
    placements: [at("board", "The Board", "t1", "t2"), at("interior", "Interior", "t3")],
  },
  { id: "medea", name: "Medea", type: "servant", factionId: "blue", placements: [at("board", "The Board", "t4")] },
  { id: "kotomine", name: "Kotomine", type: "master", factionId: "red", placements: [at("interior", "Interior", "t5")] },
  { id: "spare", name: "Spare Civilian", type: "civilian", factionId: null, placements: [] },
];

describe("filterCandidates", () => {
  it("returns everything when nothing is asked for", () => {
    expect(filterCandidates(candidates, {}).map((c) => c.id))
      .toEqual(["heracles", "medea", "kotomine", "spare"]);
  });

  it("narrows to the actors with a token in one scene", () => {
    expect(filterCandidates(candidates, { sceneId: "interior" }).map((c) => c.id))
      .toEqual(["heracles", "kotomine"]);
  });

  it("finds the actors standing in no scene at all", () => {
    // The sweepable ones: an actor nobody placed, left over from a test or a
    // half-finished setup. Its own filter value because it cannot be expressed
    // by picking a scene.
    expect(filterCandidates(candidates, { sceneId: "__none__" }).map((c) => c.id)).toEqual(["spare"]);
  });

  it("narrows by type and by faction", () => {
    expect(filterCandidates(candidates, { type: "servant" }).map((c) => c.id)).toEqual(["heracles", "medea"]);
    expect(filterCandidates(candidates, { factionId: "red" }).map((c) => c.id)).toEqual(["heracles", "kotomine"]);
  });

  it("matches the search anywhere in the name, ignoring case", () => {
    expect(filterCandidates(candidates, { search: "cle" }).map((c) => c.id)).toEqual(["heracles"]);
    expect(filterCandidates(candidates, { search: "MEDEA" }).map((c) => c.id)).toEqual(["medea"]);
  });

  it("intersects every filter given at once", () => {
    expect(filterCandidates(candidates, { sceneId: "board", type: "servant", factionId: "red" })
      .map((c) => c.id)).toEqual(["heracles"]);
  });
});

describe("purgePlan — deleting actors", () => {
  it("takes every token of the selected actors, in every scene", () => {
    // The scene filter narrows what is SHOWN. Deleting an actor takes all of
    // it: a token left behind in a scene the GM was not looking at is exactly
    // the orphan this tool exists to prevent.
    const plan = purgePlan(candidates, { mode: "actors", selectedIds: ["heracles"] });
    expect(plan.actorIds).toEqual(["heracles"]);
    expect(plan.scenes).toEqual([
      { sceneId: "board", sceneName: "The Board", tokenIds: ["t1", "t2"] },
      { sceneId: "interior", sceneName: "Interior", tokenIds: ["t3"] },
    ]);
    expect(plan.counts).toMatchObject({ actors: 1, tokens: 3, scenes: 2 });
  });

  it("ignores the scene filter, which is a view and not a scope", () => {
    const plan = purgePlan(candidates, { mode: "actors", selectedIds: ["heracles"], sceneId: "board" });
    expect(plan.counts).toMatchObject({ actors: 1, tokens: 3 });
  });

  it("groups tokens of different actors that share a scene", () => {
    const plan = purgePlan(candidates, { mode: "actors", selectedIds: ["heracles", "medea"] });
    expect(plan.scenes.find((s) => s.sceneId === "board").tokenIds).toEqual(["t1", "t2", "t4"]);
  });

  it("plans an actor with no tokens without inventing a scene", () => {
    const plan = purgePlan(candidates, { mode: "actors", selectedIds: ["spare"] });
    expect(plan.scenes).toEqual([]);
    expect(plan.counts).toMatchObject({ actors: 1, tokens: 0, scenes: 0 });
  });

  it("refuses an empty selection rather than planning nothing", () => {
    // A confirm dialog that says "delete 0 actors" is a button that teaches
    // the GM the confirmation is meaningless.
    expect(purgePlan(candidates, { mode: "actors", selectedIds: [] }).refusal).toBe("nothingSelected");
  });

  it("ignores a selected id that is not on the list", () => {
    const plan = purgePlan(candidates, { mode: "actors", selectedIds: ["heracles", "ghost"] });
    expect(plan.actorIds).toEqual(["heracles"]);
  });
});

describe("purgePlan — removing tokens from one scene", () => {
  it("takes only that scene's tokens, and no actors", () => {
    const plan = purgePlan(candidates, { mode: "tokens", selectedIds: ["heracles"], sceneId: "interior" });
    expect(plan.actorIds).toEqual([]);
    expect(plan.scenes).toEqual([{ sceneId: "interior", sceneName: "Interior", tokenIds: ["t3"] }]);
    expect(plan.counts).toMatchObject({ actors: 0, tokens: 1, scenes: 1 });
  });

  it("refuses without a scene, which would otherwise mean every scene", () => {
    // The dangerous reading. "Remove tokens" with no scene chosen is one
    // keystroke away from clearing the board, so it is refused rather than
    // guessed at.
    expect(purgePlan(candidates, { mode: "tokens", selectedIds: ["heracles"] }).refusal).toBe("noScene");
    expect(purgePlan(candidates, { mode: "tokens", selectedIds: ["heracles"], sceneId: "__none__" }).refusal)
      .toBe("noScene");
  });

  it("plans nothing for an actor with no token in that scene", () => {
    const plan = purgePlan(candidates, { mode: "tokens", selectedIds: ["medea"], sceneId: "interior" });
    expect(plan.refusal).toBe("nothingToRemove");
  });
});

describe("danglingReferences", () => {
  const world = [
    { id: "medea", type: "servant", system: { masterId: "kotomine" } },
    { id: "heracles", type: "servant", system: { masterId: "illya" } },
    { id: "kotomine", type: "master", system: { servantIds: ["medea", "assassin"] } },
    { id: "spirit", type: "summon", system: { summonerId: "medea" } },
    { id: "gardens", type: "platform", system: { ownerId: "semiramis" } },
  ];

  it("clears a contract whose Master is going", () => {
    // `masterId` is half of a reciprocal pair, and the survivor is the half
    // that keeps pointing at nothing.
    expect(danglingReferences(world, ["kotomine"]))
      .toContainEqual({ actorId: "medea", changes: { "system.masterId": null } });
  });

  it("drops a deleted Servant out of its Master's list, keeping the rest", () => {
    expect(danglingReferences(world, ["medea"]))
      .toContainEqual({ actorId: "kotomine", changes: { "system.servantIds": ["assassin"] } });
  });

  it("clears a summon's summoner and a platform's owner", () => {
    expect(danglingReferences(world, ["medea"]))
      .toContainEqual({ actorId: "spirit", changes: { "system.summonerId": null } });
    expect(danglingReferences(world, ["semiramis"]))
      .toContainEqual({ actorId: "gardens", changes: { "system.ownerId": null } });
  });

  it("says nothing about the actors being deleted themselves", () => {
    // `medea` points at `kotomine` and both are going. Writing to a document
    // that is about to be deleted is work at best and an error at worst.
    const fixes = danglingReferences(world, ["medea", "kotomine"]);
    expect(fixes.map((f) => f.actorId)).not.toContain("medea");
    expect(fixes.map((f) => f.actorId)).not.toContain("kotomine");
  });

  it("leaves a reference that still resolves alone", () => {
    expect(danglingReferences(world, ["gardens"])).toEqual([]);
  });

  it("returns one entry per actor, however many of its fields dangle", () => {
    const both = [{ id: "x", type: "summon", system: { masterId: "gone", summonerId: "gone" } }];
    expect(danglingReferences(both, ["gone"])).toEqual([
      { actorId: "x", changes: { "system.masterId": null, "system.summonerId": null } },
    ]);
  });
});

describe("danglingReferences — the match roster", () => {
  it("clears the slot ids the war setup recorded", () => {
    // `MatchData.containers` carries `servantId`/`masterId` per slot
    // (`engine/war-setup.mjs`), and a war whose roster names deleted actors
    // reports containers that cannot be opened.
    const containers = [
      { id: "c1", servantId: "medea", masterId: "kotomine" },
      { id: "c2", servantId: "heracles", masterId: "illya" },
    ];
    expect(danglingReferences([], ["kotomine"], { containers })).toEqual([
      {
        match: true,
        changes: {
          "system.containers": [
            { id: "c1", servantId: "medea", masterId: null },
            { id: "c2", servantId: "heracles", masterId: "illya" },
          ],
        },
      },
    ]);
  });

  it("says nothing when no slot names a deleted actor", () => {
    const containers = [{ id: "c1", servantId: "medea", masterId: "kotomine" }];
    expect(danglingReferences([], ["spare"], { containers })).toEqual([]);
  });
});
