/**
 * The extractor's job is to make an audit issue's Clause list without hand
 * transcription, and its failure mode is the programme's own dominant defect:
 * a Clause that is quietly missing. So the assertions that matter are the ones
 * about completeness — that Asterios yields the thirty Clauses his issue was
 * audited against, and that anything the grammar could not place is *reported*
 * rather than dropped.
 *
 * @see docs/46-roster-re-audit.md
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import { abbreviate, allClauses, parseCharacterSheet, renderClauseList } from "../../tools/lib/clauses.mjs";

const SHEET_DIR = "char_orig_sheets";
const sheet = (name) => parseCharacterSheet(readFileSync(join(SHEET_DIR, `Copia de ${name}.md`), "utf8"));
const refs = (parsed) => allClauses(parsed).map((c) => c.ref);

/**
 * The list issue #41 was audited against, in its order. The two `.pre` refs are
 * the tool's placeholders for the Clauses a human named `ME.lock` and
 * `CL.geom` — the only two names in the whole list that are not mechanical.
 */
const ASTERIOS = [
  "SB",
  "ME.pre", "ME.1", "ME.2", "ME.3", "ME.4", "ME.5", "ME.6", "ME.7",
  "MS.1", "MS.cd",
  "NM.p", "NM.a", "NM.cd",
  "AL.1", "AL.2", "AL.3", "AL.cd",
  "CL.pre", "CL.1", "CL.2", "CL.3", "CL.4", "CL.5", "CL.6", "CL.7", "CL.8", "CL.9", "CL.10", "CL.cd",
];

describe("Asterios reproduces the list his audit was run against", () => {
  it("yields his thirty Clauses, in order, grouped under his five Abilities", () => {
    const parsed = sheet("Asterios");
    expect(refs(parsed)).toEqual(ASTERIOS);
    expect(ASTERIOS).toHaveLength(30);
    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0].abilities.map((a) => a.name)).toEqual([
      "Mad Enhancement",
      "Monstrous Strength",
      "Natural Monster",
      "Avyssos of Labrys",
      "Chaos Labyrinthos: Eternally Unchanging Labyrinth",
    ]);
  });

  it("names the two Clauses a human has to name, and only those two", () => {
    const parsed = sheet("Asterios");
    expect(allClauses(parsed).filter((c) => c.unnamed).map((c) => c.ref)).toEqual(["ME.pre", "CL.pre"]);
    expect(parsed.warnings).toHaveLength(2);
    expect(parsed.warnings[0].why).toMatch(/Mad Enhancement opens with a rule of its own/);
  });

  it("carries the statblock as one Clause with the fields the audit checks", () => {
    const [sb] = allClauses(sheet("Asterios"));
    expect(sb.ref).toBe("SB");
    expect(sb.claim).toContain("STR A++");
    expect(sb.claim).toContain("Base Health 1500");
    expect(sb.claim).toContain("Range 2/1");
    expect(sb.claim).toContain("BA(STR) 170");
    expect(sb.claim).toContain("Sustainability 2◈");
  });

  it("keeps the escape ladder's two paragraphs as the one Clause it was audited as", () => {
    const cl5 = allClauses(sheet("Asterios")).find((c) => c.ref === "CL.5");
    expect(cl5.claim).toMatch(/must first Move to the inner border/);
    expect(cl5.claim).toMatch(/increased by 5% for the next Escape attempt/);
  });

  it("splits a Cooldown off the Clause that spends it, stated either way", () => {
    const clauses = allClauses(sheet("Asterios"));
    // Monstrous Strength welds its Cooldown to the Clause; Avyssos states it on its own line.
    expect(clauses.find((c) => c.ref === "MS.cd").claim).toBe("Cooldown: 3◈ Turns.");
    expect(clauses.find((c) => c.ref === "MS.1").claim).not.toMatch(/Cooldown/);
    expect(clauses.find((c) => c.ref === "AL.cd").claim).toBe("Cooldown: 3◈ Turns.");
  });
});

