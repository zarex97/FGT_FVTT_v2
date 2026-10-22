import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import {
  annotateClauses, buildIndex, capabilityOf, conversionSheet, ledgerCoverage, readClauseList, resolveKeyRef,
} from "../../tools/lib/capabilities.mjs";

/** @type {import("../../tools/lib/capabilities.mjs").Index} */
let index;
beforeAll(async () => { index = await buildIndex(); }, 60_000);

describe("the model's keys: lines", () => {
  it("every field bullet in docs/model carries a keys: line", () => {
    const missing = index.model.filter((m) => !m.hasKeys).map((m) => `${m.file}:${m.line}`);
    expect(missing).toEqual([]);
  });

  it("every key a keys: line names exists in the authored vocabulary", () => {
    const bad = index.model.flatMap((m) => m.keys
      .map((k) => ({ k, r: resolveKeyRef(k, index) }))
      .filter(({ r }) => !r.ok)
      .map(({ k, r }) => `${m.file}:${m.line} ${k}: ${r.why}`));
    expect(bad).toEqual([]);
  });

  it("a key that does not exist is refused, saying why", () => {
    expect(resolveKeyRef("element.NoSuchElement", index)).toEqual({ ok: false, why: "no element named NoSuchElement" });
    expect(resolveKeyRef("element.RankShift.nonsense", index)).toEqual({ ok: false, why: "RankShift has no field nonsense" });
    expect(resolveKeyRef("bogus.RankShift", index).why).toBe("unknown family bogus");
  });
});

describe("what the survey wrongly called a gap", () => {
  it("finds RankShift's Parameter branch and Kiritsugu authoring it (#284)", () => {
    const top = capabilityOf("RankShift", index).hits[0];
    expect(top.key).toBe("element.RankShift");
    expect(top.entry.fields).toContain("parameter");
    expect(top.entry.usage).toContain("packs/_source/abilities/kiritsugu-affection-of-the-holy-grail.yml");
  });

  it("finds the Split action the Horrors author (#290)", () => {
    const split = capabilityOf("split", index).hits.find((h) => h.key === "action.Split");
    expect(split.entry.usage).toContain("packs/_source/summons/horror.yml");
  });
});

describe("conversion sources", () => {
  it("every built Servant names the sheet it was converted from, and the sheet exists", () => {
    const dir = "packs/_source/servants";
    const problems = [];
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".yml") && !x.startsWith("test-"))) {
      const sheet = conversionSheet(readFileSync(join(dir, f), "utf8"));
      if (!sheet) problems.push(`${f}: no # Conversion source: line`);
      else if (!existsSync(`char_orig_sheets/Copia de ${sheet}.md`)) problems.push(`${f}: ${sheet} has no sheet`);
    }
    expect(problems).toEqual([]);
  });

  it("reads the sheet name out of the comment", () => {
    expect(conversionSheet("# x\n# Conversion source: char_orig_sheets/Copia de Proto Gil.md (as edited 2026-10-16)\n")).toBe("Proto Gil");
    expect(conversionSheet("# Castor, char_orig_sheets/Copia de Dioscuri.md\n")).toBeNull();
  });
});

describe("a hand-written Clause list", () => {
  it("reads each Clause under its Ability's heading", () => {
    const md = "# Someone — the Clause list\n\n## Fist — Rank A *(Active)*\n\n- [ ] **F.crit** · Crit Up 60% · *Untouched*\n- [x] **F.cd** · Cooldown 4◈ · *Pressed* · seen\n";
    expect(readClauseList(md)).toEqual({
      owner: "Someone",
      clauses: [
        { ref: "F.crit", claim: "Crit Up 60%", ability: "Fist", line: 5 },
        { ref: "F.cd", claim: "Cooldown 4◈", ability: "Fist", line: 6 },
      ],
    });
  });

  it("annotates Yan Qing's 75 Clauses through his own sheet's wording", () => {
    const rows = annotateClauses(readFileSync("docs/superpowers/specs/2026-10-19-yan-qing-clauses.md", "utf8"), { index });
    expect(rows).toHaveLength(75);
    const by = Object.fromEntries(rows.map((r) => [r.ref, r]));
    expect(by["ZG.np"].keys).toContain("element.OnEvent");
    expect(by["YF.crit"].keys).toContain("effect.critUp");
    expect(by["YF.crit"].precedent?.file).toMatch(/^packs\/_source\/abilities\//);
    // His own sheet is never his precedent: a precedent is another built Servant.
    expect(rows.every((r) => r.precedent?.servant !== "Yan Qing")).toBe(true);
  });

  it("finds a list's sheet through its built Servant when the titles differ", () => {
    // "Gilles de Rais (Saber)" is the Servant; his roster sheet is "Gilles de Rais".
    const rows = annotateClauses(readFileSync("docs/superpowers/specs/2026-10-20-gilles-saber-clauses.md", "utf8"), { index });
    expect(rows.filter((r) => r.sheetClause).length).toBeGreaterThan(100);
  });
});

describe("the ledger", () => {
  it("resolves its Shape labels to keys, a model field or a family, and the unmapped few do not grow", () => {
    const { unmapped } = ledgerCoverage(index);
    // 19 on 2026-10-22: War setup, Contract, History and the like, which have no single authored key.
    expect(unmapped.length).toBeLessThanOrEqual(19);
  });
});
