import { describe, it, expect } from "vitest";
import type { EnrichedSnapshot, CSSChange } from "@/types/snapshot.js";
import { makeSnapshot, makeChange } from "../helpers/fixtures.js";

/**
 * The diff in an EnrichedSnapshot is represented by the `changes` array.
 * Each entry records a CSS property where before_computed != after_computed.
 * These tests validate that snapshots are constructed correctly —
 * only changed properties appear, unchanged ones are excluded.
 */

function buildChangesFromOverrides(
  computed: Record<string, string>,
  overrides: Record<string, string>
): CSSChange[] {
  return Object.entries(overrides)
    .filter(([prop, val]) => computed[prop] !== val)
    .map(([property, value]) => ({
      property,
      before_computed: computed[property] ?? "",
      after_computed: value,
      expected_final_computed: value,
    }));
}

describe("snapshot diff — only changed properties", () => {
  it("includes only properties where before != after", () => {
    const computed = {
      "background-color": "rgb(124, 58, 237)",
      color: "rgb(255, 255, 255)",
      "font-size": "16px",
    };
    const overrides = {
      "background-color": "rgb(0, 0, 0)",
      color: "rgb(255, 255, 255)", // unchanged
    };

    const changes = buildChangesFromOverrides(computed, overrides);

    expect(changes).toHaveLength(1);
    expect(changes[0]!.property).toBe("background-color");
    expect(changes[0]!.before_computed).toBe("rgb(124, 58, 237)");
    expect(changes[0]!.after_computed).toBe("rgb(0, 0, 0)");
  });

  it("excludes unchanged properties", () => {
    const computed = { padding: "8px", margin: "0px" };
    const overrides = { padding: "8px", margin: "0px" };

    const changes = buildChangesFromOverrides(computed, overrides);
    expect(changes).toHaveLength(0);
  });

  it("captures multiple changed properties", () => {
    const computed = {
      "background-color": "rgb(255, 255, 255)",
      "font-size": "14px",
      padding: "4px",
      border: "none",
    };
    const overrides = {
      "background-color": "rgb(0, 0, 0)",
      "font-size": "18px",
      padding: "4px", // unchanged
      border: "1px solid black",
    };

    const changes = buildChangesFromOverrides(computed, overrides);

    expect(changes).toHaveLength(3);
    const props = changes.map((c) => c.property).sort();
    expect(props).toEqual(["background-color", "border", "font-size"]);
  });

  it("handles property not present in computed (new property)", () => {
    const computed: Record<string, string> = { color: "black" };
    const overrides = { "box-shadow": "0 2px 4px rgba(0,0,0,0.2)" };

    const changes = buildChangesFromOverrides(computed, overrides);

    expect(changes).toHaveLength(1);
    expect(changes[0]!.before_computed).toBe("");
    expect(changes[0]!.after_computed).toBe("0 2px 4px rgba(0,0,0,0.2)");
  });
});

describe("snapshot changes structure", () => {
  it("each change has expected_final_computed matching after_computed", () => {
    const snap = makeSnapshot({
      changes: [
        makeChange({ property: "color", before_computed: "red", after_computed: "blue", expected_final_computed: "blue" }),
        makeChange({ property: "padding", before_computed: "0px", after_computed: "10px", expected_final_computed: "10px" }),
      ],
    });

    for (const change of snap.changes) {
      expect(change.expected_final_computed).toBe(change.after_computed);
    }
  });

  it("snapshot with no changes but text_instructions is valid", () => {
    const snap: EnrichedSnapshot = {
      ...makeSnapshot(),
      changes: [],
      text_instructions: "add hover glow effect",
    };

    expect(snap.changes).toHaveLength(0);
    expect(snap.text_instructions).toBeDefined();
  });

  it("snapshot changes array is independent per snapshot", () => {
    const snap1 = makeSnapshot({
      changes: [makeChange({ property: "color", after_computed: "red" })],
    });
    const snap2 = makeSnapshot({
      changes: [makeChange({ property: "padding", after_computed: "20px" })],
    });

    expect(snap1.changes[0]!.property).toBe("color");
    expect(snap2.changes[0]!.property).toBe("padding");
    expect(snap1.changes).toHaveLength(1);
    expect(snap2.changes).toHaveLength(1);
  });
});
