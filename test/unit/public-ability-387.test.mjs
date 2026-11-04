/**
 * #387: an ability's name reveals its Unit, so a card prints a tag.
 *
 * The tag is a pure function of the War, the Unit and the ability. The pick list's
 * text is walked over the whole roster, because removing names by code only holds
 * if something proves what is left.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "js-yaml";
import { PUBLIC_TAG, publicTagOf, scrubbedText, tagPrefix } from "../../module/rules/public-ability.mjs";
import { abilityNameReads, ABILITY_NAME_READ } from "../../tools/check-public-names.mjs";

const np = { type: "noblePhantasm", system: { contentId: "x-excalibur" } };
const skill = { type: "ability", system: { contentId: "x-charisma" } };

describe("a public tag (rulings 50, 58, 59, 60)", () => {
  it("is its kind and five letters and digits", () => {
    expect(publicTagOf(np, { warId: "w", unitId: "u" })).toMatch(/^NP-[2-9A-HJ-NP-Z]{5}$/);
    expect(publicTagOf(skill, { warId: "w", unitId: "u" })).toMatch(/^SK-[2-9A-HJ-NP-Z]{5}$/);
  });

  it("files a Class Skill and a Spell under SK", () => {
    expect(tagPrefix({ type: "ability", system: { kind: "classSkill" } })).toBe("SK");
    expect(tagPrefix({ type: "ability", system: { kind: "spell" } })).toBe("SK");
    expect(tagPrefix({ type: "ability", system: { isNP: true } })).toBe("NP");
  });

  it("holds for a War and changes with the next", () => {
    const here = publicTagOf(np, { warId: "w1", unitId: "u" });
    expect(publicTagOf(np, { warId: "w1", unitId: "u" })).toBe(here);
    expect(publicTagOf(np, { warId: "w2", unitId: "u" })).not.toBe(here);
  });

  it("differs on two Units who hold one Skill", () => {
    expect(publicTagOf(skill, { warId: "w", unitId: "a" })).not.toBe(publicTagOf(skill, { warId: "w", unitId: "b" }));
  });

  it("is shared by one printed NP on two clocks, by publicTagAs", () => {
    const method2 = { type: "noblePhantasm", system: { contentId: "x-method-2", publicTagAs: "x-excalibur" } };
    expect(publicTagOf(method2, { warId: "w", unitId: "u" })).toBe(publicTagOf(np, { warId: "w", unitId: "u" }));
  });

  it("is found in a line of text, and a name is not", () => {
    const tag = publicTagOf(np, { warId: "w", unitId: "u" });
    expect(`Archer of Red used ${tag}.`.match(PUBLIC_TAG)).toEqual([tag]);
    expect("NP Seal lands on SK-1 and NP-ABCDEFG".match(PUBLIC_TAG)).toBeNull();
  });
});

describe("a pick list's text (ruling 55)", () => {
  const bearer = {
    names: ["Arturia Pendragon"],
    ownName: "Charisma",
    abilities: [
      { id: "avalon", name: "Avalon: The Everdistant Utopia", tag: "NP-AAAAA" },
      { id: "short", name: "Avalon", tag: "SK-BBBBB" },
    ],
  };

  it("takes out the bearer's name, whole or in part, and only as a word", () => {
    expect(scrubbedText("Whenever Arturia's Charisma fires, Arturian Knights rejoice.", bearer))
      .toBe("Whenever this Unit's this Skill fires, Arturian Knights rejoice.");
    expect(scrubbedText("Arturia Pendragon stands.", bearer)).toBe("this Unit stands.");
  });

  it("gives another ability its tag, longest name first", () => {
    expect(scrubbedText("Uses Avalon: The Everdistant Utopia, or Avalon.", bearer)).toBe("Uses NP-AAAAA, or SK-BBBBB.");
    expect(scrubbedText("Uses @ability[avalon]{Avalon: The Everdistant Utopia}.", bearer)).toBe("Uses NP-AAAAA.");
  });

  it("takes out another Servant's name too: a rival names the bearer", () => {
    expect(scrubbedText("Against Karna only.", { ...bearer, others: ["Karna"] })).toBe("Against another Unit only.");
  });

  it("keeps an effect's words and drops its link", () => {
    expect(scrubbedText("Inflicts @effect[stun]{Stun}.", bearer)).toBe("Inflicts Stun.");
  });
});

describe("the roster, scrubbed", () => {
  const root = join(process.cwd(), "packs", "_source");
  const load = (dir) => readdirSync(join(root, dir)).filter((f) => f.endsWith(".yml"))
    .map((f) => YAML.load(readFileSync(join(root, dir, f), "utf8")));
  const abilities = new Map([...load("abilities"), ...load("class-skills")].map((a) => [a.id, a]));
  const servants = load("servants").filter((s) => s?.type === "servant");

  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const word = (name) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`, "u");
  const rosterNames = [...new Set(servants.flatMap((s) => [s.trueName, s.name]).filter(Boolean))];

  it("leaves no Servant's True Name in any Skill another Unit can pick", () => {
    const leaks = [];
    for (const servant of servants) {
      const held = (servant.abilities ?? []).map((r) => abilities.get(r.ref)).filter(Boolean);
      for (const ability of held) {
        if (ability.isNP || ability.kind === "classSkill") continue;
        const text = scrubbedText(ability.description ?? "", {
          names: [servant.trueName, servant.name].filter(Boolean),
          others: rosterNames.filter((n) => n !== servant.trueName && n !== servant.name),
          ownName: ability.name,
          abilities: held.filter((a) => a !== ability).map((a) => ({ id: a.id, name: a.name, tag: "SK-22222" })),
        });
        for (const name of rosterNames) {
          if (word(name).test(text)) leaks.push(`${ability.id}: ${name}`);
        }
        for (const other of held) {
          if (other !== ability && other.name && word(other.name).test(text)) leaks.push(`${ability.id}: ${other.name}`);
        }
      }
    }
    expect(leaks).toEqual([]);
  });
});

describe("the guard", () => {
  it("refuses an ability's name read raw, naming the expression and why", () => {
    const found = abilityNameReads("  const line = `${ability.name} hits`;");
    expect(found).toHaveLength(1);
    expect(found[0].expression).toBe("ability.name");
    expect(found[0].problem).toMatch(/reveals its Unit: ask `shownAbility`/);
  });

  it("passes a line that says why, console text, and a comment", () => {
    expect(abilityNameReads("  name: item.name, // fgt-name-ok: the owner's prompt")).toEqual([]);
    expect(abilityNameReads("  console.warn(`FGT | ${ability.name} failed`);")).toEqual([]);
    expect(abilityNameReads("  // ability.name was read here")).toEqual([]);
    // A bare marker says nothing.
    expect(abilityNameReads("  name: item.name, // fgt-name-ok:")).toHaveLength(1);
  });

  it("reads the holders the sites use", () => {
    for (const held of ["ability.name", "item?.name", "np.name", "cancelling.name"]) {
      expect(ABILITY_NAME_READ.test(held)).toBe(true);
    }
    expect(ABILITY_NAME_READ.test("effect.name")).toBe(false);
    // Read in one chain, as a Cooldown row printed Airavata King Size to the whole table.
    expect(ABILITY_NAME_READ.test("unitActor(id)?.items?.get(a)?.name")).toBe(true);
  });
});
