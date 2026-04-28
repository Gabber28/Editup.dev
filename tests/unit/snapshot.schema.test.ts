import { describe, it, expect } from "vitest";
import { parseEnrichedSnapshot } from "@bridge/enriched-snapshot.js";
import { SchemaValidationError } from "@/lib/errors.js";
import type { EnrichedSnapshot } from "@/types/snapshot.js";

const valid: EnrichedSnapshot = {
  element: {
    tag: "button",
    classes: ["btn-primary"],
    component_name: "Hero",
    source_file: "Hero.tsx",
    source_line: 42,
  },
  styling: {
    framework: "tailwind",
    class_to_rule_map: {},
    active_css_variables: {},
  },
  changes: [
    {
      property: "background-color",
      before_computed: "rgb(124, 58, 237)",
      after_computed: "rgb(0, 0, 0)",
      expected_final_computed: "rgb(0, 0, 0)",
    },
  ],
};

describe("EnrichedSnapshot schema", () => {
  it("accepts valid snapshot", () => {
    expect(() => parseEnrichedSnapshot(valid)).not.toThrow();
  });

  it("rejects empty changes array", () => {
    const invalid = { ...valid, changes: [] };
    expect(() => parseEnrichedSnapshot(invalid)).toThrow(
      SchemaValidationError
    );
  });

  it("rejects invalid CSS property casing", () => {
    const invalid = {
      ...valid,
      changes: [{ ...valid.changes[0]!, property: "BackgroundColor" }],
    };
    expect(() => parseEnrichedSnapshot(invalid)).toThrow(
      SchemaValidationError
    );
  });

  it("rejects invalid framework value", () => {
    const invalid = {
      ...valid,
      styling: { ...valid.styling, framework: "sass" },
    };
    expect(() => parseEnrichedSnapshot(invalid)).toThrow(
      SchemaValidationError
    );
  });

  it("accepts text_instructions", () => {
    const withText = { ...valid, text_instructions: "make it bolder" };
    const parsed = parseEnrichedSnapshot(withText);
    expect(parsed.text_instructions).toBe("make it bolder");
  });
});
