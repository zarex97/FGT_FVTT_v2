/**
 * #235: no player-facing line names a Unit by its True Name.
 *
 * The guard (`tools/check-public-names.mjs`) reads source text; the readers it
 * sends everyone to (`shownName`, `shownNameOf`) are tested here through the
 * real projection, and the two surfaces the audits found leaking live, the
 * refusal banner's reasons and the turn panel's roster, through their real
 * builders.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { unitNameReads, NAME_READ, speakerlessCards } from "../../tools/check-public-names.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";
import { shownNameOf } from "../../module/rules/identity.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 30_000 });

const ARJ = "arjunaPandava001";
const KAR = "karnaRival000001";
const FOE = "asteriosFoe00001";

/* ========================================================================== */

describe("the guard", () => {
  it("refuses a card posted with no speaker, which speaks as the player's own character (#333)", () => {
    const bare = "  await ChatMessage.create({ content: `<p>${line}</p>` });";
    const found = speakerlessCards(`async function say() {\n${bare}\n}`);
    expect(found).toHaveLength(1);
    expect(found[0].line).toBe(2);
    expect(found[0].problem).toMatch(/no `speaker`: it speaks as the user's own character/);
    expect(speakerlessCards("  await ChatMessage.create({ content, speaker: publicSpeakerFor(actor, board) });")).toEqual([]);
    expect(speakerlessCards("  // fgt-speaker-ok: whispered to the GM\n  await ChatMessage.create({ content, whisper });")).toEqual([]);
    // A bare marker says nothing.
    expect(speakerlessCards("  // fgt-speaker-ok:\n  await ChatMessage.create({ content });")).toHaveLength(1);
  });

  it("refuses a Unit's name read raw on a card, naming the file's line and the expression", () => {
    const text = [
      "async function post(actor) {",
      "  await ChatMessage.create({ content: `${actor.name} attacks` });",
      "}",
    ].join("\n");
    const found = unitNameReads(text);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ line: 2, expression: "actor.name" });
    // The reason it fails, not only that it did.
    expect(found[0].problem).toMatch(/True Name: ask `shownName`/);
  });

  it("passes a read marked with its reason, on the line or the line above", () => {
    expect(unitNameReads("  name: actor.name, // fgt-name-ok: the owner's own prompt")).toEqual([]);
    expect(unitNameReads("  // fgt-name-ok: console text\n  console.warn(actor.name);")).toEqual([]);
  });

  it("refuses a bare marker: the point of the allowlist is the sentence", () => {
    expect(unitNameReads("  name: actor.name, // fgt-name-ok:")).toHaveLength(1);
  });

  it("does not read an ability's or an item's name as a Unit's", () => {
    expect(unitNameReads("  title: ability.name, label: item.name,")).toEqual([]);
    expect(NAME_READ.test("game.actors.get(id)?.name")).toBe(true);
  });
});

/* ========================================================================== */

describe("the one reader (shownName, shownNameOf)", () => {
  it("a concealed Servant is its class; a Master is itself", async () => {
    const { shownName, shownNameById } = await import("../../module/engine/public-identity.mjs");
    await withSubjects([
      { from: "arjuna", id: ARJ, state: { factionId: "A" } },
      { from: "master-advanced", id: "arjunaMaster0001", state: { factionId: "A" } },
    ], ({ unit, world: w }) => {
      expect(shownName(w.actor(ARJ))).toBe("Archer");
      expect(shownNameById(ARJ)).toBe("Archer");
      expect(shownNameOf(unit(ARJ))).toBe("Archer");
      expect(shownName(unit(ARJ))).toBe("Archer");
      expect(shownNameById("arjunaMaster0001")).toBe(w.actor("arjunaMaster0001").name);
    });
  });

  it("a revealed Servant is its True Name", async () => {
    const { shownName } = await import("../../module/engine/public-identity.mjs");
    await withSubjects([{ from: "arjuna", id: ARJ, state: { factionId: "A", identityRevealed: true } }], ({ world: w }) => {
      expect(shownName(w.actor(ARJ))).toBe("Arjuna");
    });
  });
});

/* ========================================================================== */

describe("the refusal banner's reasons name the target publicly (found live, #234)", () => {
  const scene = () => [
    { from: "arjuna", id: ARJ, panel: { i: 5, j: 2 }, state: { factionId: "A" } },
    { from: "karna", id: KAR, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
    { from: "asterios", id: FOE, panel: { i: 4, j: 4 }, state: { factionId: "B" } },
  ];
  const normal = { anchor: { kind: "targetUnit" }, shape: { kind: "unit" }, selection: { relations: ["enemy"], chooser: "chosen", count: 1 } };

  it("a compelled attacker's refusal names Asterios as Berserker", async () => {
    await withSubjects(scene(), ({ unit, board }) => {
      const out = resolveTargets(normal, unit(ARJ), board, { unitId: FOE, chosenIds: [FOE] });
      const entry = out.excluded.find((e) => e.unitId === FOE);
      expect(entry).toBeTruthy();
      expect(entry.name).toBe("Berserker");
      expect(JSON.stringify(out)).not.toMatch(/Asterios/);
    });
  });

  it("an out-of-Range refusal names its target publicly", async () => {
    const far = scene().map((s) => (s.id === KAR ? { ...s, panel: { i: 5, j: 12 } } : s));
    await withSubjects(far, ({ unit, board }) => {
      const out = resolveTargets(normal, unit(ARJ), board, { unitId: KAR, chosenIds: [KAR] });
      expect(out.errors.join(" ")).toMatch(/Lancer is out of Range/);
      expect(out.errors.join(" ")).not.toMatch(/Karna/);
    }, { settings: { boardSize: 13 } });
  });
});
