import { describe, it, expect, vi } from "vitest";
import { Orchestrator } from "../../ai-bridge/orchestrator.js";
import type {
  AIAdapter,
  AdapterContext,
} from "../../src/lib/ai-adapters/types.js";
import type { EnrichedSnapshot } from "../../src/types/snapshot.js";
import type { EditPlan } from "../../src/types/edit-plan.js";
import type { ExecuteResult } from "../../src/types/execute.js";

const snapshot: EnrichedSnapshot = {
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

const planHigh: EditPlan = {
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

const ctx: AdapterContext = {
  projectRoot: "/project",
  sessionToken: "token",
};

class FakeAdapter implements AIAdapter {
  readonly name = "fake";
  readonly type = "cli" as const;

  constructor(
    private readonly planResult: EditPlan = planHigh,
    private readonly shouldFailExecute = false
  ) {}

  async detect(): Promise<boolean> {
    return true;
  }
  async plan(): Promise<EditPlan> {
    return this.planResult;
  }
  async execute(): Promise<ExecuteResult> {
    if (this.shouldFailExecute) throw new Error("execute boom");
    return {
      files_modified: ["Hero.tsx"],
      files_extra: [],
      duration_ms: 100,
      model: "fake",
      token_usage: { input_total: 100, output_total: 50 },
    };
  }
  async isRunning(): Promise<boolean> {
    return false;
  }
}

describe("Orchestrator", () => {
  it("plans, awaits approval, executes", async () => {
    const orchestrator = new Orchestrator(new FakeAdapter());
    const onApproval = vi.fn((req: { approve: () => void }) => req.approve());

    const result = await orchestrator.run({
      snapshot,
      context: ctx,
      events: { onApprovalNeeded: onApproval },
    });

    expect(result.phase).toBe("completed");
    expect(onApproval).toHaveBeenCalledTimes(1);
    expect(result.plan?.summary).toBe("test");
    expect(result.executeResult?.files_modified).toEqual(["Hero.tsx"]);
  });

  it("cancels when user rejects", async () => {
    const orchestrator = new Orchestrator(new FakeAdapter());
    const result = await orchestrator.run({
      snapshot,
      context: ctx,
      events: {
        onApprovalNeeded: (req): void => req.reject(),
      },
    });
    expect(result.phase).toBe("cancelled");
    expect(result.executeResult).toBeUndefined();
  });

  it("skips approval in express mode for high-confidence + no side effects", async () => {
    const orchestrator = new Orchestrator(new FakeAdapter());
    const onApproval = vi.fn();
    const result = await orchestrator.run({
      snapshot,
      context: ctx,
      expressMode: true,
      events: { onApprovalNeeded: onApproval },
    });
    expect(onApproval).not.toHaveBeenCalled();
    expect(result.phase).toBe("completed");
  });

  it("does NOT skip approval if side_effects present", async () => {
    const planWithSideEffects: EditPlan = {
      ...planHigh,
      side_effects: ["3 other buttons will change"],
    };
    const orchestrator = new Orchestrator(
      new FakeAdapter(planWithSideEffects)
    );
    const onApproval = vi.fn((req: { approve: () => void }) => req.approve());
    await orchestrator.run({
      snapshot,
      context: ctx,
      expressMode: true,
      events: { onApprovalNeeded: onApproval },
    });
    expect(onApproval).toHaveBeenCalled();
  });

  it("does NOT skip approval if confidence is low", async () => {
    const planLow: EditPlan = {
      ...planHigh,
      confidence: "low",
      recommended_action: "consider_alternatives",
      alternatives: [
        {
          description: "Edit the design token instead",
          pros: ["consistent across all buttons"],
          cons: ["affects 3 other buttons"],
        },
      ],
    };
    const orchestrator = new Orchestrator(new FakeAdapter(planLow));
    const onApproval = vi.fn((req: { approve: () => void }) => req.approve());
    await orchestrator.run({
      snapshot,
      context: ctx,
      expressMode: true,
      events: { onApprovalNeeded: onApproval },
    });
    expect(onApproval).toHaveBeenCalled();
  });

  it("calls verifier after execute when provided", async () => {
    const orchestrator = new Orchestrator(new FakeAdapter());
    const verifier = vi.fn().mockResolvedValue({
      visual_check: "pass" as const,
      scope_check: "pass" as const,
      diff_check: "pass_exact" as const,
      correction_attempts: 0,
    });
    const result = await orchestrator.run({
      snapshot,
      context: ctx,
      verifier,
      events: {
        onApprovalNeeded: (req): void => req.approve(),
      },
    });
    expect(verifier).toHaveBeenCalled();
    expect(result.verification?.visual_check).toBe("pass");
  });

  it("transitions to failed phase when execute throws", async () => {
    const orchestrator = new Orchestrator(new FakeAdapter(planHigh, true));
    const onError = vi.fn();
    const result = await orchestrator.run({
      snapshot,
      context: ctx,
      events: {
        onApprovalNeeded: (req): void => req.approve(),
        onError,
      },
    });
    expect(result.phase).toBe("failed");
    expect(onError).toHaveBeenCalled();
  });
});
