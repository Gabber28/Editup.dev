import { describe, it, expect } from "vitest";
import { checkVisual } from "@verify/visual.js";
import { makeSnapshot, makeChange } from "../helpers/fixtures.js";

describe("snapshot — CSS value normalization and tolerance", () => {
  it("exact rgb match passes", () => {
    const snapshot = makeSnapshot({
      changes: [makeChange({
        property: "color",
        expected_final_computed: "rgb(255, 0, 0)",
      })],
    });
    const result = checkVisual({
      snapshot,
      postEditComputed: { color: "rgb(255, 0, 0)" },
    });
    expect(result.status).toBe("pass");
  });

  it("rgb within 15-channel tolerance passes", () => {
    const snapshot = makeSnapshot({
      changes: [makeChange({
        property: "color",
        expected_final_computed: "rgb(100, 100, 100)",
      })],
    });
    const result = checkVisual({
      snapshot,
      postEditComputed: { color: "rgb(115, 100, 100)" },
    });
    expect(result.status).toBe("pass");
  });

  it("rgb exceeding 15-channel tolerance fails", () => {
    const snapshot = makeSnapshot({
      changes: [makeChange({
        property: "color",
        expected_final_computed: "rgb(100, 100, 100)",
      })],
    });
    const result = checkVisual({
      snapshot,
      postEditComputed: { color: "rgb(120, 100, 100)" },
    });
    expect(result.status).toBe("fail");
    expect(result.divergences[0]?.reason).toContain("RGB");
  });

  it("px within 5px tolerance passes", () => {
    const snapshot = makeSnapshot({
      changes: [makeChange({
        property: "width",
        expected_final_computed: "200px",
      })],
    });
    const result = checkVisual({
      snapshot,
      postEditComputed: { width: "203px" },
    });
    expect(result.status).toBe("pass");
  });

  it("px exceeding 5px tolerance fails", () => {
    const snapshot = makeSnapshot({
      changes: [makeChange({
        property: "width",
        expected_final_computed: "200px",
      })],
    });
    const result = checkVisual({
      snapshot,
      postEditComputed: { width: "210px" },
    });
    expect(result.status).toBe("fail");
    expect(result.divergences[0]?.reason).toContain("px");
  });

  it("hex color comparison works via rgb parsing", () => {
    const snapshot = makeSnapshot({
      changes: [makeChange({
        property: "background-color",
        expected_final_computed: "#ff0000",
      })],
    });
    const result = checkVisual({
      snapshot,
      postEditComputed: { "background-color": "rgb(255, 0, 0)" },
    });
    expect(result.status).toBe("pass");
  });

  it("missing property in post-edit is a divergence", () => {
    const snapshot = makeSnapshot({
      changes: [makeChange({ property: "opacity" })],
    });
    const result = checkVisual({ snapshot, postEditComputed: {} });
    expect(result.status).toBe("fail");
    expect(result.divergences[0]?.actual).toBe("<missing>");
  });
});
