import { describe, it, expect } from "vitest";
import { buildPlanPrompt } from "@bridge/prompt.js";
import { makeSnapshot, makeStyling } from "../helpers/fixtures.js";
import type { StylingFramework } from "@/types/snapshot.js";

const ALL_FRAMEWORKS: StylingFramework[] = [
  "tailwind",
  "css-modules",
  "styled-components",
  "css-variables",
  "plain-css",
  "mixed",
];

describe("prompt — framework mention for every value", () => {
  it.each(ALL_FRAMEWORKS)(
    "prompt contains '%s' when snapshot.styling.framework is '%s'",
    (fw) => {
      const snapshot = makeSnapshot({
        styling: makeStyling({ framework: fw }),
      });
      const prompt = buildPlanPrompt({ snapshot, projectRoot: "/proj" });

      expect(prompt).toContain(`<framework>${fw}</framework>`);
    }
  );

  it("framework tag appears exactly once", () => {
    const snapshot = makeSnapshot({
      styling: makeStyling({ framework: "css-modules" }),
    });
    const prompt = buildPlanPrompt({ snapshot, projectRoot: "/proj" });

    const matches = prompt.match(/<framework>/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("framework tag is outside visual_changes section", () => {
    const snapshot = makeSnapshot({
      styling: makeStyling({ framework: "styled-components" }),
    });
    const prompt = buildPlanPrompt({ snapshot, projectRoot: "/proj" });

    const fwIdx = prompt.indexOf("<framework>");
    const vcEnd = prompt.indexOf("</visual_changes>");
    expect(fwIdx).toBeLessThan(vcEnd);
    expect(fwIdx).toBeGreaterThan(-1);
    const fwBefore = prompt.slice(0, prompt.indexOf("</visual_changes>"));
    expect(fwBefore).toContain("<framework>");
  });

  it("renders class_rules when class_to_rule_map is populated", () => {
    const snapshot = makeSnapshot({
      styling: makeStyling({
        framework: "plain-css",
        class_to_rule_map: {
          "card": {
            source_file: "src/card.css",
            rule_text: ".card { padding: 8px; }",
            line_number: 3,
          },
        },
      }),
    });
    const prompt = buildPlanPrompt({ snapshot, projectRoot: "/proj" });

    expect(prompt).toContain("<class_rules>");
    expect(prompt).toContain('name="card"');
    expect(prompt).toContain('file="src/card.css"');
  });

  it("omits class_rules when class_to_rule_map is empty", () => {
    const snapshot = makeSnapshot({
      styling: makeStyling({
        framework: "mixed",
        class_to_rule_map: {},
      }),
    });
    const prompt = buildPlanPrompt({ snapshot, projectRoot: "/proj" });

    expect(prompt).not.toContain("<class_rules>");
  });
});
