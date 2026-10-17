/**
 * EMIYA's audit, #208: defects the live board found (Ch. 46 §46.30).
 * The rulings themselves are in `emiya-208-rulings.test.mjs`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { useBudgetKind } from "../../module/rules/ability-use.mjs";

/** An authored ability, shaped as the item the bar and the use path hold. */
const item = (name) => {
  const doc = parse(readFileSync(`packs/_source/abilities/${name}.yml`, "utf8"));
  return { type: doc.kind === "noblePhantasm" ? "noblePhantasm" : "ability", system: doc };
};

describe("a non-damaging Noble Phantasm's slot asks the budget the declaration asks (#208, live)", () => {
  // Live, Round 2: EMIYA attacked Medea, and Unlimited Blade Works' slot stayed
  // lit with no reason. The press refused it: "cannot be used: this unit has
  // already attacked this turn". A used NP costs the Attack, damage or not.
  it("Unlimited Blade Works bills the NP action, as the use path does", () => {
    expect(useBudgetKind(item("emiya-unlimited-blade-works"))).toBe("np");
  });

  it("a Skill, and a Spell that is not an Attack, bill the Skill action", () => {
    expect(useBudgetKind(item("emiya-tracing"))).toBe("skill");
    expect(useBudgetKind(item("emiya-hawkeye"))).toBe("skill");
  });

  it("the bar and the use path read the one helper", () => {
    const bar = readFileSync("module/apps/hud/action-bar.mjs", "utf8");
    const use = readFileSync("module/engine/skill-use.mjs", "utf8");
    // Each path's kind: the attack path's `abilityKind` for an Attack (a damaging
    // NP is `np`, which NP Seal refuses), the use path's helper otherwise (#209 review).
    expect(bar).toMatch(/afford\(budgetActionFor\(use\.isAttack \? abilityKind\(item\) : useBudgetKind\(item\)\)\)/);
    expect(use).toMatch(/budgetActionFor\(useBudgetKind\(ability\)\)/);
  });
});

describe("Clairvoyance's 80% die has a line on the Evade's Rolls (#208, live)", () => {
  // Live, Round 2: Heracles (Agility 22, faster than EMIYA) Evaded on the
  // unfavourable table, and the card's Rolls showed only the d20. The 1d100
  // that put him there was rolled (`rollCheckChances`) and shown to nobody.
  // EMIYA as his sheet projects him: Clairvoyance's imposed 80% against a
  // Normal Attack from Range 3 or more.
  const options = new Set(["attack:kind:normal", "attack:range:gte:3"]);
  const projected = async () => {
    const { withSubjects, prepareSubjects } = await import("../helpers/subject.mjs");
    await prepareSubjects();
    return withSubjects([{ from: "emiya", id: "emiya" }], ({ unit }) => unit("emiya"));
  };

  it("the plan names the probable contribution, its die and whether it held", async () => {
    const { checkPlan, mergePlans } = await import("../../module/rules/checks.mjs");
    const emiya = await projected();
    const held = checkPlan(emiya, "evade", { direction: "imposed", options, rolls: { Clairvoyance: 34 } });
    expect(held.forceTable).toBe("unfavourable");
    expect(held.chances).toEqual([{ source: "Clairvoyance", chance: 80, roll: 34, passed: true }]);
    const missed = checkPlan(emiya, "evade", { direction: "imposed", options, rolls: { Clairvoyance: 91 } });
    expect(missed.forceTable).toBeNull();
    expect(missed.chances).toEqual([{ source: "Clairvoyance", chance: 80, roll: 91, passed: false }]);
    expect(mergePlans(checkPlan({}, "evade"), held).chances).toEqual(held.chances);
  }, 120_000);

  it("the roll record carries it as a line", async () => {
    const { fromCheck } = await import("../../module/rules/roll-log.mjs");
    const rec = fromCheck({ roll: 7, total: 11, table: "unfavourable",
      chances: [{ source: "Clairvoyance", chance: 80, roll: 34, passed: true }] }, { id: "x", entryId: "evade-" });
    expect(rec.modifiers.map((m) => m.source)).toContain("Clairvoyance: 1d100 → 34 against 80%, in force");
  });

  it("the Evade hands its plan's chances to the record", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("module/engine/attack.mjs", "utf8")).toMatch(/rollLog\.fromCheck\(\{ \.\.\.outcome, chances: plan\.chances \}/);
  });
});

