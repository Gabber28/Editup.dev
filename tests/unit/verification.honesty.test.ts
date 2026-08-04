import { describe, it, expect } from "vitest";
import { summarizeVerification } from "@verify/correction.js";
import { auditDiff } from "@verify/diff-audit.js";
import { hasVerificationWarnings } from "@/types/execute.js";
import { makePlan } from "../helpers/fixtures.js";
import type { VisualCheckResult } from "@verify/visual.js";

const passing: VisualCheckResult = { status: "pass", checked: 3, divergences: [] };
const failing: VisualCheckResult = {
  status: "fail",
  checked: 2,
  divergences: [
    { property: "top", expected: "24px", actual: "0px", reason: "px diff 24", element: "div.card" },
  ],
};

describe("summarizeVerification — absence of proof is not a pass", () => {
  it("reports unverified when the page was never observed", () => {
    const v = summarizeVerification(null, "skipped", "pass_exact", 0);
    expect(v.visual_check).toBe("unverified");
    expect(hasVerificationWarnings(v)).toBe(true);
  });

  it("keeps skipped distinct from unverified", () => {
    const v = summarizeVerification(
      { status: "pass", checked: 0, divergences: [] },
      "skipped",
      "pass_exact",
      0,
    );
    expect(v.visual_check).toBe("skipped");
  });

  it("carries the diverging element and values into the result", () => {
    const v = summarizeVerification(failing, "skipped", "pass_exact", 4);
    expect(v.visual_check).toBe("fail");
    expect(v.divergences).toEqual([
      { element: "div.card", property: "top", expected: "24px", actual: "0px" },
    ]);
    expect(v.correction_attempts).toBe(4);
    expect(hasVerificationWarnings(v)).toBe(true);
  });

  it("a fully verified run carries no warning", () => {
    const v = summarizeVerification(passing, "pass", "pass_exact", 0);
    expect(hasVerificationWarnings(v)).toBe(false);
  });

  it("no_git counts as a warning, since nothing witnessed the files", () => {
    const v = summarizeVerification(passing, "pass", "no_git", 0);
    expect(v.diff_check).toBe("no_git");
    expect(hasVerificationWarnings(v)).toBe(false);
  });
});

describe("auditDiff — a folder without git cannot earn a pass", () => {
  it("returns no_git instead of pass_exact when git is unavailable", () => {
    const plan = makePlan();
    const result = auditDiff({
      plan,
      modifiedFiles: plan.files.map((f) => f.path),
      gitAvailable: false,
    });
    expect(result.status).toBe("no_git");
  });

  it("still fails loudly when a planned file was never touched", () => {
    const result = auditDiff({ plan: makePlan(), modifiedFiles: [], gitAvailable: false });
    expect(result.status).toBe("fail");
    expect(result.missing).toEqual(["src/components/Button.tsx"]);
  });

  it("keeps pass_exact when git did witness the change", () => {
    const plan = makePlan();
    const result = auditDiff({
      plan,
      modifiedFiles: plan.files.map((f) => f.path),
      gitAvailable: true,
    });
    expect(result.status).toBe("pass_exact");
  });
});
