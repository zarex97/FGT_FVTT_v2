/**
 * @file One Attack Description: the preview, the resolution and the
 * counterfactual describe an attack through `describeAttack`.
 * @see module/engine/attack.mjs#describeAttack, docs/22-damage-pipeline.md
 *
 * Each used to assemble its own. The element was decided four ways; the preview
 * missed an element the attacker's state granted, counted a Skill as a Normal
 * Attack, and read Aim and Pierce without the attacker's buffs; the
 * counterfactual never asked for a granted element at all (#195).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { installClientNamespace } from "../helpers/client-namespace.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";

beforeAll(prepareSubjects, 60_000);

const engine = readFileSync("module/engine/attack.mjs", "utf8").replaceAll("\r\n", "\n");
const body = (name) => {
  const from = engine.indexOf(name);
  return engine.slice(from, engine.indexOf("\n}\n", from));
};

describe("every reader takes the one description", () => {
  it("the resolution, the preview and the counterfactual call describeAttack", () => {
    expect(body("async function applyDamage")).toMatch(/describeAttack\(/);
    expect(body("export function previewContext")).toMatch(/describeAttack\(/);
    expect(body("function counterfactualDescription")).toMatch(/describeAttack\(/);
  });

  it("decides an element's share only where the attack is declared, described or identified", () => {
    // Every `elementFraction:` written in the engine, by the function it is in.
    const owners = new Set();
    const lines = engine.split("\n");
    let fn = null;
    for (const line of lines) {
      const head = line.match(/^(?:export )?(?:async )?function (\w+)/);
      if (head) fn = head[1];
      if (/^\s+elementFraction:/.test(line)) owners.add(fn);
    }
    expect(owners.size).toBeGreaterThan(0);
    for (const f of owners) expect(["attackFacts", "attackIdentityOf", "buildAttackSpec", "describeAttack", "withGrantedElement"]).toContain(f);
  });
});

/** A Servant's damage abilities, and its Normal Attack, previewed and described. */
const SWEEP = [
  ["karna", "quetzalcoatl"],
  ["quetzalcoatl", "karna"],
  ["nemo", "medea"],
  ["medea", "nemo"],
  ["emiya", "heracles"],
  ["raikou", "medusa"],
  ["ozymandias", "jack-the-ripper"],
];

describe("the preview describes an attack as the resolution does", () => {
  for (const [owner, defender] of SWEEP) {
    it(`${owner}: every damage ability and the Normal Attack, on ${defender}`, () => withSubjects(
      [{ from: owner, id: owner, panel: { i: 5, j: 5 } }, { from: defender, id: defender, panel: { i: 5, j: 6 } }],
      async ({ unit, board, world }) => {
        installClientNamespace();
        const { previewContext, buildAttackSpec, describeAttack, instancesAgainst } = await import("../../module/engine/attack.mjs");
        const caster = unit(owner);
        const target = unit(defender);
        const doc = world.actor(owner);
        const abilities = [null, ...doc.items.filter((i) => i.system?.damage && (i.system.phases ?? []).some((p) => p.kind === "damage"))];
        expect(abilities.length).toBeGreaterThan(1);
        for (const ability of abilities) {
          const isNP = ability?.type === "noblePhantasm";
          const preview = previewContext({ caster, defender: target, ability, board, isNP });
          // The resolution's path: the declaration a press stores, then the description.
          const declared = buildAttackSpec({
            attacker: doc, ability, abilityId: ability?.id ?? null,
            options: rollOptionsFor({ attacker: caster, defender: target }), board,
          });
          // ...with its first instance spread over it, as the first Process's
          // attack is (`declareProcesses`, #230: a block's own keys live there).
          const instance = instancesAgainst(ability, caster, target, declared)[0] ?? {};
          const resolution = describeAttack({
            state: { attack: { ...declared, ...instance, instanceBlock: instance, kind: isNP ? "np" : declared.kind } },
            attacker: caster, defender: target, board, ability,
          }).attack;
          const pick = (a) => ({
            kind: a.kind, component: a.component, element: a.element, elementFraction: a.elementFraction,
            aim: a.aim, pierce: a.pierce, ignoresMagicResistance: a.ignoresMagicResistance,
            rank: String(a.rank ?? ""), npTags: a.npTags, isFixedDamage: a.isFixedDamage, range: a.range,
          });
          expect(pick(preview.attack), ability?.name ?? "Normal Attack").toEqual(pick(resolution));
        }
      },
    ), 120_000);
  }
});
