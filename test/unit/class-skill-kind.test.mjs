/**
 * @file A Class Skill carries `kind: classSkill` (ruled 2026-11-13, Q6, Q7, Q10).
 *
 * Riding, Presence Concealment and Pretender were sold in the Dossier's Active
 * Skills, shown among the sheet's Skills, coercible and copyable, because their
 * files said `kind: skill` or nothing. Every reader of a Class Skill asks the
 * kind (`rules/intel.mjs#sectionOf`, `rules/copy.mjs`, `rules/skill-theft.mjs`,
 * Coercion, the actor sheet), so the kind is checked against two sources:
 *
 * 1. Every file in `packs/_source/class-skills/` is a Class Skill (ruled Q6:
 *    Divinity, Battle Continuation and Bravery too; Q7: Pretender too).
 * 2. Every ability a built Servant holds under a name its own sheet prints after
 *    "Class Skill:" is one, wherever its file lives (per-Servant variants sit in
 *    `abilities/`: Medea's Item Construction, `normal-riding`).
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { conversionPath } from "../../tools/lib/capabilities.mjs";

const SRC = "packs/_source";

/** @param {string} dir @returns {Array<{file: string, doc: object, text: string}>} */
function load(dir) {
  return readdirSync(join(SRC, dir)).filter((f) => f.endsWith(".yml")).map((f) => {
    const text = readFileSync(join(SRC, dir, f), "utf8");
    return { file: `${dir}/${f}`, doc: YAML.parse(text) ?? {}, text };
  });
}

/** Lowercase letters and digits only, no parenthesis: "Presence Concealment (J)" → "presenceconcealment". */
const fold = (s) => String(s ?? "").replace(/\\/g, "").replace(/\s*\(.*$/, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** The names a sheet prints after "Class Skill:". @param {string} text @returns {Set<string>} */
function classSkillNames(text) {
  const out = new Set();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^(?:#+\s*)?\([^)]*\)\s*Class Skill:\s*(.+?)\s*(?:—|$)/);
    if (m) out.add(fold(m[1]));
  }
  return out;
}

const abilities = new Map([...load("abilities"), ...load("class-skills")].map((a) => [a.doc.id, a]));

describe("a Class Skill carries kind: classSkill", () => {
  it("every file in class-skills/ is one (Q6, Q7)", () => {
    const files = load("class-skills");
    expect(files.length).toBeGreaterThanOrEqual(28);
    expect(files.filter((f) => f.doc.kind !== "classSkill").map((f) => f.file)).toEqual([]);
  });

  it("every ability its bearer's sheet prints after \"Class Skill:\" is one, wherever it lives (Q10)", () => {
    const wrong = [];
    let checked = 0;
    for (const { doc, text } of load("servants")) {
      if (String(doc.id ?? "").startsWith("test-")) continue;
      const path = conversionPath(text);
      if (!path) continue;
      const names = classSkillNames(readFileSync(path, "utf8"));
      for (const ref of doc.abilities ?? []) {
        const a = abilities.get(ref?.ref);
        if (!a || !names.has(fold(a.doc.name))) continue;
        checked += 1;
        if (a.doc.kind !== "classSkill") wrong.push(`${doc.id}: ${a.file} (${a.doc.name}) is ${a.doc.kind ?? "unset"}`);
      }
    }
    // It found its subjects: a regex that matched nothing would pass on an empty list.
    expect(checked).toBeGreaterThanOrEqual(60);
    expect(wrong).toEqual([]);
  });
});
