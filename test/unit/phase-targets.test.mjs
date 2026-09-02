/**
 * @file `phase.target` decides who a phase lands on, and nothing read it.
 * @see module/engine/skill-use.mjs
 *
 * Every ability in the reference set has authored `target: self` or
 * `target: reuse` since phases existed. The skill executor looped every phase
 * over every resolved target and ignored the field entirely.
 *
 * It stayed invisible because every `target: self` phase belonged to a
 * *self-targeting* ability, where the two lists are identical. Scáthach's
 * Primordial Rune is the first where they differ — *"Gain 2 PRS Tokens. Then,
 * ... on an allied Unit"* — and in a live world the tokens went to the ally.
 *
 * A static guard rather than a behavioural one: the executor needs a world, so
 * this checks that every authored phase names a target the executor
 * understands, which is the half that can go wrong silently.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

/** @param {string} dir @returns {string[]} */
function ymlUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return ymlUnder(path);
    return e.name.endsWith(".yml") ? [path] : [];
  });
}

/** The two the executor implements. Anything else is a typo that lands wrongly. */
const TARGETS = new Set(["self", "reuse"]);

/**
 * Does this ability resolve through `resolveAttack` rather than `useSkill`?
 * The same test `classifyAbility` makes, against authored data.
 * @param {object} a
 * @returns {boolean}
 */
function isAttack(a) {
  return Boolean(a?.isNP || a?.isSpell || a?.isAttackSkill)
    || (a?.phases ?? []).some((p) => p?.kind === "damage");
}

describe("authored phases", () => {
  const docs = ymlUnder("packs/_source").map((path) => ({ path, doc: parse(readFileSync(path, "utf8")) }));

  it("name a target the executor understands", () => {
    /** @type {string[]} */
    const bad = [];

    for (const { path, doc } of docs) {
      for (const holder of [doc, ...(doc?.abilities ?? [])]) {
        for (const [index, phase] of (holder?.phases ?? []).entries()) {
          if (phase?.target === undefined) continue;
          if (!TARGETS.has(phase.target)) {
            bad.push(`${path}: ${holder.id ?? holder.ref}.phases[${index}] targets "${phase.target}"`);
          }
        }
      }
    }

    expect(bad).toEqual([]);
  });

  it("gives a self-phase on an outward-targeting ability an explicit target", () => {
    // The Primordial Rune case, stated as a rule rather than as one file: an
    // ability whose targeting can reach somebody else must say, per phase,
    // which of them each phase is for. Defaulting is what sent the tokens to
    // Medea.
    /** @type {string[]} */
    const bad = [];

    for (const { path, doc } of docs) {
      for (const holder of [doc, ...(doc?.abilities ?? [])]) {
        // Only the SKILL path is at risk. An attack resolves one Combat
        // Process per defender, so its phases already have exactly one target
        // and `phase.target` is documentation there rather than a selector.
        if (isAttack(holder)) continue;

        const relations = holder?.targeting?.selection?.relations ?? null;
        if (!relations || relations.every((r) => r === "self")) continue;

        for (const [index, phase] of (holder?.phases ?? []).entries()) {
          // A phase carrying its OWN `targeting` has answered the question
          // more precisely than `target` could: `phaseTargets` reads that and
          // ignores `target` entirely. Guidance of the Netherworld's second
          // phase is the case -- "applies GotN to all affected Units EXCLUDING
          // ITSELF" reaches a different set from the Skill's own, which is
          // neither `self` nor `reuse`.
          if (phase?.targeting) continue;
          if (phase?.target === undefined) {
            bad.push(`${path}: ${holder.id ?? holder.ref}.phases[${index}] has no target`);
          }
        }
      }
    }

    expect(bad).toEqual([]);
  });
});