describe("Kanshou & Bakuya's Rank C lasts the rest of that Turn, not into the next (#208, live)", () => {
  // Live, Round 2: his close swing on his own Turn (tick 4) raised Magic
  // Resistance to C, and at Faction 2's Turn (tick 5) it still read C. The
  // effect was authored for ⅓◈, which runs through the following tick.
  // `anyTurnEnd`, not `turnEnd`: the latter is heard by the active faction's
  // Units alone, so a guard landed on a Counter in the enemy's Turn outlived
  // that Turn and his own next one (#208, review).
  it("its trigger applies dualWieldGuard until the Turn ends, whoever's it is", () => {
    const doc = parse(readFileSync("packs/_source/abilities/emiya-kanshou-and-bakuya.yml", "utf8"));
    const apply = doc.passiveRules.find((r) => r.key === "OnEvent").then.find((a) => a.key === "ApplyEffect");
    expect(apply.effect.id).toBe("dualWieldGuard");
    expect(apply.duration).toBe("until anyTurnEnd");
  });

  it("so does Overedge's, which carries the same effect to Range 3", () => {
    const doc = parse(readFileSync("packs/_source/abilities/emiya-overedge.yml", "utf8"));
    const apply = doc.passiveRules.find((r) => r.key === "OnEvent").then.find((a) => a.key === "ApplyEffect");
    expect(apply.effect.id).toBe("dualWieldGuard");
    expect(apply.duration).toBe("until anyTurnEnd");
  });

  it("the guard is gone at the end of the enemy's Turn too", async () => {
    const { fireEvent } = await import("../../module/engine/scheduler.mjs");
    const { withSubjects, prepareSubjects } = await import("../helpers/subject.mjs");
    await prepareSubjects();
    await withSubjects([{ from: "emiya", id: "emiya", state: { factionId: "A" },
      effects: [{ defId: "dualWieldGuard", endsOn: "anyTurnEnd" }] }], ({ unit }) => {
      const emiya = unit("emiya");
      expect(emiya.effectInstances.map((e) => e.endsOn), "the landing's record survives the projection").toEqual(["anyTurnEnd"]);
      // Faction B's Turn ends: `anyTurnEnd` is heard by every Unit, his too.
      const out = fireEvent("anyTurnEnd", [emiya], { tick: 5 });
      expect(out).toContainEqual(expect.objectContaining({ t: "removeEffect", unitId: "emiya" }));
    });
  }, 120_000);
});

describe("a field's wall names the field, not its content id (#208, live)", () => {
  // Live, Faction 2's Turn: Drake, outside Unlimited Blade Works, aimed at Nemo
  // inside it: "Refused: No legal targets: Nemo is separated by
  // emiya-unlimited-blade-works."
  it("the board carries the field's name, which is its Region's", async () => {
    const { prepareSubjects } = await import("../helpers/subject.mjs");
    const { fieldsOf, squareAround, prepareFields } = await import("../helpers/field.mjs");
    await prepareSubjects(); await prepareFields();
    // UBW states a duration, and the expiry reads the Turn length off the
    // world's settings, which a bare test world does not register.
    const saved = globalThis.game.settings;
    globalThis.game.settings = { get: () => 3 };
    try {
      const [field] = await fieldsOf([{ ability: "emiya-unlimited-blade-works", owner: "emiyaLive0000001", faction: "A",
        panels: squareAround({ i: 10, j: 10 }, 7) }]);
      expect(field.id).toBe("emiya-unlimited-blade-works");
      expect(field.name).toBe("Unlimited Blade Works: Infinite Creation of Swords");
    } finally {
      globalThis.game.settings = saved;
    }
  }, 120_000);

  it("and the isolation refusal reads it", () => {
    const src = readFileSync("module/rules/targeting/resolve.mjs", "utf8");
    expect(src).toMatch(/drop\(u, `separated by \$\{field\.name \?\? field\.id\}`\)/);
  });
});

describe("Rho Aias is offered only when it can be used (#208, live)", () => {
  // Live, Faction 2's Turn: Rho Aias, used once already, was offered again on
  // EMIYA's own reaction card although his Health had not been restored above
  // half since. Pressed, the use path refused it (`healthRestoredSince`) with a
  // toast on the GM's screen only, and Nine Lives hit him for 956 unshielded.
  const rho = () => {
    const doc = parse(readFileSync("packs/_source/abilities/emiya-rho-aias.yml", "utf8"));
    return { id: "rhoAias000000001", system: { ...doc, contentId: doc.id, cooldown: { remaining: 0 }, lastUsedTick: 5 } };
  };
  const offer = async (watermarks, item = rho()) => {
    const { allyReactions } = await import("../../module/rules/reactions.mjs");
    const emiya = { id: "emiya", name: "EMIYA", panel: { i: 0, j: 0 }, effects: [], turnState: {}, healthWatermarks: watermarks };
    return allyReactions({
      defender: emiya, board: { units: [emiya] }, attack: { kind: "np" },
      actorFor: () => ({ items: [item] }),
    }).map((o) => o.ability.id);
  };

  it("not after a use, while his Health has not been restored above half since", async () => {
    expect(await offer({ 50: 4 })).toEqual([]);
  });

  it("after a use, once his Health was restored above half since it", async () => {
    expect(await offer({ 50: 6 })).toEqual(["rhoAias000000001"]);
  });

  it("before its first use", async () => {
    const fresh = rho();
    fresh.system.lastUsedTick = null;
    expect(await offer({}, fresh)).toEqual(["rhoAias000000001"]);
  });
});

