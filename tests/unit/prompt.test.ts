import { describe, it, expect } from "vitest";
import {
  buildPlanPrompt,
  buildExecutePrompt,
} from "@bridge/prompt.js";
import type { EnrichedSnapshot } from "@/types/snapshot.js";

const snapshot: EnrichedSnapshot = {
  element: {
    tag: "button",
    classes: ["btn-primary"],
    component_name: "Hero",
    source_file: "src/Hero.tsx",
    source_line: 42,
  },
  styling: {
    framework: "tailwind",
    class_to_rule_map: {
      "btn-primary": {
        source_file: "src/index.css",
        rule_text: ".btn-primary { background: #7c3aed; }",
        line_number: 12,
      },
    },
    active_css_variables: {},
    tailwind_classes: ["bg-purple-600"],
  },
  changes: [
    {
      property: "background-color",
      before_computed: "rgb(124, 58, 237)",
      after_computed: "rgb(0, 0, 0)",
      expected_final_computed: "rgb(0, 0, 0)",
    },
  ],
  text_instructions: "also make the text uppercase",
};

describe("prompt generator", () => {
  it("plan prompt contains snapshot data", () => {
    const prompt = buildPlanPrompt({
      snapshot,
      projectRoot: "/project",
    });
    expect(prompt).toContain("button");
    expect(prompt).toContain("btn-primary");
    expect(prompt).toContain("background-color");
  });

  it("plan prompt contains visual_changes section", () => {
    const prompt = buildPlanPrompt({
      snapshot,
      projectRoot: "/project",
    });
    expect(prompt).toContain("<visual_changes>");
    expect(prompt).toContain("</visual_changes>");
  });

  it("plan prompt contains text_instructions content when present", () => {
    const prompt = buildPlanPrompt({
      snapshot,
      projectRoot: "/project",
    });
    expect(prompt).toContain("uppercase");
  });

  it("plan prompt omits text_instructions section when absent", () => {
    const noText = { ...snapshot };
    delete (noText as { text_instructions?: string }).text_instructions;
    const prompt = buildPlanPrompt({
      snapshot: noText,
      projectRoot: "/project",
    });
    expect(prompt).not.toContain("uppercase");
    expect(prompt).not.toContain("CDATA");
  });

  it("plan prompt mentions framework", () => {
    const prompt = buildPlanPrompt({
      snapshot,
      projectRoot: "/project",
    });
    expect(prompt).toContain("tailwind");
  });

  it("plan prompt instructs no editing", () => {
    const prompt = buildPlanPrompt({
      snapshot,
      projectRoot: "/project",
    });
    expect(prompt).toMatch(/READ-ONLY|do not edit|DO NOT edit/i);
  });

  it("execute prompt includes approved plan", () => {
    const planJson = JSON.stringify({ summary: "test" });
    const prompt = buildExecutePrompt({
      snapshot,
      projectRoot: "/project",
      approvedPlanJson: planJson,
    });
    expect(prompt).toContain("<approved_plan>");
    expect(prompt).toContain("test");
  });

  it("escapes XML special chars in element data", () => {
    const evil: EnrichedSnapshot = {
      ...snapshot,
      element: {
        ...snapshot.element,
        tag: "div",
        classes: ["a<script>evil</script>"],
      },
    };
    const prompt = buildPlanPrompt({
      snapshot: evil,
      projectRoot: "/project",
    });
    expect(prompt).not.toContain("<script>evil</script>");
    expect(prompt).toContain("&lt;script&gt;");
  });
});
