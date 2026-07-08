import { describe, it, expect, vi } from "vitest";
import { runPlan } from "@bridge/plan.js";
import { MockAdapter } from "../helpers/mock-adapter.js";
import { makeSnapshot, makeContext, makePlan } from "../helpers/fixtures.js";
import type { AdapterContext } from "@/lib/ai-adapters/types.js";

vi.mock("@/lib/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("runPlan — retry hint after schema failure", () => {
  it("passes a retryHint naming the invalid fields on the second attempt", async () => {
    const invalidPlan = { summary: "x", files: [] } as never;
    const validPlan = makePlan();
    const adapter = new MockAdapter({ planResult: validPlan });
    (adapter.plan as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(invalidPlan)
      .mockResolvedValueOnce(validPlan);

    await runPlan(adapter, makeSnapshot(), makeContext());

    const secondCall = (adapter.plan as ReturnType<typeof vi.fn>).mock.calls[1];
    const contextArg = secondCall?.[1] as AdapterContext;
    expect(contextArg.retryHint).toBeDefined();
    expect(contextArg.retryHint).toContain("files");
  });

  it("does not set retryHint on the first attempt", async () => {
    const adapter = new MockAdapter({ planResult: makePlan() });

    await runPlan(adapter, makeSnapshot(), makeContext());

    const firstCall = (adapter.plan as ReturnType<typeof vi.fn>).mock.calls[0];
    const contextArg = firstCall?.[1] as AdapterContext;
    expect(contextArg.retryHint).toBeUndefined();
  });
});
