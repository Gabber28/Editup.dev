import { describe, it, expect } from "vitest";
import { parseEditPlan, normalizeRawPlan } from "@bridge/edit-plan.js";

const base = {
  summary: "Move the docs button before the primary CTA",
  files: [
    {
      path: "src/hero.tsx",
      lines_affected: [14, 15],
      reason: "reordered the two buttons",
      change_type: "structural",
      change_source: "visual",
    },
  ],
  visual_changes_applied: true,
  text_instructions_applied: false,
  side_effects: [],
  confidence: "high",
  recommended_action: "apply",
};

describe("EditPlan with a structural change", () => {
  it("accepts change_type: structural", () => {
    const plan = parseEditPlan(base);
    expect(plan.files[0]?.change_type).toBe("structural");
  });

  it("keeps structural through normalization", () => {
    const normalized = normalizeRawPlan(base) as typeof base;
    expect(normalized.files[0]?.change_type).toBe("structural");
  });

  it("still falls back to other for an unknown type", () => {
    const normalized = normalizeRawPlan({
      ...base,
      files: [{ ...base.files[0], change_type: "reordering" }],
    }) as typeof base;
    expect(normalized.files[0]?.change_type).toBe("other");
  });
});