describe("timing markers decide which evidence a Clause needs", () => {
  it("gives an Ability with a passive and an active part two records", () => {
    const nm = sheet("Asterios").groups[0].abilities.find((a) => a.name === "Natural Monster");
    expect(nm.markers).toEqual(["Passive", "Active"]);
    expect(nm.clauses.map((c) => c.ref)).toEqual(["NM.p", "NM.a", "NM.cd"]);
    expect(nm.clauses[0].marker).toBe("Passive");
    expect(nm.clauses[1].marker).toBe("Active");
  });

  it("carries the marker onto the rendered list, so a press is distinguishable from an observation", () => {
    const rendered = renderClauseList(sheet("Asterios"));
    expect(rendered).toContain("## Natural Monster — Rank A++ *(Passive + Active — two records)*");
    expect(rendered).toContain("## Mad Enhancement — Class Skill, Rank B *(Active)*");
  });

  it("numbers a Passive 1 / Passive 2 pair apart", () => {
    const castor = sheet("Dioscuri").groups.find((g) => g.name === "Castor");
    const core = castor.abilities.find((a) => a.name === "Twin God’s Divine Core");
    expect(core.clauses.map((c) => c.ref)).toEqual(["CA.TGDC.p1", "CA.TGDC.p2", "CA.TGDC.n1"]);
  });
});

describe("the rendered list is what the tracker counts", () => {
  it("emits one task-list item per Clause, every one starting at Untouched", () => {
    const parsed = sheet("Asterios");
    const rendered = renderClauseList(parsed);
    const items = rendered.split("\n").filter((l) => l.startsWith("- [ ]"));
    expect(items).toHaveLength(allClauses(parsed).length);
    expect(rendered).not.toContain("- [x]");
  });

  it("states ref, claim and level in that order", () => {
    const line = renderClauseList(sheet("Asterios")).split("\n").find((l) => l.includes("**ME.2**"));
    expect(line).toBe("- [ ] **ME.2** · All damage taken is reduced by 40%; if NP, 20%. · *Untouched*");
  });
});

