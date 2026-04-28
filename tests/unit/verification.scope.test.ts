import { describe, it, expect } from "vitest";
import { checkScope } from "@verify/scope.js";
import type { EnrichedSnapshot } from "@/types/snapshot.js";

const snapshot: EnrichedSnapshot = {
  element: { tag: "button", classes: ["btn-primary"] },
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
  ],
};

describe("verification — scope", () => {
  it("passes when no related elements changed", () => {
    const result = checkScope({
      snapshot,
      declaredSideEffects: [],
      relatedElements: [
        {
          selector: ".btn-secondary",
          classes: ["btn-secondary"],
          preEditComputed: { "background-color": "rgb(255, 255, 255)" },
          postEditComputed: { "background-color": "rgb(255, 255, 255)" },
        },
      ],
    });
    expect(result.status).toBe("pass");
  });

  it("passes when expected side effects occurred (declared in plan)", () => {
    const result = checkScope({
      snapshot,
      declaredSideEffects: ["3 other btn-primary buttons will change"],
      relatedElements: [
        {
          selector: ".btn-primary",
          classes: ["btn-primary"],
          preEditComputed: { "background-color": "rgb(124, 58, 237)" },
          postEditComputed: { "background-color": "rgb(0, 0, 0)" },
        },
      ],
    });
    expect(result.status).toBe("pass");
    expect(result.expectedChanges).toHaveLength(1);
    expect(result.unexpectedChanges).toHaveLength(0);
  });

  it("fails on unexpected scope leaks", () => {
    const result = checkScope({
      snapshot,
      declaredSideEffects: [],
      relatedElements: [
        {
          selector: ".btn-secondary",
          classes: ["btn-secondary"],
          preEditComputed: { "background-color": "rgb(255, 255, 255)" },
          postEditComputed: { "background-color": "rgb(0, 0, 0)" },
        },
      ],
    });
    expect(result.status).toBe("fail");
    expect(result.unexpectedChanges).toHaveLength(1);
  });
});
