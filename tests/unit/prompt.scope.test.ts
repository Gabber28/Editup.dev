import { describe, it, expect } from "vitest";
import { buildPlanPrompt, buildExecutePrompt } from "@bridge/prompt.js";
import { makeElement, makeChange } from "../helpers/fixtures.js";
import type { EnrichedSnapshot } from "@/types/snapshot.js";

const inputs = { projectRoot: "/project" };

const snapshot = (
  styling: Partial<EnrichedSnapshot["styling"]> = {},
): EnrichedSnapshot => ({
  element: { ...makeElement({ tag: "div", classes: ["card"] }), dom_index: 2 },
  styling: {
    framework: "plain-css",
    class_to_rule_map: {},
    active_css_variables: {},
    ...styling,
  },
  changes: [makeChange({ property: "top", after_computed: "24px" })],
});

describe("shared rules are visible to the AI", () => {
  it("tags a rule that styles several elements with its reach", () => {
    const prompt = buildPlanPrompt({
      snapshot: snapshot({
        matching_rules: [
          {
            selector: ".card",
            source_file: "index.html",
            rule_text: ".card { padding: 28px; }",
            line_number: 81,
            match_count: 3,
          },
        ],
      }),
      ...inputs,
    });
    expect(prompt).toContain("<matching_rules>");
    expect(prompt).toContain('selector=".card"');
    expect(prompt).toContain('shared_by="3"');
    expect(prompt).toContain('file="index.html"');
  });

  it("does not tag a rule that styles a single element", () => {
    const prompt = buildPlanPrompt({
      snapshot: snapshot({
        matching_rules: [
          {
            selector: "#hero-title",
            source_file: "index.html",
            rule_text: "#hero-title { font-size: 52px; }",
            line_number: 40,
            match_count: 1,
          },
        ],
      }),
      ...inputs,
    });
    const ruleLine = prompt
      .split("\n")
      .find((l) => l.includes('selector="#hero-title"'));
    expect(ruleLine).toBeDefined();
    expect(ruleLine).not.toContain("shared_by");
  });

  it("carries the reach into the class map too", () => {
    const prompt = buildPlanPrompt({
      snapshot: snapshot({
        class_to_rule_map: {
          card: {
            source_file: "index.html",
            rule_text: ".card { padding: 28px; }",
            line_number: 81,
            match_count: 3,
          },
        },
      }),
      ...inputs,
    });
    expect(prompt).toContain('<class name="card"');
    expect(prompt).toContain('shared_by="3"');
  });

  it("omits the block when no rules were captured", () => {
    const prompt = buildPlanPrompt({ snapshot: snapshot(), ...inputs });
    expect(prompt).not.toContain("<matching_rules>");
  });
});

describe("both prompts forbid editing a shared rule in place", () => {
  const plan = buildPlanPrompt({ snapshot: snapshot(), ...inputs });
  const execute = buildExecutePrompt({
    snapshot: snapshot(),
    approvedPlanJson: "{}",
    ...inputs,
  });

  it("states the shared_by rule and the scoping idioms", () => {
    for (const prompt of [plan, execute]) {
      expect(prompt).toContain("shared_by");
      expect(prompt).toMatch(/nth-of-type|nth-child/);
      expect(prompt).toContain("Tailwind");
      expect(prompt).toContain("dom_path");
    }
  });

  it("calls out collateral change as a failed edit", () => {
    expect(plan).toMatch(/failed edit/i);
    expect(execute).toMatch(/failed edit/i);
  });
});
