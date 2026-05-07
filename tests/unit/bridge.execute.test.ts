import { describe, it, expect, vi } from "vitest";
import { runExecute } from "@bridge/execute.js";
import { ExecuteFailedError } from "@/lib/errors.js";
import { MockAdapter } from "../helpers/mock-adapter.js";
import {
  makeSnapshot,
  makeContext,
  makePlan,
  makeExecuteResult,
} from "../helpers/fixtures.js";

vi.mock("@/lib/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("runExecute", () => {
  const snapshot = makeSnapshot();
  const context = makeContext();
  const plan = makePlan();

  it("calls adapter.execute() with plan, snapshot, context", async () => {
    const adapter = new MockAdapter();
    await runExecute(adapter, plan, snapshot, context);

    expect(adapter.execute).toHaveBeenCalledTimes(1);
    expect(adapter.execute).toHaveBeenCalledWith(
      plan,
      snapshot,
      context
    );
  });

  it("returns ExecuteResult on success", async () => {
    const execResult = makeExecuteResult({
      files_modified: ["src/A.tsx", "src/B.tsx"],
      duration_ms: 800,
    });
    const adapter = new MockAdapter({ executeResult: execResult });

    const result = await runExecute(adapter, plan, snapshot, context);

    expect(result.files_modified).toEqual(["src/A.tsx", "src/B.tsx"]);
    expect(result.duration_ms).toBe(800);
    expect(result.files_extra).toEqual([]);
  });

  it("wraps adapter errors in ExecuteFailedError", async () => {
    const adapter = new MockAdapter({ shouldFailExecute: true });

    try {
      await runExecute(adapter, plan, snapshot, context);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ExecuteFailedError);
      const efe = err as ExecuteFailedError;
      expect(efe.name).toBe("ExecuteFailedError");
      expect(efe.message).toContain("execute failed");
      expect(efe.cause).toBeInstanceOf(Error);
    }
  });

  it("preserves original error as cause", async () => {
    const original = new Error("network timeout");
    const adapter = new MockAdapter();
    (adapter.execute as ReturnType<typeof vi.fn>).mockRejectedValue(
      original
    );

    try {
      await runExecute(adapter, plan, snapshot, context);
      expect.fail("should have thrown");
    } catch (err) {
      const efe = err as ExecuteFailedError;
      expect(efe.cause).toBe(original);
      expect(efe.message).toContain("network timeout");
    }
  });

  it("includes adapter name in error message", async () => {
    const adapter = new MockAdapter({
      name: "my-adapter",
      shouldFailExecute: true,
    });

    await expect(
      runExecute(adapter, plan, snapshot, context)
    ).rejects.toThrow(/my-adapter/);
  });
});
