import { describe, it, expect } from "vitest";
import { parseEnrichedSnapshot } from "@bridge/enriched-snapshot.js";
import { SchemaValidationError } from "@/lib/errors.js";
import type { EnrichedSnapshot } from "@/types/snapshot.js";

const base: EnrichedSnapshot = {
  element: { tag: "button", classes: ["btn"] },
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

describe("EnrichedSnapshot refinement — visual or text required", () => {
  it("accepts visual-only snapshot", () => {
    expect(() => parseEnrichedSnapshot(base)).not.toThrow();
  });

  it("accepts text-only snapshot (zero changes + text_instructions)", () => {
    const textOnly: EnrichedSnapshot = {
      ...base,
      changes: [],
      text_instructions: "make the hero section more elegant",
    };
    expect(() => parseEnrichedSnapshot(textOnly)).not.toThrow();
  });

  it("accepts combined visual + text snapshot", () => {
    const combined: EnrichedSnapshot = {
      ...base,
      text_instructions: "also uppercase",
    };
    expect(() => parseEnrichedSnapshot(combined)).not.toThrow();
  });

  it("rejects empty snapshot (no changes, no text)", () => {
    const empty: EnrichedSnapshot = { ...base, changes: [] };
    expect(() => parseEnrichedSnapshot(empty)).toThrow(SchemaValidationError);
  });

  it("rejects whitespace-only text_instructions with no changes", () => {
    const whitespace: EnrichedSnapshot = {
      ...base,
      changes: [],
      text_instructions: "   \n  ",
    };
    expect(() => parseEnrichedSnapshot(whitespace)).toThrow(
      SchemaValidationError
    );
  });
});
