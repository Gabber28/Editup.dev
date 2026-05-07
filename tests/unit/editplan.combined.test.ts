import { describe, it, expect } from "vitest";
import { parseEditPlan } from "@bridge/edit-plan.js";
import { makePlan, makePlanFile } from "../helpers/fixtures.js";

describe("EditPlan — combined change_source + applied flags", () => {
  it("accepts change_source:'both' on files", () => {
    const plan = makePlan({
      files: [makePlanFile({ change_source: "both" })],
      visual_changes_applied: true,
      text_instructions_applied: true,
    });
    expect(() => parseEditPlan(plan)).not.toThrow();
  });

  it("accepts change_source:'visual' on files", () => {
    const plan = makePlan({
      files: [makePlanFile({ change_source: "visual" })],
    });
    expect(() => parseEditPlan(plan)).not.toThrow();
  });

  it("accepts change_source:'text_instruction' on files", () => {
    const plan = makePlan({
      files: [makePlanFile({ change_source: "text_instruction" })],
      text_instructions_applied: true,
    });
    expect(() => parseEditPlan(plan)).not.toThrow();
  });

  it("accepts visual_changes_applied:true + text_instructions_applied:true", () => {
    const plan = makePlan({
      visual_changes_applied: true,
      text_instructions_applied: true,
    });
    const parsed = parseEditPlan(plan);
    expect(parsed.visual_changes_applied).toBe(true);
    expect(parsed.text_instructions_applied).toBe(true);
  });

  it("accepts visual_changes_applied:false + text_instructions_applied:false", () => {
    const plan = makePlan({
      visual_changes_applied: false,
      text_instructions_applied: false,
    });
    const parsed = parseEditPlan(plan);
    expect(parsed.visual_changes_applied).toBe(false);
    expect(parsed.text_instructions_applied).toBe(false);
  });

  it("accepts mixed files with different change_source values", () => {
    const plan = makePlan({
      files: [
        makePlanFile({ path: "a.tsx", change_source: "visual" }),
        makePlanFile({ path: "b.css", change_source: "text_instruction" }),
        makePlanFile({ path: "c.tsx", change_source: "both" }),
      ],
      visual_changes_applied: true,
      text_instructions_applied: true,
    });
    const parsed = parseEditPlan(plan);
    expect(parsed.files).toHaveLength(3);
  });

  it("preserves change_source values through parse round-trip", () => {
    const plan = makePlan({
      files: [
        makePlanFile({ path: "x.tsx", change_source: "both" }),
      ],
    });
    const parsed = parseEditPlan(plan);
    expect(parsed.files[0]!.change_source).toBe("both");
  });

  it("rejects unknown change_source value", () => {
    const plan = makePlan({
      files: [makePlanFile({ change_source: "unknown" as "visual" })],
    });
    expect(() => parseEditPlan(plan)).toThrow();
  });

  it("boolean flags default expectations are preserved", () => {
    const plan = makePlan();
    const parsed = parseEditPlan(plan);
    expect(typeof parsed.visual_changes_applied).toBe("boolean");
    expect(typeof parsed.text_instructions_applied).toBe("boolean");
  });
});
