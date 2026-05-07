import { describe, it, expect, vi } from "vitest";
import { runPlan } from "@bridge/plan.js";
import { PlanFailedError } from "@/lib/errors.js";
import { MockAdapter } from "../helpers/mock-adapter.js";
import { makeSnapshot, makeContext, makePlan } from "../helpers/fixtures.js";

vi.mock("@/lib/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("runPlan", () => {
  const snapshot = makeSnapshot();
  const context = makeContext();

  it("calls adapter.plan() with snapshot and context", async () => {
    const adapter = new MockAdapter();
    await runPlan(adapter, snapshot, context);

    expect(adapter.plan).toHaveBeenCalledTimes(1);
    expect(adapter.plan).toHaveBeenCalledWith(snapshot, context);
  });

  it("returns a validated EditPlan on success", async () => {
    const plan = makePlan({ summary: "change color" });
    const adapter = new MockAdapter({ planResult: plan });

    const result = await runPlan(adapter, snapshot, context);

    expect(result.summary).toBe("change color");
    expect(result.files).toHaveLength(1);
    expect(result.confidence).toBe("high");
  });

  it("retries on adapter failure, up to MAX_PLAN_ATTEMPTS (2)", async () => {
    const adapter = new MockAdapter({ shouldFailPlan: true });

    await expect(runPlan(adapter, snapshot, context)).rejects.toThrow(
      PlanFailedError
    );
    expect(adapter.plan).toHaveBeenCalledTimes(2);
  });

  it("retries when plan returns invalid schema", async () => {
    const invalidPlan = { summary: "" } as never;
    const validPlan = makePlan();
    const adapter = new MockAdapter({ planResult: validPlan });

    (adapter.plan as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(invalidPlan)
      .mockResolvedValueOnce(validPlan);

    const result = await runPlan(adapter, snapshot, context);
    expect(adapter.plan).toHaveBeenCalledTimes(2);
    expect(result.summary).toBe(validPlan.summary);
  });

  it("throws PlanFailedError after exhausting retries", async () => {
    const adapter = new MockAdapter({ shouldFailPlan: true });

    try {
      await runPlan(adapter, snapshot, context);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PlanFailedError);
      const pfe = err as PlanFailedError;
      expect(pfe.attempts).toBe(2);
      expect(pfe.message).toContain("2 attempts");
    }
  });

  it("succeeds on second attempt after first fails", async () => {
    const plan = makePlan();
    const adapter = new MockAdapter({ planResult: plan });

    (adapter.plan as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce(plan);

    const result = await runPlan(adapter, snapshot, context);
    expect(adapter.plan).toHaveBeenCalledTimes(2);
    expect(result.summary).toBe(plan.summary);
  });
});
