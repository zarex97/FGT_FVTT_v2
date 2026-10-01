/**
 * @file The content sync replaces a world document's system rather than merging into it (#163).
 * @see module/migration/runner.mjs#syncContent
 *
 * `reconcileItems` builds each item's whole `system` and `syncContent` writes it.
 * Foundry's update is recursive unless told otherwise, so the new system was
 * merged into the old one and a key the pack had removed survived: on a live
 * board Xiuhcoatl kept `targeting.anchor.range: 2` after her content dropped it.
 * The sync is never run by the suite, so this reads the two writes it makes.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("module/migration/runner.mjs", "utf8").replaceAll("\r\n", "\n");
const body = source.slice(source.indexOf("export async function syncContent"));

describe("syncContent writes", () => {
  it("replaces an actor's system", () => {
    expect(body).toMatch(/actor\.update\(\{ system \}, \{ diff: false, recursive: false \}\)/);
  });

  it("replaces each refreshed item's system", () => {
    expect(body).toMatch(/updateEmbeddedDocuments\("Item", refreshed, \{ diff: false, recursive: false \}\)/);
  });
});
