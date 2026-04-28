import { describe, it, expect } from "vitest";
import { auditDiff } from "@verify/diff-audit.js";
import type { EditPlan } from "@/types/edit-plan.js";

const plan: EditPlan = {
  summary: "test",
  files: [
    {
      path: "src/Hero.tsx",
      lines_affected: [42],
      reason: "target",
      change_type: "target",
      change_source: "visual",
    },
    {
      path: "src/theme.css",
      lines_affected: [12],
      reason: "token",
      change_type: "design_token",
      change_source: "visual",
    },
  ],
  visual_changes_applied: true,
  text_instructions_applied: false,
  side_effects: [],
  confidence: "high",
  recommended_action: "apply",
};

describe("verification — diff audit", () => {
  it("pass_exact when diff matches plan exactly", () => {
    const result = auditDiff({
      plan,
      modifiedFiles: ["src/Hero.tsx", "src/theme.css"],
    });
    expect(result.status).toBe("pass_exact");
    expect(result.extras).toHaveLength(0);
    expect(result.missing).toHaveLength(0);
  });

  it("pass_subset when extras are non-sensitive", () => {
    const result = auditDiff({
      plan,
      modifiedFiles: ["src/Hero.tsx", "src/theme.css", "src/utils.ts"],
    });
    expect(result.status).toBe("pass_subset");
    expect(result.extras).toContain("src/utils.ts");
  });

  it("warn_extras when extras include sensitive files", () => {
    const result = auditDiff({
      plan,
      modifiedFiles: ["src/Hero.tsx", "src/theme.css", "package.json"],
    });
    expect(result.status).toBe("warn_extras");
    expect(result.sensitiveExtras).toContain("package.json");
  });

  it("fails when planned files are missing from diff", () => {
    const result = auditDiff({
      plan,
      modifiedFiles: ["src/Hero.tsx"],
    });
    expect(result.status).toBe("fail");
    expect(result.missing).toContain("src/theme.css");
  });

  it("normalizes Windows path separators", () => {
    const result = auditDiff({
      plan,
      modifiedFiles: ["src\\Hero.tsx", "src\\theme.css"],
    });
    expect(result.status).toBe("pass_exact");
  });
});
