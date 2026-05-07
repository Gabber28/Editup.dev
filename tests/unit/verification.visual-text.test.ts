import { describe, it, expect } from "vitest";
import { checkVisual } from "@verify/visual.js";
import { makeSnapshot, makeChange } from "../helpers/fixtures.js";

describe("verification — visual vs text differentiated checks", () => {
  it("visual change uses strict tolerance", () => {
    const snapshot = makeSnapshot({
      changes: [makeChange({
        property: "width",
        before_computed: "100px",
        after_computed: "200px",
        expected_final_computed: "200px",
      })],
    });
    const result = checkVisual({
      snapshot,
      postEditComputed: { width: "210px" },
    });
    expect(result.status).toBe("fail");
    expect(result.divergences).toHaveLength(1);
  });

  it("text_instruction change uses lenient check — passes if value changed", () => {
    const snapshot = makeSnapshot({
      changes: [{
        property: "font-size",
        before_computed: "14px",
        after_computed: "18px",
        expected_final_computed: "18px",
        change_source: "text_instruction",
      } as never],
    });
    const result = checkVisual({
      snapshot,
      postEditComputed: { "font-size": "20px" },
    });
    expect(result.status).toBe("pass");
  });

  it("text_instruction change fails if value unchanged from before", () => {
    const snapshot = makeSnapshot({
      changes: [{
        property: "font-size",
        before_computed: "14px",
        after_computed: "18px",
        expected_final_computed: "18px",
        change_source: "text_instruction",
      } as never],
    });
    const result = checkVisual({
      snapshot,
      postEditComputed: { "font-size": "14px" },
    });
    expect(result.status).toBe("fail");
    expect(result.divergences[0]?.reason).toContain("text instruction");
  });

  it("combined: visual strict + text lenient both checked", () => {
    const snapshot = makeSnapshot({
      changes: [
        makeChange({
          property: "color",
          expected_final_computed: "rgb(0, 0, 0)",
        }),
        {
          property: "padding",
          before_computed: "8px",
          after_computed: "16px",
          expected_final_computed: "16px",
          change_source: "text_instruction",
        } as never,
      ],
    });
    const result = checkVisual({
      snapshot,
      postEditComputed: { color: "rgb(0, 0, 0)", padding: "12px" },
    });
    expect(result.status).toBe("pass");
  });
});
