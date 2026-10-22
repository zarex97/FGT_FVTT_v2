#!/usr/bin/env node
/**
 * @file Find a Clause's Kin across every Character Sheet on the roster.
 * @see tools/lib/kin.mjs, .claude/skills/survey-class/SKILL.md, docs/model/README.md
 *
 *   node tools/sheet-kin.mjs survey Saber            the Kin groups a Class's sheets touch, and its residue
 *   node tools/sheet-kin.mjs kin "Saber/Gawain"      each Clause of one sheet, beside its nearest Kin
 *   node tools/sheet-kin.mjs stats                   corpus counts at three thresholds
 *
 * `--threshold <0..1>` sets the least word-pair overlap (default 0.5). `--out <file>` writes instead of printing.
 *
 * A group already given a verdict in `docs/model/ledger.json` is listed by its verdict, one line, and not
 * re-read: that is how each Class's survey costs less than the one before it.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { groupKin, loadCorpus, sheetsOf } from "./lib/kin.mjs";

const LEDGER = "docs/model/ledger.json";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const threshold = Number(opt("--threshold", "0.5"));
const outFile = opt("--out", null);
const [command, target] = args;

const builtNames = readdirSync("packs/_source/servants")
  .filter((f) => f.endsWith(".yml") && !f.startsWith("test-"))
  .map((f) => readFileSync(join("packs/_source/servants", f), "utf8").match(/^name:\s*"?([^"\n]+)"?/m)?.[1])
  .filter(Boolean);
const corpus = loadCorpus(undefined, builtNames);

/** @type {Record<string, {verdict: string, shape: string, note?: string}>} normalized head → verdict */
const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : {};
const verdictOf = (g) => g.members.map((m) => ledger[m.norm]).find(Boolean) ?? null;

const clip = (s, n = 160) => (s.length > n ? `${s.slice(0, n - 1)}…` : s).replace(/\|/g, "/").replace(/\s+/g, " ");
const lines = [];
const say = (s = "") => lines.push(s);

if (command === "stats") {
  for (const t of [0.4, 0.5, 0.6]) {
    const g = groupKin(corpus, t);
    const shared = g.filter((x) => sheetsOf(x).length > 1);
    const n = shared.reduce((a, x) => a + x.members.length, 0);
    say(`threshold ${t}: ${g.length} groups, ${shared.length} span 2+ sheets and hold ${n} of ${corpus.length} Clauses (${((100 * n) / corpus.length).toFixed(1)}%)`);
  }
} else if (command === "survey" && target) {
  const groups = groupKin(corpus, threshold);
  const mine = groups.filter((g) => g.members.some((m) => m.cls === target));
  const sheets = new Set(corpus.filter((c) => c.cls === target).map((c) => c.sheet));
  const known = mine.filter(verdictOf);
  const open = mine.filter((g) => !verdictOf(g) && sheetsOf(g).length > 1)
    .sort((a, b) => sheetsOf(b).length - sheetsOf(a).length);
  const residue = mine.filter((g) => !verdictOf(g) && sheetsOf(g).length === 1);

  say(`# Survey: ${target}`);
  say();
  say(`${sheets.size} sheets, ${corpus.filter((c) => c.cls === target).length} Clauses, threshold ${threshold}.`);
  say(`${mine.length} Kin groups touch them: ${known.length} already have a verdict, ${open.length} span other sheets, ${residue.length} are this Class's own.`);
  say();
  say("## Groups with a verdict");
  say();
  const tally = {};
  for (const g of known) { const v = verdictOf(g); tally[`${v.verdict} ${v.shape}`] = (tally[`${v.verdict} ${v.shape}`] ?? 0) + 1; }
  for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) say(`- ${k}: ${n}`);
  say();
  say("## Open groups shared with other sheets");
  say();
  say("| # | sheets | built | Ability (head) | head Clause | other phrasings |");
  say("|---|---|---|---|---|---|");
  open.forEach((g, i) => {
    const others = [...new Map(g.members.filter((m) => m.norm !== g.head.norm).map((m) => [m.norm, m])).values()].slice(0, 2);
    const built = g.members.some((m) => m.built) ? "yes" : "";
    say(`| K${i + 1} | ${sheetsOf(g).length} | ${built} | ${clip(g.head.ability, 40)} | ${clip(g.head.claim, Infinity)} | ${others.map((m) => `${m.sheet}: ${clip(m.claim, Infinity)}`).join(" · ")} |`);
  });
  say();
  say("## Residue: Clauses no other sheet shares");
  say();
  const bySheet = new Map();
  for (const g of residue) for (const m of g.members) bySheet.set(m.sheet, (bySheet.get(m.sheet) ?? []).concat(m));
  for (const [sheet, ms] of [...bySheet].sort()) {
    say(`### ${sheet}${ms[0].built ? " (built)" : ""}`);
    for (const m of ms) say(`- **${clip(m.ability, 40)}**${m.marker ? ` (${m.marker})` : ""}: ${clip(m.claim, Infinity)}`);
  }
} else if (command === "kin" && target) {
  const [cls, sheet] = target.split("/");
  const groups = groupKin(corpus, threshold);
  say(`# Kin of ${target}`);
  for (const g of groups) {
    for (const m of g.members.filter((x) => x.cls === cls && x.sheet === sheet)) {
      const kin = sheetsOf(g).filter((s) => s !== target);
      const built = [...new Set(g.members.filter((x) => x.built && x.sheet !== sheet).map((x) => x.sheet))];
      const v = verdictOf(g);
      say(`- **${clip(m.ability, 40)}**: ${clip(m.claim, Infinity)}`);
      say(`  - ${kin.length} other sheets${built.length ? `, built: ${built.slice(0, 5).join(", ")}` : ""}${v ? `, ${v.verdict} ${v.shape}` : ""}`);
    }
  }
} else {
  console.error("usage: sheet-kin.mjs survey <Class> | kin <Class/Sheet> | stats [--threshold n] [--out file]");
  process.exit(2);
}

if (outFile) writeFileSync(outFile, `${lines.join("\n")}\n`);
else console.log(lines.join("\n"));
