import { describe, it, expect } from "vitest";
import { extractEditPlanFromText, normalizeRawPlan } from "@bridge/edit-plan.js";
import { makePlan, makePlanFile } from "../helpers/fixtures.js";

describe("EditPlan — resilient normalization of AI output", () => {
  it("clamps an over-long summary instead of rejecting", () => {
    const longSummary = "x".repeat(600);
    const plan = { ...makePlan(), summary: longSummary };
    const result = extractEditPlanFromText(JSON.stringify(plan));
    expect(result.summary.length).toBe(300);
  });

  it("maps an unknown change_type to 'other'", () => {
    const plan = makePlan({
      files: [makePlanFile({ change_type: "style" as "target" })],
    });
    const result = extractEditPlanFromText(JSON.stringify(plan));
    expect(result.files[0]?.change_type).toBe("other");
  });

  it("maps an unknown confidence to 'medium'", () => {
    const plan = { ...makePlan(), confidence: "very-high" };
    const result = extractEditPlanFromText(JSON.stringify(plan));
    expect(result.confidence).toBe("medium");
  });

  it("fills missing side_effects with an empty array", () => {
    const { side_effects: _omit, ...plan } = makePlan();
    const result = extractEditPlanFromText(JSON.stringify(plan));
    expect(result.side_effects).toEqual([]);
  });

  it("clamps an over-long file reason", () => {
    const plan = makePlan({
      files: [makePlanFile({ reason: "y".repeat(900) })],
    });
    const result = extractEditPlanFromText(JSON.stringify(plan));
    expect(result.files[0]?.reason.length).toBe(500);
  });

  it("repairs low confidence without alternatives", () => {
    const plan = { ...makePlan(), confidence: "low", alternatives: undefined };
    const result = extractEditPlanFromText(JSON.stringify(plan));
    expect(result.recommended_action).toBe("consider_alternatives");
    expect(result.alternatives?.length ?? 0).toBeGreaterThan(0);
  });

  it("still rejects structurally invalid input with no files", () => {
    expect(() => extractEditPlanFromText('{"foo": 1}')).toThrow();
  });

  it("normalizeRawPlan leaves non-object input untouched", () => {
    expect(normalizeRawPlan(42)).toBe(42);
    expect(normalizeRawPlan(null)).toBe(null);
  });
});
