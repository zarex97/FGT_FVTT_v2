/**
 * @file Castor receives Pollux's Magic Resistance while directly next to him (#102).
 * @see packs/_source/class-skills/magic-resistance.yml, module/rules/auras.mjs
 *
 * > *"(Pollux) Class Skill: Magic Resistance — Rank: A. … When Castor is
 * > directly next to Pollux, Castor also receives the effect of this Skill."*
 * > — char_orig_sheets/Copia de Dioscuri.md, lines 101–104
 *
 * The shared template authored the partner aura's payload as `rules:`, which
 * the Aura executor never reads (it reads `elements`), and set
 * `recipientRoles: [linkedPartner]`, which the executor never copied. So the
 * aura that reached every adjacent ally carried nothing, and Castor, who has no
 * Magic Resistance of his own, has never had any.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 60_000);

// Real actor ids: `memberIds` is a list of them, and the model refuses anything else.
const POLLUX = "polluxDioscuri01";
const CASTOR = "castorDioscuri01";
const ALLY = "allyOfPollux0001";

const dioscuri = (castorPanel) => [
  {
    from: "pollux", id: POLLUX, panel: { i: 5, j: 5 },
    state: { factionId: "f1", linkedGroup: { id: "dioscuri", partners: ["castor"], memberIds: [CASTOR] } },
  },
  {
    from: "castor", id: CASTOR, panel: castorPanel,
    state: { factionId: "f1", linkedGroup: { id: "dioscuri", partners: ["pollux"], memberIds: [POLLUX] } },
  },
  { from: "heracles", id: ALLY, panel: { i: 5, j: 4 }, state: { factionId: "f1" } },
];

describe("Pollux's Magic Resistance", () => {
  it("reaches Castor directly next to him: negates MAG up to A, else −50%", async () => {
    const mr = await withSubjects(dioscuri({ i: 5, j: 6 }), ({ unit }) => unit(CASTOR).magicResistance);
    expect(mr).toMatchObject({ mode: "rank", percent: 50, component: "mag", includesNP: true });
    expect(String(mr.rank)).toBe("A");
  });

  it("reaches Castor's debuff chance too, exactly as Pollux holds it: the whole Skill", async () => {
    const [castor, pollux] = await withSubjects(dioscuri({ i: 5, j: 6 }), ({ unit }) => [CASTOR, POLLUX].map((id) =>
      (unit(id).applicationChances ?? []).filter((c) => /Magic Resistance/.test(c.source))
        .map((c) => ({ severity: c.severity, value: c.value, predicate: c.predicate, direction: c.direction }))));
    expect(pollux).toHaveLength(2);
    expect(castor).toEqual(pollux);
  });

  it("does not reach Castor two panels away", async () => {
    const mr = await withSubjects(dioscuri({ i: 5, j: 7 }), ({ unit }) => unit(CASTOR).magicResistance);
    expect(mr ?? null).toBeNull();
  });

  it("does not reach an ordinary ally standing next to Pollux", async () => {
    const mr = await withSubjects(dioscuri({ i: 5, j: 7 }), ({ unit }) => unit(ALLY).magicResistance);
    expect(mr ?? null).toBeNull();
  });
});
