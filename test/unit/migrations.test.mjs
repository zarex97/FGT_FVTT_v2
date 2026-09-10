/**
 * @file Schema migrations.
 * @see module/migration/migrations.mjs, docs/39-migration-and-versioning.md §39.2
 *
 * D39.2: migrations are pure functions over source data, unit-testable without a
 * world. They must also be IDEMPOTENT -- a runner that fails halfway will be
 * re-run, and a migration that doubles a value on the second pass is worse than
 * one that never ran.
 */

import { describe, it, expect } from "vitest";
import {
  SCHEMA_VERSION, MIGRATIONS, pendingFrom, applyMigration,
} from "../../module/migration/migrations.mjs";

describe("the schema version", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(SCHEMA_VERSION)).toBe(true);
    expect(SCHEMA_VERSION).toBeGreaterThan(0);
  });

  it("equals the highest migration target, or 1 when there are none", () => {
    // A migration list that runs past the code's version would loop; one that
    // stops short would leave data half-migrated with no record of it.
    const highest = MIGRATIONS.reduce((n, m) => Math.max(n, m.to), 1);
    expect(SCHEMA_VERSION).toBe(highest);
  });
});

describe("the migration list", () => {
  it("is strictly ascending, with no repeated target", () => {
    const targets = MIGRATIONS.map((m) => m.to);
    expect(targets).toEqual([...targets].sort((a, b) => a - b));
    expect(new Set(targets).size).toBe(targets.length);
  });

  it("describes every entry", () => {
    // The description is what the GM is shown and what the changelog quotes.
    for (const m of MIGRATIONS) {
      expect(typeof m.description).toBe("string");
      expect(m.description.length).toBeGreaterThan(0);
    }
  });

  it("declares only handler kinds the runner walks", () => {
    const known = new Set(["to", "description", "actor", "item", "effect", "scene", "combat"]);
    for (const m of MIGRATIONS) {
      for (const key of Object.keys(m)) expect(known).toContain(key);
    }
  });
});

describe("pendingFrom", () => {
  it("returns nothing when the world is current", () => {
    expect(pendingFrom(SCHEMA_VERSION)).toEqual([]);
  });

  it("returns nothing when the world is somehow ahead", () => {
    // A world opened by a newer system and then by an older one. Refusing to
    // run is right; running migrations backwards is not a thing.
    expect(pendingFrom(SCHEMA_VERSION + 5)).toEqual([]);
  });

  it("returns the entries above the world's version, in order", () => {
    const all = pendingFrom(0);
    expect(all).toEqual([...MIGRATIONS]);
  });
});

describe("applyMigration", () => {
  const entry = {
    to: 2,
    description: "test",
    actor: (source) => ({ ...source, system: { ...source.system, marked: true } }),
  };

  it("applies the handler for a kind it declares", () => {
    const out = applyMigration(entry, "actor", { system: { mov: 5 } }, {});
    expect(out.system.marked).toBe(true);
    expect(out.system.mov).toBe(5);
  });

  it("returns the source untouched for a kind it does not declare", () => {
    const source = { system: { x: 1 } };
    expect(applyMigration(entry, "item", source, {})).toBe(source);
  });

  it("is idempotent for every shipped migration", () => {
    // Applied twice must equal applied once. A runner that fails partway
    // through will be re-run against data some of which is already migrated.
    for (const m of MIGRATIONS) {
      for (const kind of ["actor", "item", "effect", "scene", "combat"]) {
        if (!m[kind]) continue;
        const source = { system: {} };
        const once = applyMigration(m, kind, source, { globalTurn: 0 });
        const twice = applyMigration(m, kind, once, { globalTurn: 0 });
        expect(twice).toEqual(once);
      }
    }
  });
});
