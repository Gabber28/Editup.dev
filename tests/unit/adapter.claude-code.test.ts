import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSnapshot, makePlan, makeContext } from "../helpers/fixtures.js";

const { spawnSafeMock, detectCliViaTauriMock } = vi.hoisted(() => ({
  spawnSafeMock: vi.fn(),
  detectCliViaTauriMock: vi.fn(),
}));

vi.mock("@/lib/ai-adapters/spawn-safe.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai-adapters/spawn-safe.js")>();
  return { ...actual, spawnSafe: spawnSafeMock };
});

vi.mock("@/lib/ai-adapters/spawn-tauri.js", () => ({
  detectCliViaTauri: detectCliViaTauriMock,
  spawnViaTauri: vi.fn(),
}));

vi.mock("@/lib/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { ClaudeCodeAdapter } from "@/lib/ai-adapters/claude-code.js";
import { PlanFailedError, ExecuteFailedError } from "@/lib/errors.js";

const VALID_PLAN_RESPONSE = JSON.stringify({
  result: JSON.stringify(makePlan()),
});

const VALID_PLAN_WITH_USAGE = JSON.stringify({
  result: JSON.stringify(makePlan()),
  usage: { input_tokens: 1000, output_tokens: 350 },
});

const CONTENT_ARRAY_RESPONSE = JSON.stringify({
  content: [{ text: JSON.stringify(makePlan()) }],
  usage: { input_tokens: 500, output_tokens: 200 },
});

/** A stream-json run that really edited the planned file. */
const EXECUTE_STREAM = [
  JSON.stringify({
    type: "assistant",
    message: {
      content: [
        {
          type: "tool_use",
          id: "t1",
          name: "Edit",
          input: { file_path: "/home/user/project/src/components/Button.tsx" },
        },
      ],
    },
  }),
  JSON.stringify({
    type: "user",
    message: { content: [{ type: "tool_result", tool_use_id: "t1", is_error: false }] },
  }),
  JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    result: "edited the button",
    usage: { input_tokens: 1000, output_tokens: 350 },
  }),
].join("\n");

/** A run that talked but never used an edit tool. */
const EXECUTE_STREAM_NO_EDITS = JSON.stringify({
  type: "result",
  subtype: "success",
  is_error: false,
  result: "I could not find the file",
  usage: { input_tokens: 10, output_tokens: 5 },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ClaudeCodeAdapter.plan()", () => {
  it("builds args with correct model and plan allowedTools", async () => {
    spawnSafeMock.mockResolvedValue({
      exitCode: 0, stdout: VALID_PLAN_RESPONSE, stderr: "", durationMs: 500,
    });
    const adapter = new ClaudeCodeAdapter();
    const ctx = makeContext({ model: "claude-sonnet-4-6" });
    await adapter.plan(makeSnapshot(), ctx);

    const call = spawnSafeMock.mock.calls[0][0];
    expect(call.cmd).toBe("claude");
    expect(call.args).toContain("--allowedTools");

    const toolsIdx = call.args.indexOf("--allowedTools");
    expect(call.args[toolsIdx + 1]).toBe("Read,Glob,Grep");
  });

  it("plan allowedTools does NOT include Edit", async () => {
    spawnSafeMock.mockResolvedValue({
      exitCode: 0, stdout: VALID_PLAN_RESPONSE, stderr: "", durationMs: 500,
    });
    const adapter = new ClaudeCodeAdapter();
    await adapter.plan(makeSnapshot(), makeContext());

    const args: string[] = spawnSafeMock.mock.calls[0][0].args;
    const toolsIdx = args.indexOf("--allowedTools");
    const tools = args[toolsIdx + 1]!;
    expect(tools).not.toContain("Edit");
  });

  it("includes --output-format json", async () => {
    spawnSafeMock.mockResolvedValue({
      exitCode: 0, stdout: VALID_PLAN_RESPONSE, stderr: "", durationMs: 500,
    });
    const adapter = new ClaudeCodeAdapter();
    await adapter.plan(makeSnapshot(), makeContext());

    const args: string[] = spawnSafeMock.mock.calls[0][0].args;
    const fmtIdx = args.indexOf("--output-format");
    expect(fmtIdx).toBeGreaterThan(-1);
    expect(args[fmtIdx + 1]).toBe("json");
  });

  it("uses default model when context.model is undefined", async () => {
    spawnSafeMock.mockResolvedValue({
      exitCode: 0, stdout: VALID_PLAN_RESPONSE, stderr: "", durationMs: 500,
    });
    const adapter = new ClaudeCodeAdapter();
    await adapter.plan(makeSnapshot(), makeContext({ model: undefined }));

    const args: string[] = spawnSafeMock.mock.calls[0][0].args;
    const modelIdx = args.indexOf("--model");
    expect(args[modelIdx + 1]).toBe("claude-sonnet-4-6");
  });

  it("throws PlanFailedError on non-zero exit code", async () => {
    spawnSafeMock.mockResolvedValue({
      exitCode: 1, stdout: "", stderr: "error", durationMs: 200,
    });
    const adapter = new ClaudeCodeAdapter();
    await expect(
      adapter.plan(makeSnapshot(), makeContext())
    ).rejects.toThrow(PlanFailedError);
  });

  it("parses JSON from content array response", async () => {
    spawnSafeMock.mockResolvedValue({
      exitCode: 0, stdout: CONTENT_ARRAY_RESPONSE, stderr: "", durationMs: 500,
    });
    const adapter = new ClaudeCodeAdapter();
    const plan = await adapter.plan(makeSnapshot(), makeContext());
    expect(plan.summary).toBe("Update button background color");
  });
});

