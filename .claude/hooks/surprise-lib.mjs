/**
 * @file What both Surprise hooks share: where the records live and how many wait for review.
 * @see .claude/skills/record-surprise/SKILL.md, .claude/skills/review-surprises/SKILL.md
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** At or past this many unreviewed Surprises, `review-surprises` is due. */
export const REVIEW_AT = 5;

/** @param {string} root the repo root @returns {string} */
export const surprisesDir = (root) => join(root, "docs", "surprises");

/**
 * The Surprise files still marked `reviewed: false`.
 * @param {string} root
 * @returns {string[]} file names
 */
export function unreviewed(root) {
  let names = [];
  try {
    names = readdirSync(surprisesDir(root)).filter((n) => n.endsWith(".md") && n !== "README.md");
  } catch {
    return [];
  }
  return names.filter((n) => /^reviewed:\s*false\s*$/m.test(readFileSync(join(surprisesDir(root), n), "utf8")));
}
