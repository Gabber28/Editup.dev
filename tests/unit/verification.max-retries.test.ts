import { describe, it, expect, vi } from "vitest";
import { runCorrectionPass } from "@verify/correction.js";
import type { VisualCheckResult } from "@verify/visual.js";
import { MockAdapter } from "../helpers/mock-adapter.js";
import { makeSnapshot, makePlan, makeContext } from "../helpers/fixtures.js";

vi.mock("@/lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const failingVisual: VisualCheckResult = {
  status: "fail",
  divergences: [{ property: "color", expected: "red", actual: "blue", reason: "mismatch" }],
};

describe("verification — max retries enforcement", () => {
  it("stops after 4 failed correction attempts", async () => {
    const recheck = vi.fn<() => Promise<VisualCheckResult>>()
      .mockResolvedValue(failingVisual);

    const result = await runCorrectionPass({
      adapter: new MockAdapter(),
      plan: makePlan(),
      snapshot: makeSnapshot(),
      context: makeContext(),
      visualResult: failingVisual,
      recheckVisual: recheck,
    });

    expect(result.attempts).toBe(4);
    expect(result.finalVisual.status).toBe("fail");
    expect(recheck).toHaveBeenCalledTimes(4);
  });

  it("does NOT attempt a 5th correction", async () => {
    const executeFn = vi.fn();
    const adapter = new MockAdapter();
    adapter.execute = executeFn.mockResolvedValue({
      files_modified: [], files_extra: [], duration_ms: 50,
      model: "mock", token_usage: { input_total: 0, output_total: 0 },
    });

    const recheck = vi.fn<() => Promise<VisualCheckResult>>()
      .mockResolvedValue(failingVisual);

    await runCorrectionPass({
      adapter,
      plan: makePlan(),
      snapshot: makeSnapshot(),
      context: makeContext(),
      visualResult: failingVisual,
      recheckVisual: recheck,
    });

    expect(executeFn).toHaveBeenCalledTimes(4);
  });
});