describe("ClaudeCodeAdapter.execute()", () => {
  it("builds args with Edit in allowedTools", async () => {
    spawnSafeMock.mockResolvedValue({
      exitCode: 0, stdout: EXECUTE_STREAM, stderr: "", durationMs: 800,
    });
    const adapter = new ClaudeCodeAdapter();
    const plan = makePlan();
    await adapter.execute(plan, makeSnapshot(), makeContext());

    const args: string[] = spawnSafeMock.mock.calls[0][0].args;
    const toolsIdx = args.indexOf("--allowedTools");
    expect(args[toolsIdx + 1]).toBe("Read,Glob,Grep,Edit");
  });

  it("includes --max-turns 15 for execute", async () => {
    spawnSafeMock.mockResolvedValue({
      exitCode: 0, stdout: EXECUTE_STREAM, stderr: "", durationMs: 800,
    });
    const adapter = new ClaudeCodeAdapter();
    await adapter.execute(makePlan(), makeSnapshot(), makeContext());

    const args: string[] = spawnSafeMock.mock.calls[0][0].args;
    const turnsIdx = args.indexOf("--max-turns");
    expect(args[turnsIdx + 1]).toBe("15");
  });

  it("asks for the stream format that carries per-tool evidence", async () => {
    spawnSafeMock.mockResolvedValue({
      exitCode: 0, stdout: EXECUTE_STREAM, stderr: "", durationMs: 800,
    });
    const adapter = new ClaudeCodeAdapter();
    await adapter.execute(makePlan(), makeSnapshot(), makeContext());

    const args: string[] = spawnSafeMock.mock.calls[0][0].args;
    const fmtIdx = args.indexOf("--output-format");
    expect(args[fmtIdx + 1]).toBe("stream-json");
    expect(args).toContain("--verbose");
  });

  it("reports the files the run actually edited, relative to the project root", async () => {
    spawnSafeMock.mockResolvedValue({
      exitCode: 0, stdout: EXECUTE_STREAM, stderr: "", durationMs: 800,
    });
    const adapter = new ClaudeCodeAdapter();
    const result = await adapter.execute(makePlan(), makeSnapshot(), makeContext());
    expect(result.files_modified).toEqual(["src/components/Button.tsx"]);
    expect(result.files_extra).toEqual([]);
  });

  it("flags files edited beyond the plan as extras", async () => {
    const stream = EXECUTE_STREAM.replace(
      "src/components/Button.tsx",
      "src/styles.css",
    );
    spawnSafeMock.mockResolvedValue({
      exitCode: 0, stdout: stream, stderr: "", durationMs: 800,
    });
    const adapter = new ClaudeCodeAdapter();
    const result = await adapter.execute(makePlan(), makeSnapshot(), makeContext());
    expect(result.files_extra).toEqual(["src/styles.css"]);
  });

  it("fails when the run edited nothing, instead of reporting success", async () => {
    spawnSafeMock.mockResolvedValue({
      exitCode: 0, stdout: EXECUTE_STREAM_NO_EDITS, stderr: "", durationMs: 800,
    });
    const adapter = new ClaudeCodeAdapter();
    await expect(
      adapter.execute(makePlan(), makeSnapshot(), makeContext())
    ).rejects.toThrow(/edited no files/);
  });

  it("fails when the edit tool was denied, despite exit code 0", async () => {
    const denied = JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      result: "blocked",
      permission_denials: [{ tool_name: "Edit" }],
    });
    spawnSafeMock.mockResolvedValue({
      exitCode: 0, stdout: denied, stderr: "", durationMs: 800,
    });
    const adapter = new ClaudeCodeAdapter();
    await expect(
      adapter.execute(makePlan(), makeSnapshot(), makeContext())
    ).rejects.toThrow(/denied/);
  });

  it("fails when the CLI itself flags the run as errored", async () => {
    const errored = JSON.stringify({
      type: "result",
      subtype: "error_max_turns",
      is_error: true,
      result: "ran out of turns",
    });
    spawnSafeMock.mockResolvedValue({
      exitCode: 0, stdout: errored, stderr: "", durationMs: 800,
    });
    const adapter = new ClaudeCodeAdapter();
    await expect(
      adapter.execute(makePlan(), makeSnapshot(), makeContext())
    ).rejects.toThrow(/error_max_turns/);
  });

  it("parses token usage from the stream", async () => {
    spawnSafeMock.mockResolvedValue({
      exitCode: 0, stdout: EXECUTE_STREAM, stderr: "", durationMs: 800,
    });
    const adapter = new ClaudeCodeAdapter();
    const result = await adapter.execute(
      makePlan(), makeSnapshot(), makeContext()
    );
    expect(result.token_usage.input_total).toBe(1000);
    expect(result.token_usage.output_total).toBe(350);
  });

  it("throws ExecuteFailedError on non-zero exit code", async () => {
    spawnSafeMock.mockResolvedValue({
      exitCode: 1, stdout: "", stderr: "fail", durationMs: 200,
    });
    const adapter = new ClaudeCodeAdapter();
    await expect(
      adapter.execute(makePlan(), makeSnapshot(), makeContext())
    ).rejects.toThrow(ExecuteFailedError);
  });
});
