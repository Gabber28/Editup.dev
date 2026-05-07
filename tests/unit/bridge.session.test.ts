import { describe, it, expect, vi } from "vitest";
import { runPlan } from "@bridge/plan.js";
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

describe("bridge.session — plan is always a fresh session", () => {
  const snapshot = makeSnapshot();
  const context = makeContext();

  it("each plan call invokes adapter.plan independently", async () => {
    const adapter = new MockAdapter();

    await runPlan(adapter, snapshot, context);
    await runPlan(adapter, snapshot, context);

    expect(adapter.plan).toHaveBeenCalledTimes(2);

    const calls = (adapter.plan as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0]).toEqual([snapshot, context]);
    expect(calls[1]).toEqual([snapshot, context]);
  });

  it("plan does not carry state between invocations", async () => {
    const plan1 = makePlan({ summary: "first" });
    const plan2 = makePlan({ summary: "second" });
    const adapter = new MockAdapter();

    (adapter.plan as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(plan1)
      .mockResolvedValueOnce(plan2);

    const result1 = await runPlan(adapter, snapshot, context);
    const result2 = await runPlan(adapter, snapshot, context);

    expect(result1.summary).toBe("first");
    expect(result2.summary).toBe("second");
  });

  it("context.sessionToken is passed to adapter on each call", async () => {
    const ctx1 = makeContext({ sessionToken: "token-aaa" });
    const ctx2 = makeContext({ sessionToken: "token-bbb" });
    const adapter = new MockAdapter();

    await runPlan(adapter, snapshot, ctx1);
    await runPlan(adapter, snapshot, ctx2);

    const calls = (adapter.plan as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][1].sessionToken).toBe("token-aaa");
    expect(calls[1][1].sessionToken).toBe("token-bbb");
  });

  it("a failed plan does not poison subsequent calls", async () => {
    const goodPlan = makePlan();
    const adapter = new MockAdapter();

    (adapter.plan as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"));

    await expect(runPlan(adapter, snapshot, context)).rejects.toThrow();

    (adapter.plan as ReturnType<typeof vi.fn>).mockResolvedValue(
      goodPlan
    );

    const result = await runPlan(adapter, snapshot, context);
    expect(result.summary).toBe(goodPlan.summary);
  });
});
