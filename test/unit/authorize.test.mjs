/**
 * The socket proxy lets any client ask the GM to write anything. This check is
 * what stops one player from handing the GM a batch that kills another
 * player's Servant, so it gets tested harder than anything else in net/.
 */
import { describe, it, expect } from "vitest";
import { authorizeIntents, OPERATIONS } from "../../module/net/operations.mjs";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as I from "../../module/engine/intents.mjs";

function world({ gm = false } = {}) {
  const alice = { id: "alice", name: "Alice", isGM: gm };
  const bob = { id: "bob", name: "Bob", isGM: false };
  const actor = (id, ownerId) => ({
    id, name: id,
    testUserPermission: (user) => user.id === ownerId,
  });
  return {
    users: { get: (id) => ({ alice, bob }[id] ?? null) },
    actors: { get: (id) => ({ saber: actor("saber", "alice"), archer: actor("archer", "bob") }[id] ?? null) },
  };
}

describe("authorizeIntents", () => {
  it("allows a user to write to a unit they own", () => {
    const r = authorizeIntents([I.damage("saber", 10)], "alice", world());
    expect(r.allowed).toBe(true);
  });

  it("REFUSES a user writing to someone else's unit", () => {
    const r = authorizeIntents([I.damage("archer", 500)], "alice", world());
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/Alice does not own archer/);
  });

  it("refuses if any single intent in the batch is unauthorized", () => {
    // The dangerous case: a legitimate batch with one smuggled intent.
    const r = authorizeIntents(
      [I.damage("saber", 10), I.damage("archer", 9999)], "alice", world(),
    );
    expect(r.allowed).toBe(false);
  });

  it("allows a GM everything", () => {
    expect(authorizeIntents([I.damage("archer", 500)], "alice", world({ gm: true })).allowed).toBe(true);
  });

  it("refuses an unknown user", () => {
    expect(authorizeIntents([], "mallory", world()).reason).toBe("Unknown user.");
  });

  it("refuses an unknown unit rather than silently skipping it", () => {
    expect(authorizeIntents([I.damage("ghost", 1)], "alice", world()).reason).toMatch(/Unknown unit ghost/);
  });

  it("rejects a malformed batch before checking ownership", () => {
    const r = authorizeIntents([I.damage("saber", -5)], "alice", world());
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/use a heal intent/);
  });

  it("does not require ownership for log or prompt intents", () => {
    const r = authorizeIntents([I.log({ kind: "x" }), I.prompt("bob", {})], "alice", world());
    expect(r.allowed).toBe(true);
  });

  it("checks masterId as well as unitId", () => {
    const r = authorizeIntents([I.spendCS("archer", 1, "killYourself")], "alice", world());
    expect(r.allowed).toBe(false);
  });
});

describe("every socket operation has a caller", () => {
  /**
   * A proxied write that nothing requests is not "available for later" -- it is
   * a permission model for a code path that does not exist, and the real path
   * is running unproxied somewhere and failing on the GM-only document it
   * cannot write.
   *
   * `advanceProcess` is why this exists. It was written complete, with an
   * authorizer admitting only the side the ladder is waiting on, and had no
   * caller anywhere: the chat card imported `advanceAttack` and called it on
   * the clicking player's own client, so pressing Block produced *"User Player2
   * lacks permission to update Combat"* and the reaction ladder stopped. Found
   * in play, two players deep into an exchange.
   */
  const sources = (dir = "module") => {
    const out = [];
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) out.push(...sources(path));
      else if (entry.endsWith(".mjs")) out.push(path);
    }
    return out;
  };

  const callers = sources()
    .filter((f) => !f.endsWith("operations.mjs"))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");

  it("declares operations at all, so a broken read cannot pass vacuously", () => {
    expect(Object.keys(OPERATIONS).length).toBeGreaterThan(5);
  });

  it("is requested from somewhere for every operation it declares", () => {
    // KNOWN DEAD. `discoverRoll` proxies a 1d100 to the GM so a player never
    // learns a Discover was even attempted (Ch. 05.7). It was superseded before
    // it was ever called: `engine/concealment.mjs#runDiscoverChecks` returns
    // early for anyone who is not the GM and rolls there directly, which
    // satisfies the same rule without a round trip. Listed rather than deleted
    // because removing a socket operation is an API change; a candidate for
    // deletion, not a thing to build a caller for.
    const DEAD = new Set(["discoverRoll"]);
    const orphans = Object.keys(OPERATIONS)
      .filter((op) => !DEAD.has(op) && !callers.includes(`"${op}"`));
    expect(orphans).toEqual([]);
  });
});

describe("declareCounter authorization", () => {
  // The second clause matters more than the first. Without the rung check, any
  // owner could post this operation at any moment and receive a free attack
  // that costs no turn budget — which is precisely what a Counter is, minus the
  // part where somebody attacked them first.
  const auth = OPERATIONS.declareCounter.authorize;

  /** `authorize` reads `game` off the global; give it one. */
  function withWorld(fn) {
    const w = world();
    const previous = globalThis.game;
    globalThis.game = {
      ...w,
      messages: {
        get: (id) => (id === "missing" ? null : {
          getFlag: () => JSON.stringify({ state: id === "onCounterRung" ? "counter" : "damage" }),
        }),
      },
    };
    try { return fn(); } finally { globalThis.game = previous; }
  }

  it("refuses a user who does not own the responding unit", () => {
    const out = withWorld(() => auth({ respondingUnitId: "archer", messageId: "onCounterRung" }, "alice"));
    expect(out.allowed).toBe(false);
    expect(out.reason).toMatch(/Not your decision/);
  });

  it("allows the owner while the parent process is on the counter rung", () => {
    const out = withWorld(() => auth({ respondingUnitId: "saber", messageId: "onCounterRung" }, "alice"));
    expect(out.allowed).toBe(true);
  });

  it("refuses the owner when the parent process is somewhere else", () => {
    // A free attack on demand, if this clause were missing.
    const out = withWorld(() => auth({ respondingUnitId: "saber", messageId: "onDamageRung" }, "alice"));
    expect(out.allowed).toBe(false);
    expect(out.reason).toMatch(/not offering a Counter/);
  });

  it("refuses when the message is gone entirely", () => {
    const out = withWorld(() => auth({ respondingUnitId: "saber", messageId: "missing" }, "alice"));
    expect(out.allowed).toBe(false);
  });
});

