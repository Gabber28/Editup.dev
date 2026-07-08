import { describe, it, expect } from "vitest";
import { checkVisual } from "@verify/visual.js";
import { summarizeVerification } from "@verify/correction.js";
import { makeSnapshot, makeChange } from "../helpers/fixtures.js";

describe("checkVisual — pseudo-state and secondary-element changes", () => {
  it("does not fail a :hover change absent from the default computed style", () => {
    const snapshot = makeSnapshot({
      changes: [
        makeChange({
          property: "background-color",
          pseudo_state: ":hover",
          expected_final_computed: "rgb(90, 20, 200)",
        }),
      ],
    });
    // post-edit computed reflects the DEFAULT state — hover value not visible
    const result = checkVisual({
      snapshot,
      postEditComputed: { "background-color": "rgb(124, 58, 237)" },
    });

    expect(result.status).toBe("pass");
    expect(result.checked).toBe(0);
    expect(result.divergences).toHaveLength(0);
  });

  it("does not check changes that target another element (element_ref)", () => {
    const snapshot = makeSnapshot({
      changes: [
        makeChange({
          property: "color",
          expected_final_computed: "rgb(255, 255, 255)",
          element_ref: { tag: "a", classes: ["nav-link"] },
        }),
      ],
    });
    const result = checkVisual({ snapshot, postEditComputed: {} });

    expect(result.status).toBe("pass");
    expect(result.checked).toBe(0);
  });

  it("still strictly checks default-state changes on the primary element", () => {
    const snapshot = makeSnapshot({
      changes: [
        makeChange({ expected_final_computed: "rgb(0, 0, 0)" }),
        makeChange({
          property: "color",
          pseudo_state: ":hover",
          expected_final_computed: "rgb(1, 2, 3)",
        }),
      ],
    });
    const result = checkVisual({
      snapshot,
      postEditComputed: { "background-color": "rgb(200, 0, 0)" },
    });

    expect(result.status).toBe("fail");
    expect(result.checked).toBe(1);
    expect(result.divergences).toHaveLength(1);
    expect(result.divergences[0]?.property).toBe("background-color");
  });

  it("summarizeVerification reports skipped when nothing was checked", () => {
    const summary = summarizeVerification(
      { status: "pass", checked: 0, divergences: [] },
      "pass",
      "pass_exact",
      0
    );
    expect(summary.visual_check).toBe("skipped");
  });

  it("summarizeVerification reports pass/fail when changes were checked", () => {
    expect(
      summarizeVerification(
        { status: "pass", checked: 2, divergences: [] },
        "pass",
        "pass_exact",
        0
      ).visual_check
    ).toBe("pass");
    expect(
      summarizeVerification(
        {
          status: "fail",
          checked: 1,
          divergences: [
            { property: "color", expected: "a", actual: "b", reason: "x" },
          ],
        },
        "pass",
        "pass_exact",
        2
      ).visual_check
    ).toBe("fail");
  });
});
