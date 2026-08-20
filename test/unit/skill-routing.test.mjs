/**
 * @file A Skill is not an Attack — against the shipped content.
 * @see docs/15-abilities.md §15.1, §15.2
 *
 * The bug this pins, reported from a live table: using Asterios's *Avyssos of
 * Labrys* — three buffs, applied to Asterios, touching nobody — opened a
 * targeting session that listed Asterios as a target, priced him at "120–165"
 * damage, offered a button labelled **Attack**, and on confirmation started a
 * Combat Process that asked him to choose Evade or Block.
 *
 * Every layer had the information needed to prevent that. `classifyAbility`
 * returned `isAttack: false`; `targetSpecFor` returned a self/self spec. The
 * sheet's click handler read neither and sent everything to `resolveAttack`.
 *
 * So these run against the **real authored files** rather than fixtures: the
 * defect was not in the classification, and a fixture would have re-tested the
 * part that already worked.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import {
  classifyAbility, needsTargeting, targetSpecFor, countsAsAttack,
} from "../../module/rules/ability-use.mjs";

/** Every authored ability, as the item document the sheet would hold. */
function abilities() {
  const dir = "packs/_source/abilities";
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yml"))
    .map((f) => {
      const doc = parse(readFileSync(join(dir, f), "utf8"));
      return { file: f, type: doc.isNP ? "noblePhantasm" : "ability", system: doc };
    });
}

describe("Asterios's active Skills", () => {
  const byId = (id) => abilities().find((a) => a.system.id === id);

  for (const id of ["asterios-avyssos-of-labrys", "asterios-natural-monster"]) {
    describe(id, () => {
      const ability = byId(id);

      it("is authored", () => {
        expect(ability, `${id} is missing from packs/_source/abilities`).toBeTruthy();
      });

      it("is NOT an attack", () => {
        expect(classifyAbility(ability).isAttack).toBe(false);
      });

      it("does not count as the Unit's Attack for the turn", () => {
        // It applies buffs to its own caster. Marking the Servant as having
        // attacked would cost it the attack it never made.
        expect(countsAsAttack(ability)).toBe(false);
      });

      it("needs NO targeting session", () => {
        // The session is what produced the "Attack" button and the damage
        // range on a self-buff.
        expect(needsTargeting(ability)).toBe(false);
      });

      it("resolves to the caster, not to an enemy", () => {
        const spec = targetSpecFor(ability, 2);

        expect(spec.anchor.kind).toBe("self");
        expect(spec.selection.relations).toEqual(["self"]);
      });
    });
  }
});

describe("every authored ability", () => {
  it("only asks for targeting when something is actually chosen", () => {
    // An ability that opens a session it does not need asks the player a
    // question with one answer -- and the verb on the button will be wrong,
    // because the session belongs to the attack flow.
    for (const ability of abilities()) {
      const use = classifyAbility(ability);
      if (use.isAttack) continue;
      if (ability.system.targeting) continue;

      expect(needsTargeting(ability), `${ability.file} opens a targeting session for nothing`)
        .toBe(false);
    }
  });

  it("never counts as an Attack unless it deals damage directly", () => {
    // The distinction the rules draw: a skill inflicting poison is not an
    // Attack Skill, however much Health the poison eventually costs.
    for (const ability of abilities()) {
      if (!countsAsAttack(ability)) continue;
      if (ability.system.countsAsAttack === true) continue;

      const damages = (ability.system.phases ?? []).some((p) => p.kind === "damage")
        || ability.system.isAttackSkill === true
        || ability.system.isSpell === true
        || ability.system.isNP === true;

      expect(damages, `${ability.file} counts as an Attack and deals no direct damage`).toBe(true);
    }
  });
});
