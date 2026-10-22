/**
 * @file Sheet Kin: which Clauses on the roster say the same thing, in the same or similar words.
 * @see docs/model/README.md
 *
 * The survey of every Character Sheet (`.claude/skills/survey-class`) cannot read 469 sheets whole: that is
 * about 2.9M characters. It reads one Clause per Kin group instead, plus the Clauses that match nothing.
 *
 * Similar is measured, not guessed. A Clause is normalized first: numbers, ranks, ◈ fractions and the
 * owner's own name are masked, so "reduced by 40%" and "reduced by 20%" are one phrasing. Two normalized
 * Clauses are Kin when their word pairs overlap (Jaccard) at or above a threshold. Grouping is leader-based,
 * not transitive: a Clause joins the group whose first member it is closest to, so a chain of near
 * neighbours never fuses two unlike rules into one group.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

import { parseCharacterSheet } from "./clauses.mjs";

/** Where `tools/` keeps the per-Class export of the Drive roster folders. */
export const BY_CLASS_DIR = "char_orig_sheets/by-class";

/** Files in a Class folder that are not Character Sheets. */
const NOT_A_SHEET = new Set(["Note for Grand Order Campaign.md"]);

/**
 * Built Servants whose document name differs from their sheet's title. The rest match by name.
 * @type {Record<string, string>}
 */
const BUILT_ALIASES = {
  "Gilles de Rais (Saber)": "Gilles de Rais",
  "Hundred-Faced Hassan": "Hassan (Hundred-Face)",
  "Hassan of Serenity": "Hassan (Serenity)",
  Castor: "Dioscuri",
  Pollux: "Dioscuri",
  "Anastasia (Summer)": "Anastasia & Viy",
};

/**
 * A Clause's text with what varies between bearers masked out.
 * @param {string} text
 * @param {string} [owner] the sheet's title; its first word stands for the bearer in the prose
 */
export function normalize(text, owner = "") {
  let s = String(text).replace(/\\/g, "").replace(/\*\*/g, "");
  const self = owner.split(/[\s(]/)[0];
  if (self.length > 2) s = s.replaceAll(self, "SELF");
  return s
    .replace(/[‘’“”]/g, "'")
    .replace(/[0-9]+(\.[0-9]+)?/g, "#")
    .replace(/[◈⅓⅔½¼]+/g, "◈")
    .replace(/\bRank:? [A-E][+-]*|\bEX\b/g, "Rank")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** @param {string} norm */
export function wordPairs(norm) {
  const w = norm.split(" ");
  const g = new Set();
  for (let i = 0; i + 1 < w.length; i++) g.add(`${w[i]} ${w[i + 1]}`);
  if (g.size === 0 && w[0]) g.add(w[0]);
  return g;
}

/** @param {Set<string>} a @param {Set<string>} b */
export function jaccard(a, b) {
  let i = 0;
  for (const t of a) if (b.has(t)) i++;
  return i / (a.size + b.size - i || 1);
}

/**
 * @typedef {object} KinClause
 * @property {string} cls      the Class folder the sheet sits in
 * @property {string} sheet    the sheet's file name, without `.md`
 * @property {boolean} built   whether a Servant document exists for this sheet
 * @property {string} ability
 * @property {"classSkill"|"noblePhantasm"|"skill"|"statblock"} abilityKind
 * @property {string|null} marker
 * @property {string} claim    the Clause as the sheet states it
 * @property {string} norm
 * @property {Set<string>} pairs
 */

/**
 * Every Clause on every sheet under `dir`, one record each.
 * @param {string} [dir]
 * @param {string[]} [builtNames] Servant document names; a sheet is built when one maps onto its title
 * @returns {KinClause[]}
 */
export function loadCorpus(dir = BY_CLASS_DIR, builtNames = []) {
  const built = new Set(builtNames.map((n) => BUILT_ALIASES[n] ?? n));
  /** @type {KinClause[]} */
  const out = [];
  for (const cls of readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory())) {
    for (const file of readdirSync(join(dir, cls)).filter((f) => f.endsWith(".md") && !NOT_A_SHEET.has(f))) {
      const sheet = basename(file, ".md");
      const parsed = parseCharacterSheet(readFileSync(join(dir, cls, file), "utf8"));
      for (const group of parsed.groups) {
        if (group.statClause) out.push(record(cls, sheet, built, "Statblock", "statblock", null, group.statClause.claim));
        for (const a of group.abilities) {
          const kind = a.isNP ? "noblePhantasm" : a.isClassSkill ? "classSkill" : "skill";
          for (const c of a.clauses) out.push(record(cls, sheet, built, a.name, kind, c.marker, c.claim));
        }
      }
    }
  }
  return out;
}

/** @returns {KinClause} */
function record(cls, sheet, built, ability, abilityKind, marker, claim) {
  const norm = normalize(claim, sheet);
  return { cls, sheet, built: built.has(sheet), ability, abilityKind, marker, claim, norm, pairs: wordPairs(norm) };
}

/**
 * @typedef {object} KinGroup
 * @property {KinClause} head        the first member, the one a reader reads
 * @property {KinClause[]} members
 * @property {number} exact          members whose normalized text equals the head's
 */

/**
 * Leader-based grouping. Commoner phrasings lead: a Clause whose exact normalized text recurs is placed first.
 * @param {KinClause[]} clauses
 * @param {number} [threshold] the least word-pair overlap that makes two Clauses Kin
 * @returns {KinGroup[]}
 */
export function groupKin(clauses, threshold = 0.5) {
  const freq = new Map();
  for (const c of clauses) freq.set(c.norm, (freq.get(c.norm) ?? 0) + 1);
  const ordered = [...clauses].sort((a, b) => freq.get(b.norm) - freq.get(a.norm) || b.norm.length - a.norm.length);

  /** @type {KinGroup[]} */
  const groups = [];
  const byNorm = new Map();
  /** @type {Map<string, number[]>} word pair → indexes of groups whose head carries it */
  const index = new Map();
  for (const c of ordered) {
    const same = byNorm.get(c.norm);
    if (same !== undefined) { groups[same].members.push(c); groups[same].exact++; continue; }
    const seen = new Set();
    let best = -1, score = 0;
    for (const p of c.pairs) for (const gi of index.get(p) ?? []) {
      if (seen.has(gi)) continue;
      seen.add(gi);
      const j = jaccard(c.pairs, groups[gi].head.pairs);
      if (j > score) { score = j; best = gi; }
    }
    if (best >= 0 && score >= threshold) { groups[best].members.push(c); continue; }
    groups.push({ head: c, members: [c], exact: 1 });
    byNorm.set(c.norm, groups.length - 1);
    for (const p of c.pairs) index.set(p, (index.get(p) ?? []).concat(groups.length - 1));
  }
  return groups;
}

/** The distinct sheets a group spans. @param {KinGroup} g */
export const sheetsOf = (g) => [...new Set(g.members.map((m) => `${m.cls}/${m.sheet}`))];