describe("a reaction ability refused when pressed is said to its player (#208, live)", () => {
  // The refusal was a toast on the active GM's client, which is where the
  // reaction resolves; Player1, who pressed it, saw nothing (*press as a player*).
  it("both refusals go through one notice that whispers the owner, worded", () => {
    const src = readFileSync("module/engine/attack.mjs", "utf8");
    // A refusal's detail rides along for the bar's words since #244.
    expect(src).toMatch(/async function tellReactionRefused\(owner, used, reason, detail = \{\}\)/);
    expect(src).toMatch(/FGT\.Skill\.Reason\.\$\{reason\}/);
    expect(src.match(/await tellReactionRefused\(owner, used,/g) ?? []).toHaveLength(2);
  });
});

describe("a field's start-of-Turn events get their card (#208, live)", () => {
  // Live, Round 2: Unlimited Blade Works' toll took 25 and 50 from Scáthach
  // and Heracles at the start of Faction 2's Turn, and again at the next, with
  // no card, no log line and no Evade roll anyone could read. The Turn-end
  // events are gathered into a card per field (#182); `turnStart` was run and
  // never reported.
  it("the turnStart dispatch posts what it did, under its own heading", () => {
    const src = readFileSync("module/engine/scheduler-hooks.mjs", "utf8");
    expect(src).toMatch(/const started = await fields\.runFieldEvents\("turnStart"\);/);
    expect(src).toMatch(/await postFieldReports\(fieldEventsIn\(started\), \{ titleKey: "FGT\.FieldReport\.StartTitle" \}\);/);
  });

  it("the heading is worded", () => {
    const lang = JSON.parse(readFileSync("lang/en.json", "utf8"));
    expect(lang["FGT.FieldReport.StartTitle"]).toBe("{field}: start of the Turn");
  });

  it("a toll's card names who evaded and who took what", async () => {
    const { fieldReportCards } = await import("../../module/engine/field-report.mjs");
    const lang = JSON.parse(readFileSync("lang/en.json", "utf8"));
    const t = (k, d = {}) => lang[k].replace(/\{(\w+)\}/g, (_, n) => d[n]);
    const cards = fieldReportCards([
      { fieldId: "ubw", unitName: "Heracles", roll: { check: "evade", total: 18, outcome: "fail" } },
      { fieldId: "ubw", unitName: "Heracles", damage: 50 },
    ], () => "Unlimited Blade Works", t, "FGT.FieldReport.StartTitle");
    expect(JSON.stringify(cards)).toMatch(/Unlimited Blade Works: start of the Turn/);
    expect(JSON.stringify(cards)).toMatch(/Heracles Evade 1d20 → 18: failed/);
    expect(JSON.stringify(cards)).toMatch(/Heracles takes 50 damage/);
  });
});

describe("an attack card lists its effects when the damage step is skipped (#208, live)", () => {
  // Live, Round 3: Gáe Bolg Alternative Instakilled EMIYA; the card read only
  // the ladder. Its `effects` flag held "Stun: applied" and "Instakill: rolled
  // 7 vs 75%", but the card computed who may read them only from a damage
  // result, and an Instakill skips the damage.
  it("Gáe Bolg Alternative's Instakill is on the card", async () => {
    const { withSubjects, prepareSubjects } = await import("../helpers/subject.mjs");
    const { playAttack } = await import("../helpers/process.mjs");
    await prepareSubjects();
    await withSubjects([
      { from: "scathach", id: "scathachLive0001", state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "heracles", id: "heraclesLive0001", state: { factionId: "B" }, panel: { i: 5, j: 7 } },
    ], async ({ world: w }) => {
      w.dice.every(10); // Instakill (75%) lands.
      const np = [...w.actor("scathachLive0001").items].find((i) => i.system.contentId === "scathach-gae-bolg-alternative");
      const { declared } = await playAttack(w, {
        attacker: "scathachLive0001", ability: np.id, target: "heraclesLive0001",
        react: { heraclesLive0001: ["nothing", "declined"] },
      });
      expect(w.messages.get(declared.messageId).getFlag("fgt", "result")).toBeFalsy();
      const card = w.cards.filter((c) => c.path.endsWith("chat/attack.hbs")).at(-1);
      expect((card.data.visibility?.effectNames ?? []).join(" | ")).toMatch(/Instakill/);
    }, { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "A" } });
  }, 120_000);
});