describe("useSkill authorization (#130, #144)", () => {
  // A Skill pressed from a player's client used to run on that client, where it
  // cannot write the Regions it paints, the Actors and Tokens it creates, or a
  // buff on another player's Unit. It runs on the GM now, as an attack does --
  // so this is what stops a player asking the GM to run somebody else's Skill.
  const auth = OPERATIONS.useSkill.authorize;

  /** Two players, a GM, and Servants that each hold one ability. */
  function skillWorld() {
    const users = {
      alice: { id: "alice", name: "Alice", isGM: false },
      bob: { id: "bob", name: "Bob", isGM: false },
      gm: { id: "gm", name: "GM", isGM: true },
    };
    const actor = (id, ownerId, abilityId) => ({
      id, name: id,
      testUserPermission: (user) => user.id === ownerId,
      items: { get: (itemId) => (itemId === abilityId ? { id: abilityId } : undefined) },
    });
    const actors = { saber: actor("saber", "alice", "charisma"), archer: actor("archer", "bob", "wisdom") };
    return { users: { get: (id) => users[id] ?? null }, actors: { get: (id) => actors[id] ?? null } };
  }

  /** `authorize` reads `game` off the global; give it one. */
  function withGame(fn) {
    const previous = globalThis.game;
    globalThis.game = skillWorld();
    try { return fn(); } finally { globalThis.game = previous; }
  }

  it("allows the owner of the actor to use an ability the actor holds", () => {
    expect(withGame(() => auth({ actorId: "saber", abilityId: "charisma" }, "alice")).allowed).toBe(true);
  });

  it("allows a GM to use anybody's", () => {
    expect(withGame(() => auth({ actorId: "archer", abilityId: "wisdom" }, "gm")).allowed).toBe(true);
  });

  it("refuses a user who does not own the actor", () => {
    const out = withGame(() => auth({ actorId: "archer", abilityId: "wisdom" }, "alice"));
    expect(out.allowed).toBe(false);
    expect(out.reason).toMatch(/Alice does not control archer/);
  });

  it("refuses an ability the actor does not hold, even for its owner", () => {
    const out = withGame(() => auth({ actorId: "saber", abilityId: "wisdom" }, "alice"));
    expect(out.allowed).toBe(false);
    expect(out.reason).toMatch(/holds no such ability/);
  });

  it("refuses an unknown actor and an unknown user", () => {
    expect(withGame(() => auth({ actorId: "ghost", abilityId: "x" }, "alice")).allowed).toBe(false);
    expect(withGame(() => auth({ actorId: "saber", abilityId: "charisma" }, "mallory")).allowed).toBe(false);
  });

  it("hands the use only what a player may choose: the actor, the ability and the placement", async () => {
    // `bypassesCategoryLimit` rides a use the ENGINE decides is free of a cap. A
    // player must not be able to claim it in a socket payload.
    const src = readFileSync("module/net/operations.mjs", "utf8");
    const exec = src.slice(src.indexOf("useSkill: {"), src.indexOf("deactivateField: {"));
    expect(exec).toMatch(/useSkill\(\{\s*actorId: payload\.actorId, abilityId: payload\.abilityId, placement: payload\.placement/);
    expect(exec).not.toMatch(/bypassesCategoryLimit/);
  });
});

describe("deactivateField authorization (#130)", () => {
  // The End control deletes a Region, an Actor and a Token, and starts a
  // cooldown: all GM writes. A player asks in the name of an actor they own, and
  // the GM then checks the field is that actor's and may be ended now.
  const auth = OPERATIONS.deactivateField.authorize;

  function withGame(fn) {
    const previous = globalThis.game;
    const users = { alice: { id: "alice", name: "Alice", isGM: false }, gm: { id: "gm", name: "GM", isGM: true } };
    const actor = (id, ownerId) => ({ id, name: id, testUserPermission: (u) => u.id === ownerId });
    const actors = { saber: actor("saber", "alice"), archer: actor("archer", "bob") };
    globalThis.game = { users: { get: (id) => users[id] ?? null }, actors: { get: (id) => actors[id] ?? null } };
    try { return fn(); } finally { globalThis.game = previous; }
  }

  it("allows the owner of the actor the field belongs to", () => {
    expect(withGame(() => auth({ actorId: "saber", fieldId: "mine" }, "alice")).allowed).toBe(true);
  });

  it("refuses a user who does not own that actor", () => {
    const out = withGame(() => auth({ actorId: "archer", fieldId: "theirs" }, "alice"));
    expect(out.allowed).toBe(false);
    expect(out.reason).toMatch(/Alice does not control archer/);
  });

  it("allows a GM", () => {
    expect(withGame(() => auth({ actorId: "archer", fieldId: "theirs" }, "gm")).allowed).toBe(true);
  });

  it("refuses an unknown actor", () => {
    expect(withGame(() => auth({ actorId: "ghost", fieldId: "x" }, "alice")).allowed).toBe(false);
  });
});
