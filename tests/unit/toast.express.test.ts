import { describe, it, expect, vi, beforeEach } from "vitest";
import { Orchestrator } from "@bridge/orchestrator.js";
import { makePlan } from "../helpers/fixtures.js";
import type { EditPlan } from "@/types/edit-plan.js";
import type {
  AIAdapter,
  AdapterContext,
} from "@/lib/ai-adapters/types.js";
import type { EnrichedSnapshot } from "@/types/snapshot.js";
import { makeSnapshot, makeContext } from "../helpers/fixtures.js";

vi.mock("@bridge/plan.js", () => ({
  runPlan: vi.fn(),
}));

vi.mock("@bridge/execute.js", () => ({
  runExecute: vi.fn(),
}));

vi.mock("@/lib/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

function stubAdapter(planResult: EditPlan): AIAdapter {
  return {
    name: "test-adapter",
    type: "cli",
    detect: vi.fn().mockResolvedValue(true),
    plan: vi.fn().mockResolvedValue(planResult),
    execute: vi.fn().mockResolvedValue({
      files_modified: [],
      files_extra: [],
      duration_ms: 100,
      model: "test",
      token_usage: { input_total: 0, output_total: 0 },
    }),
    isRunning: vi.fn().mockResolvedValue(false),
  };
}

describe("Orchestrator — express mode", () => {
  let snapshot: EnrichedSnapshot;
  let context: AdapterContext;

  beforeEach(() => {
    vi.clearAllMocks();
    snapshot = makeSnapshot();
    context = makeContext();
  });

  beforeEach(async () => {
    const { runPlan } = await import("@bridge/plan.js");
    const { runExecute } = await import("@bridge/execute.js");
    (runPlan as ReturnType<typeof vi.fn>).mockImplementation(
      (_a: AIAdapter, _s: EnrichedSnapshot, _c: AdapterContext) =>
        Promise.resolve(makePlan()),
    );
    (runExecute as ReturnType<typeof vi.fn>).mockResolvedValue({
      files_modified: ["src/Button.tsx"],
      files_extra: [],
      duration_ms: 500,
      model: "claude-sonnet-4-6",
      token_usage: { input_total: 100, output_total: 50 },
    });
  });

  it("skips approval for high confidence + no side effects", async () => {
    const highPlan = makePlan({
      confidence: "high",
      side_effects: [],
    });
    const { runPlan } = await import("@bridge/plan.js");
    (runPlan as ReturnType<typeof vi.fn>).mockResolvedValue(highPlan);

    const adapter = stubAdapter(highPlan);
    const orch = new Orchestrator(adapter);
    const onApproval = vi.fn();

    const result = await orch.run({
      snapshot,
      context,
      expressMode: true,
      events: { onApprovalNeeded: onApproval },
    });

    expect(onApproval).not.toHaveBeenCalled();
    expect(result.phase).toBe("completed");
  });

  it("does NOT skip approval when side effects present", async () => {
    const plan = makePlan({
      confidence: "high",
      side_effects: ["Affects navbar"],
    });
    const { runPlan } = await import("@bridge/plan.js");
    (runPlan as ReturnType<typeof vi.fn>).mockResolvedValue(plan);

    const adapter = stubAdapter(plan);
    const orch = new Orchestrator(adapter);
    const onApproval = vi.fn(
      (req: { approve: () => void }) => req.approve(),
    );

    await orch.run({
      snapshot,
      context,
      expressMode: true,
      events: { onApprovalNeeded: onApproval },
    });

    expect(onApproval).toHaveBeenCalledOnce();
  });

  it("does NOT skip approval when confidence is low", async () => {
    const plan = makePlan({
      confidence: "low",
      side_effects: [],
    });
    const { runPlan } = await import("@bridge/plan.js");
    (runPlan as ReturnType<typeof vi.fn>).mockResolvedValue(plan);

    const adapter = stubAdapter(plan);
    const orch = new Orchestrator(adapter);
    const onApproval = vi.fn(
      (req: { approve: () => void }) => req.approve(),
    );

    await orch.run({
      snapshot,
      context,
      expressMode: true,
      events: { onApprovalNeeded: onApproval },
    });

    expect(onApproval).toHaveBeenCalledOnce();
  });

  it("does NOT skip approval when confidence is medium", async () => {
    const plan = makePlan({
      confidence: "medium",
      side_effects: [],
    });
    const { runPlan } = await import("@bridge/plan.js");
    (runPlan as ReturnType<typeof vi.fn>).mockResolvedValue(plan);

    const adapter = stubAdapter(plan);
    const orch = new Orchestrator(adapter);
    const onApproval = vi.fn(
      (req: { approve: () => void }) => req.approve(),
    );

    await orch.run({
      snapshot,
      context,
      expressMode: true,
      events: { onApprovalNeeded: onApproval },
    });

    expect(onApproval).toHaveBeenCalledOnce();
  });

  it("requires approval when expressMode is false even with high confidence", async () => {
    const plan = makePlan({
      confidence: "high",
      side_effects: [],
    });
    const { runPlan } = await import("@bridge/plan.js");
    (runPlan as ReturnType<typeof vi.fn>).mockResolvedValue(plan);

    const adapter = stubAdapter(plan);
    const orch = new Orchestrator(adapter);
    const onApproval = vi.fn(
      (req: { approve: () => void }) => req.approve(),
    );

    await orch.run({
      snapshot,
      context,
      expressMode: false,
      events: { onApprovalNeeded: onApproval },
    });

    expect(onApproval).toHaveBeenCalledOnce();
  });
});
