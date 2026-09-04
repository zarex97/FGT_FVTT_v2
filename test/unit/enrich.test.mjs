/**
 * @file Enriching description prose.
 * @see module/apps/enrich.mjs, docs/29-user-interface.md §29.2
 *
 * Nothing in this system called `enrichHTML` before this, so a `@UUID` link in
 * a description rendered as literal text. The functions here are the one place
 * that calls it, and they are separated from the sheets so the "which fields"
 * decision is testable without Foundry.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichText, enrichAbilityCards } from "../../module/apps/enrich.mjs";

beforeEach(() => {
  globalThis.foundry = {
    applications: { ux: { TextEditor: { implementation: {
      enrichHTML: vi.fn(async (text) => `<enriched>${text}</enriched>`),
    } } } },
  };
});

describe("enrichText", () => {
  it("passes the text through Foundry's enricher", async () => {
    expect(await enrichText("inflicts @UUID[x]{Burn}")).toBe("<enriched>inflicts @UUID[x]{Burn}</enriched>");
  });

  it("returns an empty string for nothing, rather than calling out", async () => {
    expect(await enrichText("")).toBe("");
    expect(await enrichText(null)).toBe("");
    expect(foundry.applications.ux.TextEditor.implementation.enrichHTML).not.toHaveBeenCalled();
  });

  it("leaves rolls alone", async () => {
    // This system resolves its dice through the engine. An inline [[/r]] in a
    // description would open a second path to a roll.
    await enrichText("text");
    const [, options] = foundry.applications.ux.TextEditor.implementation.enrichHTML.mock.calls[0];
    expect(options).toMatchObject({ rolls: false, documents: true, links: true });
  });
});

describe("enrichAbilityCards", () => {
  it("enriches every card in every group, in place", async () => {
    const cards = {
      classSkills: [{ description: "a" }],
      skills: [{ description: "b" }, { description: "c" }],
      noblePhantasms: [{ description: "d" }],
      anyAbilities: true,
    };
    await enrichAbilityCards(cards);
    expect(cards.skills.map((c) => c.description)).toEqual(["<enriched>b</enriched>", "<enriched>c</enriched>"]);
    expect(cards.noblePhantasms[0].description).toBe("<enriched>d</enriched>");
  });

  it("ignores the non-array members of the group object", async () => {
    // `anyAbilities` is a boolean and iterating it would throw.
    const cards = { classSkills: [], skills: [], noblePhantasms: [], anyAbilities: false };
    await expect(enrichAbilityCards(cards)).resolves.toBeUndefined();
  });

  it("survives being handed nothing", async () => {
    await expect(enrichAbilityCards(null)).resolves.toBeUndefined();
  });
});
