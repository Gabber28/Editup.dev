import { describe, it, expect } from "vitest";
import { auditDiff } from "@verify/diff-audit.js";
import { makePlan, makePlanFile } from "../helpers/fixtures.js";

describe("verification — diff extras and sensitive files", () => {
  it("exact match produces pass_exact", () => {
    const plan = makePlan({ files: [makePlanFile({ path: "src/App.tsx" })] });
    const result = auditDiff({ plan, modifiedFiles: ["src/App.tsx"] });
    expect(result.status).toBe("pass_exact");
    expect(result.extras).toHaveLength(0);
    expect(result.missing).toHaveLength(0);
  });

  it("subset of planned files produces pass_subset", () => {
    const plan = makePlan({
      files: [
        makePlanFile({ path: "src/A.tsx" }),
        makePlanFile({ path: "src/B.tsx" }),
      ],
    });
    const result = auditDiff({
      plan,
      modifiedFiles: ["src/A.tsx", "src/B.tsx", "src/utils.ts"],
    });
    expect(result.status).toBe("pass_subset");
    expect(result.extras).toContain("src/utils.ts");
  });

  it("extra sensitive files produce warn_extras", () => {
    const plan = makePlan({ files: [makePlanFile({ path: "src/App.tsx" })] });
    const result = auditDiff({
      plan,
      modifiedFiles: ["src/App.tsx", ".env"],
    });
    expect(result.status).toBe("warn_extras");
    expect(result.sensitiveExtras).toContain(".env");
  });

  it("missing planned file produces fail", () => {
    const plan = makePlan({
      files: [
        makePlanFile({ path: "src/A.tsx" }),
        makePlanFile({ path: "src/B.tsx" }),
      ],
    });
    const result = auditDiff({ plan, modifiedFiles: ["src/A.tsx"] });
    expect(result.status).toBe("fail");
    expect(result.missing).toContain("src/B.tsx");
  });

  it("package.json flagged as sensitive", () => {
    const plan = makePlan({ files: [makePlanFile({ path: "src/X.tsx" })] });
    const result = auditDiff({
      plan,
      modifiedFiles: ["src/X.tsx", "package.json"],
    });
    expect(result.sensitiveExtras).toContain("package.json");
  });

  it("tsconfig.json flagged as sensitive", () => {
    const plan = makePlan({ files: [makePlanFile({ path: "src/X.tsx" })] });
    const result = auditDiff({
      plan,
      modifiedFiles: ["src/X.tsx", "tsconfig.json"],
    });
    expect(result.sensitiveExtras).toContain("tsconfig.json");
  });

  it("normalizes path separators", () => {
    const plan = makePlan({
      files: [makePlanFile({ path: "src\\components\\Button.tsx" })],
    });
    const result = auditDiff({
      plan,
      modifiedFiles: ["src/components/Button.tsx"],
    });
    expect(result.status).toBe("pass_exact");
  });
});
