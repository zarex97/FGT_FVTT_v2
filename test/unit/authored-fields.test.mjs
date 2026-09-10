/**
 * @file The one vocabulary: which fields the pack owns, which play owns.
 * @see module/content/authored-fields.mjs, docs/39-migration-and-versioning.md
 *
 * `actorSystem`/`itemSystem` in the content pipeline decide what enters a pack.
 * The content sync needs the same answer, so the list lives in one place and
 * this file holds the two readers against each other -- the same guard
 * `RULE_ELEMENT_KEYS` and `EXECUTORS` already have, and for the same reason: two
 * hand-maintained copies of one vocabulary drift, and the drift is silent.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  AUTHORED_ACTOR_KEYS, AUTHORED_ITEM_KEYS,
  SEEDED_THEN_OWNED, COOLDOWN_OWNED_BY_WORLD, SUMMON_VARIANT_OWNED_BY_WORLD,
  SEEDED_BY_TYPE, ownedByWorld,
} from "../../module/content/authored-fields.mjs";

describe("the authored vocabulary", () => {
  it("names the actor fields a pack may state", () => {
    // A spot check on the ones that have already gone missing once: a key
    // absent here is dropped on the way into the pack, silently.
    for (const key of ["contentId", "parameters", "baseAttack", "normalAttack", "passiveRules"]) {
      expect(AUTHORED_ACTOR_KEYS).toContain(key);
    }
  });

  it("names the item fields a pack may state", () => {
    for (const key of ["contentId", "cooldown", "targeting", "phases", "npGateRound", "damage"]) {
      expect(AUTHORED_ITEM_KEYS).toContain(key);
    }
  });

  it("has no duplicates in either list", () => {
    expect(new Set(AUTHORED_ACTOR_KEYS).size).toBe(AUTHORED_ACTOR_KEYS.length);
    expect(new Set(AUTHORED_ITEM_KEYS).size).toBe(AUTHORED_ITEM_KEYS.length);
  });
});

describe("fields the pack only seeds", () => {
  it("keeps every seeded key inside the authored list", () => {
    // A seeded key that is NOT authored is a contradiction: the sync would
    // never have touched it anyway, and listing it hides a real mistake.
    for (const key of SEEDED_THEN_OWNED.actor) expect(AUTHORED_ACTOR_KEYS).toContain(key);
    for (const key of SEEDED_THEN_OWNED.item) expect(AUTHORED_ITEM_KEYS).toContain(key);
  });

  it("names the three the allowlist carries but no content authors", () => {
    // Measured: `grep -rl "^ *timesUsed:" packs/_source/` finds nothing.
    for (const key of ["timesUsed", "lastUsedTick", "recordedAttacks"]) {
      expect(SEEDED_THEN_OWNED.item).toContain(key);
    }
  });

  it("names the ones content authors as a STARTING value", () => {
    for (const key of ["agility", "luck", "resources", "stance"]) {
      expect(SEEDED_THEN_OWNED.actor).toContain(key);
    }
    for (const key of ["active", "quantity"]) {
      expect(SEEDED_THEN_OWNED.item).toContain(key);
    }
  });

  it("keeps provenance with the world", () => {
    // An item copied by Wisdom of Dún Scáith records where it came from; a
    // content update has no business rewriting that.
    expect(SEEDED_THEN_OWNED.item).toContain("copiedFrom");
    expect(SEEDED_THEN_OWNED.item).toContain("grantedBy");
  });
});

describe("ownedByWorld", () => {
  it("says yes to a seeded key and no to an ordinary authored one", () => {
    expect(ownedByWorld("item", "timesUsed")).toBe(true);
    expect(ownedByWorld("item", "phases")).toBe(false);
    expect(ownedByWorld("actor", "resources")).toBe(true);
    expect(ownedByWorld("actor", "parameters")).toBe(false);
  });

  it("says yes to anything outside the authored list at all", () => {
    // Health, turnState, contracts and positions are not authored, so they are
    // preserved without needing to be listed.
    expect(ownedByWorld("actor", "health")).toBe(true);
    expect(ownedByWorld("actor", "turnState")).toBe(true);
    expect(ownedByWorld("item", "expended")).toBe(true);
  });
});

describe("the cooldown split", () => {
  it("leaves the clock with the world and the shape with the pack", () => {
    // `cooldown` is the one key that is half each: `max` is authored, and
    // `remaining` is what the match has spent.
    expect(COOLDOWN_OWNED_BY_WORLD).toEqual(["remaining", "regen", "gatedDelay"]);
  });
});

describe("the pipeline and the vocabulary agree", () => {
  // Two hand-maintained copies of one list is the shape this codebase has been
  // bitten by repeatedly. Either direction is a defect: a key here that the
  // builder does not emit means the sync overwrites something the pack never
  // sets, and a key the builder emits that is missing here means the sync
  // leaves a stale field behind for ever.
  const source = readFileSync("tools/lib/content.mjs", "utf8");

  /** The keys one builder function emits, read out of its source. */
  const emitted = (fnName) => {
    const start = source.indexOf(`function ${fnName}(doc)`);
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf("\n}", start);
    return [...source.slice(start, end).matchAll(/^ {4}([a-zA-Z][\w]*):/gm)].map((m) => m[1]);
  };

  it("actorSystem emits exactly AUTHORED_ACTOR_KEYS", () => {
    expect([...emitted("actorSystem")].sort()).toEqual([...AUTHORED_ACTOR_KEYS].sort());
  });

  it("itemSystem emits exactly AUTHORED_ITEM_KEYS", () => {
    expect([...emitted("itemSystem")].sort()).toEqual([...AUTHORED_ITEM_KEYS].sort());
  });
});