describe("nothing is dropped in silence", () => {
  it("emits a rule stated with neither a number nor a marker, and warns about it", () => {
    const parsed = sheet("Dioscuri");
    const orphan = allClauses(parsed).find((c) => c.claim.startsWith("This Skill counts as ‘Divinity’"));
    expect(orphan).toBeDefined();
    expect(orphan.unnamed).toBe(true);
    expect(parsed.warnings.some((w) => w.text.startsWith("This Skill counts as ‘Divinity’"))).toBe(true);
  });

  it("still gives an Ability stated entirely as prose its own Cooldown Clause", () => {
    // Heracles' Nine Lives carries no marker and no numbering at all, so its
    // Cooldown would otherwise be swallowed into the one Clause the Ability has.
    const clauses = sheet("Heracles").groups[0].abilities.find((a) => a.name.startsWith("Nine Lives")).clauses;
    expect(clauses.map((c) => c.ref)).toEqual(["NL.n1", "NL.cd"]);
    expect(clauses[0].claim).not.toMatch(/Cooldown/);
    expect(clauses[1].claim).toBe("Cooldown: 7◈+⅓◈ Turns.");
  });

  it("letters a second numbered list rather than colliding with the first", () => {
    const parsed = sheet("Pale Rider");
    const contagion = parsed.groups.flatMap((g) => g.abilities).find((a) => a.name === "Contagion");
    expect(contagion.clauses.map((c) => c.ref)).toContain("CO.1");
    expect(contagion.clauses.map((c) => c.ref)).toContain("CO.b1");
    expect(parsed.warnings.some((w) => w.why.includes("restarts its numbering"))).toBe(true);
  });

  it("numbers a second Ability that abbreviates the same way", () => {
    const names = sheet("Semiramis").groups[0].abilities;
    const summons = names.filter((a) => a.name.startsWith("Double Summon"));
    expect(summons.length).toBeGreaterThan(1);
    expect(new Set(summons.map((a) => a.abbr)).size).toBe(summons.length);
  });

  it("gives every Clause on every sheet a unique ref, or says which two clash", () => {
    for (const file of readdirSync(SHEET_DIR).filter((f) => f.endsWith(".md"))) {
      const parsed = parseCharacterSheet(readFileSync(join(SHEET_DIR, file), "utf8"));
      const seen = new Set();
      for (const clause of allClauses(parsed)) {
        if (seen.has(clause.ref)) {
          expect(
            parsed.warnings.some((w) => w.why.includes(`ref ${clause.ref} is already used`)),
            `${file} ${clause.ref}`,
          ).toBe(true);
        }
        seen.add(clause.ref);
      }
    }
  });

  it("never names a ref in a warning that the output does not contain", () => {
    // The stderr stream is the whole "loud, not tidy" contract. A warning that
    // cites a ref nobody can find sends the auditor looking for nothing, which
    // happened while Ability abbreviations were made unique *after* the
    // warnings quoting them had already been written.
    for (const file of readdirSync(SHEET_DIR).filter((f) => f.endsWith(".md"))) {
      const parsed = parseCharacterSheet(readFileSync(join(SHEET_DIR, file), "utf8"));
      const refs = new Set(allClauses(parsed).map((c) => c.ref));
      for (const warning of parsed.warnings) {
        const cited = /emitted as (\S+?),/.exec(warning.why);
        if (cited) expect(refs.has(cited[1]), `${file}: ${warning.why}`).toBe(true);
      }
    }
  });

  it("does not let an Ability header ending in parentheses be read as a rank variant", () => {
    // Proto Gil states `(ProtoGil) Class Skill: Magic Resistance — Rank: C (E)`.
    // A greedy variant pattern matched it from the first paren to the last and
    // filed the whole Class Skill under the Ability above it, with no warning.
    const gil = sheet("Proto Gil").groups[0];
    expect(gil.abilities.map((a) => a.name)).toContain("Magic Resistance");
    const mr = gil.abilities.find((a) => a.name === "Magic Resistance");
    expect(mr.rank).toBe("C (E)");
    expect(mr.clauses.length).toBeGreaterThan(1);
  });

  it("closes the sheet on either spelling of the footer", () => {
    // Twenty-seven sheets say "Items held"; Karna and Hundred-Faced Hassan say
    // "Held Items", and missing that left the footer inside the last Ability as
    // a phantom Clause with a warning it had not earned.
    for (const name of ["Karna", "Hassan (Hundred-Face)", "Asterios"]) {
      const claims = allClauses(sheet(name)).map((c) => c.claim);
      expect(claims.some((c) => /^Held items?\b/i.test(c) || /^Items? held\b/i.test(c)), name).toBe(false);
    }
  });

  it("ends a parenthesised Cooldown at its own paren, keeping the rest of the rule", () => {
    // Quetzalcoatl's shared-cooldown rule states the cooldown mid-sentence and
    // then states two exclusivity rules. Running the cooldown to end-of-line hid
    // both behind a ref an auditor reads as "check the number".
    const shared = allClauses(sheet("Quetzalcoatl")).find((c) =>
      c.claim.startsWith("All of Quetz’s Quetzalcoatlus Spells share the same Cooldown"),
    );
    expect(shared.claim).toMatch(/the other 2 cannot be used until Cooldown ends/);
    expect(shared.claim).toMatch(/cannot be used if Piedra Del Sol is Active/);
    expect(shared.claim).not.toContain("Cooldown: 2◈");
  });

  it("does not let a trailing Note be swallowed by the Cooldown before it", () => {
    const cd = allClauses(sheet("Karna")).find((c) => c.claim.startsWith("Cooldown:") && c.ref.startsWith("BR."));
    expect(cd.claim).not.toMatch(/Note:/);
    expect(allClauses(sheet("Karna")).some((c) => c.claim.startsWith("Note: Does not deal extra damage"))).toBe(true);
  });
});

