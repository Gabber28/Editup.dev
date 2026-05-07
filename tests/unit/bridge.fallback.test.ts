import { describe, it, expect, vi } from "vitest";
import { runPlan } from "@bridge/plan.js";
import { PlanFailedError } from "@/lib/errors.js";
import { MockAdapter } from "../helpers/mock-adapter.js";
import { makeSnapshot, makeContext } from "../helpers/fixtures.js";

vi.mock("@/lib/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("bridge.fallback — plan failure escalation", () => {
  const snapshot = makeSnapshot();
  const context = makeContext();

  it("throws PlanFailedError after 2 consecutive failures", async () => {
    const adapter = new MockAdapter({ shouldFailPlan: true });

    await expect(runPlan(adapter, snapshot, context)).rejects.toThrow(
      PlanFailedError
    );
    expect(adapter.plan).toHaveBeenCalledTimes(2);
  });

  it("PlanFailedError.attempts equals MAX_PLAN_ATTEMPTS (2)", async () => {
    const adapter = new MockAdapter({ shouldFailPlan: true });

    try {
      await runPlan(adapter, snapshot, context);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PlanFailedError);
      expect((err as PlanFailedError).attempts).toBe(2);
    }
  });

  it("PlanFailedError message mentions attempt count", async () => {
    const adapter = new MockAdapter({ shouldFailPlan: true });

    await expect(runPlan(adapter, snapshot, context)).rejects.toThrow(
      /2 attempts/
    );
  });

  it("PlanFailedError preserves the last error as cause", async () => {
    const adapter = new MockAdapter();
    const error1 = new Error("first failure");
    const error2 = new Error("second failure");

    (adapter.plan as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(error1)
      .mockRejectedValueOnce(error2);

    try {
      await runPlan(adapter, snapshot, context);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PlanFailedError);
      expect((err as PlanFailedError).cause).toBe(error2);
    }
  });

  it("does NOT throw if second attempt succeeds", async () => {
    const adapter = new MockAdapter();
    const validPlan = {
      summary: "fix it",
      files: [
        {
          path: "src/A.tsx",
          lines_affected: [1],
          reason: "fix",
          change_type: "target" as const,
          change_source: "visual" as const,
        },
      ],
      visual_changes_applied: true,
      text_instructions_applied: false,
      side_effects: [],
      confidence: "high" as const,
      recommended_action: "apply" as const,
    };

    (adapter.plan as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce(validPlan);

    const result = await runPlan(adapter, snapshot, context);
    expect(result.summary).toBe("fix it");
  });

  it("schema validation failures also count toward attempts", async () => {
    const invalidPlan = { bad: true };
    const adapter = new MockAdapter();

    (adapter.plan as ReturnType<typeof vi.fn>)
      .mockResolvedValue(invalidPlan);

    try {
      await runPlan(adapter, snapshot, context);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PlanFailedError);
      expect((err as PlanFailedError).attempts).toBe(2);
      expect(adapter.plan).toHaveBeenCalledTimes(2);
    }
  });
});
