import { describe, it, expect } from "vitest";
import { checkVisual } from "../../verification/visual.js";
import type { EnrichedSnapshot } from "../../src/types/snapshot.js";

const baseSnapshot: EnrichedSnapshot = {
  element: { tag: "button", classes: ["btn"] },
  styling: {
    framework: "tailwind",
    class_to_rule_map: {},
    active_css_variables: {},
  },
  changes: [
    {
      property: "background-color",
      before_computed: "rgb(124, 58, 237)",
      after_computed: "rgb(0, 0, 0)",
      expected_final_computed: "rgb(0, 0, 0)",
    },
    {
      property: "padding",
      before_computed: "8px",
      after_computed: "16px",
      expected_final_computed: "16px",
    },
  ],
};

describe("verification — visual", () => {
  it("passes when actual matches expected exactly", () => {
    const result = checkVisual({
      snapshot: baseSnapshot,
      postEditComputed: {
        "background-color": "rgb(0, 0, 0)",
        padding: "16px",
      },
    });
    expect(result.status).toBe("pass");
    expect(result.divergences).toHaveLength(0);
  });

  it("passes when RGB diff is within tolerance", () => {
    const result = checkVisual({
      snapshot: baseSnapshot,
      postEditComputed: {
        "background-color": "rgb(10, 10, 10)",
        padding: "16px",
      },
    });
    expect(result.status).toBe("pass");
  });

  it("fails when RGB diff exceeds tolerance", () => {
    const result = checkVisual({
      snapshot: baseSnapshot,
      postEditComputed: {
        "background-color": "rgb(80, 80, 80)",
        padding: "16px",
      },
    });
    expect(result.status).toBe("fail");
  });

  it("passes when pixel diff is within tolerance", () => {
    const result = checkVisual({
      snapshot: baseSnapshot,
      postEditComputed: {
        "background-color": "rgb(0, 0, 0)",
        padding: "19px",
      },
    });
    expect(result.status).toBe("pass");
  });

  it("fails when pixel diff exceeds tolerance", () => {
    const result = checkVisual({
      snapshot: baseSnapshot,
      postEditComputed: {
        "background-color": "rgb(0, 0, 0)",
        padding: "30px",
      },
    });
    expect(result.status).toBe("fail");
  });

  it("flags missing properties as divergence", () => {
    const result = checkVisual({
      snapshot: baseSnapshot,
      postEditComputed: { "background-color": "rgb(0, 0, 0)" },
    });
    expect(result.status).toBe("fail");
    expect(result.divergences.some((d) => d.actual === "<missing>")).toBe(
      true
    );
  });

  it("handles hex color format", () => {
    const snapshot: EnrichedSnapshot = {
      ...baseSnapshot,
      changes: [
        {
          property: "color",
          before_computed: "#ffffff",
          after_computed: "#000000",
          expected_final_computed: "#000000",
        },
      ],
    };
    const result = checkVisual({
      snapshot,
      postEditComputed: { color: "rgb(5, 5, 5)" },
    });
    expect(result.status).toBe("pass");
  });
});