/**
 * Everything below was found by the FIRST dry run of the content sync against
 * the live world, not by reasoning about the allowlist. Each one would have
 * been silently reset on the next load, and each is pinned here by the actual
 * value the world held.
 */
describe("fields the engine writes during play", () => {
  it("keeps a summon's summoner", () => {
    // `summoning.mjs` writes `summonerId`. The Sphinx held `ha6OpDqFBWndMfZp`
    // and the pack template holds null: syncing would orphan every summon on
    // the board, and `fields.mjs` looks its owner up by exactly this id.
    expect(ownedByWorld("actor", "summonerId")).toBe(true);
  });

  it("keeps a platform's owner", () => {
    // `hgob.mjs` writes `ownerId` when the Hanging Gardens are placed.
    expect(ownedByWorld("actor", "ownerId")).toBe(true);
  });

  it("keeps a Servant revealed once she has been revealed", () => {
    // §4.2. Medusa had been revealed in the live world and the sync would have
    // put her mask back on.
    expect(ownedByWorld("actor", "identityRevealed")).toBe(true);
  });

  it("keeps the class slot war setup placed a Servant in", () => {
    // `war-setup.mjs` writes `classContainer` after `commitSummon`. It is the
    // slot this war put her in, not the class her sheet names: Medusa sat in
    // `saber` while the pack says `rider`.
    expect(ownedByWorld("actor", "classContainer")).toBe(true);
  });
});

describe("a Master's rolled stats", () => {
  // `war-setup.mjs` rolls these through `rollSetupPlan` onto a BLANK pack
  // template whose rank is "" and whose zon is 2. Syncing them back throws away
  // the war's setup rolls -- the live world had Masters at rank C and A, zon 4,
  // and baseAttack.mag 125.
  it("stays with the world, for a master", () => {
    for (const key of ["rank", "zon", "baseAttack", "commandSpells"]) {
      expect(ownedByWorld("actor", key, "master")).toBe(true);
    }
  });

  it("still follows the pack for a servant", () => {
    // A Servant's rank and attack come from her sheet. This is why the
    // exemption is keyed on type rather than added to SEEDED_THEN_OWNED.
    for (const key of ["rank", "baseAttack"]) {
      expect(ownedByWorld("actor", key, "servant")).toBe(false);
    }
  });

  it("names only types the system actually has", () => {
    const types = new Set(["servant", "master", "summon", "structure", "civilian"]);
    for (const type of Object.keys(SEEDED_BY_TYPE)) expect(types).toContain(type);
  });
});

describe("the summonVariant split", () => {
  it("leaves the flip with the world and the two forms with the pack", () => {
    // The same shape as `cooldown`: SM Semiramis had come up `dsc`, and the
    // pack states only what heads and tails are.
    expect(SUMMON_VARIANT_OWNED_BY_WORLD).toEqual(["variant"]);
  });
});
