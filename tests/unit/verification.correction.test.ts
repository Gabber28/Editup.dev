import { describe, it, expect, vi } from "vitest";
import { runCorrectionPass } from "@verify/correction.js";
import type { CorrectionInput } from "@verify/correction.js";
import type { VisualCheckResult } from "@verify/visual.js";
import { MockAdapter } from "../helpers/mock-adapter.js";
import { makeSnapshot, makePlan, makeContext } from "../helpers/fixtures.js";

vi.mock("@/lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const passingVisual: VisualCheckResult = { status: "pass", divergences: [] };
const failingVisual: VisualCheckResult = {
  status: "fail",
  divergences: [{ property: "color", expected: "red", actual: "blue", reason: "mismatch" }],
};

function makeInput(overrides: Partial<CorrectionInput> = {}): CorrectionInput {
  return {
    adapter: new MockAdapter(),
    plan: makePlan(),
    snapshot: makeSnapshot(),
    context: makeContext(),
    visualResult: failingVisual,
    recheckVisual: vi.fn<() => Promise<VisualCheckResult>>().mockResolvedValue(passingVisual),
    ...overrides,
  };
}

describe("verification — correction pass", () => {
  it("corrects on first attempt when recheck passes", async () => {
    const input = makeInput();
    const result = await runCorrectionPass(input);
    expect(result.attempts).toBe(1);
    expect(result.finalVisual.status).toBe("pass");
    expect(result.executeResults).toHaveLength(1);
  });

  it("attempts twice when first recheck still fails", async () => {
    const recheck = vi.fn<() => Promise<VisualCheckResult>>()
      .mockResolvedValueOnce(failingVisual)
      .mockResolvedValueOnce(passingVisual);
    const input = makeInput({ recheckVisual: recheck });
    const result = await runCorrectionPass(input);
    expect(result.attempts).toBe(2);
    expect(result.finalVisual.status).toBe("pass");
  });

  it("skips correction when initial visual already passes", async () => {
    const input = makeInput({ visualResult: passingVisual });
    const result = await runCorrectionPass(input);
    expect(result.attempts).toBe(0);
    expect(result.executeResults).toHaveLength(0);
  });

  it("stops on execute error", async () => {
    const adapter = new MockAdapter({ shouldFailExecute: true });
    const recheck = vi.fn<() => Promise<VisualCheckResult>>();
    const input = makeInput({ adapter, recheckVisual: recheck });
    const result = await runCorrectionPass(input);
    expect(result.attempts).toBe(1);
    expect(recheck).not.toHaveBeenCalled();
  });
});