describe("the linked pair", () => {
  it("emits the pair's shared Clauses separately from either twin's", () => {
    const parsed = sheet("Dioscuri");
    const shared = parsed.groups.find((g) => g.shared);
    expect(shared.name).toBe("Dioscuri");
    expect(shared.statblock).toBeNull();
    expect(shared.notes.map((n) => n.ref)).toEqual(["DI.s1", "DI.s2", "DI.s3"]);
    expect(shared.notes[0].claim).toMatch(/maximum distance between the two is 2 panels/);
    expect(shared.notes[2].claim).toMatch(/the Skill enters Cooldown for both of them/);
  });

  it("puts the joint Noble Phantasm with the pair, not with the twin it is written under", () => {
    const parsed = sheet("Dioscuri");
    const shared = parsed.groups.find((g) => g.shared);
    expect(shared.abilities.map((a) => a.name)).toEqual(["Dioscures Tyndaridae: Hymn of the Divine Twins"]);
    for (const twin of parsed.groups.filter((g) => !g.shared)) {
      expect(twin.abilities.map((a) => a.name)).not.toContain("Dioscures Tyndaridae: Hymn of the Divine Twins");
    }
  });

  it("gives each twin its own statblock, under a ref that names which twin", () => {
    const twins = sheet("Dioscuri").groups.filter((g) => !g.shared);
    expect(twins.map((g) => g.name)).toEqual(["Castor", "Pollux"]);
    expect(twins[0].statClaim).toContain("MOV 6");
    expect(twins[1].statClaim).toContain("MOV 5");
    expect(twins.map((g) => g.statClause.ref)).toEqual(["CA.SB", "PO.SB"]);
  });

  it("scopes every ref on a multi-Unit sheet to its Unit", () => {
    // Ozymandias' sheet describes him and three Sphinxes. Unscoped, it emits
    // four Clauses called SB and a finding citing one of them names four Units.
    const parsed = sheet("Ozymandias");
    expect(parsed.groups.length).toBe(4);
    const statRefs = parsed.groups.map((g) => g.statClause?.ref).filter(Boolean);
    expect(new Set(statRefs).size).toBe(statRefs.length);
    expect(parsed.warnings.filter((w) => w.why.includes("already used"))).toHaveLength(0);
  });

  it("leaves a single-Unit sheet's refs unscoped", () => {
    expect(allClauses(sheet("Asterios")).every((c) => !c.ref.startsWith("AS."))).toBe(true);
  });

  it("says the shared Clauses need an issue of their own", () => {
    expect(sheet("Dioscuri").warnings.some((w) => w.why.includes("belonging to no single Servant"))).toBe(true);
  });
});

describe("the whole corpus", () => {
  const files = readdirSync(SHEET_DIR).filter((f) => f.endsWith(".md"));

  it("parses every Character Sheet, largest and smallest included, without throwing", () => {
    expect(files.length).toBeGreaterThan(25);
    for (const file of files) {
      const parsed = parseCharacterSheet(readFileSync(join(SHEET_DIR, file), "utf8"));
      expect(parsed.title, file).toBeTruthy();
      expect(allClauses(parsed).length, file).toBeGreaterThan(0);
    }
  });

  it("finds Clauses in the largest and the smallest at the scale Ch. 46 predicts", () => {
    // Ch. 46 puts the range at roughly twenty-six Clauses to roughly a hundred.
    expect(allClauses(sheet("Semiramis")).length).toBeGreaterThan(90);
    expect(allClauses(sheet("Heracles")).length).toBeGreaterThan(20);
  });

  it("never emits a Clause with an empty claim or a ref ending in a bare dot", () => {
    for (const file of files) {
      for (const clause of allClauses(parseCharacterSheet(readFileSync(join(SHEET_DIR, file), "utf8")))) {
        expect(clause.claim.trim(), `${file} ${clause.ref}`).not.toBe("");
        expect(clause.ref, file).not.toMatch(/\.$/);
      }
    }
  });
});

describe("abbreviate", () => {
  it("initials the words before a colon and skips connectives", () => {
    expect(abbreviate("Chaos Labyrinthos: Eternally Unchanging Labyrinth")).toBe("CL");
    expect(abbreviate("Avyssos of Labrys")).toBe("AL");
    expect(abbreviate("Mad Enhancement")).toBe("ME");
  });

  it("takes two letters from a one-word name, because one letter collides", () => {
    expect(abbreviate("Contagion")).toBe("CO");
    expect(abbreviate("Divinity")).toBe("DI");
  });
});
