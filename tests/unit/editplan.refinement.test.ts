import { describe, it, expect } from "vitest";
import { parseEditPlan } from "@bridge/edit-plan.js";
import { SchemaValidationError } from "@/lib/errors.js";
import type { EditPlan } from "@/types/edit-plan.js";

const base: EditPlan = {
  summary: "test",
  files: [
    {
      path: "Hero.tsx",
      lines_affected: [1],
      reason: "test",
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

describe("EditPlan refinement — confidence/alternatives", () => {
  it("rejects confidence:'low' without alternatives", () => {
    const invalid: EditPlan = {
      ...base,
      confidence: "low",
      recommended_action: "consider_alternatives",
    };
    expect(() => parseEditPlan(invalid)).toThrow(SchemaValidationError);
  });

  it("rejects confidence:'low' with empty alternatives", () => {
    const invalid: EditPlan = {
      ...base,
      confidence: "low",
      recommended_action: "consider_alternatives",
      alternatives: [],
    };
    expect(() => parseEditPlan(invalid)).toThrow(SchemaValidationError);
  });

  it("rejects confidence:'low' with recommended_action:'apply'", () => {
    const invalid: EditPlan = {
      ...base,
      confidence: "low",
      recommended_action: "apply",
      alternatives: [
        { description: "A", pros: [], cons: [] },
      ],
    };
    expect(() => parseEditPlan(invalid)).toThrow(SchemaValidationError);
  });

  it("accepts confidence:'low' with consider_alternatives + alternatives", () => {
    const valid: EditPlan = {
      ...base,
      confidence: "low",
      recommended_action: "consider_alternatives",
      alternatives: [
        {
          description: "Edit token",
          pros: ["consistent"],
          cons: ["affects others"],
        },
      ],
    };
    expect(() => parseEditPlan(valid)).not.toThrow();
  });

  it("does not constrain medium/high confidence", () => {
    const med: EditPlan = { ...base, confidence: "medium" };
    expect(() => parseEditPlan(med)).not.toThrow();
  });
});
