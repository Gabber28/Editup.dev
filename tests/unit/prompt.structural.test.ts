import { describe, it, expect } from "vitest";
import { buildPlanPrompt, buildExecutePrompt } from "@bridge/prompt.js";
import { makeElement, makeStyling, makeChange } from "../helpers/fixtures.js";
import type { EnrichedSnapshot } from "@/types/snapshot.js";

const MOVE_VALUE = JSON.stringify({
  position: "before",
  reference: {
    tag: "button",
    classes: ["btn", "btn-primary"],
    component: "Hero",
    source: "src/hero.tsx:14",
  },
});

function snapshotWithMove(extra: EnrichedSnapshot["changes"] = []): EnrichedSnapshot {
  return {
    element: makeElement(),
    styling: makeStyling(),
    changes: [
      makeChange({
        property: "__move__",
        before_computed: "",
        after_computed: MOVE_VALUE,
        expected_final_computed: MOVE_VALUE,
      }),
      ...extra,
    ],
  };
}

const inputs = { projectRoot: "/project" };

// The instruction text itself mentions these tags, so block presence is only
// meaningful when the tag opens its own line — that is the rendered section.
const VISUAL_BLOCK = /^<visual_changes>$/m;
const STRUCTURAL_BLOCK = /^<structural_changes>$/m;

describe("structural changes in the prompt", () => {
  it("renders a reorder as its own block, not as a CSS declaration", () => {
    const prompt = buildPlanPrompt({ snapshot: snapshotWithMove(), ...inputs });

    expect(prompt).toMatch(STRUCTURAL_BLOCK);
    expect(prompt).toContain('position="before"');
    expect(prompt).toContain('reference="button.btn.btn-primary"');
    expect(prompt).toContain('reference_source="src/hero.tsx:14"');
    expect(prompt).toContain('reference_component="Hero"');
    expect(prompt).not.toContain('property="__move__"');
  });

  it("omits the visual block entirely when the reorder is the only change", () => {
    const prompt = buildPlanPrompt({ snapshot: snapshotWithMove(), ...inputs });
    expect(prompt).not.toMatch(VISUAL_BLOCK);
  });

  it("keeps CSS changes in the visual block alongside the reorder", () => {
    const prompt = buildPlanPrompt({
      snapshot: snapshotWithMove([makeChange({ property: "color" })]),
      ...inputs,
    });
    expect(prompt).toMatch(VISUAL_BLOCK);
    expect(prompt).toContain('property="color"');
    expect(prompt).toMatch(STRUCTURAL_BLOCK);
  });

  it("tells both prompts to move markup and to reorder .map() data instead", () => {
    const plan = buildPlanPrompt({ snapshot: snapshotWithMove(), ...inputs });
    const execute = buildExecutePrompt({
      snapshot: snapshotWithMove(),
      approvedPlanJson: "{}",
      ...inputs,
    });

    for (const prompt of [plan, execute]) {
      expect(prompt).toContain(".map()");
      expect(prompt).toMatch(/never duplicate it|without duplicating it/);
      expect(prompt).toContain("structural_changes");
    }
    expect(plan).toContain("structural");
  });

  it("skips a malformed move value instead of leaking raw JSON", () => {
    const snapshot: EnrichedSnapshot = {
      element: makeElement(),
      styling: makeStyling(),
      changes: [
        makeChange({
          property: "__move__",
          after_computed: "not json",
          expected_final_computed: "not json",
        }),
      ],
    };
    const prompt = buildPlanPrompt({ snapshot, ...inputs });
    expect(prompt).not.toMatch(STRUCTURAL_BLOCK);
    expect(prompt).not.toContain("not json");
  });
});
