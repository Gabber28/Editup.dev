import { describe, it, expect } from "vitest";
import { checkVisual } from "@verify/visual.js";
import { makeElement, makeStyling, makeChange } from "../helpers/fixtures.js";
import type { EnrichedSnapshot } from "@/types/snapshot.js";

const CARD_2 = "section.cards > div:nth-of-type(2)";
const CARD_3 = "section.cards > div:nth-of-type(3)";

function snapshot(changes: EnrichedSnapshot["changes"]): EnrichedSnapshot {
  return { element: makeElement(), styling: makeStyling(), changes };
}

const cardChange = (path: string, value: string) =>
  makeChange({
    property: "top",
    before_computed: "0px",
    after_computed: value,
    expected_final_computed: value,
    element_ref: { tag: "div", classes: ["card"], dom_path: path },
  });

describe("a multi-element edit is verified element by element", () => {
  it("checks each element against its own styles", () => {
    const result = checkVisual({
      snapshot: snapshot([cardChange(CARD_2, "24px"), cardChange(CARD_3, "8px")]),
      postEditComputed: {},
      elementStyles: {
        [CARD_2]: { top: "24px" },
        [CARD_3]: { top: "8px" },
      },
    });
    expect(result.checked).toBe(2);
    expect(result.status).toBe("pass");
  });

  it("catches the value landing on the wrong instance", () => {
    const result = checkVisual({
      snapshot: snapshot([cardChange(CARD_2, "24px"), cardChange(CARD_3, "8px")]),
      postEditComputed: {},
      elementStyles: {
        // The AI wrote to the shared rule: both cards moved by the same amount.
        [CARD_2]: { top: "24px" },
        [CARD_3]: { top: "24px" },
      },
    });
    expect(result.status).toBe("fail");
    expect(result.divergences).toHaveLength(1);
    expect(result.divergences[0]?.element).toBe("div.card");
    expect(result.divergences[0]?.expected).toBe("8px");
    expect(result.divergences[0]?.actual).toBe("24px");
  });

  it("counts an element the page never reported as unchecked, not as passing", () => {
    const result = checkVisual({
      snapshot: snapshot([cardChange(CARD_2, "24px")]),
      postEditComputed: {},
      elementStyles: {},
    });
    expect(result.checked).toBe(0);
    expect(result.status).toBe("pass");
  });

  it("still verifies the primary element from the snapshot styles", () => {
    const result = checkVisual({
      snapshot: snapshot([
        makeChange({
          property: "top",
          after_computed: "12px",
          expected_final_computed: "12px",
        }),
        cardChange(CARD_2, "24px"),
      ]),
      postEditComputed: { top: "12px" },
      elementStyles: { [CARD_2]: { top: "24px" } },
    });
    expect(result.checked).toBe(2);
    expect(result.status).toBe("pass");
  });

  it("keeps ignoring pseudo-state changes, which no computed style shows", () => {
    const result = checkVisual({
      snapshot: snapshot([
        makeChange({ property: "color", pseudo_state: ":hover" }),
      ]),
      postEditComputed: { color: "rgb(1, 2, 3)" },
    });
    expect(result.checked).toBe(0);
  });
});
