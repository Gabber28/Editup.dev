import { describe, it, expect } from "vitest";
import { buildPlanPrompt } from "@bridge/prompt.js";
import { makeSnapshot, makeChange } from "../helpers/fixtures.js";

describe("prompt — combined visual + text instructions", () => {
  it("includes both <visual_changes> and <text_instructions> sections", () => {
    const snapshot = makeSnapshot({
      text_instructions: "add hover glow effect",
    });
    const prompt = buildPlanPrompt({ snapshot, projectRoot: "/proj" });

    expect(prompt).toContain("<visual_changes>");
    expect(prompt).toContain("</visual_changes>");
    expect(prompt).toContain("<text_instructions>");
    expect(prompt).toContain("hover glow effect");
  });

  it("visual_changes appears before text_instructions", () => {
    const snapshot = makeSnapshot({
      text_instructions: "increase font on mobile",
    });
    const prompt = buildPlanPrompt({ snapshot, projectRoot: "/proj" });

    const visualIdx = prompt.indexOf("<visual_changes>");
    const textIdx = prompt.indexOf("<text_instructions>");
    expect(visualIdx).toBeGreaterThan(-1);
    expect(textIdx).toBeGreaterThan(-1);
    expect(visualIdx).toBeLessThan(textIdx);
  });

  it("prompt states visual_changes take priority over text", () => {
    const snapshot = makeSnapshot({
      text_instructions: "make it red",
    });
    const prompt = buildPlanPrompt({ snapshot, projectRoot: "/proj" });

    expect(prompt).toMatch(/visual_changes\s.*win|priority/i);
  });

  it("omits text_instructions section when no text present", () => {
    const snapshot = makeSnapshot({ text_instructions: undefined });
    const prompt = buildPlanPrompt({ snapshot, projectRoot: "/proj" });

    expect(prompt).toContain("<visual_changes>");
    expect(prompt).not.toContain("</text_instructions>");
  });

  it("includes visual_changes even when only text_instructions set", () => {
    const snapshot = makeSnapshot({
      changes: [makeChange({ property: "color" })],
      text_instructions: "refactor component",
    });
    const prompt = buildPlanPrompt({ snapshot, projectRoot: "/proj" });

    expect(prompt).toContain("<visual_changes>");
    expect(prompt).toContain("<text_instructions>");
    expect(prompt).toContain("refactor component");
  });

  it("visual_changes section lists each change property", () => {
    const snapshot = makeSnapshot({
      changes: [
        makeChange({ property: "font-size", after_computed: "18px" }),
        makeChange({ property: "color", after_computed: "red" }),
      ],
      text_instructions: "also center text",
    });
    const prompt = buildPlanPrompt({ snapshot, projectRoot: "/proj" });

    expect(prompt).toContain('property="font-size"');
    expect(prompt).toContain('property="color"');
  });

  it("text_instructions content is wrapped in CDATA", () => {
    const snapshot = makeSnapshot({
      text_instructions: "use <bold> styling",
    });
    const prompt = buildPlanPrompt({ snapshot, projectRoot: "/proj" });

    expect(prompt).toContain("<text_instructions>");
    expect(prompt).toContain("<![CDATA[");
  });
});
