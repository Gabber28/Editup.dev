import { describe, it, expect } from "vitest";
import { buildPlanPrompt } from "@bridge/prompt.js";
import { makeElement, makeStyling, makeChange } from "../helpers/fixtures.js";
import type { EnrichedSnapshot, ChangeElementRef } from "@/types/snapshot.js";

const inputs = { projectRoot: "/project" };

const card = (n: number): ChangeElementRef => ({
  tag: "div",
  classes: ["card"],
  dom_path: `body > main > section:nth-of-type(2) > div:nth-of-type(${n})`,
  dom_index: n,
  text_preview: `Card ${n}`,
});

function snapshot(changes: EnrichedSnapshot["changes"]): EnrichedSnapshot {
  return {
    element: {
      ...makeElement({ tag: "div", classes: ["card"] }),
      dom_path: "body > main > section:nth-of-type(2) > div:nth-of-type(1)",
      dom_index: 1,
      text_preview: "Card 1",
      ancestor_path: ["main", "section.cards"],
    },
    styling: makeStyling(),
    changes,
  };
}

describe("the prompt identifies which instance was edited", () => {
  it("renders dom_path, sibling position, text and ancestors for the main element", () => {
    const prompt = buildPlanPrompt({
      snapshot: snapshot([makeChange({ property: "top" })]),
      ...inputs,
    });
    expect(prompt).toContain(
      "<dom_path>body &gt; main &gt; section:nth-of-type(2) &gt; div:nth-of-type(1)</dom_path>",
    );
    expect(prompt).toContain("<sibling_position>1</sibling_position>");
    expect(prompt).toContain("<text>Card 1</text>");
    expect(prompt).toContain("main &gt; section.cards");
  });

  it("keeps two instances of the same class in separate blocks", () => {
    const prompt = buildPlanPrompt({
      snapshot: snapshot([
        makeChange({ property: "top", after_computed: "24px", element_ref: card(2) }),
        makeChange({ property: "top", after_computed: "8px", element_ref: card(3) }),
      ]),
      ...inputs,
    });
    const blocks = prompt.match(/<element_changes /g) ?? [];
    expect(blocks).toHaveLength(2);
    expect(prompt).toContain('div:nth-of-type(2)"');
    expect(prompt).toContain('div:nth-of-type(3)"');
    expect(prompt).toContain('text="Card 2"');
  });

  it("falls back to the old identity when dom_path is absent", () => {
    const prompt = buildPlanPrompt({
      snapshot: {
        element: makeElement(),
        styling: makeStyling(),
        changes: [
          makeChange({
            property: "color",
            element_ref: { tag: "p", classes: ["lead"] },
          }),
        ],
      },
      ...inputs,
    });
    expect(prompt).toContain('target="p.lead"');
  });
});

const moveValue = (refTag: string): string =>
  JSON.stringify({ position: "before", reference: { tag: refTag, classes: ["btn"] } });

describe("a reorder says which element moved (regression)", () => {
  it("attributes a secondary element's move to that element, not the main one", () => {
    const prompt = buildPlanPrompt({
      snapshot: snapshot([
        makeChange({
          property: "__move__",
          after_computed: moveValue("button"),
          expected_final_computed: moveValue("button"),
          element_ref: card(3),
        }),
      ]),
      ...inputs,
    });
    expect(prompt).toContain('element="div.card"');
    expect(prompt).toContain('div:nth-of-type(3)"');
    // The moved element must not be confused with the drop reference.
    expect(prompt).toContain('reference="button.btn"');
  });

  it("gives two drags two distinct moved elements instead of contradicting itself", () => {
    const prompt = buildPlanPrompt({
      snapshot: snapshot([
        makeChange({
          property: "__move__",
          after_computed: moveValue("button"),
          expected_final_computed: moveValue("button"),
          element_ref: card(2),
        }),
        makeChange({
          property: "__move__",
          after_computed: moveValue("a"),
          expected_final_computed: moveValue("a"),
          element_ref: card(3),
        }),
      ]),
      ...inputs,
    });
    const moves = prompt.match(/<move /g) ?? [];
    expect(moves).toHaveLength(2);
    expect(prompt).toContain('sibling_position="2"');
    expect(prompt).toContain('sibling_position="3"');
  });

  it("uses the main element when the move carries no element_ref", () => {
    const prompt = buildPlanPrompt({
      snapshot: snapshot([
        makeChange({
          property: "__move__",
          after_computed: moveValue("button"),
          expected_final_computed: moveValue("button"),
        }),
      ]),
      ...inputs,
    });
    expect(prompt).toContain('element="div.card"');
  });
});
