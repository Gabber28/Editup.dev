import { describe, it, expect } from "vitest";
import { buildPlanPrompt, buildExecutePrompt } from "@bridge/prompt.js";
import { makeSnapshot, makeChange, makeStyling } from "../helpers/fixtures.js";

describe("prompt — multi-element visual changes", () => {
  it("renders changes without element_ref under the main element", () => {
    const snapshot = makeSnapshot();
    const prompt = buildPlanPrompt({ snapshot, projectRoot: "/proj" });

    expect(prompt).toContain('<change property="background-color"');
    // the instruction text mentions the tag; assert no rendered block exists
    expect(prompt).not.toContain("<element_changes target=");
  });

  it("groups element_ref changes into element_changes blocks with target and source", () => {
    const snapshot = makeSnapshot({
      changes: [
        makeChange(),
        makeChange({
          property: "color",
          after_computed: "rgb(255, 255, 255)",
          expected_final_computed: "rgb(255, 255, 255)",
          element_ref: {
            tag: "a",
            classes: ["nav-link"],
            source_file: "src/Nav.tsx",
            source_line: 8,
          },
        }),
      ],
    });
    const prompt = buildPlanPrompt({ snapshot, projectRoot: "/proj" });

    expect(prompt).toContain('<element_changes target="a.nav-link" source="src/Nav.tsx:8">');
    expect(prompt).toContain("</element_changes>");
    // primary change stays outside the block
    const visualStart = prompt.indexOf("<visual_changes>");
    const blockStart = prompt.indexOf("<element_changes target=", visualStart);
    const primaryIdx = prompt.indexOf('property="background-color"', visualStart);
    expect(primaryIdx).toBeLessThan(blockStart);
  });

  it("groups multiple changes of the same secondary element into one block", () => {
    const ref = { tag: "a", classes: ["nav-link"] };
    const snapshot = makeSnapshot({
      changes: [
        makeChange({ property: "color", element_ref: ref }),
        makeChange({ property: "font-size", element_ref: ref }),
      ],
    });
    const prompt = buildPlanPrompt({ snapshot, projectRoot: "/proj" });

    expect(prompt.match(/<element_changes target=/g)).toHaveLength(1);
    expect(prompt).toContain('property="color"');
    expect(prompt).toContain('property="font-size"');
  });

  it("keeps the state attribute on pseudo-state changes inside blocks", () => {
    const snapshot = makeSnapshot({
      changes: [
        makeChange({
          property: "color",
          pseudo_state: ":hover",
          element_ref: { tag: "a", classes: [] },
        }),
      ],
    });
    const prompt = buildPlanPrompt({ snapshot, projectRoot: "/proj" });
    expect(prompt).toContain('state=":hover"');
  });

  it("execute prompt also renders element_changes blocks and styling context", () => {
    const snapshot = makeSnapshot({
      changes: [
        makeChange({ element_ref: { tag: "a", classes: ["x"] } }),
      ],
    });
    const prompt = buildExecutePrompt({
      snapshot,
      projectRoot: "/proj",
      approvedPlanJson: "{}",
    });
    expect(prompt).toContain('<element_changes target="a.x">');
    expect(prompt).toContain("<framework>");
  });
});

describe("prompt — embedded rule text and retry hint", () => {
  it("embeds rule_text inside class_rules entries", () => {
    const snapshot = makeSnapshot();
    const prompt = buildPlanPrompt({ snapshot, projectRoot: "/proj" });
    expect(prompt).toContain(".btn-primary { background: #7c3aed; }");
  });

  it("renders existing pseudo rules only for edited pseudo states", () => {
    const snapshot = makeSnapshot({
      styling: makeStyling({
        pseudo_rules: [
          {
            pseudo: ":hover",
            selector: ".btn:hover",
            properties: { "background-color": "rgb(90, 20, 200)" },
            source_file: "src/styles.css",
            line_number: 0,
          },
          {
            pseudo: ":focus",
            selector: ".btn:focus",
            properties: { outline: "2px solid" },
            source_file: "src/styles.css",
            line_number: 0,
          },
        ],
      }),
      changes: [makeChange({ pseudo_state: ":hover" })],
    });
    const prompt = buildPlanPrompt({ snapshot, projectRoot: "/proj" });

    expect(prompt).toContain("<existing_pseudo_rules>");
    expect(prompt).toContain('selector=".btn:hover"');
    expect(prompt).not.toContain('selector=".btn:focus"');
  });

  it("appends a strict-mode warning when retryHint is set", () => {
    const snapshot = makeSnapshot();
    const prompt = buildPlanPrompt({
      snapshot,
      projectRoot: "/proj",
      retryHint: "invalid fields: files.0.change_type",
    });
    expect(prompt).toContain("STRICT MODE");
    expect(prompt).toContain("files.0.change_type");
  });

  it("omits the strict-mode warning without retryHint", () => {
    const snapshot = makeSnapshot();
    const prompt = buildPlanPrompt({ snapshot, projectRoot: "/proj" });
    expect(prompt).not.toContain("STRICT MODE");
  });
});
