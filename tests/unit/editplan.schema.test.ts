import { describe, it, expect } from "vitest";
import {
  parseEditPlan,
  tryParseEditPlan,
  extractEditPlanFromText,
  EditPlanSchema,
} from "@bridge/edit-plan.js";
import { SchemaValidationError } from "@/lib/errors.js";
import type { EditPlan } from "@/types/edit-plan.js";

const validPlan: EditPlan = {
  summary: "Change button bg to black",
  files: [
    {
      path: "src/Hero.tsx",
      lines_affected: [42],
      reason: "Target element",
      change_type: "target",
      change_source: "visual",
    },
  ],
  visual_changes_applied: true,
  text_instructions_applied: false,
  side_effects: [],
  confidence: "high",
  recommended_action: "apply",
};

describe("EditPlan schema", () => {
  it("accepts valid plan", () => {
    expect(() => parseEditPlan(validPlan)).not.toThrow();
  });

  it("rejects plan missing summary", () => {
    const invalid = { ...validPlan, summary: "" };
    expect(() => parseEditPlan(invalid)).toThrow(SchemaValidationError);
  });

  it("rejects plan with no files", () => {
    const invalid = { ...validPlan, files: [] };
    expect(() => parseEditPlan(invalid)).toThrow(SchemaValidationError);
  });

  it("rejects invalid confidence value", () => {
    const invalid = { ...validPlan, confidence: "very-high" };
    expect(() => parseEditPlan(invalid)).toThrow(SchemaValidationError);
  });

  it("rejects invalid change_source", () => {
    const invalid = {
      ...validPlan,
      files: [{ ...validPlan.files[0]!, change_source: "rogue" }],
    };
    expect(() => parseEditPlan(invalid)).toThrow(SchemaValidationError);
  });

  it("tryParseEditPlan returns success for valid input", () => {
    const result = tryParseEditPlan(validPlan);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summary).toBe(validPlan.summary);
    }
  });

  it("tryParseEditPlan returns issues for invalid input", () => {
    const result = tryParseEditPlan({ summary: 123 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it("extractEditPlanFromText handles plain JSON", () => {
    const text = JSON.stringify(validPlan);
    const result = extractEditPlanFromText(text);
    expect(result.summary).toBe(validPlan.summary);
  });

  it("extractEditPlanFromText handles fenced JSON", () => {
    const text = `Some preamble.\n\`\`\`json\n${JSON.stringify(validPlan)}\n\`\`\``;
    const result = extractEditPlanFromText(text);
    expect(result.summary).toBe(validPlan.summary);
  });

  it("extractEditPlanFromText throws on non-JSON", () => {
    expect(() => extractEditPlanFromText("not json")).toThrow(
      SchemaValidationError
    );
  });

  it("supports alternatives field", () => {
    const withAlts: EditPlan = {
      ...validPlan,
      confidence: "low",
      recommended_action: "consider_alternatives",
      alternatives: [
        {
          description: "Edit design token",
          pros: ["consistent"],
          cons: ["affects 3 buttons"],
        },
      ],
    };
    const parsed = EditPlanSchema.parse(withAlts);
    expect(parsed.alternatives).toHaveLength(1);
  });
});
