/**
 * The socket proxy lets any client ask the GM to write anything. This check is
 * what stops one player from handing the GM a batch that kills another
 * player's Servant, so it gets tested harder than anything else in net/.
 */
import { describe, it, expect } from "vitest";
import { authorizeIntents } from "../../module/net/operations.mjs";
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
