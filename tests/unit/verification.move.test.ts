import { describe, it, expect } from "vitest";
import { checkVisual } from "@verify/visual.js";
import { makeElement, makeStyling, makeChange } from "../helpers/fixtures.js";
import type { EnrichedSnapshot } from "@/types/snapshot.js";

const MOVE_VALUE = JSON.stringify({ position: "before", reference: { tag: "button" } });

describe("visual verification of a reorder", () => {
  it("skips __move__ — a DOM position has no computed style to compare", () => {
    const snapshot: EnrichedSnapshot = {
      element: makeElement(),
      styling: makeStyling(),
      changes: [
        makeChange({
          property: "__move__",
          before_computed: "",
          after_computed: MOVE_VALUE,
          expected_final_computed: MOVE_VALUE,
        }),
      ],
    };

    const result = checkVisual({ snapshot, postEditComputed: {} });
    expect(result.status).toBe("pass");
    expect(result.checked).toBe(0);
    expect(result.divergences).toEqual([]);
  });

  it("still checks the CSS changes that came with the same gesture", () => {
    const snapshot: EnrichedSnapshot = {
      element: makeElement(),
      styling: makeStyling(),
      changes: [
        makeChange({
          property: "__move__",
          after_computed: MOVE_VALUE,
          expected_final_computed: MOVE_VALUE,
        }),
        makeChange({
          property: "left",
          before_computed: "auto",
          after_computed: "40px",
          expected_final_computed: "40px",
        }),
      ],
    };

    const pass = checkVisual({ snapshot, postEditComputed: { left: "40px" } });
    expect(pass.status).toBe("pass");
    expect(pass.checked).toBe(1);

    const fail = checkVisual({ snapshot, postEditComputed: { left: "400px" } });
    expect(fail.status).toBe("fail");
    expect(fail.divergences[0]?.property).toBe("left");
  });
});
