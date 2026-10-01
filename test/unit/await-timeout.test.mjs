/**
 * @file The await timer reads the Process the card carries, and so does every
 * other reader of that flag.
 * @see docs/23-reactions.md
 *
 * `message.getFlag("fgt", "process")` is a **JSON string**
 * (`combat-process.mjs#serialize`). `policyForMessage` handed it to
 * `pendingPrompt` raw, which reads `PROMPTS[undefined]` and returns `null`, so
 * no reaction, Luck Check, Command Spell, Counter or facing prompt ever got a
 * deadline or a countdown (#166). The policy table was tested, the clock was
 * not: nothing ever fed `policyForMessage` the shape a real card stores.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import { policyForMessage } from "../../module/engine/await-timeout.mjs";
import * as process from "../../module/engine/combat-process.mjs";

/** A message stub whose flags are exactly what a stored card holds. */
function messageWith(flags, timestamp = 1_000_000) {
  return {
    id: "m1",
    timestamp,
    getFlag: (scope, key) => (scope === "fgt" ? flags[key] : undefined),
  };
}

/** A real Process, serialized by the module's own serializer, on the Counter rung. */
function counterRung() {
  const state = process.begin({
    attackerId: "attacker",
    defenderId: "defender",
    attack: { abilityId: "normal" },
    groupId: "g1",
  });
  return { ...state, state: "counter", counterAvailable: true };
}

describe("policyForMessage", () => {
  it("reads the serialized Process flag, which is what a card really stores", () => {
    const raw = process.serialize(counterRung());
    expect(typeof raw, "the stored flag is a JSON string").toBe("string");

    const policy = policyForMessage(messageWith({ process: raw }));
    expect(policy).toMatchObject({
      defaultChoice: "declined",
      timeoutMs: 45_000,
      prompt: { kind: "counter", unitId: "defender" },
    });
    expect(policy.deadline, "the deadline runs from the card's timestamp").toBe(1_000_000 + 45_000);
  });

  it("starts the deadline from promptStartedAt when the GM stamped one", () => {
    const raw = process.serialize(counterRung());
    const policy = policyForMessage(messageWith({ process: raw, promptStartedAt: 2_000_000 }));
    expect(policy.deadline).toBe(2_000_000 + 45_000);
  });

  it("also accepts an already-parsed Process object", () => {
    const policy = policyForMessage(messageWith({ process: counterRung() }));
    expect(policy?.prompt.kind).toBe("counter");
  });

  it("fails closed on a flag that does not parse, so no timer ever answers for a state it could not read", () => {
    expect(policyForMessage(messageWith({ process: "{not json" }))).toBeNull();
    expect(policyForMessage(messageWith({ process: JSON.stringify({ state: "nonsense" }) }))).toBeNull();
  });

  it("returns null with no flag, and for a rung that asks nobody anything", () => {
    expect(policyForMessage(messageWith({}))).toBeNull();
    expect(policyForMessage(null)).toBeNull();
    const done = { ...counterRung(), state: "done" };
    expect(policyForMessage(messageWith({ process: process.serialize(done) }))).toBeNull();
  });
});

describe("every reader of the Process flag deserializes it (#166)", () => {
  /** @param {string} dir @returns {string[]} */
  function sourcesUnder(dir) {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourcesUnder(path);
      return path.endsWith(".mjs") ? [path] : [];
    });
  }

  // A reader is a `getFlag("fgt", "process")` whose value is used as a Process.
  // The comparison and truthiness uses are not reads of the contents, and
  // `module/net/operations.mjs#readProcess` parses a string itself.
  const READ = /getFlag\??\.?\(\s*"fgt",\s*"process"\s*\)/g;
  const PARSES = /(?:deserialize|JSON\.parse|readProcess|readProcessFlag)\(/;

  it("passes each read through a parser within the statement that makes it", () => {
    const bare = [];
    for (const file of sourcesUnder("module")) {
      const src = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
      for (const match of src.matchAll(READ)) {
        const line = src.slice(src.lastIndexOf("\n", match.index) + 1, src.indexOf("\n", match.index));
        // Truthiness and identity checks do not read the contents.
        if (/if \(!\s*\w+\??\.getFlag/.test(line)) continue;
        if (/!== before/.test(line) || /const before = /.test(line)) continue;
        // Either the read is the argument of a parser, or `const raw = ...` is
        // parsed within the next few lines.
        const before = line.slice(0, line.indexOf(match[0]));
        if (/(?:deserialize|JSON\.parse|readProcess|readProcessFlag)\(\s*[\w?.]*$/.test(before)) continue;
        if (PARSES.test(src.slice(match.index, match.index + 400))) continue;
        bare.push(`${file}: ${line.trim()}`);
      }
    }
    expect(bare, "a reader that treats the JSON string as an object reads undefined").toEqual([]);
  });
});
