/**
 * @file Cross-reference markers in content prose.
 * @see tools/lib/references.mjs, docs/37-content-pipeline.md §37.8
 *
 * Nothing in this system has ever called `enrichHTML`, so a description
 * mentioning Burn was plain text and a player had no way to learn what Burn
 * does. Markers are authored, resolved at build time, and rendered by
 * Foundry's own content-link enricher.
 */
import { describe, it, expect } from "vitest";
import {
  REFERENCE_KINDS, parseMarkers, rewriteReferences, mentionsWithoutMarkers,
} from "../../tools/lib/references.mjs";

const index = new Map([
  ["effect:burn", { uuid: "Compendium.fgt.effects.Item.j7sgkl30v2z7d6vs", name: "Burn" }],
  ["ability:class-riding", { uuid: "Compendium.fgt.class-skills.Item.aaaaaaaaaaaaaaaa", name: "Riding" }],
  ["np:medusa-bellerophon", { uuid: "Compendium.fgt.servants.Actor.mmmm.Item.bbbb", name: "Bellerophon" }],
  ["action:mark", { uuid: "Compendium.fgt.rules.JournalEntry.cccc", name: "Mark" }],
]);

describe("parseMarkers", () => {
  it("finds a marker with no label", () => {
    expect(parseMarkers("inflicts @effect[burn] for 3◈")).toEqual([
      { raw: "@effect[burn]", kind: "effect", id: "burn", label: null, index: 9 },
    ]);
  });

  it("finds a marker with a label", () => {
    const [m] = parseMarkers("cannot use @ability[class-riding]{Riding} now");
    expect(m).toMatchObject({ kind: "ability", id: "class-riding", label: "Riding" });
  });

  it("finds several in one description", () => {
    const found = parseMarkers("@effect[burn] then @action[mark] then @np[medusa-bellerophon]");
    expect(found.map((m) => m.kind)).toEqual(["effect", "action", "np"]);
  });

  it("ignores an at-sign that is not a marker", () => {
    // `@intentional` is an existing authoring convention in comments, and an
    // email address must not become a link either.
    expect(parseMarkers("see @intentional and a@b.com")).toEqual([]);
  });

  it("ignores an unknown kind rather than guessing", () => {
    expect(parseMarkers("@servant[medusa]")).toEqual([]);
  });

  it("names every kind the vocabulary supports", () => {
    expect([...REFERENCE_KINDS].sort()).toEqual(
      ["ability", "action", "effect", "essence", "np", "spell"],
    );
  });
});

describe("rewriteReferences", () => {
  it("rewrites a bare marker to a UUID link labelled with the document's name", () => {
    const out = rewriteReferences("inflicts @effect[burn] for 3◈", index);
    expect(out.text).toBe("inflicts @UUID[Compendium.fgt.effects.Item.j7sgkl30v2z7d6vs]{Burn} for 3◈");
    expect(out.problems).toEqual([]);
  });

  it("keeps an authored label, for inflection and case", () => {
    const out = rewriteReferences("@effect[burn]{Burning}", index);
    expect(out.text).toBe("@UUID[Compendium.fgt.effects.Item.j7sgkl30v2z7d6vs]{Burning}");
  });

  it("rewrites several markers in one pass without disturbing the prose", () => {
    const out = rewriteReferences("A @effect[burn] B @action[mark] C", index);
    expect(out.text).toBe(
      "A @UUID[Compendium.fgt.effects.Item.j7sgkl30v2z7d6vs]{Burn} B "
      + "@UUID[Compendium.fgt.rules.JournalEntry.cccc]{Mark} C",
    );
  });

  it("reports an id that resolves to nothing, and leaves the text alone", () => {
    const out = rewriteReferences("@effect[nosuchthing}", index);
    expect(out.problems).toEqual([]); // malformed: no closing bracket, so not a marker
    const bad = rewriteReferences("@effect[nosuchthing]", index);
    expect(bad.problems[0]).toMatch(/@effect\[nosuchthing\] resolves to no document/);
    expect(bad.text).toBe("@effect[nosuchthing]");
  });

  it("reports a marker whose kind disagrees with the target", () => {
    // `burn` is an effect. Calling it an ability is a link that would not work.
    const out = rewriteReferences("@ability[burn]", index);
    expect(out.problems[0]).toMatch(/@ability\[burn\] resolves to no document/);
  });

  it("leaves text with no markers untouched", () => {
    expect(rewriteReferences("plain prose", index)).toEqual({ text: "plain prose", problems: [] });
  });

  it("survives an empty or missing description", () => {
    expect(rewriteReferences("", index).text).toBe("");
    expect(rewriteReferences(undefined, index).text).toBe("");
  });
});

describe("mentionsWithoutMarkers", () => {
  const names = new Map([["Burn", "effect:burn"], ["Riding", "ability:class-riding"]]);

  it("reports a known name in plain prose", () => {
    expect(mentionsWithoutMarkers("inflicts Burn for 3◈", names)).toEqual(["Burn"]);
  });

  it("says nothing about a name that is already inside a marker", () => {
    expect(mentionsWithoutMarkers("inflicts @effect[burn]{Burn} for 3◈", names)).toEqual([]);
  });

  it("does not match a name inside a longer word", () => {
    // "Burn" must not fire on "Mana Burst" or "sunburnt".
    expect(mentionsWithoutMarkers("Mana Burst and sunburnt", names)).toEqual([]);
  });

  it("reports each name once however often it appears", () => {
    expect(mentionsWithoutMarkers("Burn, then Burn again", names)).toEqual(["Burn"]);
  });
});

describe("a name linked once is done", () => {
  const names = new Map([["Burn", "effect:burn"]]);

  it("does not demand a marker for a repetition of a name already linked", () => {
    // The convention is to mark the first occurrence and leave the rest as
    // prose. Without this the warning asked for markers it had been told not
    // to write, 61 times across the corpus.
    expect(mentionsWithoutMarkers("@effect[burn]{Burn} then Burn again", names)).toEqual([]);
  });

  it("still reports a name that is never linked at all", () => {
    expect(mentionsWithoutMarkers("Burn then Burn again", names)).toEqual(["Burn"]);
  });
});
